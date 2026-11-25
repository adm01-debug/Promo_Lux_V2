import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => {
  const state = { updated: false, allowWrite: false, updateCalls: 0 };
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.update = () => {
    state.updateCalls += 1;
    state.updated = true;
    return chain;
  };
  chain.insert = () => chain;
  chain.maybeSingle = () =>
    Promise.resolve(
      state.updated
        ? state.allowWrite
          ? { data: { id: "flag-1" }, error: null }
          : { data: null, error: null }
        : { data: { id: "flag-1", is_enabled: false }, error: null },
    );
  return { state, chain };
});

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => h.chain },
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

import { PlacesApiNewToggle } from "../PlacesApiNewToggle";

describe("PlacesApiNewToggle", () => {
  beforeEach(() => {
    h.state.updated = false;
    h.state.allowWrite = false;
    h.state.updateCalls = 0;
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it("avisa quando o UPDATE nao altera linha (RLS/sem permissao) em vez de mentir sucesso", async () => {
    render(<PlacesApiNewToggle />);
    const sw = await screen.findByRole("switch", {
      name: /Alternar Places API \(New\)/i,
    });
    await waitFor(() => expect(sw).not.toBeDisabled());

    fireEvent.click(sw);

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Falha: Sem permissão para alterar esta flag",
      ),
    );
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(screen.getByText("desativada")).toBeInTheDocument();
  });

  it("confirma sucesso quando o UPDATE altera a linha", async () => {
    h.state.allowWrite = true;
    render(<PlacesApiNewToggle />);
    const sw = await screen.findByRole("switch", {
      name: /Alternar Places API \(New\)/i,
    });
    await waitFor(() => expect(sw).not.toBeDisabled());

    fireEvent.click(sw);

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Places API (New) ativada"),
    );
    expect(toastError).not.toHaveBeenCalled();
    expect(screen.getByText("ativa")).toBeInTheDocument();
  });
});
