import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useDealStages, useDeals } from "@/hooks/useDeals";

/**
 * Etapas 195/196/199.
 *
 * O auto-preenchimento das etapas do funil depende do resultado da consulta que
 * ele mesmo invalida. O teste devolve uma lista vazia nova a cada render (o
 * cenario em que o comportamento de identidade da biblioteca muda) e exige que
 * a funcao do banco seja chamada uma unica vez, alem de erro visivel quando ela
 * falha (195) e nas mutacoes de negocio (199).
 */

type MutationOptions = { onError?: (e: Error) => void };

const state = vi.hoisted(() => ({
  dataFactory: (() => []) as () => unknown[],
  isLoading: false,
  rpc: vi.fn(),
  invalidate: vi.fn(),
  toastError: vi.fn(),
  mutations: [] as MutationOptions[],
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: state.dataFactory(),
    isLoading: state.isLoading,
    isPending: false,
    error: null,
  }),
  useQueryClient: () => ({
    invalidateQueries: state.invalidate,
    cancelQueries: vi.fn(),
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
  }),
  useMutation: (options: MutationOptions) => {
    state.mutations.push(options);
    return { mutate: vi.fn(), isPending: false };
  },
}));

vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("@/contexts/active-org-context", () => ({
  useActiveOrganization: () => ({ activeOrgId: "org-1" }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: state.rpc } }));
vi.mock("@/integrations/supabase/withOrg", () => ({ db: { from: () => ({}) } }));
vi.mock("sonner", () => ({ toast: { error: state.toastError, success: vi.fn() } }));

beforeEach(() => {
  state.dataFactory = () => [];
  state.isLoading = false;
  state.mutations.length = 0;
  state.rpc.mockReset();
  state.invalidate.mockReset();
  state.toastError.mockReset();
});

describe("useDealStages - auto-preenchimento (etapas 195/196)", () => {
  it("cria as etapas padrao uma unica vez mesmo com lista vazia nova a cada render", async () => {
    state.rpc.mockResolvedValue({ error: null });
    const { rerender } = renderHook(() => useDealStages());
    rerender();
    rerender();

    await waitFor(() => expect(state.rpc).toHaveBeenCalledTimes(1));
    expect(state.rpc).toHaveBeenCalledWith("create_default_deal_stages", { _user_id: "user-1" });
    await waitFor(() =>
      expect(state.invalidate).toHaveBeenCalledWith({ queryKey: ["deal_stages", "user-1"] }),
    );
  });

  it("avisa o usuario e nao repete a tentativa quando a funcao do banco falha", async () => {
    state.rpc.mockResolvedValue({ error: { message: "permission denied for function" } });
    const { rerender } = renderHook(() => useDealStages());
    rerender();

    await waitFor(() => expect(state.toastError).toHaveBeenCalled());
    expect(state.toastError.mock.calls[0][0]).toBe("Não foi possível criar as etapas padrão do funil");
    expect(state.toastError.mock.calls[0][1]).toMatchObject({
      description: "permission denied for function",
    });
    expect(state.invalidate).not.toHaveBeenCalled();
    expect(state.rpc).toHaveBeenCalledTimes(1);
  });

  it("nao semeia quando o funil ja tem etapas", async () => {
    state.dataFactory = () => [{ id: "stage-1" }];
    renderHook(() => useDealStages());
    await Promise.resolve();
    expect(state.rpc).not.toHaveBeenCalled();
  });
});

describe("useDeals - mutacoes avisam o motivo da falha (etapa 199)", () => {
  it("mostra o motivo quando a remocao do negocio falha", async () => {
    state.rpc.mockResolvedValue({ error: null });
    renderHook(() => useDeals());
    // ordem declarada em useDeals: createDeal, updateDeal, deleteDeal
    const deleteDeal = state.mutations[2];
    expect(deleteDeal?.onError).toBeTypeOf("function");

    deleteDeal.onError?.(new Error("sem permissao"));
    expect(state.toastError).toHaveBeenCalledWith("Não foi possível remover o negócio", {
      description: "sem permissao",
    });
  });

  it("todas as mutacoes de negocio expostas tratam erro", () => {
    state.rpc.mockResolvedValue({ error: null });
    renderHook(() => useDeals());
    const semTratamento = state.mutations.filter((m) => typeof m.onError !== "function");
    expect(semTratamento).toEqual([]);
  });
});
