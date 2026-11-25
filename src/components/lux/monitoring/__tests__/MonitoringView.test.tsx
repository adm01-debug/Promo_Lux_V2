import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MonitoringView } from "../MonitoringView";

interface FakeDbSnapshot {
  id: string;
  captured_at: string;
  active_connections: number;
  max_connections: number;
  connection_pct: number;
  db_size_bytes: number;
  postmaster_start: string;
  restart_detected: boolean;
  commits: number;
  rollbacks: number;
  deadlocks: number;
  cache_hit_ratio: number;
  longest_query_secs: number;
}

const makeSnapshot = (over: Partial<FakeDbSnapshot> = {}): FakeDbSnapshot => ({
  id: "s1",
  captured_at: new Date().toISOString(),
  active_connections: 20,
  max_connections: 60,
  connection_pct: 33,
  db_size_bytes: 1024,
  postmaster_start: new Date().toISOString(),
  restart_detected: false,
  commits: 100,
  rollbacks: 0,
  deadlocks: 0,
  cache_hit_ratio: 99.5,
  longest_query_secs: 1,
  ...over,
});

const estado = vi.hoisted(() => ({
  latency: [] as Array<Record<string, unknown>>,
  trend: [] as Array<Record<string, unknown>>,
  db: [] as unknown[],
  dlq: undefined as Record<string, unknown> | undefined,
  publicStatus: undefined as Record<string, unknown> | undefined,
  uptime: [] as Array<Record<string, unknown>>,
  audit: { rows: [], total: 0, totalPages: 0 } as Record<string, unknown>,
}));

vi.mock("@/hooks/useApiLatency", () => ({
  useApiLatency: () => ({ data: estado.latency, isLoading: false }),
  useApiLatencyTrend: () => ({ data: estado.trend, isLoading: false }),
  latencySeverity: (stat: { p95_ms: number; error_rate: number }) =>
    stat.p95_ms >= 1500 || stat.error_rate >= 5
      ? "critical"
      : stat.p95_ms >= 500 || stat.error_rate >= 1
        ? "warning"
        : "ok",
}));

vi.mock("@/hooks/useDbHealth", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/hooks/useDbHealth")>();
  return { ...real, useDbHealth: () => ({ data: estado.db, isLoading: false }) };
});

vi.mock("@/hooks/useDlqHealth", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/hooks/useDlqHealth")>();
  return { ...real, useDlqHealth: () => ({ data: estado.dlq, isLoading: false }) };
});

vi.mock("@/hooks/useStatusPage", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/hooks/useStatusPage")>();
  return {
    ...real,
    usePublicStatus: () => ({ data: estado.publicStatus, isLoading: false }),
    usePublicUptime: () => ({ data: estado.uptime, isLoading: false }),
  };
});

vi.mock("@/hooks/useAuditTrail", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/hooks/useAuditTrail")>();
  return { ...real, useAuditTrail: () => ({ data: estado.audit, isLoading: false }) };
});

beforeEach(() => {
  estado.latency = [];
  estado.trend = [];
  estado.db = [];
  estado.dlq = undefined;
  estado.publicStatus = undefined;
  estado.uptime = [];
  estado.audit = { rows: [], total: 0, totalPages: 0 };
});

// jsdom não traz ResizeObserver, que o ResponsiveContainer do recharts usa.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

describe("MonitoringView com fontes reais", () => {
  it("sem nenhuma fonte: selo fica em 'Sem dados' e não promete saúde", () => {
    render(<MonitoringView />);
    expect(screen.getByText("Status do Sistema")).toBeInTheDocument();
    expect(screen.getAllByText("Sem dados").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Sistemas Operacionais")).not.toBeInTheDocument();
    expect(screen.queryByText("124 ms")).not.toBeInTheDocument();
    expect(screen.queryByText("99.98%")).not.toBeInTheDocument();
    expect(screen.queryByText("0.02%")).not.toBeInTheDocument();
  });

  it("fila morta em nível crítico derruba o selo", () => {
    estado.dlq = { total_items: 150, pending_items: 150, replayed_items: 0, oldest_pending_age_secs: 90000, added_last_24h: 150, replayed_last_24h: 0 };
    render(<MonitoringView />);
    expect(screen.getByText("Falha Detectada")).toBeInTheDocument();
    expect(screen.queryByText("Sistemas Operacionais")).not.toBeInTheDocument();
    expect(screen.getByText("Fila morta (DLQ)")).toBeInTheDocument();
  });

  it("saturação de conexões do banco derruba o selo mesmo com demais fontes saudáveis", () => {
    estado.publicStatus = { generated_at: new Date().toISOString(), overall: "operational", components: [], incidents: [] };
    estado.db = [makeSnapshot({ connection_pct: 95, active_connections: 57 })];
    estado.dlq = { total_items: 0, pending_items: 0, replayed_items: 0, oldest_pending_age_secs: 0, added_last_24h: 0, replayed_last_24h: 0 };
    render(<MonitoringView />);
    expect(screen.getByText("Falha Detectada")).toBeInTheDocument();
    expect(screen.queryByText("Sistemas Operacionais")).not.toBeInTheDocument();
  });

  it("todas as fontes saudáveis: selo verde com dados reais", () => {
    estado.publicStatus = { generated_at: new Date().toISOString(), overall: "operational", components: [], incidents: [] };
    estado.db = [makeSnapshot()];
    estado.dlq = { total_items: 0, pending_items: 0, replayed_items: 0, oldest_pending_age_secs: 0, added_last_24h: 0, replayed_last_24h: 0 };
    estado.latency = [{ path: "/public-api/stakeholders", requests: 100, errors: 0, error_rate: 0, p50_ms: 80, p95_ms: 200, p99_ms: 300, max_ms: 400, avg_ms: 120 }];
    estado.trend = [{ bucket: new Date().toISOString(), requests: 100, errors: 0, error_rate: 0, p50_ms: 80, p95_ms: 200 }];
    estado.uptime = [{ day: "2026-11-25", events: 10, failures: 0, uptime_pct: 100 }];
    render(<MonitoringView />);
    expect(screen.getByText("Sistemas Operacionais")).toBeInTheDocument();
    expect(screen.getByText("200 ms")).toBeInTheDocument();
    expect(screen.getByText("100.00%")).toBeInTheDocument();
    expect(screen.getByText("0.00%")).toBeInTheDocument();
  });

  it("mostra 'Sem dados' nos indicadores quando só a latência responde", () => {
    estado.latency = [{ path: "/public-api/me", requests: 10, errors: 1, error_rate: 10, p50_ms: 90, p95_ms: 900, p99_ms: 1200, max_ms: 1500, avg_ms: 300 }];
    render(<MonitoringView />);
    expect(screen.getByText("900 ms")).toBeInTheDocument();
    expect(screen.getByText("10.00%")).toBeInTheDocument();
    expect(screen.getAllByText("Sem dados").length).toBeGreaterThanOrEqual(1);
  });
});
