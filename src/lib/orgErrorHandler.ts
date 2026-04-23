/**
 * Tratamento padronizado para erros de escopo multi-tenant lançados pelo
 * wrapper `db` (`withOrg.ts`). Mostra toast com mensagem clara e ação de
 * recuperação (recarregar dados da org ativa).
 *
 * Uso típico (dentro de mutations / try-catch):
 *   try { await db.from("companies").insert(...) }
 *   catch (e) { if (handleOrgError(e)) return; throw e; }
 *
 * Também é instalado globalmente em App.tsx para capturar promises não
 * tratadas que escapem das mutations.
 */
import { toast } from "sonner";
import type { QueryClient } from "@tanstack/react-query";
import { OrgMismatchError, MissingOrgContextError } from "@/integrations/supabase/withOrg";
import { supabase } from "@/integrations/supabase/client";

let qcRef: QueryClient | null = null;

/** Registra o QueryClient para a ação "Recarregar dados". */
export function registerQueryClient(qc: QueryClient) {
  qcRef = qc;
}

/* ---------- Mapa tabela → view de listagem ---------- */

/**
 * Quando um OrgMismatchError bloqueia a abertura de um registro (ex.: o
 * usuário trocou de org enquanto um modal/detail estava aberto), levamos
 * o usuário de volta para a tela de listagem correspondente — assim ele
 * recupera o contexto sem ficar olhando para um modal vazio. Tabelas não
 * mapeadas caem no fallback "dashboard".
 */
const TABLE_TO_VIEW: Record<string, string> = {
  companies: "companies",
  stakeholders: "stakeholders",
  deals: "deals",
  deal_stages: "deals",
  deal_tasks: "deals",
  deal_activities: "deals",
  campaigns: "campaigns",
  campaign_recipients: "campaigns",
  campaign_messages: "campaigns",
  campaign_replies: "campaigns",
  campaign_events: "campaigns",
  workflows: "workflows",
  workflow_runs: "workflows",
  scrape_jobs: "scrape-results",
  scrape_results: "scrape-results",
  intent_signals: "intent",
  ipc_config: "icp",
  webhooks: "integrations",
  webhook_deliveries: "integrations",
  email_accounts: "integrations",
  email_sync_log: "integrations",
  api_keys: "integrations",
  api_request_logs: "integrations",
  notifications: "dashboard",
  organization_members: "organizations",
  organization_invites: "organizations",
  organizations: "organizations",
};

/** Retorna a view alvo para uma tabela (ou null se não mapeada). */
export function viewForTable(table?: string | null): string | null {
  if (!table) return null;
  return TABLE_TO_VIEW[table] ?? null;
}

/**
 * Redireciona o usuário para a view de listagem associada à tabela do
 * erro e dispara `popstate` para o `useNavigationHistory` sincronizar.
 * Também limpa o banner. Se a tabela não tiver mapeamento, apenas
 * recarrega os dados (fallback seguro).
 */
export function navigateAfterOrgMismatch(table?: string | null) {
  const view = viewForTable(table);
  if (typeof window === "undefined") return;
  if (!view) {
    reloadAfterOrgError();
    return;
  }
  emit(null);
  const url = new URL(window.location.href);
  if (view === "dashboard") url.searchParams.delete("view");
  else url.searchParams.set("view", view);
  window.history.pushState({}, "", url.toString());
  window.dispatchEvent(new PopStateEvent("popstate"));
  // Recarrega queries para garantir dados frescos da org ativa.
  if (qcRef) qcRef.invalidateQueries();
}

/* ---------- Última operação para "Tentar novamente" ---------- */

/**
 * Guarda a última operação executada via `runWithOrgRetry`. Quando um
 * OrgMismatchError ocorre, o toast oferece a ação "Tentar novamente",
 * que primeiro recarrega a lista de organizações ativas e depois
 * reexecuta esta função. O slot é único (last-wins) para evitar
 * vazamento de closures de operações antigas.
 */
type RetryFn = () => Promise<unknown>;
let lastOperation: { fn: RetryFn; label: string } | null = null;

/**
 * Envolve uma operação (mutation, fetch direto etc.) registrando-a como
 * a "última" — usada para o botão "Tentar novamente" no toast de
 * OrgMismatchError. Se a operação lançar um erro de escopo, o handler
 * é acionado e devolve o erro ao caller para que React Query / try-catch
 * locais sigam o fluxo normal.
 *
 * Uso:
 *   await runWithOrgRetry(() => db.from("companies").update(...).eq("id", id), "Atualizar empresa");
 */
export async function runWithOrgRetry<T>(
  fn: () => Promise<T>,
  label = "Última operação",
): Promise<T> {
  lastOperation = { fn: fn as RetryFn, label };
  return await fn();
}

/**
 * Recarrega a organização ativa (refetch de `my-organizations`) e em
 * seguida reexecuta a última operação registrada. Retorna `true` se
 * conseguiu acionar a retry, `false` caso contrário.
 */
async function refreshOrgAndRetry(): Promise<boolean> {
  if (!lastOperation) return false;
  const op = lastOperation;
  try {
    if (qcRef) {
      // Refetch da lista de orgs garante que o valor em memória de
      // `getActiveOrgId()` esteja consistente com o servidor antes de
      // tentarmos novamente.
      await qcRef.refetchQueries({ queryKey: ["my-organizations"] });
    }
    toast.info("Tentando novamente…", { description: op.label });
    await op.fn();
    toast.success("Operação concluída", { description: op.label });
    if (qcRef) qcRef.invalidateQueries();
    emit(null);
    return true;
  } catch (err) {
    // Se ainda houver mismatch, o handler será re-invocado naturalmente
    // pela própria `fn`. Caso seja outro erro, mostramos um toast neutro.
    if (err instanceof OrgMismatchError || err instanceof MissingOrgContextError) {
      handleOrgError(err);
    } else {
      toast.error("Falha ao reexecutar", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
    return false;
  }
}

/* ---------- Pub/sub para banners inline globais ---------- */

export interface OrgErrorBannerState {
  kind: "missing" | "mismatch";
  title: string;
  description: string;
  table?: string;
  op?: string;
  expected?: string | null;
  got?: string | null;
  occurredAt: string;
}

type Listener = (state: OrgErrorBannerState | null) => void;
const listeners = new Set<Listener>();
let currentBanner: OrgErrorBannerState | null = null;

export function subscribeOrgErrorBanner(fn: Listener): () => void {
  listeners.add(fn);
  // Empurra o estado atual imediatamente para novos assinantes.
  fn(currentBanner);
  return () => listeners.delete(fn);
}

function emit(state: OrgErrorBannerState | null) {
  currentBanner = state;
  listeners.forEach((l) => {
    try {
      l(state);
    } catch {
      /* listener defensivo */
    }
  });
}

export function clearOrgErrorBanner() {
  emit(null);
}

/** Permite reuso da ação "recarregar dados" pelo banner inline. */
export function reloadAfterOrgError() {
  if (!qcRef) {
    if (typeof window !== "undefined") window.location.reload();
    return;
  }
  qcRef.invalidateQueries();
  emit(null);
}

let lastToastAt = 0;
const THROTTLE_MS = 1500;

/* ---------- Rótulos amigáveis (entidade + operação) ---------- */

/**
 * Mapeia nomes técnicos das tabelas para rótulos amigáveis usados nos
 * toasts. Mantém o nome no singular/plural natural conforme o contexto
 * mais comum da mensagem ("ao consultar empresas", "ao criar empresa").
 * Tabelas não mapeadas caem no nome cru entre aspas.
 */
const ENTITY_LABELS: Record<string, { singular: string; plural: string }> = {
  agent_chat_messages: { singular: "mensagem do agente IA", plural: "mensagens do agente IA" },
  api_keys: { singular: "chave de API", plural: "chaves de API" },
  api_request_logs: { singular: "log de requisição", plural: "logs de requisições" },
  audit_logs: { singular: "registro de auditoria", plural: "trilha de auditoria" },
  campaign_events: { singular: "evento de campanha", plural: "eventos de campanha" },
  campaign_messages: { singular: "mensagem de campanha", plural: "mensagens de campanha" },
  campaign_recipients: { singular: "destinatário", plural: "destinatários da campanha" },
  campaign_replies: { singular: "resposta de campanha", plural: "respostas de campanha" },
  campaigns: { singular: "campanha", plural: "campanhas" },
  companies: { singular: "empresa", plural: "empresas" },
  deal_activities: { singular: "atividade de negócio", plural: "atividades de negócio" },
  deal_stages: { singular: "estágio do funil", plural: "estágios do funil" },
  deal_tasks: { singular: "tarefa", plural: "tarefas de negócio" },
  deals: { singular: "negócio", plural: "negócios" },
  email_accounts: { singular: "conta de e-mail", plural: "contas de e-mail" },
  intent_signals: { singular: "sinal de intenção", plural: "sinais de intenção" },
  ipc_config: { singular: "configuração de ICP", plural: "configurações de ICP" },
  notifications: { singular: "notificação", plural: "notificações" },
  scrape_jobs: { singular: "job de coleta", plural: "jobs de coleta" },
  scrape_results: { singular: "resultado de coleta", plural: "resultados de coleta" },
  stakeholders: { singular: "stakeholder", plural: "stakeholders" },
  webhook_deliveries: { singular: "entrega de webhook", plural: "entregas de webhook" },
  webhooks: { singular: "webhook", plural: "webhooks" },
  workflow_runs: { singular: "execução de workflow", plural: "execuções de workflow" },
  workflows: { singular: "workflow", plural: "workflows" },
};

function entityLabel(table: string | undefined, form: "singular" | "plural" = "singular"): string {
  if (!table) return form === "plural" ? "estes recursos" : "este recurso";
  const e = ENTITY_LABELS[table];
  if (!e) return `"${table}"`;
  return e[form];
}

/** CTA padrão: leva o usuário direto à tela de gestão de workspaces. */
function selectOrganizationAction() {
  return {
    label: "Selecionar organização",
    onClick: () => {
      emit(null);
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      url.searchParams.set("view", "organizations");
      window.history.pushState({}, "", url.toString());
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
  };
}

/**
 * Mensagens específicas por operação para `MissingOrgContextError`.
 * Mantém o tom direto: o que foi bloqueado + por quê + o que fazer.
 */
const MISSING_OP_COPY: Record<
  string,
  { title: string; description: (table: string) => string }
> = {
  select: {
    title: "Consulta bloqueada — sem organização ativa",
    description: (t) =>
      `Não foi possível carregar ${entityLabel(t, "plural")} porque nenhuma organização está selecionada.`,
  },
  insert: {
    title: "Criação bloqueada — sem organização ativa",
    description: (t) =>
      `Não foi possível criar ${entityLabel(t, "singular")} porque nenhuma organização está selecionada.`,
  },
  upsert: {
    title: "Gravação bloqueada — sem organização ativa",
    description: (t) =>
      `Não foi possível salvar ${entityLabel(t, "singular")} (insert/update) porque nenhuma organização está selecionada.`,
  },
  update: {
    title: "Edição bloqueada — sem organização ativa",
    description: (t) =>
      `Não foi possível atualizar ${entityLabel(t, "singular")} porque nenhuma organização está selecionada.`,
  },
  delete: {
    title: "Exclusão bloqueada — sem organização ativa",
    description: (t) =>
      `Não foi possível remover ${entityLabel(t, "singular")} porque nenhuma organização está selecionada.`,
  },
};

function copyForMissing(err: MissingOrgContextError): { title: string; description: string } {
  const entry = MISSING_OP_COPY[err.op];
  if (entry) return { title: entry.title, description: entry.description(err.table) };
  return {
    title: "Operação bloqueada — sem organização ativa",
    description: `Não foi possível executar "${err.op}" em ${entityLabel(err.table)} porque nenhuma organização está selecionada.`,
  };
}

/**
 * Mensagens específicas por operação para `OrgMismatchError`.
 * Diferente do MissingOp (sem org ativa), aqui há org ativa mas o
 * registro/payload aponta para outra — falamos em "cross-org" e damos
 * pistas concretas do que o usuário deve fazer.
 */
const MISMATCH_OP_COPY: Record<
  string,
  { title: string; description: (table: string) => string }
> = {
  select: {
    title: "Consulta bloqueada — organização divergente",
    description: (t) =>
      `Tentativa de consultar ${entityLabel(t, "plural")} de outra organização. Confirme o workspace ativo antes de tentar novamente.`,
  },
  insert: {
    title: "Criação bloqueada — organização divergente",
    description: (t) =>
      `Tentativa de criar ${entityLabel(t, "singular")} vinculada a outra organização. Verifique o workspace ativo.`,
  },
  upsert: {
    title: "Gravação bloqueada — organização divergente",
    description: (t) =>
      `Tentativa de inserir/atualizar ${entityLabel(t, "singular")} com organização diferente da ativa. Operação cancelada.`,
  },
  update: {
    title: "Edição bloqueada — organização divergente",
    description: (t) =>
      `Tentativa de modificar ${entityLabel(t, "singular")} de outra organização. Recarregue o registro no workspace correto.`,
  },
  delete: {
    title: "Exclusão bloqueada — organização divergente",
    description: (t) =>
      `Tentativa de remover ${entityLabel(t, "singular")} pertencente a outra organização. Operação cancelada.`,
  },
};

function copyForMismatch(err: OrgMismatchError): { title: string; description: string } {
  const entry = MISMATCH_OP_COPY[err.op];
  if (entry) return { title: entry.title, description: entry.description(err.table) };
  return {
    title: "Operação bloqueada por segurança",
    description: `Tentativa de acessar ${entityLabel(err.table)} de outra organização. A ação foi cancelada.`,
  };
}

/**
 * Registra a tentativa bloqueada na trilha de auditoria (`audit_logs`)
 * com `table_name="__org_violation"` para separá-la das mutações reais.
 * Fire-and-forget: erros de inserção (ex.: RLS, offline) são ignorados —
 * auditoria nunca pode quebrar o fluxo do usuário. Throttle próprio para
 * evitar floods quando várias queries falham simultaneamente.
 */
let lastAuditAt = 0;
const AUDIT_THROTTLE_MS = 1000;
function recordOrgViolation(err: OrgMismatchError | MissingOrgContextError) {
  const now = Date.now();
  if (now - lastAuditAt < AUDIT_THROTTLE_MS) return;
  lastAuditAt = now;

  const payload = {
    kind: err.name,
    table: (err as OrgMismatchError).table,
    op: (err as OrgMismatchError).op,
    expected_org: (err as OrgMismatchError).expected ?? null,
    received_org:
      err instanceof OrgMismatchError ? String((err as OrgMismatchError).got) : null,
    url: typeof window !== "undefined" ? window.location.pathname : null,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    occurred_at: new Date().toISOString(),
  };

  void supabase.auth.getUser().then(({ data }) => {
    const user = data.user;
    if (!user) return;
    const orgId = (err as OrgMismatchError).expected ?? null;
    void supabase
      .from("audit_logs")
      .insert({
        action: "update",
        table_name: "__org_violation",
        record_id: user.id,
        actor_id: user.id,
        organization_id: orgId,
        old_data: null,
        new_data: payload,
      })
      .then(({ error }) => {
        if (error && typeof console !== "undefined") {
          console.debug("[orgErrorHandler] audit insert skipped:", error.message);
        }
      });
  });
}

/**
 * Inspeciona um erro arbitrário; se for um erro de escopo, exibe toast
 * com ação de recuperação e retorna `true` (consumido). Caso contrário
 * retorna `false` para o caller decidir como tratar.
 */
export function handleOrgError(err: unknown): boolean {
  if (
    !(err instanceof OrgMismatchError) &&
    !(err instanceof MissingOrgContextError)
  ) {
    return false;
  }

  // Auditoria estruturada — antes do throttle do toast, para que bursts
  // continuem registrados (com throttle próprio mais curto).
  recordOrgViolation(err);

  // Empurra estado para o banner inline (sem throttle — o componente
  // decide como renderizar e desduplicar visualmente).
  if (err instanceof MissingOrgContextError) {
    const { title, description } = copyForMissing(err);
    emit({
      kind: "missing",
      title,
      description,
      table: err.table,
      op: err.op,
      occurredAt: new Date().toISOString(),
    });
  } else {
    const { title, description } = copyForMismatch(err);
    emit({
      kind: "mismatch",
      title,
      description,
      table: err.table,
      op: err.op,
      expected: err.expected ?? null,
      got: String((err as OrgMismatchError).got ?? ""),
      occurredAt: new Date().toISOString(),
    });
  }

  // Throttle simples — várias queries falhando juntas não geram spam.
  const now = Date.now();
  if (now - lastToastAt < THROTTLE_MS) return true;
  lastToastAt = now;

  const reload = () => {
    if (!qcRef) {
      // Fallback: full reload se não temos QueryClient registrado.
      if (typeof window !== "undefined") window.location.reload();
      return;
    }
    qcRef.invalidateQueries();
  };

  if (err instanceof MissingOrgContextError) {
    const { title, description } = copyForMissing(err);
    toast.error(title, {
      description,
      action: selectOrganizationAction(),
    });
  } else {
    // OrgMismatchError
    const { title, description } = copyForMismatch(err);
    // Prioridade da ação:
    //  1. Se há operação registrada → "Tentar novamente" (com refresh de org).
    //  2. Se a tabela tem view mapeada → "Ir para <lista>" (recupera contexto).
    //  3. Fallback → "Selecionar organização" (CTA direto para o switcher).
    const targetView = viewForTable(err.table);
    const action = lastOperation
      ? {
          label: "Tentar novamente",
          onClick: () => {
            void refreshOrgAndRetry();
          },
        }
      : targetView
        ? {
            label: "Ir para a lista",
            onClick: () => navigateAfterOrgMismatch(err.table),
          }
        : selectOrganizationAction();
    toast.error(title, { description, action });
  }

  // Log estruturado (útil em produção/sentry).
  if (typeof console !== "undefined") {
    console.warn("[orgErrorHandler]", err.name, {
      table: (err as OrgMismatchError).table,
      op: (err as OrgMismatchError).op,
    });
  }

  return true;
}

/**
 * Instala um listener global para promises não tratadas — útil quando o
 * erro escapa de uma mutation sem try/catch explícito.
 */
export function installGlobalOrgErrorHandler() {
  if (typeof window === "undefined") return;
  const onRejection = (ev: PromiseRejectionEvent) => {
    if (handleOrgError(ev.reason)) {
      ev.preventDefault();
    }
  };
  window.addEventListener("unhandledrejection", onRejection);
  return () => window.removeEventListener("unhandledrejection", onRejection);
}
