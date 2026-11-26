import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRemoveChannel, mockInvalidateQueries, mockRefetch } = vi.hoisted(() => ({
  mockRemoveChannel: vi.fn(),
  mockInvalidateQueries: vi.fn(),
  mockRefetch: vi.fn(),
}));

let channels: string[] = [];
let lastFilter: string | null = null;

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [], isLoading: false, refetch: mockRefetch }),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: (name: string) => {
      channels.push(name);
      const channel: Record<string, unknown> = {};
      channel.on = (_event: string, config: { filter?: string }) => {
        lastFilter = config.filter ?? null;
        return channel;
      };
      channel.subscribe = () => ({});
      return channel;
    },
    removeChannel: mockRemoveChannel,
  },
}));

// A leitura instantânea do módulo fica parada na organização antiga de
// propósito: é exatamente o cenário do achado (snapshot que não acompanha a
// troca) — o canal precisa seguir o Context.
vi.mock("@/integrations/supabase/withOrg", () => ({
  db: { from: () => ({ select: () => ({ is: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }) }) },
  getActiveOrgId: () => "org-a",
}));

let currentOrg = "org-a";

vi.mock("@/contexts/active-org-context", () => ({
  useActiveOrganization: () => ({ activeOrgId: currentOrg, activeOrg: null, setActive: vi.fn() }),
}));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ user: { id: "u-1" } }),
}));

import { renderHook } from "@testing-library/react";
import { useAutomationsMonitor } from "../useAutomationsMonitor";

describe("useAutomationsMonitor — canal em tempo real", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channels = [];
    lastFilter = null;
    currentOrg = "org-a";
  });

  it("abre o canal com a organização ativa", () => {
    renderHook(() => useAutomationsMonitor());
    expect(channels[channels.length - 1]).toBe("org:org-a:automations");
    expect(lastFilter).toBe("organization_id=eq.org-a");
  });

  it("recria o canal com a organização nova quando ela muda", () => {
    const { rerender } = renderHook(() => useAutomationsMonitor());

    currentOrg = "org-b";
    rerender();

    expect(channels[channels.length - 1]).toBe("org:org-b:automations");
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
  });
});