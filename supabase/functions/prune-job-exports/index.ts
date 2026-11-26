import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { isCronAuthorized } from "../_shared/cron-auth.ts";
import { selecionarOrfaos, type Arquivo } from "./regras.ts";

/**
 * Expurgo do bucket `job-exports` (retencao dos CSVs de exportacao de leads).
 *
 * Motivo: desde que o export passou a gravar o CSV no bucket privado, cada
 * clique deixou um arquivo com nome/telefone/e-mail de lead parado para
 * sempre. O dado em si continua em `scrape_results` (o CSV e derivado e sai
 * de novo em um clique), entao apagar o arquivo antigo nao perde informacao -
 * so encerra a copia esquecida.
 *
 * Por que uma edge function e nao SQL: DELETE em `storage.objects` nao remove
 * o byte do backend. O arquivo tem de sair pela Storage API, com service role.
 *
 * Duas passadas, independentes:
 *   1. RETENCAO - `job_exports` com `file_url` e `created_at` mais velho que a
 *      retencao (padrao 90 dias): apaga o objeto e marca a linha como
 *      `expired` com `file_url = null`. O historico de quem exportou o que
 *      continua intacto; some apenas o arquivo.
 *   2. ORFAOS - arquivos no bucket que nao tem linha nenhuma apontando para
 *      eles. O bucket nao tem policy em `storage.objects` e o unico caminho
 *      ate o arquivo e a linha em `job_exports`, logo um orfao e inalcancavel
 *      pela aplicacao: e byte morto segurando dado pessoal. So sao apagados
 *      depois de listar o bucket INTEIRO e ler TODAS as linhas com sucesso, e
 *      apenas se forem mais velhos que a retencao - um upload feito entre a
 *      consulta e a listagem nunca entra na conta.
 *
 * Idempotente: se o objeto sai e o UPDATE falha, a proxima execucao repara
 * (remover objeto inexistente nao da erro) e a linha continua intacta ate la.
 */
const BUCKET = "job-exports";
const RETENCAO_DIAS_PADRAO = 90;
const LOTE = 500;
const FATIA = 100;
const PAGINA_LIST = 1000;
const PAGINA_DB = 1000;
const MAX_PROFUNDIDADE = 5;
const MAX_ENTRADAS = 50_000;

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

  const corpo = await req.json().catch(() => ({})) as { retencao_dias?: unknown; dry_run?: unknown };
  const pedido = Number(corpo?.retencao_dias ?? RETENCAO_DIAS_PADRAO);
  const dias = Number.isFinite(pedido)
    ? Math.min(Math.max(Math.trunc(pedido), 7), 3650)
    : RETENCAO_DIAS_PADRAO;
  const simular = corpo?.dry_run === true;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const corte = new Date(Date.now() - dias * 86_400_000).toISOString();

    const retencao = await expurgarPorRetencao(supabase, corte, dias, simular);
    const orfaos = await expurgarOrfaos(supabase, corte, dias, simular);

    const resultado = {
      ok: retencao.expirados > 0 || orfaos.removidos > 0 || (retencao.candidatos === 0 && orfaos.candidatos === 0),
      dry_run: simular,
      dias,
      retencao,
      orfaos,
    };

    // 500 quando havia trabalho e nada pode ser feito, para o erro aparecer na
    // trilha de `net._http_response` em vez de sumir num 200.
    const nadaFeito = (retencao.candidatos > 0 && retencao.expirados === 0) ||
      (orfaos.candidatos > 0 && orfaos.removidos === 0);
    return json(nadaFeito ? 500 : 200, resultado);
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e);
    console.error(JSON.stringify({ etapa: "geral", erro: mensagem }));
    return json(500, { ok: false, error: mensagem });
  }
});

type Cliente = SupabaseClient;

/** Passada 1: linhas vencidas -> apaga o objeto -> marca `expired`. */
async function expurgarPorRetencao(
  supabase: Cliente,
  corte: string,
  dias: number,
  simular: boolean,
) {
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
  if (candidatos.length === 0 || simular) {
    return { dias, candidatos: candidatos.length, removidos: 0, expirados: 0, pendentes: candidatos.length, lote_cheio: candidatos.length === LOTE };
  }

  // So marca o que saiu de verdade: zerar `file_url` de um arquivo que
  // continua no bucket apagaria o unico ponteiro para o byte orfao.
  const apagados: string[] = [];
  let erroStorage = "";

  for (let i = 0; i < candidatos.length; i += FATIA) {
    const trecho = candidatos.slice(i, i + FATIA);
    const { error: storageErro } = await supabase.storage
      .from(BUCKET)
      .remove(trecho.map((l) => l.file_url));
    if (storageErro) {
      erroStorage = storageErro.message;
      console.error(JSON.stringify({ etapa: "storage", erro: storageErro.message, n: trecho.length }));
      continue;
    }
    apagados.push(...trecho.map((l) => l.id));
  }

  let expirados = 0;
  let erroUpdate = "";
  for (let i = 0; i < apagados.length; i += FATIA) {
    const trecho = apagados.slice(i, i + FATIA);
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

  return {
    dias,
    candidatos: candidatos.length,
    removidos: apagados.length,
    expirados,
    pendentes: candidatos.length - apagados.length,
    lote_cheio: candidatos.length === LOTE,
    erro_storage: erroStorage || undefined,
    erro_update: erroUpdate || undefined,
  };
}

type ItemBucket = { name: string; id?: string | null; created_at?: string; updated_at?: string };

/**
 * Passada 2: arquivos sem linha correspondente.
 *
 * Fail-closed: qualquer falha de listagem ou de leitura do banco aborta a
 * varredura inteira com `varredura_ok = false` e ZERO remocoes. Apagar em cima
 * de uma listagem parcial e a unica forma de matar arquivo valido.
 */
async function expurgarOrfaos(
  supabase: Cliente,
  corte: string,
  dias: number,
  simular: boolean,
) {
  const arquivos: Arquivo[] = [];
  let varreduraOk = true;
  let erro = "";
  let truncado = false;

  async function andar(prefixo: string, profundidade: number): Promise<void> {
    if (profundidade > MAX_PROFUNDIDADE) return;
    let offset = 0;
    while (varreduraOk) {
      const { data, error } = await supabase.storage.from(BUCKET).list(prefixo || undefined, {
        limit: PAGINA_LIST,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) {
        varreduraOk = false;
        erro = `storage.list(${prefixo || "/"}): ${error.message}`;
        console.error(JSON.stringify({ etapa: "storage:list", erro: error.message, prefixo }));
        return;
      }
      const itens = (data ?? []) as ItemBucket[];
      for (const item of itens) {
        const caminho = prefixo ? `${prefixo}/${item.name}` : item.name;
        // Pasta vem sem `id`; arquivo sempre tem.
        if (!item.id) {
          await andar(caminho, profundidade + 1);
          if (!varreduraOk) return;
          continue;
        }
        const idade = item.created_at ?? item.updated_at ?? new Date().toISOString();
        arquivos.push({ caminho, idade });
        if (arquivos.length >= MAX_ENTRADAS) {
          truncado = true;
          varreduraOk = false;
          return;
        }
      }
      if (itens.length < PAGINA_LIST) return;
      offset += PAGINA_LIST;
    }
  }

  await andar("", 0);

  // Teto atingido tambem aborta: listar so metade e o mesmo que listar nada.
  if (truncado) {
    console.error(JSON.stringify({ etapa: "storage:list", erro: "teto de entradas atingido", max: MAX_ENTRADAS }));
    return { dias, varredura_ok: false, arquivos: arquivos.length, candidatos: 0, removidos: 0, erro: "teto de entradas atingido" };
  }
  if (!varreduraOk) {
    return { dias, varredura_ok: false, arquivos: arquivos.length, candidatos: 0, removidos: 0, erro };
  }

  const conhecidos = new Set<string>();
  let logico = 0;
  while (true) {
    const { data, error } = await supabase
      .from("job_exports")
      .select("file_url")
      .not("file_url", "is", null)
      .order("id", { ascending: true })
      .range(logico, logico + PAGINA_DB - 1);
    if (error) {
      console.error(JSON.stringify({ etapa: "job_exports:orfaos", erro: error.message }));
      return { dias, varredura_ok: false, arquivos: arquivos.length, candidatos: 0, removidos: 0, erro: `job_exports: ${error.message}` };
    }
    const pagina = data ?? [];
    for (const linha of pagina) {
      if (typeof linha.file_url === "string") conhecidos.add(linha.file_url);
    }
    if (pagina.length < PAGINA_DB) break;
    logico += PAGINA_DB;
  }

  // As travas vivem em `regras.ts` (testadas em __tests__): so arquivo com
  // extensao, sem linha apontando e mais velho que a retencao - arquivo novo
  // nunca entra, mesmo que tenha sobrado de um upload interrompido agora.
  const candidatos = selecionarOrfaos(arquivos, conhecidos, corte, LOTE);

  if (candidatos.length === 0 || simular) {
    return {
      dias,
      varredura_ok: true,
      arquivos: arquivos.length,
      conhecidos: conhecidos.size,
      candidatos: candidatos.length,
      removidos: 0,
      lote_cheio: candidatos.length === LOTE,
    };
  }

  let removidos = 0;
  let erroRemocao = "";
  for (let i = 0; i < candidatos.length; i += FATIA) {
    const trecho = candidatos.slice(i, i + FATIA);
    const { error: rmErro } = await supabase.storage.from(BUCKET).remove(trecho.map((c) => c.caminho));
    if (rmErro) {
      erroRemocao = rmErro.message;
      console.error(JSON.stringify({ etapa: "storage:remove-orfao", erro: rmErro.message, n: trecho.length }));
      continue;
    }
    removidos += trecho.length;
  }

  return {
    dias,
    varredura_ok: true,
    arquivos: arquivos.length,
    conhecidos: conhecidos.size,
    candidatos: candidatos.length,
    removidos,
    lote_cheio: candidatos.length === LOTE,
    erro: erroRemocao || undefined,
  };
}