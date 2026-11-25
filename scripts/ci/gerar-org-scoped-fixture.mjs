#!/usr/bin/env node
/**
 * Gera/valida a "verdade do banco" de tabelas multi-tenant a partir das migrations.
 *
 * Por que existe: o arquivo de referencia
 * (src/integrations/supabase/__tests__/org-scoped-tables.fixture.json) era
 * mantido a mao. Quando uma migration criava uma tabela com organization_id e
 * ninguem atualizava o arquivo, o teste de sincronia do withOrg.ts ficava verde
 * exatamente sobre o buraco que deveria apontar (foi o que aconteceu com
 * role_permissions, scheduled_reports, bulk_imports e changelog_entries).
 *
 * Uso:
 *   node scripts/ci/gerar-org-scoped-fixture.mjs            # grava o arquivo
 *   node scripts/ci/gerar-org-scoped-fixture.mjs --check    # falha se estiver desatualizado
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const FIXTURE_PATH = path.join(
  ROOT,
  "src",
  "integrations",
  "supabase",
  "__tests__",
  "org-scoped-tables.fixture.json",
);

const COMMENT =
  "Verdade das tabelas BASE do schema public que possuem coluna organization_id. " +
  "Gerada por scripts/ci/gerar-org-scoped-fixture.mjs a partir de supabase/migrations " +
  "(CREATE TABLE / ALTER TABLE ... ADD COLUMN organization_id). " +
  "Nao edite a mao: rode o script. O teste withOrg.registry.test.ts falha se ficar dessincronizada.";

const STATEMENT =
  /\b(CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?|DROP\s+TABLE(?:\s+IF\s+EXISTS)?|ALTER\s+TABLE(?:\s+ONLY)?(?:\s+IF\s+EXISTS)?)\s+([A-Za-z0-9_."]+)([^;]*);/giu;

function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//gu, " ").replace(/--[^\n]*/gu, " ");
}

function tableName(raw) {
  const parts = raw.replace(/"/gu, "").split(".");
  return parts[parts.length - 1].trim().toLowerCase();
}

/**
 * Tabelas do schema public com coluna organization_id, segundo as migrations,
 * respeitando a semântica real do banco: `CREATE TABLE IF NOT EXISTS` numa
 * tabela que já existe é no-op e **não** acrescenta coluna nenhuma.
 *
 * Foi exatamente esse no-op que produziu a divergência histórica de
 * idempotency_keys: a migration de 13/05/2026 14:01 criou a tabela sem
 * organization_id e a de 16:53 pediu `IF NOT EXISTS` com a coluna — o banco
 * manteve a definição antiga (3 linhas, sem a coluna) e a coluna nunca existiu.
 */
export function tablesWithOrganizationId() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const tables = new Map();

  for (const file of files) {
    const sql = stripComments(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
    for (const match of sql.matchAll(STATEMENT)) {
      const rawKind = match[1].toUpperCase().replace(/\s+/gu, " ");
      const name = tableName(match[2]);
      const body = match[3] ?? "";

      if (rawKind.startsWith("DROP TABLE")) {
        tables.delete(name);
        continue;
      }
      if (rawKind.startsWith("CREATE TABLE")) {
        const open = body.indexOf("(");
        const definition = open === -1 ? body : body.slice(open);
        const ifNotExists = rawKind.includes("IF NOT EXISTS");
        if (ifNotExists && tables.has(name)) continue; // no-op no banco
        tables.set(name, { organizationId: /\borganization_id\b/iu.test(definition) });
        continue;
      }
      const added = /ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+organization_id\b/iu.test(body);
      const dropped = /DROP\s+COLUMN(?:\s+IF\s+EXISTS)?\s+organization_id\b/iu.test(body);
      if (!added && !dropped) continue;
      const entry = tables.get(name) ?? { organizationId: false };
      if (added) entry.organizationId = true;
      else entry.organizationId = false;
      tables.set(name, entry);
    }
  }

  return [...tables.entries()]
    .filter(([, entry]) => entry.organizationId)
    .map(([name]) => name)
    .sort();
}

export function renderFixture() {
  return `${JSON.stringify(
    { _comment: COMMENT, tablesWithOrganizationId: tablesWithOrganizationId() },
    null,
    2,
  )}\n`;
}

function main(argv) {
  const check = argv.includes("--check");
  const generated = renderFixture();
  const current = existsSync(FIXTURE_PATH) ? readFileSync(FIXTURE_PATH, "utf8") : null;

  if (!check) {
    writeFileSync(FIXTURE_PATH, generated, "utf8");
    console.log(`[org-scoped-fixture] escrito com ${tablesWithOrganizationId().length} tabelas`);
    return 0;
  }

  if (current === generated) {
    console.log(`[org-scoped-fixture] em dia (${tablesWithOrganizationId().length} tabelas)`);
    return 0;
  }

  const before = new Set(
    current ? (JSON.parse(current).tablesWithOrganizationId ?? []) : [],
  );
  const after = new Set(tablesWithOrganizationId());
  const added = [...after].filter((t) => !before.has(t));
  const removed = [...before].filter((t) => !after.has(t));
  console.error("[org-scoped-fixture] desatualizado — rode node scripts/ci/gerar-org-scoped-fixture.mjs");
  if (added.length) console.error(`  faltando no arquivo: ${added.join(", ")}`);
  if (removed.length) console.error(`  sobrando no arquivo: ${removed.join(", ")}`);
  if (!added.length && !removed.length) console.error("  mesma lista, formato/comentario divergentes");
  return 1;
}

if (process.argv[1] && process.argv[1].endsWith("gerar-org-scoped-fixture.mjs")) {
  process.exit(main(process.argv.slice(2)));
}