import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createElement } from "react";

const state = vi.hoisted(() => ({ orgId: "org-1" as string | null }));

const limitMock = vi.hoisted(() => vi.fn());
const orderMock = vi.hoisted(() => vi.fn());
const eqMock = vi.hoisted(() => vi.fn());
const selectMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

vi.mock("@/contexts/active-org-context", () => ({
  useActiveOrganization: () => ({
    activeOrgId: state.orgId,
    activeOrg: null,
    setActive: () => {},
  }),
}));

import {
  buildInstagramResultsCsv,
  flattenInstagramResult,
  matchesInstagramSearch,
  summarizeInstagramResults,
  useInstagramResults,
  type InstagramResultRecord,
  type InstagramResultRow,
} from "../useInstagramResults";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

function record(overrides: Partial<InstagramResultRecord> = {}): InstagramResultRecord {
  return {
    id: "r1",
    queue_id: "q1",
    target_type: "profile",
    target_value: "@empresa",
    item_type: "profile",
    fetched_at: new Date().toISOString(),
    normalized: {
      username: "empresa",
      fullName: "Empresa LTDA",
      followers: 1500,
      email: "contato@empresa.com",
      phone: "+5511999998888",
      website: "https://empresa.com",
      city: "São Paulo",
      country: "Brasil",
      verified: true,
      isPrivate: false,
      isBusinessAccount: true,
    },
    ...overrides,
  };
}

function row(overrides: Partial<InstagramResultRow> = {}): InstagramResultRow {
  return {
    ...flattenInstagramResult(record()),
    ...overrides,
  };
}

beforeEach(() => {
  limitMock.mockReset();
  orderMock.mockReset();
  eqMock.mockReset();
  selectMock.mockReset();
  fromMock.mockReset();
  orderMock.mockReturnValue({ limit: limitMock });
  eqMock.mockReturnValue({ order: orderMock });
  selectMock.mockReturnValue({ eq: eqMock });
  fromMock.mockReturnValue({ select: selectMock });
  state.orgId = "org-1";
});

describe("flattenInstagramResult", () => {
  it("achata o contato que vive dentro do JSONB normalized", () => {
    const flat = flattenInstagramResult(record());
    expect(flat.username).toBe("empresa");
    expect(flat.full_name).toBe("Empresa LTDA");
    expect(flat.followers).toBe(1500);
    expect(flat.email).toBe("contato@empresa.com");
    expect(flat.phone).toBe("+5511999998888");
    expect(flat.website).toBe("https://empresa.com");
    expect(flat.city).toBe("São Paulo");
    expect(flat.business_category).toBeNull();
    expect(flat.verified).toBe(true);
    expect(flat.is_business).toBe(true);
  });

  it("aceita normalized serializado como texto JSON", () => {
    const flat = flattenInstagramResult(
      record({ normalized: JSON.stringify({ username: "outra", followers: "42" }) }),
    );
    expect(flat.username).toBe("outra");
    expect(flat.followers).toBe(42);
  });

  it("não inventa dado quando normalized vem nulo ou inválido", () => {
    const flat = flattenInstagramResult(record({ normalized: null }));
    expect(flat.username).toBeNull();
    expect(flat.followers).toBeNull();
    expect(flat.email).toBeNull();
    expect(flat.verified).toBe(false);
    expect(flat.is_private).toBe(false);
    expect(flat.target_value).toBe("@empresa");
  });

  it("trata contador não numérico como ausente", () => {
    const flat = flattenInstagramResult(record({ normalized: { followers: "muitos" } }));
    expect(flat.followers).toBeNull();
  });

  it("ignora string vazia e mantém apenas texto com conteúdo", () => {
    const flat = flattenInstagramResult(record({ normalized: { username: "   ", fullName: "Ok" } }));
    expect(flat.username).toBeNull();
    expect(flat.full_name).toBe("Ok");
  });
});

describe("summarizeInstagramResults", () => {
  const now = new Date("2026-11-26T12:00:00.000Z").getTime();

  it("conta total, últimas 24h, contatos e perfis distintos", () => {
    const rows = [
      row({ id: "a", fetched_at: "2026-11-26T11:00:00.000Z" }),
      row({
        id: "b",
        fetched_at: "2026-11-26T10:00:00.000Z",
        username: "outra",
        phone: null,
        website: null,
      }),
      row({
        id: "c",
        fetched_at: "2026-11-10T10:00:00.000Z",
        username: "antiga",
        email: null,
        phone: null,
        website: null,
      }),
    ];
    expect(summarizeInstagramResults(rows, now)).toEqual({
      total: 3,
      last24h: 2,
      withEmail: 2,
      withPhone: 1,
      withWebsite: 1,
      distinctProfiles: 3,
    });
  });

  it("cai para o alvo coletado quando o item não tem @usuario", () => {
    const rows = [
      row({ id: "a", username: null, target_value: "marketing" }),
      row({ id: "b", username: null, target_value: "MARKETING" }),
    ];
    expect(summarizeInstagramResults(rows, now).distinctProfiles).toBe(1);
  });

  it("não conta fetched_at inválido como recente", () => {
    expect(summarizeInstagramResults([row({ fetched_at: "sem-data" })], now).last24h).toBe(0);
  });
});

describe("matchesInstagramSearch", () => {
  it("encontra por @usuario e por nome, sem diferenciar maiúsculas", () => {
    const r = row();
    expect(matchesInstagramSearch(r, "EMP")).toBe(true);
    expect(matchesInstagramSearch(r, "ltda")).toBe(true);
  });

  it("encontra por cidade e por alvo", () => {
    const r = row();
    expect(matchesInstagramSearch(r, "são paulo")).toBe(true);
    expect(matchesInstagramSearch(r, "@empresa")).toBe(true);
  });

  it("devolve tudo quando o termo está vazio e nada quando não casa", () => {
    const r = row();
    expect(matchesInstagramSearch(r, "   ")).toBe(true);
    expect(matchesInstagramSearch(r, "inexistente")).toBe(false);
  });
});

describe("buildInstagramResultsCsv", () => {
  it("gera uma linha por item com o contato em coluna própria", () => {
    const csv = buildInstagramResultsCsv([row({ is_private: true })]);
    expect(csv).toHaveLength(1);
    expect(Object.keys(csv[0])).toEqual([
      "usuario",
      "nome",
      "seguidores",
      "email",
      "telefone",
      "site",
      "cidade",
      "pais",
      "categoria",
      "privado",
      "tipo",
      "alvo",
      "coletado_em",
    ]);
    expect(csv[0].email).toBe("contato@empresa.com");
    expect(csv[0].privado).toBe("sim");
  });

  it("deixa célula vazia quando o contato não existe", () => {
    const csv = buildInstagramResultsCsv([
      row({ email: null, phone: null, website: null, business_category: null }),
    ]);
    expect(csv[0].email).toBe("");
    expect(csv[0].telefone).toBe("");
    expect(csv[0].site).toBe("");
    expect(csv[0].categoria).toBe("");
  });
});

describe("useInstagramResults", () => {
  it("lê instagram_scrape_results da organização ativa e resume o conjunto", async () => {
    limitMock.mockResolvedValue({ data: [record()], error: null });
    const { result } = renderHook(() => useInstagramResults(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fromMock).toHaveBeenCalledWith("instagram_scrape_results");
    expect(eqMock).toHaveBeenCalledWith("organization_id", "org-1");
    expect(orderMock).toHaveBeenCalledWith("fetched_at", { ascending: false });
    expect(result.current.data?.rows).toHaveLength(1);
    expect(result.current.data?.rows[0].email).toBe("contato@empresa.com");
    expect(result.current.data?.summary.withEmail).toBe(1);
  });

  it("expõe a falha em vez de mostrar lista vazia", async () => {
    limitMock.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    const { result } = renderHook(() => useInstagramResults(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual({ message: "permission denied" });
  });

  it("não consulta quando não há organização ativa", () => {
    state.orgId = null;
    const { result } = renderHook(() => useInstagramResults(), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(fromMock).not.toHaveBeenCalled();
  });
});