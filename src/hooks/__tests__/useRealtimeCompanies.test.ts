import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInvalidateQueries, mockToast, mockInsert, mockRemoveChannel } = vi.hoisted(() => ({
  mockInvalidateQueries: vi.fn(),
  mockToast: vi.fn(),
  mockInsert: vi.fn().mockResolvedValue({ error: null }),
  mockRemoveChannel: vi.fn(),
}));
type RealtimePayload = { eventType: string; new: Record<string, unknown> };
type SubscribeCb = (payload: RealtimePayload) => void | Promise<void>;
let subscribeCb: SubscribeCb | null = null;
let capturedChannelName: string | null = null;
let capturedOnConfig: Record<string, unknown> | null = null;

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockUser = { id: "test-user-id" };
let currentUser: typeof mockUser | null = mockUser;

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: currentUser }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: (name: string) => {
      capturedChannelName = name;
      return {
        on: (_event: string, config: Record<string, unknown>, cb: SubscribeCb) => {
          capturedOnConfig = config;
          subscribeCb = cb;
          return { subscribe: () => ({}) };
        },
      };
    },
    removeChannel: mockRemoveChannel,
    from: () => ({ insert: mockInsert }),
  },
}));

// Mock withOrg and db to prevent MissingOrgContextError in tests
vi.mock("@/integrations/supabase/withOrg", () => ({
  db: {
    from: (table: string) => ({
      insert: mockInsert,
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
    }),
  },
  getActiveOrgId: () => "test-org-id",
}));

import { renderHook } from "@testing-library/react";
import { useRealtimeCompanies } from "../useRealtimeCompanies";

describe("useRealtimeCompanies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscribeCb = null;
    capturedChannelName = null;
    capturedOnConfig = null;
    currentUser = mockUser;
  });

  // --- Private channel tests ---

  it("uses private channel name scoped to user id", () => {
    renderHook(() => useRealtimeCompanies());
    expect(capturedChannelName).toBe("private:test-user-id:companies");
  });

  it("applies user_id filter in subscription config", () => {
    renderHook(() => useRealtimeCompanies());
    expect(capturedOnConfig).toMatchObject({
      event: "*",
      schema: "public",
      table: "companies",
      filter: "user_id=eq.test-user-id",
    });
  });

  it("does not subscribe when user is null", () => {
    currentUser = null;
    renderHook(() => useRealtimeCompanies());
    expect(capturedChannelName).toBeNull();
    expect(subscribeCb).toBeNull();
  });

  it("removes channel on unmount", () => {
    const { unmount } = renderHook(() => useRealtimeCompanies());
    unmount();
    expect(mockRemoveChannel).toHaveBeenCalled();
  });

  // --- Existing behavior tests ---

  it("subscribes to realtime channel on mount", () => {
    renderHook(() => useRealtimeCompanies());
    expect(subscribeCb).toBeDefined();
  });

  it("invalidates queries on any event", async () => {
    renderHook(() => useRealtimeCompanies());
    await subscribeCb!({ eventType: "UPDATE", new: {} });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["companies-list"] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["companies-map"] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["dashboard-stats"] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["recent-companies"] });
  });

  it("shows toast on INSERT event for scraped company", async () => {
    renderHook(() => useRealtimeCompanies());
    await subscribeCb!({
      eventType: "INSERT",
      new: { name: "TestCo", source: "gmaps", sector: "Tech", location: "SP" },
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("raspada") })
    );
  });

  it("shows different title for manual source", async () => {
    renderHook(() => useRealtimeCompanies());
    await subscribeCb!({
      eventType: "INSERT",
      new: { name: "ManualCo", source: "manual", sector: "", location: "" },
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("adicionada") })
    );
  });

  it("persists notification to database on INSERT", async () => {
    renderHook(() => useRealtimeCompanies());
    await subscribeCb!({
      eventType: "INSERT",
      new: { id: "abc", name: "PersistCo", source: "gmaps", sector: "IT", location: "RJ" },
    });
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        type: "scrape",
        metadata: expect.objectContaining({ company_name: "PersistCo" }),
      }),
    ]);
  });

  it("does not toast or persist on UPDATE event", async () => {
    renderHook(() => useRealtimeCompanies());
    await subscribeCb!({ eventType: "UPDATE", new: {} });
    expect(mockToast).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
