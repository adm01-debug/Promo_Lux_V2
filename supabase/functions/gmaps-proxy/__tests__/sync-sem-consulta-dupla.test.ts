// Teste estrutural da sincronizacao de resultados (etapa 053 / G16-1).
//
// O `sync-results` foi escrito como "buscar de novo": para um job cujo fallback
// ja pagou a Places API e gravou as empresas, o auto_sync chamava a MESMA busca
// paga outra vez para chegar ao mesmo resultado. O contrato agora e reconciliar
// o que ja esta gravado antes de qualquer chamada externa.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fonte = readFileSync(new URL("../index.ts", import.meta.url), "utf8");

/** Corpo do `sync-results`, ate o proximo action. */
function blocoDoSync(): string {
  const inicio = fonte.indexOf('action === "sync-results"');
  const fim = fonte.indexOf('action === "export"');
  expect(inicio, "o sync-results mudou de lugar").toBeGreaterThan(0);
  expect(fim, "o sync-results mudou de lugar").toBeGreaterThan(inicio);
  return fonte.slice(inicio, fim);
}

describe("gmaps-proxy: sync-results nao paga duas vezes pela mesma busca", () => {
  it("confere o que ja esta gravado antes de chamar o provedor", () => {
    const bloco = blocoDoSync();
    const guarda = bloco.indexOf('from("scrape_results")');
    const places = bloco.indexOf("fetchPlacesResults(");
    const download = bloco.indexOf("/download");
    expect(guarda, "o guard de resultados gravados sumiu").toBeGreaterThan(-1);
    expect(places).toBeGreaterThan(guarda);
    expect(download).toBeGreaterThan(guarda);
  });

  it("conta sem baixar as linhas", () => {
    const bloco = blocoDoSync();
    expect(bloco).toContain('count: "exact"');
    expect(bloco).toContain("head: true");
  });

  it("devolve o sync reconciliado, sem inventar empresas criadas", () => {
    const bloco = blocoDoSync();
    expect(bloco).toContain("reconciled: true");
    expect(bloco).toContain("companies_created: 0");
  });
});
