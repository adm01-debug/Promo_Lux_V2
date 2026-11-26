import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createElement } from "react";

const state = vi.hoisted(() => ({
  activeOrgId: "org-1" as string | null,
  rows: [] as unknown[],
  error: null as null | { message: string },
  profiles: [] as { id: string; full_name: string | null }[],
  calls: {
    tables: [] as string[],
    eq: [] as [string, unknown][],
    gte: [] as [string, unknown][],
    order: [] as [string, unknown][],
    limit: [] as number[],
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      state.calls.tables.push(table);
      const limit = (n: number) => {
        state.calls.limit.push(n);
        return Promise.resolve({ data: state.rows, error: state.error });
      };
      const order = (column: string, options: unknown) => {
        state.calls.order.push([column, options]);
        return { limit };
      };
      const gte = (column: string, value: unknown) => {
        state.calls.gte.push([column, value]);
        return { order };
      };
      const eq = (column: string, value: unknown) => {
        state.calls.eq.push([column, value]);
        return { gte };
      };
      return { select: () => ({ eq }) };
    },
  },
}));

vi.mock("@/integrations/supabase/withOrg", () => ({
  db: {
    from: () => ({
      select: () => ({
        in: (_column: string, ids: string[]) =>
          Promise.resolve({
            data: state.profiles.filter((p) => ids.includes(p.id)),
            error: null,
          }),
      }),
    }),
  },
}));

vi.mock("@/contexts/active-org-context", () => ({
  useActiveOrganization: () => ({
    activeOrgId: state.activeOrgId,
    activeOrg: null,
    setActive: () => {},
  }),
}));

import {
  monthStartIso,
  summarizeLushaCreditUsage,
  useLushaCreditUsage,
  type LushaCreditUsageRow,
} from "../useLushaCreditUsage";

function row(over: Partial<LushaCreditUsageRow> = {}): LushaCreditUsageRow {
  return {
    id: "lcu-1",
    organization_id: "org-1",
    user_id: "user-1",
    bitrix_card_id: null,
    company_name: null,
    domain: null,
    endpoint: "/v2/person",
    operation: "reveal",
    api_version: "v2",
    success: true,
    credits_charged: 1,
    records_returned: 1,
    request_id: "req-1",
    error_code: null,
    created_at: "2026-11-20T10:00:00.000Z",
    ...over,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  state.activeOrgId = "org-1";
  state.rows = [];
  state.error = null;
  state.profiles = [];
  state.calls.tables = [];
  state.calls.eq = [];
  state.calls.gte = [];
  state.calls.order = [];
  state.calls.limit = [];
});

describe("monthStartIso", () => {
  it("devolve o primeiro dia do mês em UTC", () => {
    expect(monthStartIso(new Date("2026-11-26T13:45:00Z"))).toBe("2026-11-01T00:00:00.000Z");
  });

  it("não recua de mês no último instante do mês", () => {
    expect(monthStartIso(new Date("2026-12-31T23:59:59Z"))).toBe("2026-12-01T00:00:00.000Z");
  });
});

describe("summarizeLushaCreditUsage", () => {
  it("devolve zeros para lista vazia", () => {
    const summary = summarizeLushaCreditUsage([]);
    expect(summary).toEqual({
      credits: 0,
      calls: 0,
      records: 0,
      failures: 0,
      lastAt: null,
      byUser: [],
      byOperation: [],
    });
  });

  it("soma créditos, revelações e falhas, e guarda a data mais recente", () => {
    const summary = summarizeLushaCreditUsage([
      row({ credits_charged: 4, records_returned: 4, created_at: "2026-11-20T10:00:00.000Z" }),
      row({ id: "lcu-2", credits_charged: 2, records_returned: 1, created_at: "2026-11-22T09:00:00.000Z" }),
      row({ id: "lcu-3", success: false, credits_charged: 0, records_returned: 0, error_code: "http_402", created_at: "2026-11-19T09:00:00.000Z" }),
    ]);

    expect(summary.credits).toBe(6);
    expect(summary.calls).toBe(3);
    expect(summary.records).toBe(5);
    expect(summary.failures).toBe(1);
    expect(summary.lastAt).toBe("2026-11-22T09:00:00.000Z");
  });

  it("agrupa por usuário, do que mais consumiu para o que menos consumiu", () => {
    const summary = summarizeLushaCreditUsage([
      row({ user_id: "user-b", credits_charged: 1 }),
      row({ id: "lcu-2", user_id: "user-a", credits_charged: 9 }),
      row({ id: "lcu-3", user_id: "user-b", credits_charged: 3, success: false }),
    ]);

    expect(summary.byUser.map((u) => [u.userId, u.credits, u.calls, u.failures])).toEqual([
      ["user-a", 9, 1, 0],
      ["user-b", 4, 2, 1],
    ]);
  });

  it("agrupa as linhas sem usuário em uma única entrada", () => {
    const summary = summarizeLushaCreditUsage([
      row({ user_id: null, credits_charged: 2 }),
      row({ id: "lcu-2", user_id: null, credits_charged: 3 }),
    ]);

    expect(summary.byUser).toHaveLength(1);
    expect(summary.byUser[0]).toMatchObject({ userId: null, credits: 5, calls: 2 });
  });

  it("agrupa por operação e trata crédito ausente ou inválido como zero", () => {
    const summary = summarizeLushaCreditUsage([
      row({ operation: "reveal", credits_charged: 2 }),
      row({ id: "lcu-2", operation: "reveal", credits_charged: null as unknown as number }),
      row({ id: "lcu-3", operation: "search", credits_charged: 5 }),
    ]);

    expect(summary.credits).toBe(7);
    expect(summary.byOperation).toEqual([
      { operation: "search", credits: 5, calls: 1 },
      { operation: "reveal", credits: 2, calls: 2 },
    ]);
  });
});

describe("useLushaCreditUsage", () => {
  it("lê o mês corrente da organização ativa e resume o consumo", async () => {
    state.rows = [row({ credits_charged: 6, records_returned: 2 })];
    state.profiles = [{ id: "user-1", full_name: "Ana Souza" }];

    const { result } = renderHook(() => useLushaCreditUsage(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(state.calls.tables).toEqual(["lusha_credit_usage_log"]);
    expect(state.calls.eq).toEqual([["organization_id", "org-1"]]);
    expect(state.calls.gte[0][0]).toBe("created_at");
    expect(state.calls.gte[0][1]).toBe(monthStartIso());
    expect(state.calls.order).toEqual([["created_at", { ascending: false }]]);
    expect(state.calls.limit).toEqual([500]);

    expect(result.current.data?.summary.credits).toBe(6);
    expect(result.current.data?.summary.records).toBe(2);
    expect(result.current.data?.summary.byUser[0]).toMatchObject({
      userId: "user-1",
      name: "Ana Souza",
    });
  });

  it("mostra o erro em vez de fingir consumo zero", async () => {
    state.error = { message: "permission denied" };

    const { result } = renderHook(() => useLushaCreditUsage(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it("não consulta nada sem organização ativa", () => {
    state.activeOrgId = null;

    const { result } = renderHook(() => useLushaCreditUsage(), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(state.calls.tables).toEqual([]);
  });
});