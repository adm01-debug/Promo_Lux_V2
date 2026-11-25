import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "../Sidebar";
import { NAV_ITEMS } from "../nav-items";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ count: 0, error: null }),
      }),
    }),
  },
}));

vi.mock("@/lib/viewRegistry", () => ({
  prefetchView: vi.fn(),
}));

const permissoes = vi.hoisted(() => ({ isAdmin: true }));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    role: permissoes.isAdmin ? "admin" : "viewer",
    isOwner: false,
    isAdmin: permissoes.isAdmin,
    isSDR: false,
    isViewer: !permissoes.isAdmin,
    can: () => permissoes.isAdmin,
  }),
  useCan: () => permissoes.isAdmin,
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const defaultProps = {
  activeView: "dashboard" as const,
  collapsed: false,
  mobileOpen: false,
  onNavigate: vi.fn(),
  onMobileClose: vi.fn(),
  onToggleCollapse: vi.fn(),
};

const renderSidebar = (overrides = {}) =>
  render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <Sidebar {...defaultProps} {...overrides} />
      </TooltipProvider>
    </QueryClientProvider>
  );

describe("Sidebar", () => {
  it("renders all nav items when expanded", () => {
    renderSidebar();
    NAV_ITEMS.forEach((item) => {
      const elements = screen.getAllByText(item.label);
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("hides labels when collapsed", () => {
    renderSidebar({ collapsed: true });
    NAV_ITEMS.forEach((item) => {
      expect(screen.queryByText(item.label)).not.toBeInTheDocument();
    });
  });

  it("calls onNavigate when a nav item is clicked", () => {
    const onNavigate = vi.fn();
    renderSidebar({ onNavigate });
    fireEvent.click(screen.getByText("Empresas"));
    expect(onNavigate).toHaveBeenCalledWith("companies");
  });

  it("calls onToggleCollapse when collapse button is clicked", () => {
    const onToggleCollapse = vi.fn();
    renderSidebar({ onToggleCollapse });
    fireEvent.click(screen.getByText("Recolher"));
    expect(onToggleCollapse).toHaveBeenCalledOnce();
  });

  it("highlights the active view", () => {
    renderSidebar({ activeView: "companies" });
    const btn = screen.getByText("Empresas").closest("button");
    expect(btn?.className).toContain("text-primary");
  });

  it("shows mobile close button when mobileOpen", () => {
    renderSidebar({ mobileOpen: true });
    const closeBtn = screen.getByLabelText("Fechar menu");
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(defaultProps.onMobileClose).toHaveBeenCalled();
  });

  it("shows section headers when expanded", () => {
    renderSidebar();
    expect(screen.getByText("Principal")).toBeInTheDocument();
    expect(screen.getByText("Prospecção")).toBeInTheDocument();
    expect(screen.getByText("Automação")).toBeInTheDocument();
    expect(screen.getByText("Sistema")).toBeInTheDocument();
  });

  it("mostra as rotas de administrador para quem é admin", () => {
    permissoes.isAdmin = true;
    renderSidebar();
    expect(screen.getByText("Monitoramento")).toBeInTheDocument();
    expect(screen.getByText("Empresas (Admin)")).toBeInTheDocument();
    permissoes.isAdmin = true;
  });

  it("esconde as rotas de administrador de quem não é admin", () => {
    permissoes.isAdmin = false;
    try {
      renderSidebar();
      expect(screen.queryByText("Monitoramento")).not.toBeInTheDocument();
      expect(screen.queryByText("Empresas (Admin)")).not.toBeInTheDocument();
      // itens de view continuam visíveis
      expect(screen.getByText("Empresas")).toBeInTheDocument();
    } finally {
      permissoes.isAdmin = true;
    }
  });

  it("abre a rota /monitoring pelo canal de deep link, sem chamar onNavigate", () => {
    permissoes.isAdmin = true;
    const onNavigate = vi.fn();
    const recebidos: string[] = [];
    const handler = (e: Event) => recebidos.push((e as CustomEvent<{ url: string }>).detail.url);
    window.addEventListener("lux:deep-link", handler);
    try {
      renderSidebar({ onNavigate });
      fireEvent.click(screen.getByText("Monitoramento"));
      expect(recebidos).toEqual(["/monitoring"]);
      expect(onNavigate).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("lux:deep-link", handler);
    }
  });

  it("não dispara deep link ao clicar em item de view", () => {
    permissoes.isAdmin = true;
    const onNavigate = vi.fn();
    const recebidos: string[] = [];
    const handler = (e: Event) => recebidos.push((e as CustomEvent<{ url: string }>).detail.url);
    window.addEventListener("lux:deep-link", handler);
    try {
      renderSidebar({ onNavigate });
      fireEvent.click(screen.getByText("Dashboard"));
      expect(onNavigate).toHaveBeenCalledWith("dashboard");
      expect(recebidos).toEqual([]);
    } finally {
      window.removeEventListener("lux:deep-link", handler);
    }
  });
});
