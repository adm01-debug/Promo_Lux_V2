/* eslint-disable react-hooks/rules-of-hooks -- os hooks sao chamados direto porque `useQuery`,
   `useActiveOrganization`, `useDemo` e `useAuth` estao todos mockados: nenhum hook real executa. */
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Guarda de organizacao ativa nas consultas do painel.
 *
 * Sem organizacao ativa nenhuma destas consultas pode sair: o `db` (withOrg) cai
 * no caminho sem filtro de `organization_id` e a leitura vira "todas as
 * organizacoes". O teste fixa o contrato `enabled` de cada consulta e falha se
 * alguem remover a condicao.
 */

type QueryOptions = { queryKey: unknown[]; enabled?: boolean };
const state = vi.hoisted(() => ({
  captured: [] as QueryOptions[],
  currentOrgId: null as string | null,
  currentDemo: false,
  dbFrom: vi.fn(),
}));
const captured = state.captured;

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: QueryOptions) => {
    captured.push(options);
    return { data: undefined, isLoading: true, isPending: true, error: null };
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn(), clear: vi.fn(), setQueryData: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  keepPreviousData: (previous: unknown) => previous,
}));

vi.mock("@/hooks/useOrganizations", () => ({
  useActiveOrganization: () => ({ activeOrgId: state.currentOrgId }),
}));



vi.mock("@/contexts/demo-context", () => ({
  useDemo: () => ({ isDemoMode: state.currentDemo, enterDemo: vi.fn(), exitDemo: vi.fn() }),
}));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ user: { id: "user-1" }, session: null, signOut: vi.fn() }),
}));

vi.mock("@/integrations/supabase/withOrg", () => ({
  db: { from: state.dbFrom },
  getActiveOrgId: () => state.currentOrgId,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: state.dbFrom,
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
}));

import { useRecentActivity, useRecentCompanies } from "@/hooks/useDashboardData";
import { useNotificationCount } from "@/hooks/useNotificationCount";
import { useVirtualCompanies } from "@/hooks/useVirtualCompanies";
import { useICPConfig } from "@/hooks/useICPConfig";
import { useAuditTables, useAuditTrail } from "@/hooks/useAuditTrail";
import { useOAuthSandboxSnapshots } from "@/hooks/useOAuthSandboxSnapshots";

/** Executa o hook e devolve as opcoes de consulta que ele registrou. */
function optionsOf(call: () => unknown): QueryOptions[] {
  const before = captured.length;
  call();
  const produced = captured.slice(before);
  expect(produced.length).toBeGreaterThan(0);
  return produced;
}

const CASOS: Array<{ nome: string; rodar: () => unknown; temDemo: boolean }> = [
  { nome: "empresas recentes do painel", rodar: () => useRecentCompanies(), temDemo: true },
  { nome: "atividade recente do painel", rodar: () => useRecentActivity(), temDemo: true },
  { nome: "contador de notificacoes", rodar: () => useNotificationCount(), temDemo: true },
  { nome: "lista virtualizada de empresas", rodar: () => useVirtualCompanies(), temDemo: false },
  { nome: "perfil de cliente ideal", rodar: () => useICPConfig(), temDemo: false },
  { nome: "filtro de tabelas da auditoria", rodar: () => useAuditTables(), temDemo: false },
  {
    nome: "trilha de auditoria",
    rodar: () =>
      useAuditTrail({ table: "all", action: "all", search: "", page: 1, pageSize: 20 }),
    temDemo: false,
  },
  { nome: "snapshots do sandbox OAuth", rodar: () => useOAuthSandboxSnapshots(), temDemo: false },
];

beforeEach(() => {
  captured.length = 0;
  state.currentOrgId = null;
  state.currentDemo = false;
  state.dbFrom.mockClear();
});

describe("consultas condicionadas a organizacao ativa", () => {
  it.each(CASOS)("nao consulta $nome sem organizacao ativa", ({ rodar }) => {
    state.currentOrgId = null;
    for (const options of optionsOf(rodar)) {
      expect(options.enabled).toBe(false);
    }
    expect(state.dbFrom).not.toHaveBeenCalled();
  });

  it.each(CASOS)("consulta $nome quando a organizacao esta ativa", ({ rodar }) => {
    state.currentOrgId = "org-1";
    for (const options of optionsOf(rodar)) {
      expect(options.enabled).toBe(true);
    }
  });

  it("libera as telas com dado de exemplo mesmo sem organizacao ativa", () => {
    state.currentOrgId = null;
    state.currentDemo = true;
    for (const caso of CASOS.filter((c) => c.temDemo)) {
      for (const options of optionsOf(caso.rodar)) {
        expect(options.enabled).toBe(true);
      }
    }
  });
});