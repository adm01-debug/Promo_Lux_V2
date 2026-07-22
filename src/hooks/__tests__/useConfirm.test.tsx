import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmProvider, useConfirm } from "@/hooks/useConfirm";

function Harness({ onResult }: { onResult: (r: boolean) => void }) {
  const confirm = useConfirm();
  return (
    <button
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
    const user = userEvent.setup();
    let result: boolean | null = null;
    render(
      <ConfirmProvider>
        <Harness onResult={(r) => { result = r; }} />
      </ConfirmProvider>,
    );

    await user.click(screen.getByText("trigger"));
    expect(await screen.findByText("Excluir item?")).toBeInTheDocument();
    expect(screen.getByText("Ação irreversível.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await act(async () => { await Promise.resolve(); });
    expect(result).toBe(true);
  });

  it("resolves false when the user cancels", async () => {
    const user = userEvent.setup();
    let result: boolean | null = null;
    render(
      <ConfirmProvider>
        <Harness onResult={(r) => { result = r; }} />
      </ConfirmProvider>,
    );

    await user.click(screen.getByText("trigger"));
    await screen.findByText("Excluir item?");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await act(async () => { await Promise.resolve(); });
    expect(result).toBe(false);
  });

  it("throws when used outside the provider", () => {
    // Silence expected error boundary console noise
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Harness onResult={() => {}} />)).toThrow(
      /useConfirm must be used within/,
    );
    spy.mockRestore();
  });
});
