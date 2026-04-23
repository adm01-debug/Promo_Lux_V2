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

/**
 * Mensagens específicas por operação para `MissingOrgContextError`.
 * Mantém o tom direto: o que foi bloqueado + por quê + o que fazer.
 */
const MISSING_OP_COPY: Record<
  string,
  { title: string; description: (table: string) => string }
> = {
  insert: {
    title: "Criação bloqueada — sem organização ativa",
    description: (t) =>
      `Não foi possível criar o novo registro em "${t}" porque nenhuma organização está selecionada.`,
  },
  upsert: {
    title: "Gravação bloqueada — sem organização ativa",
    description: (t) =>
      `Não foi possível salvar (insert/update) em "${t}" porque nenhuma organização está selecionada.`,
  },
  update: {
    title: "Edição bloqueada — sem organização ativa",
    description: (t) =>
      `Não foi possível atualizar o registro em "${t}" porque nenhuma organização está selecionada.`,
  },
  delete: {
    title: "Exclusão bloqueada — sem organização ativa",
    description: (t) =>
      `Não foi possível remover o registro em "${t}" porque nenhuma organização está selecionada.`,
  },
};

function copyForMissing(err: MissingOrgContextError): { title: string; description: string } {
  const entry = MISSING_OP_COPY[err.op];
  if (entry) return { title: entry.title, description: entry.description(err.table) };
  return {
    title: "Operação bloqueada — sem organização ativa",
    description: `Não foi possível executar "${err.op}" em "${err.table}" porque nenhuma organização está selecionada.`,
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
  insert: {
    title: "Criação bloqueada — organização divergente",
    description: (t) =>
      `Tentativa de criar registro em "${t}" vinculado a outra organização. Verifique a organização ativa.`,
  },
  upsert: {
    title: "Gravação bloqueada — organização divergente",
    description: (t) =>
      `Tentativa de inserir/atualizar registro em "${t}" com organização diferente da ativa. Operação cancelada.`,
  },
  update: {
    title: "Edição bloqueada — organização divergente",
    description: (t) =>
      `Tentativa de modificar registro de outra organização em "${t}". Recarregue o registro na organização correta.`,
  },
  delete: {
    title: "Exclusão bloqueada — organização divergente",
    description: (t) =>
      `Tentativa de remover registro pertencente a outra organização em "${t}". Operação cancelada.`,
  },
};

function copyForMismatch(err: OrgMismatchError): { title: string; description: string } {
  const entry = MISMATCH_OP_COPY[err.op];
  if (entry) return { title: entry.title, description: entry.description(err.table) };
  return {
    title: "Operação bloqueada por segurança",
    description: `Tentativa de modificar registro de outra organização em "${err.table}". A ação foi cancelada.`,
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
      action: {
        label: "Selecionar organização",
        onClick: () => {
          emit(null);
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.set("view", "organizations");
            window.history.pushState({}, "", url.toString());
            // dispara popstate para o useNavigationHistory sincronizar
            window.dispatchEvent(new PopStateEvent("popstate"));
          }
        },
      },
    });
  } else {
    // OrgMismatchError
    const { title, description } = copyForMismatch(err);
    toast.error(title, {
      description,
      action: lastOperation
        ? {
            label: "Tentar novamente",
            onClick: () => {
              void refreshOrgAndRetry();
            },
          }
        : {
            label: "Recarregar dados",
            onClick: reload,
          },
    });
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
