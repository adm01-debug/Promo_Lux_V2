import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Etapa 080 do plano de QA: um <Button> sem manipulador é um controle morto —
// clica e nada acontece. A auditoria achou nove desses na interface de empresas
// (fechados nas etapas 074-079) e, para não voltarem, este teste reprova
// qualquer botão novo que não faça nada.
//
// Um botão é considerado "vivo" quando o próprio elemento resolve o clique
// (onClick, onSubmit, type="submit" ou spread de props) ou quando ele delega a
// ação ao pai — gatilho do Radix com `asChild` (<DialogTrigger asChild> etc.) ou
// <Link>. Esses dois últimos são exatamente os falsos positivos que a varredura
// manual descartou.

// O vitest roda com o diretório do repositório como cwd (local e no CI),
// inclusive no ambiente jsdom, onde import.meta.url não é uma URL file://.
const RAIZ = path.resolve(process.cwd(), "src");
if (!fs.existsSync(RAIZ))
  throw new Error(`Diretório src/ nao encontrado a partir de ${process.cwd()}`);
const ACAO_PROPRIA = /onClick|onSubmit|asChild|type="submit"|\{\.\.\./;
const GATILHO_DO_PAI =
  /(Dialog|AlertDialog|Popover|Sheet|DropdownMenu|Tooltip|ContextMenu|Collapsible|Accordion|HoverCard|Menubar|NavigationMenu|Select|Toggle)Trigger\s+asChild/;

function arquivosTsx(dir: string, acumulado: string[] = []): string[] {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === "__tests__") continue;
      arquivosTsx(completo, acumulado);
    } else if (entrada.name.endsWith(".tsx")) {
      acumulado.push(completo);
    }
  }
  return acumulado;
}

/** Lê a tag de abertura de <Button a partir do índice do "<". */
function tagDeAbertura(src: string, inicio: number): string | null {
  let aspas: string | null = null;
  let chaves = 0;
  for (let i = inicio; i < src.length; i++) {
    const c = src[i];
    if (aspas) {
      if (c === aspas) aspas = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      aspas = c;
      continue;
    }
    if (c === "{") chaves++;
    else if (c === "}") chaves--;
    // ">" fora de {expressão} fecha a tag, salvo quando faz parte de ">=" ou "=>"
    else if (
      c === ">" &&
      chaves === 0 &&
      src[i - 1] !== "=" &&
      src[i + 1] !== "="
    ) {
      return src.slice(inicio, i + 1);
    }
  }
  return null;
}

/** Números das linhas de <Button sem manipulador (1-based). */
export function botoesSemManipulador(src: string): number[] {
  const linhas: number[] = [];
  const re = /<Button\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const tag = tagDeAbertura(src, m.index);
    if (!tag) continue;
    if (ACAO_PROPRIA.test(tag)) continue;
    // Contexto imediato: o pai (gatilho com asChild) ou o <Link> que envolve o botão
    const antes = src.slice(Math.max(0, m.index - 260), m.index);
    const contexto = antes.slice(antes.lastIndexOf("<"));
    if (GATILHO_DO_PAI.test(contexto) || /<Link\b/.test(contexto)) continue;
    linhas.push(src.slice(0, m.index).split("\n").length);
  }
  return linhas;
}

describe("varredura de botões sem manipulador (etapa 080)", () => {
  it("acusa botão oco e absolve botão com ação, gatilho asChild e link", () => {
    expect(
      botoesSemManipulador(`<Button variant="ghost" size="sm">Oco</Button>`),
    ).toEqual([1]);
    expect(botoesSemManipulador(`<Button onClick={f}>Ok</Button>`)).toEqual([]);
    expect(
      botoesSemManipulador(`<Button type="submit">Enviar</Button>`),
    ).toEqual([]);
    expect(botoesSemManipulador(`<Button {...props}>Ok</Button>`)).toEqual([]);
    expect(
      botoesSemManipulador(
        `<DialogTrigger asChild><Button>Ok</Button></DialogTrigger>`,
      ),
    ).toEqual([]);
    expect(
      botoesSemManipulador(`<Link to="/x"><Button>Ok</Button></Link>`),
    ).toEqual([]);
    expect(
      botoesSemManipulador(
        `<Button disabled={pagina >= total}>Proxima</Button>`,
      ),
    ).toEqual([1]);
  });

  it("nenhum <Button> de src/ e um controle morto", () => {
    const mortos: string[] = [];
    for (const arquivo of arquivosTsx(RAIZ)) {
      for (const linha of botoesSemManipulador(
        fs.readFileSync(arquivo, "utf8"),
      )) {
        mortos.push(
          `${path.relative(RAIZ, arquivo).split(path.sep).join("/")}:${linha}`,
        );
      }
    }
    expect(mortos, `botões sem manipulador: ${mortos.join(", ")}`).toEqual([]);
  });
});
