import { assertEquals } from "jsr:@std/assert@1";
import { ehArquivoApagavel, selecionarOrfaos, type Arquivo } from "../regras.ts";

const CORTE = "2026-09-01T00:00:00.000Z";
const VELHO = "2026-06-01T00:00:00.000Z";
const NOVO = "2026-11-20T00:00:00.000Z";

function arq(caminho: string, idade = VELHO): Arquivo {
  return { caminho, idade };
}

Deno.test("arquivo com linha no banco nunca e candidato", () => {
  const caminho = "u1/j1/e1.csv";
  const achados = selecionarOrfaos([arq(caminho)], new Set([caminho]), CORTE, 500);
  assertEquals(achados, []);
});

Deno.test("orfao mais velho que a retencao e candidato", () => {
  const achados = selecionarOrfaos([arq("u1/j1/e1.csv")], new Set(), CORTE, 500);
  assertEquals(achados.map((a) => a.caminho), ["u1/j1/e1.csv"]);
});

Deno.test("orfao dentro da retencao espera a proxima janela", () => {
  const achados = selecionarOrfaos([arq("u1/j1/e1.csv", NOVO)], new Set(), CORTE, 500);
  assertEquals(achados, []);
});

Deno.test("pasta (uuid sem extensao) nunca e apagada, nem se estiver orfa", () => {
  const achados = selecionarOrfaos(
    [arq("u1"), arq("u1/j1"), arq("u1/j1/e1.csv")],
    new Set(),
    CORTE,
    500,
  );
  assertEquals(achados.map((a) => a.caminho), ["u1/j1/e1.csv"]);
  assertEquals(ehArquivoApagavel("u1/j1"), false);
  assertEquals(ehArquivoApagavel("u1/j1/e1.csv"), true);
});

Deno.test("respeita o lote e mantem a ordem da varredura", () => {
  const achados = selecionarOrfaos(
    [arq("a.csv"), arq("b.csv"), arq("c.csv")],
    new Set(),
    CORTE,
    2,
  );
  assertEquals(achados.map((a) => a.caminho), ["a.csv", "b.csv"]);
});