import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Etapa 046 / achado G23-2.
 *
 * `supabase/functions/mcp/index.ts` e gerado pelo plugin `mcpPlugin()`
 * (`vite.config.ts`), que resolve o project ref nesta ordem:
 * `VITE_SUPABASE_PROJECT_ID` dos `.env` de producao e, na falta dela,
 * `project_id` de `supabase/config.toml`.
 *
 * O artefato e commitado, entao um `vite dev`/`vite build` rodado com um `.env`
 * apontando para um projeto de teste — ou com o `project_id` errado — grava um
 * emissor OAuth inexistente (`https://local-e2e.supabase.co/auth/v1`) e o canal
 * MCP passa a autenticar contra projeto nenhum. Este teste falha nesse caso,
 * antes de o arquivo errado chegar no remoto.
 */
const raiz = process.cwd();

function ler(caminhoRelativo: string): string {
  return readFileSync(resolve(raiz, caminhoRelativo), "utf8");
}

function projectIdDoConfig(): string {
  const linha = ler("supabase/config.toml")
    .split(/\r?\n/)
    .find((l) => l.trim().startsWith("project_id"));
  const valor = linha?.match(/project_id\s*=\s*"([^"]*)"/)?.[1];
  if (!valor) throw new Error("supabase/config.toml sem project_id");
  return valor;
}

function projectRefDoArtefato(): string {
  const linha = ler("supabase/functions/mcp/index.ts")
    .split(/\r?\n/)
    .find((l) => l.includes("var projectRef ="));
  const valor = linha?.match(/var projectRef = "([^"]*)"/)?.[1];
  if (!valor) throw new Error("artefato do MCP sem projectRef");
  return valor;
}

describe("emissor de autenticacao do MCP (etapa 046)", () => {
  it("usa o mesmo projeto do config.toml", () => {
    expect(projectRefDoArtefato()).toBe(projectIdDoConfig());
  });

  it("aponta para um project ref plausivel, nunca para um projeto de teste", () => {
    const ref = projectRefDoArtefato();
    expect(ref).toMatch(/^[a-z]{20}$/);
    expect(["local-e2e", "placeholder-project", "project-ref-unset"]).not.toContain(ref);
  });
});