// deno-lint-ignore-file no-explicit-any
/**
 * instagram-worker — consome instagram_scrape_queue e grava resultados/DLQ.
 *
 * Fluxo:
 *  1) claim_instagram_job(worker_id, batch_size) — reserva tarefas atomicamente.
 *  2) Para cada tarefa: chama HikerClient.fetch* correspondente.
 *  3) Insere linhas em instagram_scrape_results.
 *  4) Marca a tarefa como 'succeeded' OU:
 *       - reagenda com backoff exponencial se erro retryable e attempt < max_attempts;
 *       - senão marca 'dead' e grava em instagram_scrape_dead_letter.
 *
 * Invocação: POST vazio (agendado ou manual). Header opcional `x-worker-id`.
 * Não expõe payload sensível — retorna somente resumo.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { HikerClient, HikerError, computeBackoff } from "../_shared/hiker-client.ts";
import type { NormalizedInstagramItem } from "../_shared/apify-fixtures.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BATCH_SIZE = Number(Deno.env.get("INSTAGRAM_WORKER_BATCH") ?? 3);

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Job = {
  id: string;
  organization_id: string;
  target_type: "profile" | "posts" | "hashtag" | "comments";
  target_value: string;
  params: any;
  attempt: number;
  max_attempts: number;
  trace_id: string;
};

async function runJob(client: HikerClient, job: Job): Promise<NormalizedInstagramItem[]> {
  const limit = Math.max(1, Math.min(1000, Number(job.params?.limit ?? 200)));
  switch (job.target_type) {
    case "profile": return (await client.fetchProfile(job.target_value)).items;
    case "posts": return (await client.fetchPosts(job.target_value, limit)).items;
    case "hashtag": return (await client.fetchHashtag(job.target_value, limit)).items;
    case "comments": return (await client.fetchComments(job.target_value, limit)).items;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const workerId = req.headers.get("x-worker-id") ?? `edge-${crypto.randomUUID().slice(0, 8)}`;
  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // Reserva batch atomicamente
  const { data: jobs, error: claimErr } = await service.rpc("claim_instagram_job", {
    p_worker_id: workerId,
    p_batch_size: BATCH_SIZE,
  });
  if (claimErr) {
    console.error("[instagram-worker] claim failed", claimErr);
    return json(500, { error: "claim_failed", details: claimErr.message });
  }
  const claimed = (jobs ?? []) as Job[];
  if (!claimed.length) return json(200, { worker_id: workerId, processed: 0 });

  const client = new HikerClient();
  const summary: any[] = [];

  for (const job of claimed) {
    const started = Date.now();
    try {
      const items = await runJob(client, job);

      if (items.length) {
        const rows = items.map((n) => ({
          queue_id: job.id,
          organization_id: job.organization_id,
          target_type: job.target_type,
          target_value: job.target_value,
          item_type: n.source_type,
          normalized: n,
          raw: null,
        }));
        const { error: insErr } = await service.from("instagram_scrape_results").insert(rows);
        if (insErr) throw new Error(`results_insert_failed: ${insErr.message}`);
      }

      await service
        .from("instagram_scrape_queue")
        .update({
          status: "succeeded",
          locked_at: null,
          locked_by: null,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      summary.push({
        queue_id: job.id,
        status: "succeeded",
        items: items.length,
        ms: Date.now() - started,
      });
    } catch (err) {
      const hiker = err instanceof HikerError ? err : null;
      const retryable = hiker ? hiker.retryable : true; // erros desconhecidos: retryable
      const attempt = job.attempt; // já foi incrementado pelo claim
      const canRetry = retryable && attempt < job.max_attempts;

      const errorMsg = (err as Error)?.message ?? String(err);
      const errorClass = hiker?.errorClass ?? "unknown";

      if (canRetry) {
        const backoffMs = computeBackoff(
          attempt,
          15_000,
          600_000,
          hiker?.retryAfterMs,
        );
        const nextRun = new Date(Date.now() + backoffMs).toISOString();

        // G6 (Rodada #39): erros puramente de infra (network/timeout) NÃO
        // devem consumir tentativa — indicam problema do worker, não do alvo.
        // Devolvemos `attempt` ao valor anterior ao claim para evitar que uma
        // instabilidade transitória mate a tarefa prematuramente.
        const isInfraTransient =
          errorClass === "network" || errorClass === "timeout";
        const restoredAttempt = isInfraTransient
          ? Math.max(0, attempt - 1)
          : attempt;

        await service
          .from("instagram_scrape_queue")
          .update({
            status: "queued",
            locked_at: null,
            locked_by: null,
            next_run_at: nextRun,
            attempt: restoredAttempt,
            last_error: `[${errorClass}]${isInfraTransient ? "[no-consume]" : ""} ${errorMsg}`.slice(0, 1000),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        summary.push({
          queue_id: job.id,
          status: "retry",
          attempt: restoredAttempt,
          attempt_consumed: !isInfraTransient,
          next_run_at: nextRun,
          error_class: errorClass,
        });
      } else {

        await service
          .from("instagram_scrape_queue")
          .update({
            status: "dead",
            locked_at: null,
            locked_by: null,
            last_error: `[${errorClass}] ${errorMsg}`.slice(0, 1000),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        await service.from("instagram_scrape_dead_letter").insert({
          queue_id: job.id,
          organization_id: job.organization_id,
          target_type: job.target_type,
          target_value: job.target_value,
          params: job.params,
          attempts: attempt,
          last_error: errorMsg.slice(0, 2000),
          error_class: errorClass,
        });
        summary.push({
          queue_id: job.id,
          status: "dead",
          attempt,
          error_class: errorClass,
        });
      }
    }
  }

  return json(200, {
    worker_id: workerId,
    processed: claimed.length,
    results: summary,
  });
});
