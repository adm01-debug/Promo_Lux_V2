import { describe, it, expect, vi } from "vitest";
import {
  LUSHA_REVEAL_API_VERSION,
  LUSHA_REVEAL_ENDPOINT,
  LUSHA_REVEAL_OPERATION,
  buildLushaRevealUsageRow,
  logLushaCreditUsage,
  toCreditCount,
  type LushaCreditUsageRow,
  type LushaCreditLogClient,
} from "../lusha-credit-log.ts";

function fakeClient(error: { message?: string } | null = null) {
  const insert = vi.fn(async (_row: LushaCreditUsageRow) => ({ error }));
  const from = vi.fn((_table: string) => ({ insert }));
  return { client: { from } as unknown as LushaCreditLogClient, from, insert };
}

describe("toCreditCount", () => {
  it("trata ausência de valor como zero", () => {
    expect(toCreditCount(null)).toBe(0);
    expect(toCreditCount(undefined)).toBe(0);
  });

  it("aceita número em texto como a API devolve", () => {
    expect(toCreditCount("3")).toBe(3);
  });

  it("descarta negativo, NaN e texto não numérico", () => {
    expect(toCreditCount(-5)).toBe(0);
    expect(toCreditCount(Number.NaN)).toBe(0);
    expect(toCreditCount("muitos")).toBe(0);
  });

  it("trunca fração", () => {
    expect(toCreditCount(2.9)).toBe(2);
  });
});

describe("buildLushaRevealUsageRow", () => {
  it("monta a linha de uma revelação bem-sucedida", () => {
    const row = buildLushaRevealUsageRow({
      organizationId: "org-1",
      userId: "user-1",
      requestId: "req-9",
      bitrixCardId: "card-7",
      creditsCharged: 4,
      recordsReturned: 4,
      success: true,
    });

    expect(row).toEqual({
      organization_id: "org-1",
      user_id: "user-1",
      endpoint: LUSHA_REVEAL_ENDPOINT,
      operation: LUSHA_REVEAL_OPERATION,
      api_version: LUSHA_REVEAL_API_VERSION,
      bitrix_card_id: "card-7",
      success: true,
      credits_charged: 4,
      records_returned: 4,
      request_id: "req-9",
      error_code: null,
    });
  });

  it("registra falha sem custo e com o código do erro", () => {
    const row = buildLushaRevealUsageRow({
      organizationId: "org-1",
      userId: "user-1",
      requestId: "req-9",
      success: false,
      errorCode: "http_402",
    });

    expect(row.success).toBe(false);
    expect(row.credits_charged).toBe(0);
    expect(row.records_returned).toBe(0);
    expect(row.error_code).toBe("http_402");
    expect(row.bitrix_card_id).toBeNull();
  });

  it("não inventa custo quando a API omite creditsCharged", () => {
    const row = buildLushaRevealUsageRow({
      organizationId: "org-1",
      creditsCharged: null,
      recordsReturned: 3,
      success: true,
    });

    expect(row.credits_charged).toBe(0);
    expect(row.records_returned).toBe(3);
    expect(row.user_id).toBeNull();
    expect(row.request_id).toBeNull();
  });
});

describe("logLushaCreditUsage", () => {
  it("grava na tabela de consumo e devolve true", async () => {
    const { client, from, insert } = fakeClient();
    const row = buildLushaRevealUsageRow({
      organizationId: "org-1",
      creditsCharged: 2,
      success: true,
    });

    await expect(logLushaCreditUsage(client, row)).resolves.toBe(true);
    expect(from).toHaveBeenCalledWith("lusha_credit_usage_log");
    expect(insert).toHaveBeenCalledWith(row);
  });

  it("não derruba a revelação quando o insert falha", async () => {
    const { client } = fakeClient({ message: "permission denied" });
    const onError = vi.fn();
    const row = buildLushaRevealUsageRow({ organizationId: "org-1", success: true });

    await expect(logLushaCreditUsage(client, row, onError)).resolves.toBe(false);
    expect(onError).toHaveBeenCalledWith("credit_log_failed", "permission denied");
  });

  it("não derruba a revelação quando o insert lança", async () => {
    const insert = vi.fn(async () => {
      throw new Error("network down");
    });
    const client = { from: () => ({ insert }) } as unknown as LushaCreditLogClient;
    const onError = vi.fn();
    const row = buildLushaRevealUsageRow({ organizationId: "org-1", success: true });

    await expect(logLushaCreditUsage(client, row, onError)).resolves.toBe(false);
    expect(onError).toHaveBeenCalledWith("credit_log_threw", "network down");
  });

  it("sem service_role não grava e reporta o motivo", async () => {
    const onError = vi.fn();
    const row = buildLushaRevealUsageRow({ organizationId: "org-1", success: true });

    await expect(logLushaCreditUsage(null, row, onError)).resolves.toBe(false);
    expect(onError).toHaveBeenCalledWith(
      "credit_log_skipped_no_service_role",
      LUSHA_REVEAL_OPERATION,
    );
  });
});