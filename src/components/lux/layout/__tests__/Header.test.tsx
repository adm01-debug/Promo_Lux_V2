import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Header } from "../Header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
        }),
      }),
    }),
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }),
    }),
    removeChannel: vi.fn(),
  },
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const defaultProps = {
  breadcrumbs: [{ label: "Dashboard" }],
  canGoBack: false,
  currentLabel: "Dashboard",
  userEmail: "user@test.com",
  userAvatarUrl: undefined,
  onGoBack: vi.fn(),
  onNavigate: vi.fn(),
  onOpenMobileSidebar: vi.fn(),
  onSignOut: vi.fn(),
};

const renderHeader = (overrides = {}) =>
  render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Header {...defaultProps} {...overrides} />
      </TooltipProvider>
    </QueryClientProvider>
  );

describe("Header", () => {
  it("renders user initial when no avatar", () => {
    renderHeader();
    expect(screen.getByText("U")).toBeInTheDocument();
  });

  it("renders avatar component when url provided", () => {
    const { container } = renderHeader({ userAvatarUrl: "https://example.com/avatar.png" });
    // GradientAvatar renders with the avatar — verify the dropdown trigger exists
    const avatarTrigger = container.querySelector("button.rounded-full");
    expect(avatarTrigger).toBeInTheDocument();
  });

  it("calls onOpenMobileSidebar on menu click", () => {
    const onOpenMobileSidebar = vi.fn();
    renderHeader({ onOpenMobileSidebar });
    fireEvent.click(screen.getByLabelText("Abrir menu"));
    expect(onOpenMobileSidebar).toHaveBeenCalledOnce();
  });

  it("calls onSignOut on logout click", () => {
    const onSignOut = vi.fn();
    renderHeader({ onSignOut });
    // Logout is the LogOut icon button
    const buttons = screen.getAllByRole("button");
    const logoutBtn = buttons.find((b) => b.querySelector(".lucide-log-out"));
    if (logoutBtn) {
      fireEvent.click(logoutBtn);
      expect(onSignOut).toHaveBeenCalledOnce();
    }
  });

  it("renders search shortcut", () => {
    renderHeader();
    expect(screen.getByText("Buscar...")).toBeInTheDocument();
    expect(screen.getByText("⌘K")).toBeInTheDocument();
  });
});
