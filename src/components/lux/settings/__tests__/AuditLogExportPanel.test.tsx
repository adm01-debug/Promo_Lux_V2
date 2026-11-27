import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PiiRule } from "@/hooks/usePiiRules";

const regras = vi.hoisted(() => ({ valor: [] as unknown[] }));

vi.mock("@/hooks/useAuditLogExport", () => ({
  useAuditLogExport: () => ({
    actions: [],
    tables: [],
    facetsLoading: false,
    download: vi.fn(),
    isExporting: false,
  }),
}));

vi.mock("@/hooks/usePiiRules", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/usePiiRules")>("@/hooks/usePiiRules");
  return { ...actual, usePiiRules: () => ({ data: regras.valor }) };
});

import { AuditLogExportPanel } from "../AuditLogExportPanel";

const LIGADA: PiiRule = { category: "email", action: "mask", enabled: true };

beforeEach(() => {
  regras.valor = [];
});

describe("AuditLogExportPanel — aviso de mascaramento", () => {
  it("avisa que o arquivo sai mascarado quando ha regra ligada", () => {
    regras.valor = [LIGADA];
    render(<AuditLogExportPanel />);
    expect(screen.getByText("O arquivo sai com dados sensíveis mascarados")).toBeTruthy();
    expect(screen.getByText(/1 regra\(s\) ativa\(s\)/)).toBeTruthy();
  });

  it("nao avisa nada quando nenhuma regra esta ligada", () => {
    regras.valor = [{ ...LIGADA, enabled: false }];
    render(<AuditLogExportPanel />);
    expect(screen.queryByText("O arquivo sai com dados sensíveis mascarados")).toBeNull();
  });
});