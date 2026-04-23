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

import { handleOrgError, runWithOrgRetry } from "../orgErrorHandler";
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
    expect(opts.description).toMatch(/criar.*companies/i);
  });

  it("dispara toast específico para UPDATE sem org", () => {
    vi.setSystemTime(new Date(2030, 0, 1, 12, 0, 4));
    const err = new MissingOrgContextError("deals", "update");
    expect(handleOrgError(err)).toBe(true);
    const [title, opts] = toastError.mock.calls.at(-1) as [string, { description: string }];
    expect(title).toMatch(/Edição bloqueada/i);
    expect(opts.description).toMatch(/atualizar.*deals/i);
  });

  it("dispara toast específico para DELETE sem org", () => {
    vi.setSystemTime(new Date(2030, 0, 1, 12, 0, 6));
    const err = new MissingOrgContextError("webhooks", "delete");
    expect(handleOrgError(err)).toBe(true);
    const [title, opts] = toastError.mock.calls.at(-1) as [string, { description: string }];
    expect(title).toMatch(/Exclusão bloqueada/i);
    expect(opts.description).toMatch(/remover.*webhooks/i);
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
    expect(opts.description).toMatch(/companies/);
  });

  it("dispara toast específico para OrgMismatchError em INSERT", () => {
    vi.setSystemTime(new Date(2030, 0, 1, 12, 0, 35));
    const err = new OrgMismatchError("companies", "insert", "orgA", "orgB");
    handleOrgError(err);
    const [title, opts] = toastError.mock.calls.at(-1) as [string, { description: string }];
    expect(title).toMatch(/Criação bloqueada — organização divergente/i);
    expect(opts.description).toMatch(/criar.*companies/i);
  });

  it("dispara toast específico para OrgMismatchError em DELETE", () => {
    vi.setSystemTime(new Date(2030, 0, 1, 12, 0, 40));
    const err = new OrgMismatchError("webhooks", "delete", "orgA", "orgB");
    handleOrgError(err);
    const [title, opts] = toastError.mock.calls.at(-1) as [string, { description: string }];
    expect(title).toMatch(/Exclusão bloqueada — organização divergente/i);
    expect(opts.description).toMatch(/remover.*webhooks/i);
  });

  it("dispara toast específico para OrgMismatchError em UPSERT", () => {
    vi.setSystemTime(new Date(2030, 0, 1, 12, 0, 45));
    const err = new OrgMismatchError("deals", "upsert", "orgA", "orgB");
    handleOrgError(err);
    const [title, opts] = toastError.mock.calls.at(-1) as [string, { description: string }];
    expect(title).toMatch(/Gravação bloqueada — organização divergente/i);
    expect(opts.description).toMatch(/inserir\/atualizar.*deals/i);
  });

  it("ação 'Recarregar dados' está presente no toast de mismatch", () => {
    vi.setSystemTime(new Date(2030, 0, 1, 12, 0, 50));
    handleOrgError(new OrgMismatchError("companies", "update", "orgA", "orgB"));
    const [, opts] = toastError.mock.calls.at(-1) as [
      string,
      { action: { label: string } },
    ];
    expect(opts.action.label).toMatch(/Recarregar/i);
  });

  it("retorna false (não consome) para erro genérico", () => {
    expect(handleOrgError(new Error("outro erro"))).toBe(false);
    expect(toastError).not.toHaveBeenCalled();
  });
});