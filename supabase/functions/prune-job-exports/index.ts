import { createClient } from "npm:@supabase/supabase-js@2";
import { isCronAuthorized } from "../_shared/cron-auth.ts";

/**
 * Expurgo dos CSVs guardados em `job-exports` (ADR de retencao).
 *
 * Motivo: a partir do momento em que o export passou a gravar o arquivo no
 * bucket privado, cada clique deixou um CSV com nome/telefone/e-mail de lead
 * parado para sempre. O dado em si continua em `scrape_results` (o CSV e
 * derivado e pode ser gerado de novo em um clique), entao apagar o arquivo
 * antigo nao perde informacao - so encerra a copia esquecida.
 *
 * Por que uma edge function e nao SQL: DELETE direto em `storage.objects` nao
 * remove o byte do backend. O arquivo tem de sair pela Storage API, e isso
 * exige a service role.
 *
 * O que faz, em lote:
 *   1. seleciona `job_exports` com `file_url` e `created_at` mais velho que a
 *      retencao (padrao 90 dias, ajustavel pelo corpo do POST);
 *   2. remove os objetos do bucket pela Storage API;
 *   3. marca as linhas como `expired` e zera `file_url` - o historico de quem
 *      exportou o que continua intacto, so o arquivo deixa de existir.
 *
 * Idempotente: se a remocao do objeto der certo e o UPDATE falhar, a proxima
 * execucao tenta de novo (o `remove` de objeto inexistente nao da erro).
 */
const BUCKET = "job-exports";
const RETENCAO_DIAS_PADRAO = 90;
const LOTE = 500;
const FATIA = 100;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (!isCronAuthorized(req)) {
    return json(401, { error: "Unauthorized" });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Use POST" });
  }

  const corpo = await req.json().catch(() => ({}));
  const pedido = Number((corpo as { retencao_dias?: unknown })?.retencao_dias ?? RETENCAO_DIAS_PADRAO);
  const dias = Number.isFinite(pedido)
    ? Math.min(Math.max(Math.trunc(pedido), 7), 3650)
    : RETENCAO_DIAS_PADRAO;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const corte = new Date(Date.now() - dias * 86_400_000).toISOString();

    const { data: linhas, error: leituraErro } = await supabase
      .from("job_exports")
      .select("id, file_url")
      .not("file_url", "is", null)
      .lt("created_at", corte)
      .order("created_at", { ascending: true })
      .limit(LOTE);

    if (leituraErro) throw new Error(`job_exports: ${leituraErro.message}`);

    const candidatos = (linhas ?? []).filter(
      (l): l is { id: string; file_url: string } =>
        typeof l.file_url === "string" && l.file_url.length > 0,
    );

    if (candidatos.length === 0) {
      return json(200, { ok: true, dias, candidatos: 0, removidos: 0, expirados: 0, pendentes: 0 });
    }

    // So marca o que saiu de verdade: zerar `file_url` de um arquivo que
    // continua no bucket apagaria o unico ponteiro para o byte orfao.
    const apagados: string[] = [];
    let erroStorage = "";

    for (let i = 0; i < candidatos.length; i += FATIA) {
      const trecho = candidatos.slice(i, i + FATIA);
      const caminhos = trecho.map((l) => l.file_url);
      const { error: storageErro } = await supabase.storage.from(BUCKET).remove(caminhos);
      if (storageErro) {
        erroStorage = storageErro.message;
        console.error(JSON.stringify({ etapa: "storage", erro: storageErro.message, n: caminhos.length }));
        continue;
      }
      apagados.push(...trecho.map((l) => l.id));
    }

    let expirados = 0;
    let erroUpdate = "";
    const ids = apagados;
    for (let i = 0; i < ids.length; i += FATIA) {
      const trecho = ids.slice(i, i + FATIA);
      const { error: updateErro } = await supabase
        .from("job_exports")
        .update({ file_url: null, status: "expired" })
        .in("id", trecho);
      if (updateErro) {
        erroUpdate = updateErro.message;
        console.error(JSON.stringify({ etapa: "job_exports:update", erro: updateErro.message, n: trecho.length }));
        continue;
      }
      expirados += trecho.length;
    }

    const resultado = {
      ok: expirados > 0,
      dias,
      candidatos: candidatos.length,
      removidos: apagados.length,
      expirados,
      pendentes: candidatos.length - apagados.length,
      lote_cheio: candidatos.length === LOTE,
      erro_storage: erroStorage || undefined,
      erro_update: erroUpdate || undefined,
    };

    if (expirados === 0) {
      return json(500, resultado);
    }
    return json(200, resultado);
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e);
    console.error(JSON.stringify({ etapa: "geral", erro: mensagem }));
    return json(500, { ok: false, error: mensagem });
  }
});