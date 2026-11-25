/* eslint-disable react-hooks/rules-of-hooks -- os hooks sao chamados dentro de `renderHook`; o lint nao reconhece o callback como componente */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

/**
 * Guarda de escopo de cache por organizacao (etapa 017).
 *
 * As consultas abaixo sao escopadas pela organizacao ativa (via `db`/withOrg ou
 * por RLS). Se a organizacao nao fizer parte da chave de cache, trocar de
 * organizacao reaproveita o dado da anterior enquanto a nova consulta carrega
 * (o `invalidateQueries` da troca e assincrono). O teste falha se alguem
 * remover o `activeOrgId` da chave.
 */

type QueryOptions = { queryKey: unknown[]; enabled?: boolean };
const state = vi.hoisted(() => ({
  captured: [] as QueryOptions[],
  currentOrgId: "org-1" as string | null,
  currentDemo: false,
  dbFrom: vi.fn(),
}));
const captured = state.captured;

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: QueryOptions) => {
    captured.push(options);
    return { data: undefined, isLoading: true, isPending: true, error: null };
  },
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
    clear: vi.fn(),
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
    cancelQueries: vi.fn(),
  }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  keepPreviousData: (previous: unknown) => previous,
}));

const orgValue = () => ({
  activeOrgId: state.currentOrgId,
  activeOrg: null,
  setActive: () => undefined,
});

vi.mock("@/contexts/active-org-context", () => ({
  useActiveOrganization: () => orgValue(),
}));

vi.mock("@/hooks/useOrganizations", () => ({
  useActiveOrganization: () => orgValue(),
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
    channel: () => {
      const canal: Record<string, unknown> = {};
      canal.on = () => canal;
      canal.subscribe = () => canal;
      return canal;
    },
    removeChannel: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
}));

import { useDealStages, useDealTasks, useDeals } from "@/hooks/useDeals";
import { useEmailTemplateStats, useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useWeeklyPerformance } from "@/hooks/useWeeklyPerformance";
import { useApiKeys } from "@/hooks/useApiKeys";
import { useWebhooks } from "@/hooks/useWebhooks";
import { useEmailSuppressions } from "@/hooks/useEmailSuppressions";
import { useNotificationCount } from "@/hooks/useNotificationCount";
import { useVirtualCompanies } from "@/hooks/useVirtualCompanies";
import { useICPConfig } from "@/hooks/useICPConfig";
import { useDeadLetterQueue, useScrapeQueue } from "@/hooks/useScrapeQueue";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useWebScrapeTasks } from "@/hooks/useWebScrape";
import { useOraclePreflight } from "@/hooks/useOracleV2";
import { useApiLatency, useApiLatencyTrend } from "@/hooks/useApiLatency";
import { useAuditTables, useAuditTrail } from "@/hooks/useAuditTrail";
import { useRecentActivity, useRecentCompanies } from "@/hooks/useDashboardData";
import { useAutomationsMonitor } from "@/hooks/useAutomationsMonitor";

const CASOS: Array<{ nome: string; rodar: () => unknown }> = [
  { nome: "negocios", rodar: () => useDeals() },
  { nome: "estagios do funil", rodar: () => useDealStages() },
  { nome: "tarefas do negocio", rodar: () => useDealTasks(null) },
  { nome: "modelos de e-mail", rodar: () => useEmailTemplates() },
  { nome: "estatisticas de modelos", rodar: () => useEmailTemplateStats() },
  { nome: "desempenho semanal", rodar: () => useWeeklyPerformance() },
  { nome: "chaves de API", rodar: () => useApiKeys() },
  { nome: "webhooks", rodar: () => useWebhooks() },
  { nome: "supressoes de e-mail", rodar: () => useEmailSuppressions() },
  { nome: "contador de notificacoes", rodar: () => useNotificationCount() },
  { nome: "lista virtualizada de empresas", rodar: () => useVirtualCompanies() },
  { nome: "perfil de cliente ideal", rodar: () => useICPConfig() },
  { nome: "fila de raspagem", rodar: () => useScrapeQueue() },
  { nome: "fila morta de raspagem", rodar: () => useDeadLetterQueue() },
  { nome: "flags de funcionalidade", rodar: () => useFeatureFlags() },
  { nome: "tasks de scraping nativo", rodar: () => useWebScrapeTasks() },
  { nome: "preflight do Oracle", rodar: () => useOraclePreflight() },
  { nome: "latencia da API", rodar: () => useApiLatency() },
  { nome: "tendencia de latencia", rodar: () => useApiLatencyTrend() },
  { nome: "filtro de tabelas da auditoria", rodar: () => useAuditTables() },
  {
    nome: "trilha de auditoria",
    rodar: () => useAuditTrail({ table: "all", action: "all", search: "", page: 1, pageSize: 20 }),
  },
  { nome: "empresas recentes do painel", rodar: () => useRecentCompanies() },
  { nome: "atividade recente do painel", rodar: () => useRecentActivity() },
  { nome: "monitoramento de automacoes", rodar: () => useAutomationsMonitor() },
];

/** Chaves registradas ao montar o hook com a organizacao informada. */
function keysFor(rodar: () => unknown, orgId: string | null): string[] {
  state.currentOrgId = orgId;
  captured.length = 0;
  renderHook(rodar);
  const keys = captured.map((o) => JSON.stringify(o.queryKey));
  expect(keys.length, `${JSON.stringify(keys)}`).toBeGreaterThan(0);
  return keys;
}

beforeEach(() => {
  captured.length = 0;
  state.currentOrgId = "org-1";
  state.currentDemo = false;
  state.dbFrom.mockClear();
});

describe("chave de cache escopada por organizacao", () => {
  it.each(CASOS)("$nome troca de chave ao trocar de organizacao", ({ rodar }) => {
    const daOrg1 = keysFor(rodar, "org-1");
    const daOrg2 = keysFor(rodar, "org-2");
    for (const key of daOrg1) expect(key).toContain("org-1");
    for (const key of daOrg2) expect(key).toContain("org-2");
    expect(daOrg1).not.toEqual(daOrg2);
  });
});