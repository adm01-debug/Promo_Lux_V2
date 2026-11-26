// Exporta os leads de um job de raspagem em CSV, respeitando a RLS do usuario.
// Modo criar:    body { job_id: uuid, status?: "all" | "processed" | "unprocessed" }
// Modo rebaixar: body { export_id: uuid }
// O CSV e gravado no bucket privado job-exports com a service role (o cliente nao
// tem acesso ao bucket) e o caminho fica em job_exports.file_url, alem de voltar
// direto na resposta do modo criar.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_ROWS = 20000;
const PAGE = 1000;
const BUCKET = "job-exports";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Colunas conhecidas do lead primeiro; o resto de raw_data entra depois, na ordem em que aparece.
const KNOWN = ["name", "address", "phone", "website", "email", "rating"];

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const esc = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  let s = typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/[;"\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
};

const slug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "job";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Use POST" });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Authorization ausente" });

  const trace_id = crypto.randomUUID();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return json(401, { error: "Sessao invalida", trace_id });
  const userId = userData.user.id;

  // A service role e usada so para o bucket privado. Se ela faltar, o export nao
  // quebra: o CSV continua saindo na resposta, apenas sem arquivo guardado.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const service = serviceKey
    ? createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false } })
    : null;

  let body: { job_id?: string; status?: string; export_id?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "JSON invalido", trace_id });
  }

  // Modo rebaixar: devolve o CSV ja guardado. A RLS de job_exports garante que a
  // linha so aparece para o dono; o objeto em si e lido com a service role.
  const exportId = String(body.export_id ?? "").trim();
  if (exportId) {
    if (!UUID_RE.test(exportId)) return json(400, { error: "export_id invalido", trace_id });
    const { data: exp, error: expErr } = await supabase
      .from("job_exports")
      .select("id, job_id, file_url")
      .eq("id", exportId)
      .maybeSingle();
    if (expErr) return json(500, { error: expErr.message, trace_id });
    if (!exp) return json(404, { error: "Exportacao nao encontrada", trace_id });
    const path = typeof exp.file_url === "string" ? exp.file_url : "";
    if (!path) return json(409, { error: "Exportacao sem arquivo guardado - gere o CSV de novo", trace_id });
    const { data: file, error: dlErr } = service
      ? await service.storage.from(BUCKET).download(path)
      : { data: null, error: { message: "SUPABASE_SERVICE_ROLE_KEY ausente no ambiente" } };
    if (dlErr || !file) return json(500, { error: dlErr?.message ?? "Falha ao ler o arquivo", trace_id });
    const { data: jobRow } = await supabase.from("scrape_jobs").select("name").eq("id", exp.job_id).maybeSingle();
    const name = `leads-${slug(String(jobRow?.name ?? "job"))}-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(file, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Access-Control-Expose-Headers": "Content-Disposition, X-Export-Id, X-Trace-Id",
        "X-Export-Id": exportId,
        "X-Trace-Id": trace_id,
      },
    });
  }

  const jobId = String(body.job_id ?? "").trim();
  if (!UUID_RE.test(jobId)) {
    return json(400, { error: "job_id invalido", trace_id });
  }
  const filter = body.status === "processed" || body.status === "unprocessed" ? body.status : "all";

  const { data: job, error: jobErr } = await supabase
    .from("scrape_jobs")
    .select("id, name, organization_id")
    .eq("id", jobId)
    .maybeSingle();
  if (jobErr) return json(500, { error: jobErr.message, trace_id });
  if (!job) return json(404, { error: "Job nao encontrado", trace_id });

  const rows: Record<string, unknown>[] = [];
  let truncated = false;
  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from("scrape_results")
      .select("id, company_id, processed, raw_data, created_at")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (filter === "processed") q = q.eq("processed", true);
    if (filter === "unprocessed") q = q.or("processed.is.null,processed.eq.false");
    const { data, error } = await q;
    if (error) return json(500, { error: error.message, trace_id });
    const batch = (data ?? []) as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
    if (rows.length >= MAX_ROWS) {
      truncated = rows.length > MAX_ROWS || batch.length === PAGE;
      rows.length = MAX_ROWS;
      break;
    }
  }

  const extra: string[] = [];
  const seen = new Set(KNOWN);
  for (const r of rows) {
    const raw = (r.raw_data ?? {}) as Record<string, unknown>;
    for (const k of Object.keys(raw)) {
      if (!seen.has(k)) {
        seen.add(k);
        extra.push(k);
      }
    }
  }
  const cols = [...KNOWN.filter((k) => seen.has(k)), ...extra];
  const head = ["id", "created_at", "processed", "company_id", ...cols];
  const lines = [head.join(";")];
  for (const r of rows) {
    const raw = (r.raw_data ?? {}) as Record<string, unknown>;
    const values = [r.id, r.created_at, r.processed ? "sim" : "nao", r.company_id ?? "", ...cols.map((c) => raw[c])];
    lines.push(values.map(esc).join(";"));
  }
  const csv = "\uFEFF" + lines.join("\r\n") + "\r\n";

  const { data: recorded, error: recErr } = await supabase
    .from("job_exports")
    .insert({
      job_id: jobId,
      user_id: userId,
      organization_id: job.organization_id ?? null,
      format: "csv",
      status: "pending",
      file_url: null,
    })
    .select("id")
    .maybeSingle();
  if (recErr) console.error(JSON.stringify({ trace_id, etapa: "job_exports", erro: recErr.message }));

  // Guarda o arquivo no bucket privado: o historico passa a ter o CSV, nao so a linha.
  // Falha de storage nao derruba a resposta - o CSV continua indo no corpo.
  let stored = false;
  const createdId = recorded?.id ? String(recorded.id) : "";
  if (createdId) {
    const path = `${userId}/${jobId}/${createdId}.csv`;
    const { error: upErr } = service
      ? await service.storage
        .from(BUCKET)
        .upload(path, new Blob([csv], { type: "text/csv; charset=utf-8" }), { upsert: true })
      : { error: { message: "SUPABASE_SERVICE_ROLE_KEY ausente no ambiente" } };
    if (upErr) {
      console.error(JSON.stringify({ trace_id, etapa: "storage", erro: upErr.message }));
      await supabase.from("job_exports").update({ status: "failed" }).eq("id", createdId);
    } else {
      const { error: updErr } = await supabase
        .from("job_exports")
        .update({ file_url: path, status: "completed" })
        .eq("id", createdId);
      if (updErr) console.error(JSON.stringify({ trace_id, etapa: "job_exports:update", erro: updErr.message }));
      stored = !updErr;
    }
  }

  const filename = `leads-${slug(String(job.name ?? "job"))}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Access-Control-Expose-Headers":
        "Content-Disposition, X-Export-Id, X-Export-Rows, X-Export-Truncated, X-Export-Recorded, X-Export-Stored, X-Trace-Id",
      "X-Export-Id": createdId,
      "X-Export-Rows": String(rows.length),
      "X-Export-Truncated": truncated ? "1" : "0",
      "X-Export-Recorded": recErr ? "0" : "1",
      "X-Export-Stored": stored ? "1" : "0",
      "X-Trace-Id": trace_id,
    },
  });
});