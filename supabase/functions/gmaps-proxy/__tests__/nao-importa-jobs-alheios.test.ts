// Teste estrutural do action de listagem do proxy (etapa 054 / G16-3).
//
// A listagem de jobs do fornecedor e compartilhada entre clientes e nao aceita
// credencial: o codigo importava TODO job devolvido como se fosse do usuario
// que pediu, entao o cliente via nome e config das buscas de outro cliente. O
// contrato agora e usar a listagem apenas para atualizar o estado dos jobs que
// a organizacao ja tem, casados pelo `external_id` local.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fonte = readFileSync(new URL("../index.ts", import.meta.url), "utf8");

/** Laco que cruza a listagem do fornecedor com os jobs locais. */
function blocoDaListagem(): string {
  const inicio = fonte.indexOf("externalJobs = await res.json();");
  const fim = fonte.indexOf("const { data: dbJobs");
  expect(inicio, "o laco da listagem mudou de lugar").toBeGreaterThan(0);
  expect(fim, "o laco da listagem mudou de lugar").toBeGreaterThan(inicio);
  return fonte.slice(inicio, fim);
}

describe("gmaps-proxy: listagem do fornecedor nao importa jobs alheios", () => {
  it("nao insere job novo a partir da listagem compartilhada", () => {
    expect(blocoDaListagem()).not.toContain('.from("scrape_jobs").insert(');
  });

  it("casa o job local pela organizacao, nao pelo usuario que pediu", () => {
    const bloco = blocoDaListagem();
    expect(bloco).toContain('.eq("organization_id", userOrgId)');
    expect(bloco).not.toContain('.eq("user_id", userId)');
  });

  it("atualiza o estado do job local pelo id", () => {
    expect(blocoDaListagem()).toContain('.eq("id", existing.id)');
  });

  it("registra o job externo que nao tem vinculo local", () => {
    expect(blocoDaListagem()).toContain("external_job_sem_vinculo_local");
  });
});
