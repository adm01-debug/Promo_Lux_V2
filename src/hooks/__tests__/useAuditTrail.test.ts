import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Guarda de regressão da fonte de dados da Trilha de Auditoria.
 *
 * Valida a construção da query (filtros de entidade/ação, paginação por range),
 * a junção do ator via `profiles` e o refinamento de busca no cliente — pontos
 * que quebrariam silenciosamente o painel de auditoria se o contrato mudasse.
 */

type Call = { method: string; args: unknown[] };
const calls: Call[] = [];

// Resultados injetáveis por tabela consultada.
let auditResult: { data: unknown[]; count: number; error: unknown } = {
  data: [],
  count: 0,
  error: null,
};
let profilesResult: { data: unknown[]; error: unknown } = { data: [], error: null };

function makeAuditBuilder() {
  const b: Record<string, (...a: unknown[]) => unknown> = {};
  for (const m of ["select", "order", "in", "eq"] as const) {
    b[m] = vi.fn((...args: unknown[]) => {
      calls.push({ method: m, args });
      return b;
    });
  }
  // range() encerra a cadeia da tabela audit_logs.
  b.range = vi.fn((...args: unknown[]) => {
    calls.push({ method: "range", args });
    return Promise.resolve(auditResult);
  });
  return b;
}

function makeProfilesBuilder() {
  const b: Record<string, (...a: unknown[]) => unknown> = {};
  b.select = vi.fn(() => b);
  // in() encerra a cadeia de profiles.
  b.in = vi.fn(() => Promise.resolve(profilesResult));
  return b;
}

vi.mock("@/integrations/supabase/withOrg", () => ({
  db: {
    from: vi.fn((table: string) =>
      table === "profiles" ? makeProfilesBuilder() : makeAuditBuilder(),
    ),
  },
}));

import {
  fetchAuditTrail,
  DEFAULT_AUDIT_FILTERS,
  AUTOMATION_TABLES,
} from "../useAuditTrail";

beforeEach(() => {
  calls.length = 0;
  auditResult = { data: [], count: 0, error: null };
  profilesResult = { data: [], error: null };
});

const method = (name: string) => calls.filter((c) => c.method === name);

describe("fetchAuditTrail", () => {
  it("pagina via range() com base em page/pageSize (1-indexada)", async () => {
    await fetchAuditTrail({ ...DEFAULT_AUDIT_FILTERS, page: 3, pageSize: 25 });
    const range = method("range")[0];
    // page 3 → from = (3-1)*25 = 50, to = 50 + 25 - 1 = 74
    expect(range.args).toEqual([50, 74]);
  });

  it("filtra apenas automações com .in() no conjunto esperado", async () => {
    await fetchAuditTrail({ ...DEFAULT_AUDIT_FILTERS, table: "automations" });
    const inCall = method("in")[0];
    expect(inCall.args[0]).toBe("table_name");
    expect(inCall.args[1]).toEqual([...AUTOMATION_TABLES]);
  });

  it("filtra por tabela específica com .eq(table_name)", async () => {
    await fetchAuditTrail({ ...DEFAULT_AUDIT_FILTERS, table: "companies" });
    const eqTable = method("eq").find((c) => c.args[0] === "table_name");
    expect(eqTable?.args[1]).toBe("companies");
  });

  it("não filtra tabela quando table = 'all'", async () => {
    await fetchAuditTrail({ ...DEFAULT_AUDIT_FILTERS, table: "all" });
    expect(method("in")).toHaveLength(0);
    expect(method("eq").some((c) => c.args[0] === "table_name")).toBe(false);
  });

  it("filtra por ação quando diferente de 'all'", async () => {
    await fetchAuditTrail({ ...DEFAULT_AUDIT_FILTERS, action: "delete" });
    const eqAction = method("eq").find((c) => c.args[0] === "action");
    expect(eqAction?.args[1]).toBe("delete");
  });

  it("junta o ator a partir de profiles e calcula total/totalPages", async () => {
    auditResult = {
      data: [
        { id: "l1", actor_id: "u1", table_name: "companies", action: "create" },
        { id: "l2", actor_id: null, table_name: "deals", action: "update" },
      ],
      count: 30,
      error: null,
    };
    profilesResult = {
      data: [{ id: "u1", full_name: "Ana", avatar_url: null }],
      error: null,
    };

    const res = await fetchAuditTrail({ ...DEFAULT_AUDIT_FILTERS, pageSize: 25 });
    expect(res.rows[0].actor?.full_name).toBe("Ana");
    expect(res.rows[1].actor).toBeNull();
    expect(res.total).toBe(30);
    expect(res.totalPages).toBe(2); // ceil(30/25)
  });

  it("refina por busca de ator/tabela no cliente sobre a página carregada", async () => {
    auditResult = {
      data: [
        { id: "l1", actor_id: "u1", table_name: "companies", action: "create" },
        { id: "l2", actor_id: "u2", table_name: "deals", action: "update" },
      ],
      count: 2,
      error: null,
    };
    profilesResult = {
      data: [
        { id: "u1", full_name: "Ana Silva", avatar_url: null },
        { id: "u2", full_name: "Bruno", avatar_url: null },
      ],
      error: null,
    };

    const res = await fetchAuditTrail({ ...DEFAULT_AUDIT_FILTERS, search: "ana" });
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].actor?.full_name).toBe("Ana Silva");
  });

  it("propaga erro da query de audit_logs", async () => {
    auditResult = { data: [], count: 0, error: new Error("rls denied") };
    await expect(fetchAuditTrail(DEFAULT_AUDIT_FILTERS)).rejects.toThrow("rls denied");
  });
});
