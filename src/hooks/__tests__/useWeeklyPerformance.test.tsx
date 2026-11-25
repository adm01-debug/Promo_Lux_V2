import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { SupabaseCall } from "@/test/mockSupabaseClient";

const ORG = "org-teste-semana";
const chamadas = vi.hoisted(() => [] as SupabaseCall[]);
const resposta = vi.hoisted(() => ({
  atual: { data: [], error: null } as { data: unknown; error: unknown },
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseClientMock } = await import("@/test/mockSupabaseClient");
  return {
    supabase: createSupabaseClientMock({
      result: () => resposta.atual,
      calls: chamadas,
    }),
  };
});

vi.mock("@/contexts/demo-context", () => ({
  useDemo: () => ({ isDemoMode: false }),
}));

vi.mock("@/contexts/active-org-context", () => ({
  useActiveOrganization: () => ({
    activeOrgId: ORG,
    activeOrg: null,
    setActive: vi.fn(),
  }),
}));

import { useWeeklyPerformance } from "../useWeeklyPerformance";
import { setActiveOrgId } from "@/integrations/supabase/withOrg";

let qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);

/**
 * O grafico "Performance Semanal" lia `companies` direto pelo client: sem
 * escopo de organizacao, sem filtro de lixeira e com o erro descartado (o hook
 * devolvia series zeradas como se a consulta tivesse dado certo).
 */
describe("useWeeklyPerformance — escopo multi-tenant e erro", () => {
  beforeEach(() => {
    chamadas.length = 0;
    resposta.atual = { data: [], error: null };
    setActiveOrgId(ORG);
    // Cache novo por teste: a mesma queryKey nao pode reaproveitar o sucesso
    // do teste anterior quando o objetivo e ver a falha.
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it("le as empresas da organizacao ativa, fora da lixeira", async () => {
    renderHook(() => useWeeklyPerformance(), { wrapper });

    await waitFor(() =>
      expect(
        chamadas.some((c) => c.table === "companies" && c.method === "order"),
      ).toBe(true),
    );
    expect(chamadas).toContainEqual({
      table: "companies",
      method: "eq",
      args: ["organization_id", ORG],
    });
    expect(chamadas).toContainEqual({
      table: "companies",
      method: "is",
      args: ["deleted_at", null],
    });
  });

  it("propaga o erro da consulta em vez de devolver series zeradas", async () => {
    resposta.atual = { data: null, error: new Error("falha no banco") };
    const { result } = renderHook(() => useWeeklyPerformance(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(new Error("falha no banco"));
  });
});
