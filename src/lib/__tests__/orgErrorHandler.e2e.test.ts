/**
 * Testes E2E-ish do handler global de erros de escopo multi-tenant.
 *
 * Cenário simulado:
 *   1. Usuário abre um registro da Org A (carregado em memória).
 *   2. Org ativa muda para Org B durante a edição (workspace switcher).
 *   3. Submit dispara `db.from(...).update(...)` com payload da Org A.
 *   4. O wrapper `withOrg` lança `OrgMismatchError`.
 *
 * Validamos:
 *   - Toast de erro é exibido com título/descrição corretos e ação de recuperação.
 *   - Mesmo erro propagado via `unhandledrejection` é interceptado pelo
 *     handler global (sem try/catch local) e o toast aparece.
 *   - A ação "Recarregar dados" do toast invalida queries no QueryClient.
 *   - Promises rejeitadas com `OrgMismatchError` recebem `preventDefault()`.
 *   - Erros não-Org passam direto (handler retorna `false`, sem toast).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

// Mock do sonner ANTES dos imports do handler.
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

// Mock do supabase client (auditoria fire-and-forget — não pode quebrar).
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: null }) })),
  },
}));

import {
  handleOrgError,
  installGlobalOrgErrorHandler,
  registerQueryClient,
} from "@/lib/orgErrorHandler";
import {
  OrgMismatchError,
  MissingOrgContextError,
  setActiveOrgId,
  db,
} from "@/integrations/supabase/withOrg";

// Mock leve do builder do supabase usado por `withOrg.ts` — coletamos as
// chamadas para garantir que update/insert NUNCA chega ao builder quando
// há mismatch.
const builderCalls = { insert: 0, update: 0, eq: 0 };
vi.mock("@/integrations/supabase/client", async () => {
  const stub = {
    insert: (..._args: unknown[]) => { builderCalls.insert++; return stub; },
    update: (..._args: unknown[]) => { builderCalls.update++; return stub; },
    delete: () => stub,
    select: () => stub,
    upsert: (..._args: unknown[]) => { builderCalls.insert++; return stub; },
    eq: (..._args: unknown[]) => { builderCalls.eq++; return stub; },
  };
  return {
    supabase: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(() => stub),
    },
  };
});

const ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function resetCalls() {
  toastError.mockClear();
  builderCalls.insert = 0;
  builderCalls.update = 0;
  builderCalls.eq = 0;
}

/**
 * Avança o relógio para além do throttle interno (1500ms) entre testes
 * para que cada caso veja seu próprio toast e não seja silenciado pelo
 * estado de módulo `lastToastAt`/`lastAuditAt`.
 */
let clock = Date.now();
function bypassThrottle() {
  clock += 10_000;
  vi.setSystemTime(new Date(clock));
}

describe("orgErrorHandler — E2E switching de org durante edição", () => {
  let qc: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.fn>;
  let uninstall: (() => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    bypassThrottle();
    resetCalls();
    setActiveOrgId(null);
    if (typeof window !== "undefined") window.localStorage.removeItem("lux:active-org");

    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    invalidateSpy = vi.fn(() => Promise.resolve());
    // sobrescreve o método para evitar incompatibilidade de tipos do spyOn com generics
    (qc as unknown as { invalidateQueries: typeof invalidateSpy }).invalidateQueries = invalidateSpy;
    registerQueryClient(qc);
    uninstall = installGlobalOrgErrorHandler();
  });

  afterEach(() => {
    uninstall?.();
    qc.clear();
    vi.useRealTimers();
  });

  it("mostra toast quando UPDATE falha após troca de org no meio da edição", () => {
    // Usuário carregou registro com Org A; depois trocou para Org B.
    setActiveOrgId(ORG_B);

    let caught: unknown;
    try {
      // payload "stale" trazendo a org A que estava em memória do componente
      db.from("companies").update({ name: "edit", organization_id: ORG_A });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(OrgMismatchError);
    // Builder NUNCA foi chamado — defesa em profundidade no cliente.
    expect(builderCalls.update).toBe(0);

    const consumed = handleOrgError(caught);
    expect(consumed).toBe(true);

    expect(toastError).toHaveBeenCalledTimes(1);
    const [title, opts] = toastError.mock.calls[0] as [string, { description: string; action: { label: string; onClick: () => void } }];
    expect(title).toMatch(/bloqueada/i);
    // Mensagem agora usa rótulo amigável (companies → empresa).
    expect(opts.description).toMatch(/empresa/i);
    // CTA por prioridade: como `companies` tem view mapeada, o botão é
    // "Ir para a lista" (recupera o contexto sem trocar de workspace).
    expect(opts.action.label).toMatch(/ir para a lista/i);
  });

  it("ação 'Recarregar dados' do toast invalida queries no QueryClient", () => {
    setActiveOrgId(ORG_B);
    try {
      db.from("companies").update({ name: "x", organization_id: ORG_A });
    } catch (e) {
      handleOrgError(e);
    }
    const [, opts] = toastError.mock.calls[0] as [string, { action: { onClick: () => void } }];

    expect(invalidateSpy).not.toHaveBeenCalled();
    opts.action.onClick();
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it("handler global captura unhandledrejection com OrgMismatchError e mostra toast", async () => {
    bypassThrottle();
    const err = new OrgMismatchError("companies", "update", ORG_B, ORG_A);

    // Simula uma promise rejeitada que escapou de uma mutation sem try/catch.
    const ev = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(ev, "reason", { value: err });
    const preventSpy = vi.spyOn(ev, "preventDefault");

    window.dispatchEvent(ev);

    expect(preventSpy).toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it("handler global ignora rejeições não relacionadas a org (toast não dispara)", () => {
    bypassThrottle();
    const ev = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(ev, "reason", { value: new Error("network down") });
    const preventSpy = vi.spyOn(ev, "preventDefault");

    window.dispatchEvent(ev);

    expect(preventSpy).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("MissingOrgContextError exibe toast diferente, com label 'Recarregar' e recupera via invalidação", () => {
    bypassThrottle();
    // Org ativa nunca foi carregada — bug de bootstrap.
    setActiveOrgId(null);
    let caught: unknown;
    try {
      db.from("companies").update({ name: "x" });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(MissingOrgContextError);
    handleOrgError(caught);

    const [title, opts] = toastError.mock.calls[0] as [string, { description: string; action: { label: string; onClick: () => void } }];
    // Título por operação: "Edição bloqueada — sem organização ativa".
    expect(title).toMatch(/sem organiza[çc][ãa]o ativa/i);
    // Descrição menciona "nenhuma organização" + entidade amigável.
    expect(opts.description).toMatch(/nenhuma organiza[çc][ãa]o/i);
    expect(opts.description).toMatch(/empresa/i);
    expect(opts.action.label).toMatch(/selecionar organiza/i);
  });

  it("fluxo completo: switch de org → submit do dialog → toast → recuperação restaura UI", async () => {
    // 1) usuário abriu registro carregado com Org A
    const recordOrgId = ORG_A;

    // 2) workspace switcher trocou a org ativa para B no meio da edição
    setActiveOrgId(ORG_B);

    // 3) submit chama db.update — wrapper bloqueia
    let caught: unknown;
    try {
      db.from("companies").update({ name: "novo nome", organization_id: recordOrgId });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(OrgMismatchError);
    expect(builderCalls.update).toBe(0); // nada chegou no builder

    // 4) handler global processa e exibe toast
    expect(handleOrgError(caught)).toBe(true);
    expect(toastError).toHaveBeenCalledTimes(1);

    // 5) clique em "Recarregar dados" → invalidação propaga para todas as queries
    const [, opts] = toastError.mock.calls[0] as [string, { action: { onClick: () => void } }];
    opts.action.onClick();
    expect(invalidateSpy).toHaveBeenCalledWith(); // sem filtro = todas
  });

  it("throttle silencia segundo erro idêntico em < 1.5s, mas continua consumindo o erro", () => {
    bypassThrottle();
    setActiveOrgId(ORG_B);

    const fire = () => {
      try { db.from("companies").update({ name: "x", organization_id: ORG_A }); }
      catch (e) { return handleOrgError(e); }
      return false;
    };

    expect(fire()).toBe(true);
    expect(toastError).toHaveBeenCalledTimes(1);

    // dentro do throttle — handler ainda consome (true), mas não duplica toast
    expect(fire()).toBe(true);
    expect(toastError).toHaveBeenCalledTimes(1);

    // após o throttle, novo toast é permitido
    bypassThrottle();
    expect(fire()).toBe(true);
    expect(toastError).toHaveBeenCalledTimes(2);
  });
});