import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CompanyTable } from "../CompanyTable";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock framer-motion so useInView/animate resolve synchronously in jsdom.
vi.mock("framer-motion", async () => {
  const { mockFramerMotion } = await import("@/test/mockFramerMotion");
  return mockFramerMotion();
});

// Only mock the data source. The REAL useVirtualization runs so we exercise
// the windowing/scroll logic instead of a static stub.
vi.mock("@/hooks/useVirtualCompanies", () => ({
  useVirtualCompanies: vi.fn(),
}));

import { useVirtualCompanies } from "@/hooks/useVirtualCompanies";

const ITEM_HEIGHT = 72; // must match CompanyTable's virtualization config
const CONTAINER_HEIGHT = 480; // simulated visible viewport height
const TOTAL = 60;

const mockCompanies = Array.from({ length: TOTAL }, (_, i) => ({
  id: String(i),
  name: `Empresa ${i}`,
  sector: "Tech",
  location: "SP",
  ipc_score: 50 + (i % 40),
  website: null,
  source: "gmaps",
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={qc}>
    <TooltipProvider>{children}</TooltipProvider>
  </QueryClientProvider>
);

// jsdom does not perform layout, so clientHeight is always 0. We stub it so
// CompanyTable's containerRef effect derives a realistic container height and
// the virtualization window matches a real browser.
let clientHeightSpy: PropertyDescriptor | undefined;

beforeAll(() => {
  clientHeightSpy = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get() {
      return CONTAINER_HEIGHT;
    },
  });
});

afterAll(() => {
  if (clientHeightSpy) {
    Object.defineProperty(HTMLElement.prototype, "clientHeight", clientHeightSpy);
  }
});

function renderTable() {
  vi.mocked(useVirtualCompanies).mockReturnValue({ data: mockCompanies, isLoading: false } as ReturnType<typeof useVirtualCompanies>);
  const utils = render(<CompanyTable />, { wrapper });
  const scrollContainer = utils.container.querySelector(".overflow-y-auto") as HTMLElement;
  return { ...utils, scrollContainer };
}

describe("CompanyTable — integração de virtualização com scroll", () => {
  it("renderiza apenas uma janela de linhas, não a lista inteira", () => {
    const { container } = renderTable();
    const rows = container.querySelectorAll("tbody tr");

    // Virtualização real: com 60 itens e viewport de 480px, apenas uma fração
    // deve estar no DOM (janela + overscan), nunca as 60 linhas.
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(TOTAL);
  });

  it("mostra os primeiros itens no topo e esconde os itens distantes", () => {
    renderTable();
    expect(screen.getByText("Empresa 0")).toBeInTheDocument();
    expect(screen.queryByText(`Empresa ${TOTAL - 1}`)).not.toBeInTheDocument();
  });

  it("revela itens mais abaixo após rolar e recicla os do topo", () => {
    const { scrollContainer } = renderTable();
    expect(scrollContainer).toBeTruthy();

    // Antes do scroll: item distante não está montado.
    expect(screen.queryByText("Empresa 45")).not.toBeInTheDocument();

    // Rola até aproximadamente a linha 45.
    act(() => {
      Object.defineProperty(scrollContainer, "scrollTop", {
        configurable: true,
        value: 45 * ITEM_HEIGHT,
      });
      fireEvent.scroll(scrollContainer);
    });

    // Depois do scroll: item distante montado, item do topo reciclado.
    expect(screen.getByText("Empresa 45")).toBeInTheDocument();
    expect(screen.queryByText("Empresa 0")).not.toBeInTheDocument();
  });

  it("mantém o container com altura total proporcional ao número de itens", () => {
    const { scrollContainer } = renderTable();
    const spacer = scrollContainer.firstElementChild as HTMLElement;
    // O spacer interno reserva a altura total (itens * itemHeight) para o scrollbar.
    expect(spacer.style.height).toBe(`${TOTAL * ITEM_HEIGHT}px`);
  });
});
