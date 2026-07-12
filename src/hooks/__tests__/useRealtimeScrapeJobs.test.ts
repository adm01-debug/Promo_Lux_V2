import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInvalidateQueries, mockToast, mockInsert, mockRemoveChannel } = vi.hoisted(() => ({
  mockInvalidateQueries: vi.fn(),
  mockToast: vi.fn(),
  mockInsert: vi.fn().mockResolvedValue({ error: null }),
  mockRemoveChannel: vi.fn(),
}));
let subscribeCb: any = null;
let capturedChannelName: string | null = null;
let capturedOnConfig: any = null;

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
        on: (_event: string, config: any, cb: any) => {
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
import { useRealtimeScrapeJobs } from "../useRealtimeScrapeJobs";

describe("useRealtimeScrapeJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscribeCb = null;
    capturedChannelName = null;
    capturedOnConfig = null;
    currentUser = mockUser;
  });

  // --- Private channel tests ---

  it("uses private channel name scoped to org id", () => {
    renderHook(() => useRealtimeScrapeJobs());
    expect(capturedChannelName).toBe("org:test-org-id:scrape-jobs");
  });

  it("applies organization_id filter for UPDATE events only", () => {
    renderHook(() => useRealtimeScrapeJobs());
    expect(capturedOnConfig).toMatchObject({
      event: "UPDATE",
      schema: "public",
      table: "scrape_jobs",
      filter: "organization_id=eq.test-org-id",
    });
  });

  it("does not subscribe when user is null", () => {
    currentUser = null;
    renderHook(() => useRealtimeScrapeJobs());
    expect(capturedChannelName).toBeNull();
    expect(subscribeCb).toBeNull();
  });

  it("removes channel on unmount", () => {
    const { unmount } = renderHook(() => useRealtimeScrapeJobs());
    unmount();
    expect(mockRemoveChannel).toHaveBeenCalled();
  });

  // --- Existing behavior tests ---

  it("subscribes to realtime channel on mount", () => {
    renderHook(() => useRealtimeScrapeJobs());
    expect(subscribeCb).toBeDefined();
  });

  it("ignores same-status transitions", async () => {
    renderHook(() => useRealtimeScrapeJobs());
    await subscribeCb({ new: { status: "running" }, old: { status: "running" } });
    expect(mockToast).not.toHaveBeenCalled();
  });

  it("toasts on completed job", async () => {
    renderHook(() => useRealtimeScrapeJobs());
    await subscribeCb({
      new: { status: "completed", name: "Job1", results_count: 42, id: "j1", source: "gmaps" },
      old: { status: "running" },
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("concluída") })
    );
  });

  it("persists completed notification", async () => {
    renderHook(() => useRealtimeScrapeJobs());
    await subscribeCb({
      new: { status: "completed", name: "Job2", results_count: 10, id: "j2", source: "gmaps" },
      old: { status: "running" },
    });
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({ type: "scrape", title: expect.stringContaining("concluída") }),
    ]);
  });

  it("toasts on failed job with destructive variant", async () => {
    renderHook(() => useRealtimeScrapeJobs());
    await subscribeCb({
      new: { status: "failed", name: "Job3", error_message: "timeout", id: "j3" },
      old: { status: "running" },
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" })
    );
  });

  it("persists failed notification", async () => {
    renderHook(() => useRealtimeScrapeJobs());
    await subscribeCb({
      new: { status: "failed", name: "Job4", error_message: "err", id: "j4" },
      old: { status: "running" },
    });
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({ type: "scrape", title: expect.stringContaining("falhou") }),
    ]);
  });

  it("invalidates scrape-jobs and dashboard queries", async () => {
    renderHook(() => useRealtimeScrapeJobs());
    await subscribeCb({
      new: { status: "completed", name: "J", results_count: 1, id: "x", source: "gmaps" },
      old: { status: "pending" },
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["scrape-jobs"] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["dashboard-stats"] });
  });

  it("handles missing error_message gracefully", async () => {
    renderHook(() => useRealtimeScrapeJobs());
    await subscribeCb({
      new: { status: "failed", name: "Job5", error_message: null, id: "j5" },
      old: { status: "running" },
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining("erro desconhecido"),
      })
    );
  });
});
