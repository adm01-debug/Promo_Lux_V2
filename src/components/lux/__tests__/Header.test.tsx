import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Header } from "../layout/Header";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("../NotificationsPanel", () => ({
  NotificationsPanel: ({ open }: any) => open ? <div data-testid="notifications-panel" /> : null,
  useNotificationCount: () => 3,
}));

vi.mock("../GradientAvatar", () => ({
  GradientAvatar: ({ email }: any) => <div data-testid="avatar">{email}</div>,
}));

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
    <TooltipProvider>
      <Header {...defaultProps} {...overrides} />
    </TooltipProvider>
  );

describe("Header — P1 Avatar Dropdown Menu", () => {
  it("renders the avatar with user email", () => {
    renderHeader();
    expect(screen.getByTestId("avatar")).toHaveTextContent("user@test.com");
  });

  it("does NOT render standalone logout button in header bar", () => {
    renderHeader();
    // Logout should be inside dropdown, not visible by default
    expect(screen.queryByText("Sair")).not.toBeInTheDocument();
  });

  it("shows dropdown with Settings and Logout on avatar click", async () => {
    renderHeader();
    // Click the avatar trigger button
    const avatarBtn = screen.getByTestId("avatar").closest("button");
    fireEvent.click(avatarBtn!);
    
    // Now dropdown items should appear
    expect(await screen.findByText("Configurações")).toBeInTheDocument();
    expect(await screen.findByText("Sair")).toBeInTheDocument();
  });

  it("shows user email in dropdown label", async () => {
    renderHeader();
    const avatarBtn = screen.getByTestId("avatar").closest("button");
    fireEvent.click(avatarBtn!);
    
    expect(await screen.findByText("user@test.com")).toBeInTheDocument();
  });

  it("calls onNavigate('settings') when Settings clicked", async () => {
    const onNavigate = vi.fn();
    renderHeader({ onNavigate });
    
    const avatarBtn = screen.getByTestId("avatar").closest("button");
    fireEvent.click(avatarBtn!);
    
    const settingsItem = await screen.findByText("Configurações");
    fireEvent.click(settingsItem);
    expect(onNavigate).toHaveBeenCalledWith("settings");
  });

  it("calls onSignOut when Sair clicked", async () => {
    const onSignOut = vi.fn();
    renderHeader({ onSignOut });
    
    const avatarBtn = screen.getByTestId("avatar").closest("button");
    fireEvent.click(avatarBtn!);
    
    const logoutItem = await screen.findByText("Sair");
    fireEvent.click(logoutItem);
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it("renders notification bell with unread badge", () => {
    renderHeader();
    const badge = screen.getByText("3");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("rounded-full");
  });

  it("renders keyboard shortcut button (hidden sm:inline-flex)", () => {
    const { container } = renderHeader();
    const kbdBtn = container.querySelector('[class*="hidden sm:inline-flex"]');
    expect(kbdBtn).toBeInTheDocument();
  });

  it("renders search bar with ⌘K shortcut", () => {
    renderHeader();
    expect(screen.getByText("Buscar...")).toBeInTheDocument();
    expect(screen.getByText("⌘K")).toBeInTheDocument();
  });

  it("renders ThemeToggle", () => {
    const { container } = renderHeader();
    // ThemeToggle renders a button; just verify header-actions area
    const actions = container.querySelector('[data-tour="header-actions"]');
    expect(actions).toBeInTheDocument();
  });

  it("renders mobile menu button with aria-label", () => {
    renderHeader();
    const menuBtn = screen.getByLabelText("Abrir menu");
    expect(menuBtn).toBeInTheDocument();
    expect(menuBtn.className).toContain("lg:hidden");
  });

  it("calls onOpenMobileSidebar on mobile menu click", () => {
    const onOpenMobileSidebar = vi.fn();
    renderHeader({ onOpenMobileSidebar });
    fireEvent.click(screen.getByLabelText("Abrir menu"));
    expect(onOpenMobileSidebar).toHaveBeenCalledOnce();
  });

  it("header has sticky positioning", () => {
    const { container } = renderHeader();
    const header = container.querySelector("header");
    expect(header?.className).toContain("sticky");
    expect(header?.className).toContain("top-0");
  });

  it("shows 'Usuário' fallback when no email provided", async () => {
    renderHeader({ userEmail: undefined });
    const avatarBtn = screen.getByTestId("avatar").closest("button");
    fireEvent.click(avatarBtn!);
    expect(await screen.findByText("Usuário")).toBeInTheDocument();
  });

  it("logout item has destructive styling", async () => {
    renderHeader();
    const avatarBtn = screen.getByTestId("avatar").closest("button");
    fireEvent.click(avatarBtn!);
    
    const logoutItem = await screen.findByText("Sair");
    expect(logoutItem.closest("[class*=destructive]") || logoutItem.className.includes("destructive") || logoutItem.closest("[class]")?.className.includes("destructive")).toBeTruthy();
  });
});
