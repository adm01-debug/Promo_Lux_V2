import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInvalidateQueries = vi.fn();
const mockToast = vi.fn();
const mockInsert = vi.fn().mockResolvedValue({ error: null });
let subscribeCb: any = null;

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "test-user-id" } }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: () => ({
      on: (_event: string, _config: any, cb: any) => {
        subscribeCb = cb;
        return {
          subscribe: () => ({}),
        };
      },
    }),
    removeChannel: vi.fn(),
    from: () => ({ insert: mockInsert }),
  },
}));

import { renderHook } from "@testing-library/react";
import { useRealtimeCompanies } from "../useRealtimeCompanies";

describe("useRealtimeCompanies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscribeCb = null;
  });

  it("subscribes to realtime channel on mount", () => {
    renderHook(() => useRealtimeCompanies());
    expect(subscribeCb).toBeDefined();
  });

  it("invalidates queries on any event", async () => {
    renderHook(() => useRealtimeCompanies());
    await subscribeCb({ eventType: "UPDATE", new: {} });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["companies-list"] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["companies-map"] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["dashboard-stats"] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["recent-companies"] });
  });

  it("shows toast on INSERT event", async () => {
    renderHook(() => useRealtimeCompanies());
    await subscribeCb({
      eventType: "INSERT",
      new: { name: "TestCo", source: "gmaps", sector: "Tech", location: "SP" },
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("raspada") })
    );
  });

  it("shows different title for manual source", async () => {
    renderHook(() => useRealtimeCompanies());
    await subscribeCb({
      eventType: "INSERT",
      new: { name: "ManualCo", source: "manual", sector: "", location: "" },
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("adicionada") })
    );
  });

  it("persists notification to database on INSERT", async () => {
    renderHook(() => useRealtimeCompanies());
    await subscribeCb({
      eventType: "INSERT",
      new: { id: "abc", name: "PersistCo", source: "gmaps", sector: "IT", location: "RJ" },
    });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "scrape",
        metadata: expect.objectContaining({ company_name: "PersistCo" }),
      })
    );
  });

  it("does not toast or persist on UPDATE event", async () => {
    renderHook(() => useRealtimeCompanies());
    await subscribeCb({ eventType: "UPDATE", new: {} });
    expect(mockToast).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
