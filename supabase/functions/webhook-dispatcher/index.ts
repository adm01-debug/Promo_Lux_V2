// Picks pending/retrying webhook_deliveries and sends them with HMAC signature.
// Retry policy: exponential backoff up to 5 attempts.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { assertSafeOutboundUrl } from "../_shared/ssrf-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const MAX_ATTEMPTS = 5;
const BATCH = 25;

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function nextRetry(attempts: number): Date {
  // 30s, 2m, 8m, 30m
  const minutes = Math.min(30, Math.pow(4, attempts) / 8);
  return new Date(Date.now() + minutes * 60 * 1000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // If a single delivery_id is provided, process only it (manual replay) —
  // ainda assim precisa estar pending/retrying e dentro do limite de
  // tentativas: sem isso, replay manual reenviava entregas já concluídas
  // (status='success') ou já esgotadas (attempts>=MAX_ATTEMPTS).
  let deliveryIds: string[] | null = null;
  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    if (body?.delivery_id) deliveryIds = [body.delivery_id];
  }

  let candidatesQ = supabase
    .from("webhook_deliveries")
    .select("id")
    .in("status", ["pending", "retrying"])
    .lt("attempts", MAX_ATTEMPTS);
  candidatesQ = deliveryIds
    ? candidatesQ.in("id", deliveryIds)
    : candidatesQ.lte("next_retry_at", new Date().toISOString()).limit(BATCH);

  const { data: candidates, error: candErr } = await candidatesQ;
  if (candErr) {
    return new Response(JSON.stringify({ error: candErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const candidateIds = (candidates ?? []).map((c) => c.id as string);

  // Claim atômico: só as linhas que AINDA estiverem pending/retrying no
  // momento exato deste UPDATE são travadas (status='sending'). Uma segunda
  // invocação concorrente (cron sobreposto + replay manual, por exemplo) vai
  // re-checar a mesma condição após esperar o lock da primeira e não vai
  // mais encontrar essas linhas — evita envio duplicado da mesma entrega.
  let deliveries = [];
  if (candidateIds.length > 0) {
    const { data: claimed, error: claimErr } = await supabase
      .from("webhook_deliveries")
      .update({ status: "sending" })
      .in("id", candidateIds)
      .in("status", ["pending", "retrying"])
      .select("*");
    if (claimErr) {
      return new Response(JSON.stringify({ error: claimErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    deliveries = claimed ?? [];
  }

  const results: Array<Record<string, unknown>> = [];

  for (const d of deliveries ?? []) {
    const { data: wh } = await supabase.from("webhooks").select("*").eq("id", d.webhook_id).maybeSingle();
    if (!wh || !wh.active) {
      await supabase.from("webhook_deliveries").update({
        status: "failed", error_message: "Webhook disabled or missing", attempts: d.attempts + 1,
      }).eq("id", d.id);
      results.push({ id: d.id, status: "skipped" });
      continue;
    }

    const payloadStr = JSON.stringify(d.payload);
    const signature = await hmacHex(wh.secret, payloadStr);
    const attempts = d.attempts + 1;

    // SSRF guard: a URL do webhook é fornecida pelo dono do webhook e não é
    // revalidada desde o cadastro. Sem checar de novo aqui, um usuário
    // poderia apontar para http://169.254.169.254/... (metadata da cloud) ou
    // um host interno e usar esta função como proxy para a rede interna do
    // provedor — a checagem roda a cada envio (não só no cadastro) porque o
    // DNS do host pode mudar depois de criado.
    const urlCheck = await assertSafeOutboundUrl(wh.url);
    if (!urlCheck.safe) {
      await supabase.from("webhook_deliveries").update({
        status: "failed",
        attempts,
        error_message: `URL de destino bloqueada (${urlCheck.reason})`,
        next_retry_at: null,
      }).eq("id", d.id);
      results.push({ id: d.id, status: "blocked", reason: urlCheck.reason });
      continue;
    }

    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(wh.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Event": d.event,
          "X-Webhook-Signature": `sha256=${signature}`,
          "X-Webhook-Delivery": d.id,
        },
        body: payloadStr,
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      const text = await res.text().catch(() => "");
      const ok = res.status >= 200 && res.status < 300;

      if (ok) {
        await supabase.from("webhook_deliveries").update({
          status: "success", status_code: res.status, response_body: text.slice(0, 2000),
          attempts, delivered_at: new Date().toISOString(), error_message: null, next_retry_at: null,
        }).eq("id", d.id);
        await supabase.from("webhooks").update({
          total_sent: (wh.total_sent ?? 0) + 1, last_triggered_at: new Date().toISOString(),
        }).eq("id", wh.id);
      } else {
        const isFinal = attempts >= MAX_ATTEMPTS;
        await supabase.from("webhook_deliveries").update({
          status: isFinal ? "failed" : "retrying",
          status_code: res.status,
          response_body: text.slice(0, 2000),
          attempts,
          next_retry_at: isFinal ? null : nextRetry(attempts).toISOString(),
          error_message: `HTTP ${res.status}`,
        }).eq("id", d.id);
        if (isFinal) {
          await supabase.from("webhooks").update({ total_failed: (wh.total_failed ?? 0) + 1 }).eq("id", wh.id);
        }
      }
      results.push({ id: d.id, status: ok ? "success" : "failed", code: res.status });
    } catch (e) {
      const isFinal = attempts >= MAX_ATTEMPTS;
      const msg = e instanceof Error ? e.message : String(e);
      await supabase.from("webhook_deliveries").update({
        status: isFinal ? "failed" : "retrying",
        attempts,
        next_retry_at: isFinal ? null : nextRetry(attempts).toISOString(),
        error_message: msg,
      }).eq("id", d.id);
      if (isFinal) {
        await supabase.from("webhooks").update({ total_failed: (wh.total_failed ?? 0) + 1 }).eq("id", wh.id);
      }
      results.push({ id: d.id, status: "error", error: msg });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});