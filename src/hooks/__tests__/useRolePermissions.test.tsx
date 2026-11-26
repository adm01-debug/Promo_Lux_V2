import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createElement } from "react";
import type { RolePermissionRow } from "../useRolePermissions";

const toastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: vi.fn(),
  },
}));

/** Erro devolvido pela gravacao; cada caso troca o valor antes de chamar o toggle. */
const gravacao: { error: { message: string } | null } = { error: null };

/**
 * Builder encadeavel do PostgREST. O `order` sempre falha de proposito: assim o
 * refetch disparado no onSettled nao consegue repor a matriz e o unico caminho
 * capaz de devolver o valor anterior e o desfazimento do onError.
 */
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const afterUpdate = {
        eq: () => afterUpdate,
        then: (resolve: (value: { data: null; error: unknown }) => unknown) =>
          Promise.resolve({ data: null, error: gravacao.error }).then(resolve),
      };
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => Promise.resolve({ data: null, error: new Error("refetch indisponivel") }),
        update: () => afterUpdate,
      };
      return builder;
    },
  },
}));

vi.mock("@/hooks/useOrganizations", () => ({
  useActiveOrganization: () => ({ activeOrgId: "org-1", activeOrg: null, setActive: () => {} }),
}));

import { useRolePermissions } from "../useRolePermissions";

const CHAVE = ["role_permissions", "org-1"];

const LINHA: RolePermissionRow = {
  id: "perm-1",
  organization_id: "org-1",
  role: "admin",
  resource: "companies",
  can_view: true,
  can_create: true,
  can_update: true,
  can_delete: false,
  can_manage: true,
};

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData<RolePermissionRow[]>(CHAVE, [{ ...LINHA }]);
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return { qc, ...renderHook(() => useRolePermissions(), { wrapper }) };
}

describe("useRolePermissions", () => {
  beforeEach(() => {
    toastError.mockClear();
    gravacao.error = null;
  });

  it("aplica a mudanca antes da resposta do banco", async () => {
    const { qc, result } = montar();
    const pendente = result.current.toggle.mutateAsync({
      resource: "companies",
      role: "admin",
      flag: "can_delete",
      value: true,
    });
    await waitFor(() =>
      expect(qc.getQueryData<RolePermissionRow[]>(CHAVE)?.[0].can_delete).toBe(true),
    );
    await pendente;
  });

  it("desfaz a mudanca otimista e avisa quando a gravacao falha", async () => {
    gravacao.error = { message: "permission denied for table role_permissions" };
    const { qc, result } = montar();

    await expect(
      result.current.toggle.mutateAsync({
        resource: "companies",
        role: "admin",
        flag: "can_delete",
        value: true,
      }),
    ).rejects.toThrow(/permission denied/);

    expect(qc.getQueryData<RolePermissionRow[]>(CHAVE)?.[0].can_delete).toBe(false);
    expect(toastError).toHaveBeenCalledWith(
      expect.stringContaining("Erro ao salvar"),
      expect.objectContaining({ description: "permission denied for table role_permissions" }),
    );
  });

  it("mantem a mudanca quando a gravacao conclui sem erro", async () => {
    const { qc, result } = montar();
    await result.current.toggle.mutateAsync({
      resource: "companies",
      role: "admin",
      flag: "can_delete",
      value: true,
    });
    expect(qc.getQueryData<RolePermissionRow[]>(CHAVE)?.[0].can_delete).toBe(true);
  });
});