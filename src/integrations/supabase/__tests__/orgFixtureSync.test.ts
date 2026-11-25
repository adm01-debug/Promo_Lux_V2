import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import fixture from "./org-scoped-tables.fixture.json";

/**
 * GUARDA DE SINCRONIA DO FIXTURE MULTI-TENANT (etapa 008 do plano de QA).
 *
 * `org-scoped-tables.fixture.json` é a "verdade do banco" usada pelo teste do
 * registry do `withOrg.ts`. Enquanto era mantido à mão, ele ficou verde sobre o
 * próprio buraco: quatro tabelas com `organization_id` (role_permissions,
 * scheduled_reports, bulk_imports, changelog_entries) não estavam no arquivo.
 *
 * Agora o arquivo é gerado de `supabase/migrations/` por
 * `scripts/ci/gerar-org-scoped-fixture.mjs` e este teste falha quando alguém
 * cria/remove uma tabela multi-tenant sem regerar o arquivo.
 */

const SCRIPT = path.join(process.cwd(), "scripts", "ci", "gerar-org-scoped-fixture.mjs");

function checkFixture(): { ok: boolean; output: string } {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, "--check"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, output: stdout };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; message?: string };
    return {
      ok: false,
      output: `${failure.stdout ?? ""}${failure.stderr ?? ""}${failure.message ?? ""}`,
    };
  }
}

describe("fixture de tabelas multi-tenant é derivada das migrations", () => {
  it("está em dia com supabase/migrations", () => {
    const result = checkFixture();
    expect(
      result.ok,
      `O fixture está dessincronizado. Rode: node scripts/ci/gerar-org-scoped-fixture.mjs\n${result.output}`,
    ).toBe(true);
  });

  it("o gerador produz uma lista não vazia e ordenada", () => {
    const tables: string[] = fixture.tablesWithOrganizationId;
    expect(tables.length).toBeGreaterThan(0);
    expect([...tables].sort()).toEqual(tables);
  });
});