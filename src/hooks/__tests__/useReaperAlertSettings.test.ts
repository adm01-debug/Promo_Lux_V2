import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createElement } from "react";

const state = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  error: null as null | { message: string },
  tables: [] as string[],
  selects: [] as string[],
  updates: [] as Record<string, unknown>[],
  eqs: [] as [string, unknown][],
  limits: [] as number[],
}));

interface Builder {
  select: (cols: string) => Builder;
  update: (payload: Record<string, unknown>) => Builder;
  eq: (column: string, value: unknown) => Builder;
  limit: (n: number) => Builder;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  single: () => Promise<{ data: unknown; error: unknown }>;
}

function makeBuilder(): Builder {
  const builder = {} as Builder;
  builder.select = (cols) => {
    state.selects.push(cols);
    return builder;
  };
  builder.update = (payload) => {
    state.updates.push(payload);
    return builder;
  };
  builder.eq = (column, value) => {
    state.eqs.push([column, value]);
    return builder;
  };
  builder.limit = (n) => {
    state.limits.push(n);
    return builder;
  };
  builder.maybeSingle = () => Promise.resolve({ data: state.row, error: state.error });
  builder.single = () => Promise.resolve({ data: state.row, error: state.error });
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      state.tables.push(table);
      return makeBuilder();
    },
  },
}));

import {
  REAPER_SETTINGS_DEFAULTS,
  useReaperAlertSettings,
  useUpdateReaperAlertSettings,
  validarAjustesReaper,
  type ReaperAlertSettingsInput,
} from "../useReaperAlertSettings";

const VALIDO: ReaperAlertSettingsInput = {
  enabled: true,
  consecutive: 2,
  min_dead_per_run: 3,
  no_run_hours: 4,
  cooldown_hours: 12,
};

let qc: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  state.row = null;
  state.error = null;
  state.tables = [];
  state.selects = [];
  state.updates = [];
  state.eqs = [];
  state.limits = [];
});

describe("validarAjustesReaper", () => {
  it("aceita os valores padrão e valores no limite das faixas", () => {
    expect(validarAjustesReaper(REAPER_SETTINGS_DEFAULTS)).toEqual({});
    expect(
      validarAjustesReaper({
        enabled: false,
        consecutive: 20,
        min_dead_per_run: 0,
        no_run_hours: 168,
        cooldown_hours: 1,
      }),
    ).toEqual({});
  });

  it("recusa execuções consecutivas fora de 1–20", () => {
    expect(validarAjustesReaper({ ...VALIDO, consecutive: 0 }).consecutive).toMatch(/mínimo é 1/);
    expect(validarAjustesReaper({ ...VALIDO, consecutive: 21 }).consecutive).toMatch(/máximo é 20/);
  });

  it("recusa tarefas mortas negativas e aceita zero", () => {
    expect(validarAjustesReaper({ ...VALIDO, min_dead_per_run: -1 }).min_dead_per_run).toMatch(
      /mínimo é 0/,
    );
    expect(validarAjustesReaper({ ...VALIDO, min_dead_per_run: 0 }).min_dead_per_run).toBeUndefined();
  });

  it("recusa horas fora de 1–168", () => {
    expect(validarAjustesReaper({ ...VALIDO, no_run_hours: 0 }).no_run_hours).toMatch(/mínimo é 1/);
    expect(validarAjustesReaper({ ...VALIDO, no_run_hours: 169 }).no_run_hours).toMatch(
      /máximo é 168/,
    );
    expect(validarAjustesReaper({ ...VALIDO, cooldown_hours: 0 }).cooldown_hours).toMatch(
      /mínimo é 1/,
    );
    expect(validarAjustesReaper({ ...VALIDO, cooldown_hours: 200 }).cooldown_hours).toMatch(
      /máximo é 168/,
    );
  });

  it("recusa valor fracionado", () => {
    expect(validarAjustesReaper({ ...VALIDO, consecutive: 1.5 }).consecutive).toMatch(/inteiro/);
  });
});

describe("useReaperAlertSettings", () => {
  it("lê a linha singleton de reaper_alert_settings", async () => {
    state.row = {
      id: "s1",
      enabled: true,
      consecutive: 3,
      min_dead_per_run: 2,
      no_run_hours: 5,
      cooldown_hours: 7,
      updated_at: "2026-11-20T10:00:00.000Z",
    };

    const { result } = renderHook(() => useReaperAlertSettings(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(state.tables).toEqual(["reaper_alert_settings"]);
    expect(state.limits).toEqual([1]);
    expect(result.current.data?.consecutive).toBe(3);
    expect(result.current.data?.cooldown_hours).toBe(7);
  });

  it("devolve null quando a tabela está vazia", async () => {
    const { result } = renderHook(() => useReaperAlertSettings(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("propaga o erro do banco em vez de fingir padrão", async () => {
    state.error = { message: "permission denied for table reaper_alert_settings" };

    const { result } = renderHook(() => useReaperAlertSettings(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it("não consulta quando desabilitado", () => {
    const { result } = renderHook(() => useReaperAlertSettings(false), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(state.tables).toEqual([]);
  });
});

describe("useUpdateReaperAlertSettings", () => {
  it("grava os cinco campos na linha singleton e invalida a consulta", async () => {
    state.row = { id: "s1", ...VALIDO, min_dead_per_run: 3, updated_at: "2026-11-26T12:00:00.000Z" };
    const { result } = renderHook(() => useUpdateReaperAlertSettings(), { wrapper });
    const invalidar = vi.spyOn(qc, "invalidateQueries");

    let salvo: { id?: string } | undefined;
    await act(async () => {
      salvo = await result.current.mutateAsync(VALIDO);
    });

    expect(state.tables).toEqual(["reaper_alert_settings"]);
    expect(state.updates).toEqual([
      {
        enabled: true,
        consecutive: 2,
        min_dead_per_run: 3,
        no_run_hours: 4,
        cooldown_hours: 12,
      },
    ]);
    expect(state.eqs).toEqual([["singleton", true]]);
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["reaper-alert-settings"] });
    expect(salvo?.id).toBe("s1");
  });

  it("recusa valor fora da faixa sem tocar no banco", async () => {
    const { result } = renderHook(() => useUpdateReaperAlertSettings(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ ...VALIDO, consecutive: 99 });
      }),
    ).rejects.toThrow(/máximo é 20/);

    expect(state.tables).toEqual([]);
  });

  it("propaga erro do banco", async () => {
    state.error = { message: "new row violates check constraint" };
    const { result } = renderHook(() => useUpdateReaperAlertSettings(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync(VALIDO);
      }),
    ).rejects.toBeTruthy();
    expect(state.tables).toEqual(["reaper_alert_settings"]);
  });
});