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
        return { subscribe: () => ({}) };
      },
    }),
    removeChannel: vi.fn(),
    from: () => ({ insert: mockInsert }),
  },
}));

import { renderHook } from "@testing-library/react";
import { useRealtimeScrapeJobs } from "../useRealtimeScrapeJobs";

describe("useRealtimeScrapeJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscribeCb = null;
  });

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
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ type: "scrape", title: expect.stringContaining("falhou") })
    );
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
