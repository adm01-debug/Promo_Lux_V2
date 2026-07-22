import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ConfirmProvider, useConfirm } from "@/hooks/useConfirm";

function Harness({ onResult }: { onResult: (r: boolean) => void }) {
  const confirm = useConfirm();
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await confirm({
          title: "Excluir item?",
          description: "Ação irreversível.",
          confirmLabel: "Excluir",
          variant: "destructive",
        });
        onResult(ok);
      }}
    >
      trigger
    </button>
  );
}

describe("useConfirm", () => {
  it("resolves true when the user confirms", async () => {
    let result: boolean | null = null;
    render(
      <ConfirmProvider>
        <Harness onResult={(r) => { result = r; }} />
      </ConfirmProvider>,
    );

    fireEvent.click(screen.getByText("trigger"));
    expect(await screen.findByText("Excluir item?")).toBeInTheDocument();
    expect(screen.getByText("Ação irreversível.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    await act(async () => { await Promise.resolve(); });
    await waitFor(() => expect(result).toBe(true));
  });

  it("resolves false when the user cancels", async () => {
    let result: boolean | null = null;
    render(
      <ConfirmProvider>
        <Harness onResult={(r) => { result = r; }} />
      </ConfirmProvider>,
    );

    fireEvent.click(screen.getByText("trigger"));
    await screen.findByText("Excluir item?");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await act(async () => { await Promise.resolve(); });
    await waitFor(() => expect(result).toBe(false));
  });

  it("throws when used outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Harness onResult={() => {}} />)).toThrow(
      /useConfirm must be used within/,
    );
    spy.mockRestore();
  });
});
