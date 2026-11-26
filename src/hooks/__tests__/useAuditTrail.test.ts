import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Guarda de regressão da fonte de dados da Trilha de Auditoria.
 *
 * A trilha lê por `read_audit_logs_safe` (o mascaramento de PII roda no servidor)
 * e não mais por `db.from("audit_logs")`. Este teste fixa os argumentos enviados
 * à RPC (paginação, período, ação, conjunto de tabelas), a junção do ator via
 * `profiles` e o refinamento de busca no cliente.
 */

type RpcCall = { name: string; args: Record<string, unknown> };
const rpcCalls: RpcCall[] = [];
let rpcResult: { data: unknown; error: unknown } = { data: [], error: null };
let profilesResult: { data: unknown[]; error: unknown } = { data: [], error: null };
const fromCalls: string[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn((name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return Promise.resolve(rpcResult);
    }),
  },
}));

vi.mock("@/integrations/supabase/withOrg", () => ({
  getActiveOrgId: () => "org-1",
  db: {
    from: vi.fn((table: string) => {
      fromCalls.push(table);
      const b: Record<string, (...a: unknown[]) => unknown> = {};
      b.select = vi.fn(() => b);
      // in() encerra a cadeia de profiles.
      b.in = vi.fn(() => Promise.resolve(profilesResult));
      return b;
    }),
  },
}));

import {
  fetchAuditTrail,
  DEFAULT_AUDIT_FILTERS,
  AUTOMATION_TABLES,
} from "../useAuditTrail";

beforeEach(() => {
  rpcCalls.length = 0;
  fromCalls.length = 0;
  rpcResult = { data: [], error: null };
  profilesResult = { data: [], error: null };
});

type Args = Record<string, unknown>;
const ultima = (): RpcCall => rpcCalls[rpcCalls.length - 1];

describe("fetchAuditTrail", () => {
  it("lê pelo leitor mascarado com a organização ativa", async () => {
    await fetchAuditTrail(DEFAULT_AUDIT_FILTERS);
    expect(ultima().name).toBe("read_audit_logs_safe");
    expect(ultima().args._org_id).toBe("org-1");
  });

  it("pagina via _limit/_offset a partir de page/pageSize (1-indexada)", async () => {
    await fetchAuditTrail({ ...DEFAULT_AUDIT_FILTERS, page: 3, pageSize: 25 });
    // page 3 → offset = (3-1)*25 = 50
    expect(ultima().args._limit).toBe(25);
    expect(ultima().args._offset).toBe(50);
  });

  it("envia o período como timestamps ISO inclusivos", async () => {
    await fetchAuditTrail({
      ...DEFAULT_AUDIT_FILTERS,
      dateFrom: "2026-11-01",
      dateTo: "2026-11-30",
    });
    expect(ultima().args._from).toBe("2026-11-01T00:00:00.000Z");
    expect(ultima().args._to).toBe("2026-11-30T23:59:59.999Z");
  });

  it("filtra apenas automações com o conjunto de tabelas esperado", async () => {
    await fetchAuditTrail({ ...DEFAULT_AUDIT_FILTERS, table: "automations" });
    expect(ultima().args._tables).toEqual([...AUTOMATION_TABLES]);
  });

  it("filtra por tabela específica com um único item", async () => {
    await fetchAuditTrail({ ...DEFAULT_AUDIT_FILTERS, table: "companies" });
    expect(ultima().args._tables).toEqual(["companies"]);
  });

  it("não filtra tabela quando table = 'all'", async () => {
    await fetchAuditTrail({ ...DEFAULT_AUDIT_FILTERS, table: "all" });
    expect(ultima().args._tables).toBeUndefined();
  });

  it("filtra por ação somente quando diferente de 'all'", async () => {
    await fetchAuditTrail({ ...DEFAULT_AUDIT_FILTERS, action: "delete" });
    expect(ultima().args._action).toBe("delete");

    await fetchAuditTrail({ ...DEFAULT_AUDIT_FILTERS, action: "all" });
    expect(ultima().args._action).toBeUndefined();
  });

  it("não lê audit_logs direto — só profiles para decorar o ator", async () => {
    rpcResult = { data: [{ id: "l1", actor_id: "u1" }], error: null };
    await fetchAuditTrail(DEFAULT_AUDIT_FILTERS);
    expect(fromCalls).toEqual(["profiles"]);
  });

  it("junta o ator a partir de profiles e calcula total/totalPages", async () => {
    rpcResult = {
      data: [
        { id: "l1", actor_id: "u1", table_name: "companies", action: "create", total_count: 30 },
        { id: "l2", actor_id: null, table_name: "deals", action: "update", total_count: 30 },
      ],
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
    rpcResult = {
      data: [
        { id: "l1", actor_id: "u1", table_name: "companies", action: "create", total_count: 2 },
        { id: "l2", actor_id: "u2", table_name: "deals", action: "update", total_count: 2 },
      ],
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

  it("propaga erro da leitura mascarada", async () => {
    rpcResult = { data: null, error: new Error("rls denied") };
    await expect(fetchAuditTrail(DEFAULT_AUDIT_FILTERS)).rejects.toThrow("rls denied");
  });
});