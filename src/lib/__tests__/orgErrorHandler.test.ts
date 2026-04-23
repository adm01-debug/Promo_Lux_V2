import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock sonner antes de importar o handler
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

// Mock supabase client (auth.getUser e from(...).insert) — fire-and-forget
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    from: () => ({ insert: () => Promise.resolve({ error: null }) }),
  },
}));

import { handleOrgError } from "../orgErrorHandler";
import {
  OrgMismatchError,
  MissingOrgContextError,
} from "@/integrations/supabase/withOrg";

describe("handleOrgError → toast", () => {
  beforeEach(() => {
    toastError.mockClear();
    // zera throttle interno aguardando o intervalo (1500ms) seria lento;
    // como o módulo mantém estado, espaçamos os testes manualmente alterando Date.now
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2030, 0, 1, 12, 0, 0));
  });

  it("dispara toast quando recebe MissingOrgContextError", () => {
    const err = new MissingOrgContextError("companies", "insert");
    const consumed = handleOrgError(err);
    expect(consumed).toBe(true);
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError.mock.calls[0][0]).toMatch(/Nenhuma organização ativa/i);
  });

  it("dispara toast com tabela quando recebe OrgMismatchError", () => {
    // avança 2s para limpar throttle do teste anterior
    vi.setSystemTime(new Date(2030, 0, 1, 12, 0, 2));
    const err = new OrgMismatchError("companies", "update", "orgA", "orgB");
    const consumed = handleOrgError(err);
    expect(consumed).toBe(true);
    expect(toastError).toHaveBeenCalledTimes(1);
    const [title, opts] = toastError.mock.calls[0] as [string, { description: string }];
    expect(title).toMatch(/bloqueada por segurança/i);
    expect(opts.description).toMatch(/companies/);
  });

  it("retorna false (não consome) para erro genérico", () => {
    expect(handleOrgError(new Error("outro erro"))).toBe(false);
    expect(toastError).not.toHaveBeenCalled();
  });
});