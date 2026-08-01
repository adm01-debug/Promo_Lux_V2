import { describe, it, expect } from "vitest";
import {
  ORG_SCOPED_TABLES,
  EXEMPT_TABLES,
  ORG_UNSCOPED_TABLES,
} from "../withOrg";
import fixture from "./org-scoped-tables.fixture.json";

/**
 * TESTE DE SINCRONIA DO REGISTRY MULTI-TENANT (M-1).
 *
 * Objetivo: impedir "gaps silenciosos" de isolamento. Toda tabela que possui
 * a coluna `organization_id` no banco DEVE estar classificada em exatamente
 * um dos conjuntos do `withOrg.ts`:
 *   - ORG_SCOPED_TABLES   → escopo automático via wrapper `db`.
 *   - ORG_UNSCOPED_TABLES → acesso cru/RPC intencional, sob RLS específica.
 *   - EXEMPT_TABLES       → tabelas globais / auto-gerenciadas.
 *
 * A "verdade do banco" vem de `org-scoped-tables.fixture.json`, gerada a
 * partir de `information_schema.columns`. Quando uma migração adiciona uma
 * nova tabela multi-tenant, este teste falha até que ela seja classificada,
 * forçando uma decisão explícita de escopo.
 */

const dbTables: string[] = fixture.tablesWithOrganizationId;

const dbSet = new Set(dbTables);
const scoped = [...ORG_SCOPED_TABLES];
const unscoped = [...ORG_UNSCOPED_TABLES];
const exempt = [...EXEMPT_TABLES];

describe("withOrg registry ↔ banco (sincronia multi-tenant)", () => {
  it("classifica TODA tabela com organization_id em exatamente um conjunto", () => {
    const classified = new Set<string>([...scoped, ...unscoped, ...exempt]);
    const unclassified = dbTables.filter((t) => !classified.has(t));
    expect(
      unclassified,
      `Tabelas com organization_id sem classificação no withOrg.ts: ${unclassified.join(", ")}. ` +
        `Adicione cada uma a ORG_SCOPED_TABLES, ORG_UNSCOPED_TABLES ou EXEMPT_TABLES.`,
    ).toEqual([]);
  });

  it("não classifica a mesma tabela em mais de um conjunto", () => {
    const all = [...scoped, ...unscoped, ...exempt];
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const t of all) {
      if (seen.has(t)) dupes.add(t);
      seen.add(t);
    }
    expect([...dupes], `Tabelas classificadas em múltiplos conjuntos: ${[...dupes].join(", ")}`).toEqual([]);
  });

  it("toda tabela ESCOPADA realmente possui organization_id no banco", () => {
    const orphans = scoped.filter((t) => !dbSet.has(t));
    expect(
      orphans,
      `ORG_SCOPED_TABLES referencia tabelas sem organization_id no banco: ${orphans.join(", ")}`,
    ).toEqual([]);
  });

  it("toda tabela UNSCOPED realmente possui organization_id no banco", () => {
    const orphans = unscoped.filter((t) => !dbSet.has(t));
    expect(
      orphans,
      `ORG_UNSCOPED_TABLES referencia tabelas sem organization_id no banco: ${orphans.join(", ")}`,
    ).toEqual([]);
  });

  it("automation_alerts está escopada (regressão do gap deny-by-default)", () => {
    // Bug real: Monitoring.tsx usa db.from("automation_alerts"); sem estar
    // no registry, o wrapper lançava erro deny-by-default em runtime.
    expect(ORG_SCOPED_TABLES.has("automation_alerts")).toBe(true);
  });
});
