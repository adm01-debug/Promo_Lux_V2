import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock sonner antes de importar o handler
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

// Mock supabase client (auth.getUser e from(...).insert) — fire-and-forget
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    from: () => ({ insert: () => Promise.resolve({ error: null }) }),
  },
}));

import {
  handleOrgError,
  runWithOrgRetry,
  viewForTable,
  navigateAfterOrgMismatch,
} from "../orgErrorHandler";
import {
  OrgMismatchError,
  MissingOrgContextError,
} from "@/integrations/supabase/withOrg";

describe("handleOrgError → toast", () => {
  beforeEach(() => {
    toastError.mockClear();
    toastInfo.mockClear();
    toastSuccess.mockClear();
    // zera throttle interno aguardando o intervalo (1500ms) seria lento;
    // como o módulo mantém estado, espaçamos os testes manualmente alterando Date.now
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2030, 0, 1, 12, 0, 0));
  });

  it("dispara toast específico para INSERT sem org", () => {
    const err = new MissingOrgContextError("companies", "insert");
    expect(handleOrgError(err)).toBe(true);
    expect(toastError).toHaveBeenCalledTimes(1);
    const [title, opts] = toastError.mock.calls[0] as [string, { description: string }];
    expect(title).toMatch(/Criação bloqueada/i);
    // entidade amigável: companies → empresa
    expect(opts.description).toMatch(/criar.*empresa/i);
  });

  it("dispara toast específico para UPDATE sem org", () => {
    vi.setSystemTime(new Date(2030, 0, 1, 12, 0, 4));
    const err = new MissingOrgContextError("deals", "update");
    expect(handleOrgError(err)).toBe(true);
    const [title, opts] = toastError.mock.calls.at(-1) as [string, { description: string }];
    expect(title).toMatch(/Edição bloqueada/i);
    expect(opts.description).toMatch(/atualizar.*neg[óo]cio/i);
  });

  it("dispara toast específico para DELETE sem org", () => {
    vi.setSystemTime(new Date(2030, 0, 1, 12, 0, 6));
    const err = new MissingOrgContextError("webhooks", "delete");
    expect(handleOrgError(err)).toBe(true);
    const [title, opts] = toastError.mock.calls.at(-1) as [string, { description: string }];
    expect(title).toMatch(/Exclusão bloqueada/i);
    expect(opts.description).toMatch(/remover.*webhook/i);
  });

  it("dispara toast com tabela quando recebe OrgMismatchError", () => {
    // avança o relógio para escapar do throttle (1.5s) dos testes anteriores
    vi.setSystemTime(new Date(2030, 0, 1, 12, 0, 30));
    const err = new OrgMismatchError("companies", "update", "orgA", "orgB");
    const consumed = handleOrgError(err);
    expect(consumed).toBe(true);
    expect(toastError).toHaveBeenCalledTimes(1);
    const [title, opts] = toastError.mock.calls[0] as [string, { description: string }];
    expect(title).toMatch(/Edição bloqueada — organização divergente/i);
    expect(opts.description).toMatch(/empresa/i);
  });

  it("dispara toast específico para OrgMismatchError em INSERT", () => {
    vi.setSystemTime(new Date(2030, 0, 1, 12, 0, 35));
    const err = new OrgMismatchError("companies", "insert", "orgA", "orgB");
    handleOrgError(err);
    const [title, opts] = toastError.mock.calls.at(-1) as [string, { description: string }];
    expect(title).toMatch(/Criação bloqueada — organização divergente/i);
    expect(opts.description).toMatch(/criar.*empresa/i);
  });

  it("dispara toast específico para OrgMismatchError em DELETE", () => {
    vi.setSystemTime(new Date(2030, 0, 1, 12, 0, 40));
    const err = new OrgMismatchError("webhooks", "delete", "orgA", "orgB");
    handleOrgError(err);
    const [title, opts] = toastError.mock.calls.at(-1) as [string, { description: string }];
    expect(title).toMatch(/Exclusão bloqueada — organização divergente/i);
    expect(opts.description).toMatch(/remover.*webhook/i);
  });

  it("dispara toast específico para OrgMismatchError em UPSERT", () => {
    vi.setSystemTime(new Date(2030, 0, 1, 12, 0, 45));
    const err = new OrgMismatchError("deals", "upsert", "orgA", "orgB");
    handleOrgError(err);
    const [title, opts] = toastError.mock.calls.at(-1) as [string, { description: string }];
    expect(title).toMatch(/Gravação bloqueada — organização divergente/i);
    expect(opts.description).toMatch(/inserir\/atualizar.*neg[óo]cio/i);
  });

  it("ação 'Ir para a lista' aparece quando a tabela tem view mapeada (companies)", () => {
    vi.setSystemTime(new Date(2030, 0, 1, 12, 0, 50));
    handleOrgError(new OrgMismatchError("companies", "update", "orgA", "orgB"));
    const [, opts] = toastError.mock.calls.at(-1) as [
      string,
      { action: { label: string } },
    ];
    expect(opts.action.label).toMatch(/Ir para a lista/i);
  });

  it("fallback 'Recarregar dados' quando tabela não tem view mapeada", () => {
    vi.setSystemTime(new Date(2030, 0, 1, 12, 0, 55));
    handleOrgError(new OrgMismatchError("tabela_inexistente", "update", "orgA", "orgB"));
    const [, opts] = toastError.mock.calls.at(-1) as [
      string,
      { action: { label: string } },
    ];
    // novo CTA padrão quando não há view mapeada nem operação registrada:
    // "Selecionar organização" (leva direto ao seletor de workspace).
    expect(opts.action.label).toMatch(/Selecionar organiza/i);
  });

  it("viewForTable mapeia tabelas conhecidas e retorna null para desconhecidas", () => {
    expect(viewForTable("companies")).toBe("companies");
    expect(viewForTable("deal_tasks")).toBe("deals");
    expect(viewForTable("scrape_results")).toBe("scrape-results");
    expect(viewForTable("desconhecida")).toBeNull();
    expect(viewForTable(null)).toBeNull();
    expect(viewForTable(undefined)).toBeNull();
  });

  it("navigateAfterOrgMismatch redireciona para a view correta e dispara popstate", () => {
    vi.useRealTimers();
    const pushSpy = vi.spyOn(window.history, "pushState");
    const popListener = vi.fn();
    window.addEventListener("popstate", popListener);

    navigateAfterOrgMismatch("stakeholders");

    expect(pushSpy).toHaveBeenCalled();
    const url = new URL((pushSpy.mock.calls.at(-1) as [unknown, string, string])[2], "http://localhost");
    expect(url.searchParams.get("view")).toBe("stakeholders");
    expect(popListener).toHaveBeenCalled();

    window.removeEventListener("popstate", popListener);
    pushSpy.mockRestore();
  });

  it("usa ação 'Tentar novamente' quando há operação registrada via runWithOrgRetry", async () => {
    // Avança o relógio para escapar do throttle (1.5s) e mantém fake timers
    // para previsibilidade; usamos setImmediate-equivalente via microtasks.
    vi.setSystemTime(new Date(2030, 0, 1, 12, 1, 0));
    // Registra uma operação que falha uma vez (mismatch) e sucede na retry.
    let attempts = 0;
    const op = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new OrgMismatchError("companies", "update", "orgA", "orgB");
      }
      return { ok: true };
    });

    await expect(runWithOrgRetry(op, "Atualizar empresa")).rejects.toBeInstanceOf(
      OrgMismatchError,
    );

    // O catch externo (em React Query) chamaria handleOrgError; simulamos:
    handleOrgError(new OrgMismatchError("companies", "update", "orgA", "orgB"));
    const [, opts] = toastError.mock.calls.at(-1) as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    expect(opts.action.label).toMatch(/Tentar novamente/i);

    // Aciona o retry — refreshOrgAndRetry é async, aguardamos microtasks.
    vi.useRealTimers();
    opts.action.onClick();
    // Drena microtasks até o toast de sucesso aparecer.
    for (let i = 0; i < 20 && toastSuccess.mock.calls.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 5));
    }

    expect(op).toHaveBeenCalledTimes(2);
    expect(toastInfo).toHaveBeenCalledWith(
      "Tentando novamente…",
      expect.objectContaining({ description: "Atualizar empresa" }),
    );
    expect(toastSuccess).toHaveBeenCalledWith(
      "Operação concluída",
      expect.objectContaining({ description: "Atualizar empresa" }),
    );
  });

  it("retorna false (não consome) para erro genérico", () => {
    expect(handleOrgError(new Error("outro erro"))).toBe(false);
    expect(toastError).not.toHaveBeenCalled();
  });
});