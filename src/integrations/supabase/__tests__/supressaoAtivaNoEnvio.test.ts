import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * GUARDA DA REGRA DE ENVIO (etapa 048 / G31-1).
 *
 * `email_suppressions` passou a ter exclusao reversivel (etapa 047): remover um
 * endereco da lista grava `deleted_at` em vez de apagar. O disparo de campanha
 * usa o client de servico, que nao passa pelo wrapper `db` (o wrapper esconde a
 * lixeira sozinho), entao o filtro precisa estar explicito na consulta. Sem ele
 * um descadastro removido da lista continuaria bloqueando envio para sempre.
 */

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

function fontePlana(caminho: string): string {
  return readFileSync(join(RAIZ, caminho), "utf8").replace(/\s+/g, " ");
}

describe("caminho de envio respeita a lixeira da lista de supressao", () => {
  const fonte = fontePlana("supabase/functions/campaign-dispatch/index.ts");

  it("toda leitura de email_suppressions carrega deleted_at IS NULL", () => {
    const trechos = fonte.split('.from("email_suppressions")').slice(1);
    expect(trechos.length).toBeGreaterThan(0);
    for (const trecho of trechos) {
      const instrucao = trecho.split(";")[0];
      expect(instrucao).toContain('.is("deleted_at", null)');
    }
  });

  it("a consulta de supressao do lote e escopada pela organizacao da campanha", () => {
    const trecho = fonte.split('.from("email_suppressions")')[1].split(";")[0];
    expect(trecho).toContain('.eq("organization_id", campaign.organization_id)');
    expect(trecho).toContain('.in("email", batchEmails)');
  });
});