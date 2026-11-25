import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { invokeMock, updateMock, toastMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  updateMock: vi.fn(() => ({
    eq: vi.fn(() => Promise.resolve({ error: null })),
  })),
  toastMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: invokeMock },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() =>
            Promise.resolve({ data: null, error: null }),
          ),
        })),
      })),
      update: updateMock,
    })),
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: toastMock,
  useToast: () => ({ toast: toastMock, dismiss: vi.fn(), toasts: [] }),
}));

vi.mock("@/contexts/active-org-context", () => ({
  useActiveOrganization: () => ({
    activeOrgId: "org-1",
    activeOrg: null,
    setActive: vi.fn(),
  }),
}));

vi.mock("@/hooks/useCompanyDetails", () => ({
  useCompanyDetails: () => ({
    data: {
      contacts: [
        {
          id: "c1",
          full_name: "Maria Silva",
          role: "CEO",
          email: "maria@alfa.com.br",
          linkedin_url: null,
          confidence_score: 90,
        },
      ],
      signals: [],
      timeline: [],
      technologies: [],
    },
    isLoading: false,
  }),
}));

vi.mock("@/components/lux/CompanyOpenHours", () => ({
  CompanyOpenHours: () => null,
}));
vi.mock("@/components/lux/CompanyReviewsList", () => ({
  CompanyReviewsList: () => null,
}));

vi.mock("framer-motion", async () => {
  const { mockFramerMotion } = await import("@/test/mockFramerMotion");
  return mockFramerMotion();
});

import { CompanyDetailModal } from "../CompanyDetailModal";

const CNPJ_VALIDO = "11222333000181";

const baseCompany = {
  id: "comp-1",
  name: "Alfa Ltda",
  cnpj: CNPJ_VALIDO,
  sector: "",
  location: "",
  ipcScore: 80,
  source: "manual",
  website: "https://alfa.com.br/painel",
  employees: "",
  revenue: "1M",
  enriched: false,
  starred: false,
};

const enrichPayload = {
  name: "Alfa Ltda",
  alias: null,
  status: "ATIVA",
  size: "ME",
  sector: "Tecnologia",
  cnae_code: "6201500",
  location: "Sao Paulo/SP",
  address: "Av. Paulista 100",
  phone: "11999999999",
  email: "contato@alfa.com.br",
  members: [],
  activities: [],
  source: "cnpj-ws",
  fetched_at: "2026-11-25T00:00:00Z",
};

let openSpy: ReturnType<typeof vi.spyOn>;

function renderModal(overrides: Record<string, unknown> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
  const utils = render(
    <QueryClientProvider client={qc}>
      <CompanyDetailModal
        company={{ ...baseCompany, ...overrides } as never}
        open
        onOpenChange={vi.fn()}
      />
    </QueryClientProvider>,
  );
  return { ...utils, invalidateSpy };
}

describe("CompanyDetailModal — acoes do rodape", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    updateMock.mockClear();
    toastMock.mockClear();
    openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it("nao exibe mais o botao Iniciar Sequencia (sem motor de sequencias)", () => {
    renderModal();
    expect(screen.getByRole("button", { name: /Enviar Email/ })).toBeTruthy();
    expect(screen.queryByText(/Iniciar Sequ/i)).toBeNull();
  });

  it("Enviar Email abre o cliente de e-mail do contato principal", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /Enviar Email/ }));
    expect(openSpy).toHaveBeenCalledWith(
      "mailto:maria@alfa.com.br",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("Visitar Site abre o site da empresa", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /Visitar Site/ }));
    expect(openSpy).toHaveBeenCalledWith(
      baseCompany.website,
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("Adicionar ao CRM sincroniza a empresa pelo hubspot-sync", async () => {
    invokeMock.mockResolvedValue({
      data: {
        org_id: "org-1",
        companies_synced: 1,
        created: 1,
        updated: 0,
        failed: 0,
      },
      error: null,
    });
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: /Adicionar ao CRM/ }));

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("hubspot-sync", {
        body: { org_id: "org-1", company_id: "comp-1" },
      }),
    );
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Empresa criada no CRM" }),
      ),
    );
  });

  it("Adicionar ao CRM mostra o motivo real quando o HubSpot nao esta configurado", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: {
          json: () =>
            Promise.resolve({ error: "HubSpot nao configurado para esta org" }),
        },
      },
    });
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: /Adicionar ao CRM/ }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Erro ao enviar ao CRM",
          description: "HubSpot nao configurado para esta org",
          variant: "destructive",
        }),
      ),
    );
  });

  it("Enriquecer sem CNPJ avisa e nao chama o provedor", async () => {
    renderModal({ cnpj: undefined });
    fireEvent.click(screen.getByRole("button", { name: /Enriquecer/ }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "CNPJ não cadastrado",
          variant: "destructive",
        }),
      ),
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("Enriquecer preenche apenas os campos vazios com os dados do CNPJ", async () => {
    invokeMock.mockResolvedValue({
      data: { data: enrichPayload },
      error: null,
    });
    const { invalidateSpy } = renderModal();

    fireEvent.click(screen.getByRole("button", { name: /Enriquecer/ }));

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("cnpj-enrich", {
        body: { cnpj: CNPJ_VALIDO },
      }),
    );
    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith({
        sector: "Tecnologia (CNAE 6201500)",
        location: "Sao Paulo/SP",
        email: "contato@alfa.com.br",
        phone: "11999999999",
        employees: "ME",
        enriched: true,
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["companies-list"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["company-details", "comp-1"],
    });
  });

  it("Enriquecer nao sobrescreve campos ja preenchidos", async () => {
    invokeMock.mockResolvedValue({
      data: { data: enrichPayload },
      error: null,
    });
    renderModal({
      sector: "Varejo",
      location: "Rio de Janeiro/RJ",
      email: "ja@alfa.com.br",
      phone: "1133334444",
      employees: "Media",
    });

    fireEvent.click(screen.getByRole("button", { name: /Enriquecer/ }));

    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith({ enriched: true }),
    );
  });
});
