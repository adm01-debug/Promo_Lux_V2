// Worker de reprocessamento da fila `cnpj_enrich_queue`.
// Acionado por cron (a cada 2min). Faz claim atômico via RPC, respeita o
// rate-limit compartilhado e aplica backoff exponencial em falhas transitórias.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CNPJA_API_KEY = Deno.env.get("CNPJA_API_KEY");

const TTL_SUCCESS_MS = 30 * 24 * 60 * 60 * 1000;
const TTL_NOT_FOUND_MS = 24 * 60 * 60 * 1000;
const LIMIT_AUTH_RPM = Number(Deno.env.get("CNPJA_LIMIT_RPM") ?? 60);
const LIMIT_OPEN_RPM = Number(Deno.env.get("CNPJA_OPEN_LIMIT_RPM") ?? 5);
const BATCH_SIZE = Number(Deno.env.get("CNPJ_WORKER_BATCH") ?? 10);

interface QueueRow {
  id: string; cnpj: string; attempts: number; max_attempts: number;
  requested_by: string | null; source: string | null;
}

const formatCnpj = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
function formatCnaeCode(id?: number): string | null {
  if (!id) return null;
  const s = String(id).padStart(7, "0");
  return `${s.slice(0, 4)}-${s.slice(4, 5)}/${s.slice(5)}`;
}
function formatPhone(p?: { area?: string; number?: string }): string | null {
  if (!p?.number) return null;
  const area = p.area ?? ""; const num = p.number;
  if (num.length === 9) return `(${area}) ${num.slice(0, 5)}-${num.slice(5)}`;
  if (num.length === 8) return `(${area}) ${num.slice(0, 4)}-${num.slice(4)}`;
  return `(${area}) ${num}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function normalize(raw: any, cnpjClean: string) {
  const addr = raw.address ?? {};
  const fullAddress = [
    addr.street && `${addr.street}${addr.number ? `, ${addr.number}` : ""}`,
    addr.details, addr.district,
    addr.city && addr.state ? `${addr.city} - ${addr.state}` : addr.city || addr.state,
    addr.zip,
  ].filter(Boolean).join(", ");
  const members = (raw.company?.members ?? [])
    .map((m: any) => ({ name: m.person?.name ?? null, role: m.role?.text ?? null, since: m.since ?? null }))
    .filter((m: any) => m.name);
  return {
    cnpj: formatCnpj(cnpjClean),
    name: raw.company?.name ?? null, alias: raw.alias ?? null,
    founded: raw.founded ?? null, status: raw.status?.text ?? null,
    equity: raw.company?.equity ?? null, size: raw.company?.size?.text ?? null,
    sector: raw.mainActivity?.text ?? null,
    cnae_code: formatCnaeCode(raw.mainActivity?.id),
    cnae_text: raw.mainActivity?.text ?? null,
    activities: (raw.sideActivities ?? []).map((a: any) => a.text).filter(Boolean),
    activities_full: (raw.sideActivities ?? [])
      .map((a: any) => ({ code: formatCnaeCode(a.id), text: a.text ?? null }))
      .filter((a: any) => a.code || a.text),
    members,
    location: [addr.city, addr.state].filter(Boolean).join(" - ") || null,
    address: fullAddress || null,
    zip: addr.zip ?? null,
    phone: formatPhone(raw.phones?.[0]),
    email: raw.emails?.[0]?.address ?? null,
  };
}

async function callProvider(cnpjClean: string, useAuth: boolean): Promise<Response> {
  const url = useAuth
    ? `https://api.cnpja.com/office/${cnpjClean}`
    : `https://open.cnpja.com/office/${cnpjClean}`;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 15_000);
  try {
    return await fetch(url, {
      headers: useAuth
        ? { Authorization: CNPJA_API_KEY!, Accept: "application/json" }
        : { Accept: "application/json" },
      signal: ctrl.signal,
    });
  } finally { clearTimeout(to); }
}

function backoffSeconds(attempts: number): number {
  // 30s, 60s, 2m, 4m, 8m (cap 15m) + jitter até 20%
  const base = Math.min(30 * Math.pow(2, attempts - 1), 15 * 60);
  return Math.floor(base * (1 + Math.random() * 0.2));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const traceId = crypto.randomUUID();
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const useAuth = !!CNPJA_API_KEY;
  const source = useAuth ? "cnpja" : "cnpja_open";
  const limit = useAuth ? LIMIT_AUTH_RPM : LIMIT_OPEN_RPM;

  const summary = { claimed: 0, completed: 0, retried: 0, failed: 0, not_found: 0, skipped: 0 };

  try {
    const { data: jobs, error } = await admin.rpc("cnpj_claim_enrich_jobs", { _limit: BATCH_SIZE });
    if (error) throw error;
    const rows = (jobs ?? []) as QueueRow[];
    summary.claimed = rows.length;

    for (const job of rows) {
      // Rate-limit por chamada — se estourar, retorna para pending
      const { data: allowed } = await admin.rpc("cnpj_reserve_rate_slot", {
        _source: source, _limit_per_minute: limit,
      });
      if (!allowed) {
        await admin.from("cnpj_enrich_queue").update({
          status: "pending",
          attempts: job.attempts - 1, // não conta essa tentativa
          next_retry_at: new Date(Date.now() + 30_000).toISOString(),
          last_error: "worker_rate_limited",
        }).eq("id", job.id);
        summary.skipped++;
        continue;
      }

      try {
        const res = await callProvider(job.cnpj, useAuth);

        if (res.status === 404) {
          await admin.from("cnpj_enrich_cache").upsert({
            cnpj: job.cnpj, source, status: "not_found", payload: null,
            expires_at: new Date(Date.now() + TTL_NOT_FOUND_MS).toISOString(),
          });
          await admin.from("cnpj_enrich_queue").update({
            status: "not_found", last_error: null, source,
          }).eq("id", job.id);
          summary.not_found++;
          continue;
        }

        if (res.status === 429 || res.status >= 500) {
          const details = await res.text().catch(() => "");
          if (job.attempts >= job.max_attempts) {
            await admin.from("cnpj_enrich_queue").update({
              status: "failed",
              last_error: `provider_${res.status}: ${details.slice(0, 300)}`,
              source,
            }).eq("id", job.id);
            summary.failed++;
          } else {
            await admin.from("cnpj_enrich_queue").update({
              status: "pending",
              next_retry_at: new Date(Date.now() + backoffSeconds(job.attempts) * 1000).toISOString(),
              last_error: `provider_${res.status}`,
              source,
            }).eq("id", job.id);
            summary.retried++;
          }
          continue;
        }

        if (!res.ok) {
          const details = await res.text().catch(() => "");
          await admin.from("cnpj_enrich_queue").update({
            status: "failed",
            last_error: `provider_${res.status}: ${details.slice(0, 300)}`,
            source,
          }).eq("id", job.id);
          summary.failed++;
          continue;
        }

        const raw = await res.json();
        const data = normalize(raw, job.cnpj);
        await admin.from("cnpj_enrich_cache").upsert({
          cnpj: job.cnpj, source, status: "success", payload: data,
          expires_at: new Date(Date.now() + TTL_SUCCESS_MS).toISOString(),
        });
        await admin.from("cnpj_enrich_queue").update({
          status: "completed", result: data, last_error: null, source,
        }).eq("id", job.id);
        summary.completed++;
      } catch (err) {
        const msg = (err as Error).message ?? String(err);
        if (job.attempts >= job.max_attempts) {
          await admin.from("cnpj_enrich_queue").update({
            status: "failed", last_error: msg, source,
          }).eq("id", job.id);
          summary.failed++;
        } else {
          await admin.from("cnpj_enrich_queue").update({
            status: "pending",
            next_retry_at: new Date(Date.now() + backoffSeconds(job.attempts) * 1000).toISOString(),
            last_error: msg,
            source,
          }).eq("id", job.id);
          summary.retried++;
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, trace_id: traceId, summary }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(JSON.stringify({ level: "error", trace_id: traceId, err: (err as Error).message }));
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message, trace_id: traceId }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
