// Teste estrutural do caminho de contingencia do proxy (etapa 052 / G16-1).
//
// Quando o scraper externo nao devolve `external_id`, o create cai na Places
// API. Esse caminho marcava o job como concluido sem gravar empresa nenhuma: o
// usuario via resultados contados e a lista de empresas vazia, sem erro, e o
// `sync-results` pagava a mesma consulta de novo. O contrato agora e gravar
// antes de concluir.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fonte = readFileSync(new URL("../index.ts", import.meta.url), "utf8");

/** Corpo do fallback do `create`, entre o gatilho e a gravacao da idempotencia. */
function blocoDoFallback(): string {
  const inicio = fonte.indexOf("if (!externalId) {");
  const fim = fonte.indexOf("idempotency_keys", inicio);
  expect(inicio, "o fallback do create mudou de lugar").toBeGreaterThan(0);
  expect(fim, "o fallback do create mudou de lugar").toBeGreaterThan(inicio);
  return fonte.slice(inicio, fim);
}

describe("gmaps-proxy: contingencia com Places grava antes de concluir", () => {
  it("usa o gravador compartilhado da etapa 051", () => {
    expect(blocoDoFallback()).toContain("saveScrapeResults(");
  });

  it("grava antes de dar o job como concluido", () => {
    const bloco = blocoDoFallback();
    const grava = bloco.indexOf("saveScrapeResults(");
    const conclui = bloco.indexOf('status: "completed"');
    expect(grava).toBeGreaterThan(-1);
    expect(conclui).toBeGreaterThan(grava);
  });

  it("nao conclui a tarefa quando nada foi gravado", () => {
    const bloco = blocoDoFallback();
    expect(bloco).toContain("if (saved === 0)");
    expect(bloco).toContain('status: "failed"');
  });

  it("results_count reflete o que foi gravado, nao o que a API devolveu", () => {
    expect(fonte).not.toContain("results_count: found");
  });
});
