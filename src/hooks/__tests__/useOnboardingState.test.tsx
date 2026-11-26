import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useOnboardingState } from "@/hooks/useOnboardingState";

/**
 * Etapa 197: o cliente do banco devolve o erro no resultado em vez de lancar.
 * O hook lia apenas `data`, entao o `catch` nunca rodava e uma falha de leitura
 * fazia o passo a passo reaparecer para quem ja tinha concluido.
 */

const state = vi.hoisted(() => ({
  profile: { data: null, error: null } as { data: unknown; error: unknown },
}));

vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("@/integrations/supabase/client", () => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve(state.profile),
    update: () => builder,
  };
  return { supabase: { from: () => builder } };
});

beforeEach(() => {
  state.profile = { data: null, error: null };
  localStorage.clear();
});

describe("useOnboardingState (etapa 197)", () => {
  it("nao mostra o passo a passo quando a leitura do perfil falha", async () => {
    state.profile = { data: null, error: { message: "network" } };
    const { result } = renderHook(() => useOnboardingState());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.shouldShow).toBe(false);
  });

  it("mostra quando o perfil existe e o passo a passo nao foi concluido", async () => {
    state.profile = { data: { onboarding_completed: false }, error: null };
    const { result } = renderHook(() => useOnboardingState());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.shouldShow).toBe(true);
  });

  it("nao mostra e grava o cache local quando ja foi concluido", async () => {
    state.profile = { data: { onboarding_completed: true }, error: null };
    const { result } = renderHook(() => useOnboardingState());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.shouldShow).toBe(false);
    expect(localStorage.getItem("lux-onboarding-done")).toBe("true");
  });
});
