/**
 * Garantias de resiliência para `recordOrgViolation` (chamado dentro de
 * `handleOrgError`). A inserção em `audit_logs` é fire-and-forget: se
 * RLS bloquear, se a rede cair, se o cliente lançar exceção síncrona ou
 * se `auth.getUser` rejeitar, nada disso pode quebrar o fluxo do usuário
 * — o handler precisa continuar disparando toast, banner e retornando
 * `true` normalmente.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const toastError = vi.fn();
const toastInfo = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    info: (...args: unknown[]) => toastInfo(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

// Stubs configuráveis por teste — reatribuídos antes de cada cenário.
let getUserImpl: () => Promise<{ data: { user: { id: string } | null } }> = () =>
  Promise.resolve({ data: { user: { id: "user-1" } } });
let insertImpl: (row: unknown) => unknown = () => Promise.resolve({ error: null });
let fromImpl: (table: string) => { insert: typeof insertImpl } = () => ({
  insert: (row: unknown) => insertImpl(row),
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: () => getUserImpl() },
    from: (t: string) => fromImpl(t),
  },
}));

import { handleOrgError, resetCorrelationId } from "../orgErrorHandler";
import {
  OrgMismatchError,
  MissingOrgContextError,
} from "@/integrations/supabase/withOrg";

/**
 * Espera todas as microtasks pendentes drenarem (até 5 ticks). O insert
 * em audit_logs é encadeado em `.then(...)`, então precisamos garantir
 * que qualquer rejeição não tratada teria oportunidade de ser disparada
 * antes de afirmarmos "nada quebrou".
 */
async function flushMicrotasks(times = 5) {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

describe("recordOrgViolation — resiliência fire-and-forget", () => {
  let unhandled: unknown[] = [];
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let testCounter = 0;
  const onUnhandled = (ev: PromiseRejectionEvent | { reason: unknown }) => {
    unhandled.push((ev as { reason: unknown }).reason);
  };

  beforeEach(() => {
    toastError.mockClear();
    toastInfo.mockClear();
    toastSuccess.mockClear();
    unhandled = [];
    resetCorrelationId();
    vi.useFakeTimers();
    // Cada teste começa muito depois do anterior para escapar dos
    // throttles internos (1s para audit, 1.5s para toast). Usar
    // monotônico crescente é mais confiável que aleatório.
    const base = new Date(2030, 5, 1, 10, 0, 0).getTime();
    testCounter += 1;
    vi.setSystemTime(base + testCounter * 60_000);

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

    if (typeof process !== "undefined" && process.on) {
      process.on("unhandledRejection", onUnhandled);
    }

    // Defaults — cada teste sobrescreve conforme o cenário.
    getUserImpl = () => Promise.resolve({ data: { user: { id: "user-1" } } });
    insertImpl = () => Promise.resolve({ error: null });
    fromImpl = () => ({ insert: (row: unknown) => insertImpl(row) });
  });

  afterEach(() => {
    if (typeof process !== "undefined" && process.off) {
      process.off("unhandledRejection", onUnhandled);
    }
    consoleErrorSpy.mockRestore();
    consoleDebugSpy.mockRestore();
    vi.useRealTimers();
  });

  it("não quebra quando RLS rejeita o insert (retorno {error})", async () => {
    insertImpl = () =>
      Promise.resolve({
        error: { message: "new row violates row-level security policy", code: "42501" },
      });

    const err = new OrgMismatchError("companies", "update", "org-A", "org-B");
    expect(() => handleOrgError(err)).not.toThrow();
    expect(handleOrgError(err)).toBe(true);

    await flushMicrotasks();

    // Toast de UX continua sendo emitido normalmente.
    expect(toastError).toHaveBeenCalled();
    // Nenhuma rejeição não tratada deve vazar.
    expect(unhandled).toEqual([]);
    // E o erro reportado vai para console.debug, não para console.error
    // (não é um problema do usuário).
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("não quebra quando o insert rejeita (rede/offline)", async () => {
    insertImpl = () => Promise.reject(new Error("Failed to fetch"));

    const err = new MissingOrgContextError("deals", "insert");
    expect(() => handleOrgError(err)).not.toThrow();
    expect(handleOrgError(err)).toBe(true);

    await flushMicrotasks();

    expect(toastError).toHaveBeenCalled();
    expect(unhandled).toEqual([]);
  });

  it("não quebra quando supabase.from(...).insert lança síncrono", async () => {
    insertImpl = () => {
      throw new Error("client offline / invariant");
    };

    const err = new OrgMismatchError("stakeholders", "delete", "org-A", "org-B");
    expect(() => handleOrgError(err)).not.toThrow();
    expect(handleOrgError(err)).toBe(true);

    await flushMicrotasks();

    expect(toastError).toHaveBeenCalled();
    expect(unhandled).toEqual([]);
  });

  it("não quebra quando auth.getUser rejeita", async () => {
    getUserImpl = () => Promise.reject(new Error("session unavailable"));
    let insertCalled = false;
    insertImpl = () => {
      insertCalled = true;
      return Promise.resolve({ error: null });
    };

    const err = new MissingOrgContextError("campaigns", "select");
    expect(() => handleOrgError(err)).not.toThrow();
    expect(handleOrgError(err)).toBe(true);

    await flushMicrotasks();

    expect(toastError).toHaveBeenCalled();
    expect(insertCalled).toBe(false); // sem usuário, não tenta inserir
    expect(unhandled).toEqual([]);
  });

  it("não quebra quando não há sessão (getUser retorna user=null)", async () => {
    getUserImpl = () => Promise.resolve({ data: { user: null } });
    let insertCalled = false;
    insertImpl = () => {
      insertCalled = true;
      return Promise.resolve({ error: null });
    };

    const err = new OrgMismatchError("workflows", "select", "org-X", null);
    expect(handleOrgError(err)).toBe(true);

    await flushMicrotasks();

    expect(toastError).toHaveBeenCalled();
    expect(insertCalled).toBe(false);
    expect(unhandled).toEqual([]);
  });

  it("permanece estável em burst (várias falhas seguidas) sem unhandledRejection", async () => {
    // Mistura cenários: RLS, rede, sucesso. O throttle interno de 1s pode
    // suprimir alguns inserts — mas nenhum dos cenários pode estourar.
    let call = 0;
    insertImpl = () => {
      call++;
      if (call % 3 === 0) return Promise.reject(new Error("network"));
      if (call % 3 === 1)
        return Promise.resolve({ error: { message: "rls", code: "42501" } });
      return Promise.resolve({ error: null });
    };

    for (let i = 0; i < 12; i++) {
      // Avança o relógio para escapar do throttle entre toasts/audits.
      vi.setSystemTime(Date.now() + 2_000);
      const err =
        i % 2 === 0
          ? new OrgMismatchError("companies", "update", "org-A", "org-B")
          : new MissingOrgContextError("deals", "insert");
      expect(() => handleOrgError(err)).not.toThrow();
    }

    await flushMicrotasks(10);
    expect(unhandled).toEqual([]);
  });
});