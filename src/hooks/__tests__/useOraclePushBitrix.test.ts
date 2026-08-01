import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

import { supabase } from "@/integrations/supabase/client";
import { useOraclePushBitrix, type PushBitrixResponse } from "../useOracleV2";

const invokeMock = supabase.functions.invoke as ReturnType<typeof vi.fn>;

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

describe("useOraclePushBitrix — contrato da edge oracle-push-bitrix", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("envia payload com contact_ids + destino Bitrix opcional", async () => {
    const response: PushBitrixResponse = {
      results: [
        { contact_id: "c1", status: "sent_to_bitrix", bitrix_contact_id: "10", bitrix_card_id: "20" },
      ],
      summary: { sent: 1, duplicates: 0, errors: 0, sem_dado: 0, skipped: 0 },
      skipped: [],
      correlation_id: "cid-abc-123",
    };
    invokeMock.mockResolvedValue({ data: response, error: null });

    const { result } = renderHook(() => useOraclePushBitrix(), { wrapper });
    result.current.mutate({
      contact_ids: ["c1"],
      bitrix_company_id: "42",
      bitrix_assigned_by_id: 7,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invokeMock).toHaveBeenCalledWith("oracle-push-bitrix", {
      body: { contact_ids: ["c1"], bitrix_company_id: "42", bitrix_assigned_by_id: 7 },
    });
    expect(result.current.data?.correlation_id).toBe("cid-abc-123");
    expect(result.current.data?.results[0]?.status).toBe("sent_to_bitrix");
  });

  it("propaga erro da edge (bitrix_open) para onError", async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error("bitrix_open") });

    const { result } = renderHook(() => useOraclePushBitrix(), { wrapper });
    result.current.mutate({ contact_ids: ["c1"] });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("bitrix_open");
  });

  it("aceita resposta com status variados no results[]", async () => {
    const response: PushBitrixResponse = {
      results: [
        { contact_id: "a", status: "sent_to_bitrix", bitrix_contact_id: "1", bitrix_card_id: "2" },
        { contact_id: "b", status: "bitrix_duplicate", matched_by: "email" },
        { contact_id: "c", status: "skipped", error: "no_contactable_info" },
        { contact_id: "d", status: "error_bitrix", error: "timeout" },
      ],
      summary: { sent: 1, duplicates: 1, errors: 1, sem_dado: 1, skipped: 1 },
      skipped: ["c"],
      correlation_id: "cid-xyz",
    };
    invokeMock.mockResolvedValue({ data: response, error: null });

    const { result } = renderHook(() => useOraclePushBitrix(), { wrapper });
    result.current.mutate({ contact_ids: ["a", "b", "c", "d"] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const statuses = result.current.data!.results.map((r) => r.status);
    expect(statuses).toEqual(["sent_to_bitrix", "bitrix_duplicate", "skipped", "error_bitrix"]);
  });
});
