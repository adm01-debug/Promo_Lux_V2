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

let qcRef: QueryClient | null = null;

/** Registra o QueryClient para a ação "Recarregar dados". */
export function registerQueryClient(qc: QueryClient) {
  qcRef = qc;
}

let lastToastAt = 0;
const THROTTLE_MS = 1500;

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
        label: "Recarregar",
        onClick: reload,
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
