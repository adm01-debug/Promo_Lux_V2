import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TRASH_LABEL_COLUMN, type SoftDeleteTable } from "../withOrg";

/**
 * TESTE DE SINCRONIA DO MAPA DE RÓTULOS DA LIXEIRA (G31-2).
 *
 * `RecycleBinView` monta o `select` da lixeira como `id, <rotulo>, deleted_at`
 * a partir de `TRASH_LABEL_COLUMN`. Um nome de coluna presumido derruba a aba
 * inteira: foi o que acontecia com `deals`, que tem a coluna `title` e estava
 * mapeada como `name`. A verdade aqui é o tipo gerado `../types.ts` — sem
 * banco e sem mock, a coluna tem de existir no `Row` da tabela.
 */

const CAMINHO_TIPOS = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "types.ts",
);

const TIPOS = readFileSync(CAMINHO_TIPOS, "utf8");

/** Colunas do bloco `Row` de uma tabela, lidas do tipo gerado. */
function colunasDoRow(tabela: string): Set<string> {
  const bloco = new RegExp(
    `\\n {6}%s: \\{\\n([\\s\\S]*?)\\n {6}\\}\\n`.replace("%s", tabela),
  ).exec(TIPOS);
  if (!bloco) throw new Error(`types.ts nao tem a tabela ${tabela}`);
  const row = / {8}Row: \{([\s\S]*?)\n {8}\}/.exec(bloco[1]);
  if (!row) throw new Error(`types.ts nao tem Row de ${tabela}`);
  return new Set([...row[1].matchAll(/\n {10}(\w+)\??:/g)].map((m) => m[1]));
}

const ENTRADAS = Object.entries(TRASH_LABEL_COLUMN) as [
  SoftDeleteTable,
  string,
][];

describe("TRASH_LABEL_COLUMN ↔ types.ts", () => {
  it("cobre as oito tabelas com soft delete", () => {
    expect(Object.keys(TRASH_LABEL_COLUMN).sort()).toEqual([
      "api_keys",
      "campaigns",
      "companies",
      "deals",
      "email_accounts",
      "email_suppressions",
      "webhooks",
      "workflows",
    ]);
  });

  it.each(ENTRADAS)(
    "a coluna de rotulo de %s (%s) existe no schema",
    (tabela, coluna) => {
      expect(
        [...colunasDoRow(tabela)],
        `${tabela}: a coluna "${coluna}" de TRASH_LABEL_COLUMN nao existe em types.ts`,
      ).toContain(coluna);
    },
  );

  it("deals usa title, nao name", () => {
    expect(TRASH_LABEL_COLUMN.deals).toBe("title");
    expect([...colunasDoRow("deals")]).not.toContain("name");
  });
});
