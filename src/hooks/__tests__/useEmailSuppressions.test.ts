import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createElement } from "react";

/**
 * Regra de negocio da etapa 048 (G31-1): depois da exclusao reversivel, a lista
 * de supressao passou a ser marcada em vez de apagada. "Adicionar" um e-mail
 * que esta na lixeira precisa RESTAURAR o registro -- so o descadastro ativo
 * bloqueia envio (ver `campaign-dispatch`). Antes do fix o insert batia no
 * unico (org + email), o erro era engolido como "ja suprimido" e o e-mail
 * continuava liberado sem o operador perceber.
 */

type Chamada = { tabela: string; op: string; metodo: string; args: unknown[] };

const { dbMock, chamadas, estado } = vi.hoisted(() => {
  const chamadas: Chamada[] = [];
  const estado = {
    /** Ids devolvidos pelo UPDATE de restauracao (vazio = nada na lixeira). */
    restaurados: [] as string[],
    erroRestaurar: null as { message: string } | null,
    erroInsert: null as { message: string } | null,
  };

  const dbMock = {
    from: (tabela: string) => {
      let op = "";
      const b: Record<string, unknown> = {};
      const registra = (metodo: string) => (...args: unknown[]) => {
        if (!op) op = metodo;
        chamadas.push({ tabela, op, metodo, args });
        return b;
      };
      for (const m of ["update", "insert", "select", "eq", "not", "order", "limit"]) {
        b[m] = registra(m);
      }
      b.then = (ok: (v: unknown) => unknown, fail?: (e: unknown) => unknown) => {
        const resultado =
          op === "update"
            ? {
                data: estado.restaurados.map((id) => ({ id })),
                error: estado.erroRestaurar,
              }
            : op === "insert"
              ? { data: null, error: estado.erroInsert }
              : { data: [], error: null };
        return Promise.resolve(resultado).then(ok, fail);
      };
      return b;
    },
  };

  return { dbMock, chamadas, estado };
});

vi.mock("@/integrations/supabase/withOrg", () => ({ db: dbMock }));
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));
vi.mock("@/contexts/active-org-context", () => ({
  useActiveOrganization: () => ({ activeOrgId: "org-1" }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useEmailSuppressions } from "../useEmailSuppressions";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return createElement(QueryClientProvider, { client: qc }, children);
}

const daOp = (op: string) => chamadas.filter((c) => c.op === op);
const argsDe = (op: string, metodo: string) =>
  daOp(op)
    .filter((c) => c.metodo === metodo)
    .map((c) => c.args);

beforeEach(() => {
  chamadas.length = 0;
  estado.restaurados = [];
  estado.erroRestaurar = null;
  estado.erroInsert = null;
});

describe("useEmailSuppressions.addSuppression", () => {
  it("restaura o descadastro que esta na lixeira e nao insere de novo", async () => {
    estado.restaurados = ["sup-1"];
    const { result } = renderHook(() => useEmailSuppressions(), { wrapper });

    await result.current.addSuppression.mutateAsync({ email: "  Fulano@Exemplo.COM " });

    const update = daOp("update");
    expect(update.length).toBeGreaterThan(0);
    expect(update[0].tabela).toBe("email_suppressions");
    expect(argsDe("update", "update")[0][0]).toEqual({ deleted_at: null });
    expect(argsDe("update", "eq")).toContainEqual(["email", "fulano@exemplo.com"]);
    expect(argsDe("update", "not")[0]).toEqual(["deleted_at", "is", null]);
    expect(daOp("insert")).toHaveLength(0);
  });

  it("insere quando o e-mail nao esta nem ativo nem na lixeira", async () => {
    const { result } = renderHook(() => useEmailSuppressions(), { wrapper });

    await result.current.addSuppression.mutateAsync({
      email: "Novo@Exemplo.com",
      notes: " pedido do cliente ",
    });

    expect(argsDe("update", "update")).toEqual([[{ deleted_at: null }]]);
    const inseridos = argsDe("insert", "insert")[0][0] as unknown as Record<string, unknown>[];
    expect(inseridos).toEqual([
      { email: "novo@exemplo.com", reason: "manual", notes: "pedido do cliente" },
    ]);
  });

  it("propaga o erro da restauracao e nao tenta inserir", async () => {
    estado.erroRestaurar = { message: "permission denied" };
    const { result } = renderHook(() => useEmailSuppressions(), { wrapper });

    await expect(
      result.current.addSuppression.mutateAsync({ email: "x@y.com" }),
    ).rejects.toThrow(/permission denied/);
    expect(daOp("insert")).toHaveLength(0);
  });
});