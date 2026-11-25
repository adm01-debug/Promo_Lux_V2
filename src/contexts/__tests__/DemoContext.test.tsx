import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DemoProvider } from "../DemoContext";
import { useDemo, DEMO_KEY } from "../demo-context";

function TestConsumer() {
  const { isDemoMode, enterDemo, exitDemo } = useDemo();
  return (
    <div>
      <span data-testid="mode">{isDemoMode ? "demo" : "real"}</span>
      <button onClick={enterDemo}>enter</button>
      <button onClick={exitDemo}>exit</button>
    </div>
  );
}

function renderWithClient(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <DemoProvider>
        <TestConsumer />
      </DemoProvider>
    </QueryClientProvider>,
  );
}

describe("DemoProvider", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("clears the query cache when entering demo mode so real data never shows as demo", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      ["companies-list", false],
      [{ id: "empresa-real" }],
    );
    const clearSpy = vi.spyOn(queryClient, "clear");

    renderWithClient(queryClient);
    fireEvent.click(screen.getByText("enter"));

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("mode").textContent).toBe("demo");
    expect(localStorage.getItem(DEMO_KEY)).toBe("true");
    expect(queryClient.getQueryData(["companies-list", false])).toBeUndefined();
  });

  it("clears the query cache when leaving demo mode so sample data never leaks to a real session", () => {
    localStorage.setItem(DEMO_KEY, "true");
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      ["companies-list", true],
      [{ id: "empresa-demo" }],
    );
    const clearSpy = vi.spyOn(queryClient, "clear");

    renderWithClient(queryClient);
    expect(screen.getByTestId("mode").textContent).toBe("demo");
    fireEvent.click(screen.getByText("exit"));

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("mode").textContent).toBe("real");
    expect(localStorage.getItem(DEMO_KEY)).toBeNull();
    expect(queryClient.getQueryData(["companies-list", true])).toBeUndefined();
  });
});
