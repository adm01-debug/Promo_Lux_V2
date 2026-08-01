import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { createElement } from "react";

const invokeMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
    from: vi.fn(),
  },
}));

vi.mock("@/contexts/active-org-context", () => ({
  useActiveOrganization: () => ({ activeOrgId: "org-1", activeOrg: null, setActive: () => {} }),
}));

import { useDlqReplay } from "../useDlqReplay";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

describe("useDlqReplay", () => {
  beforeEach(() => invokeMock.mockReset());

  it("invoca instagram-dlq-replay com o payload correto e retorna o result", async () => {
    invokeMock.mockResolvedValue({
      data: { ok: true, result: { replayed: 3, skipped: 1, errors: 0 } },
      error: null,
    });
    const { result } = renderHook(() => useDlqReplay("instagram"), { wrapper });
    const out = await result.current.mutateAsync({
      organization_id: "org-1",
      dlq_ids: ["a", "b"],
      reason: "teste",
    });
    expect(invokeMock).toHaveBeenCalledWith("instagram-dlq-replay", {
      body: { organization_id: "org-1", dlq_ids: ["a", "b"], reason: "teste" },
    });
    expect(out).toEqual({ replayed: 3, skipped: 1, errors: 0 });
  });

  it("invoca web-dlq-replay quando motor é 'web'", async () => {
    invokeMock.mockResolvedValue({
      data: { ok: true, result: { replayed: 5, skipped: 0, errors: 0 } },
      error: null,
    });
    const { result } = renderHook(() => useDlqReplay("web"), { wrapper });
    await result.current.mutateAsync({ organization_id: "org-1", limit: 25 });
    expect(invokeMock).toHaveBeenCalledWith("web-dlq-replay", {
      body: { organization_id: "org-1", limit: 25 },
    });
  });

  it("extrai a mensagem de FunctionsHttpError via context.text()", async () => {
    const httpErr = Object.create(FunctionsHttpError.prototype) as FunctionsHttpError;
    Object.assign(httpErr, {
      message: "non-2xx",
      context: { text: async () => '{"error":"forbidden_org"}' } as unknown as Response,
    });
    invokeMock.mockResolvedValue({ data: null, error: httpErr });
    const { result } = renderHook(() => useDlqReplay("instagram"), { wrapper });
    await expect(
      result.current.mutateAsync({ organization_id: "org-1" }),
    ).rejects.toThrow(/forbidden_org/);
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("preenche zeros quando o edge devolve result parcial", async () => {
    invokeMock.mockResolvedValue({ data: { ok: true }, error: null });
    const { result } = renderHook(() => useDlqReplay("instagram"), { wrapper });
    const out = await result.current.mutateAsync({ organization_id: "org-1" });
    expect(out).toEqual({ replayed: 0, skipped: 0, errors: 0 });
  });
});
