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
    emit({
      kind: "missing",
      title: "Nenhuma organização ativa",
      description:
        "Selecione uma organização no seletor antes de criar, editar ou remover registros.",
      table: err.table,
      op: err.op,
      occurredAt: new Date().toISOString(),
    });
  } else {
    emit({
      kind: "mismatch",
      title: "Operação bloqueada por segurança",
      description: `Tentativa de modificar registro de outra organização em "${err.table}". A ação foi cancelada.`,
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
    toast.error("Nenhuma organização ativa", {
      description:
        "Selecione uma organização antes de criar, editar ou remover registros.",
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
    toast.error("Operação bloqueada por segurança", {
      description: `Tentativa de modificar registro de outra organização em "${err.table}". A ação foi cancelada.`,
      action: {
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
