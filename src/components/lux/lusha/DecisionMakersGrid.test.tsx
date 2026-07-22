import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DecisionMakersGrid } from "./DecisionMakersGrid";
import type { DecisionMaker, DMCompanyResult, RevealedEntry } from "./types";

// ============================================================================
// R31 — Testes de contrato visual/comportamental do DecisionMakersGrid.
// Componente é puro/controlado; validamos props → render → callbacks.
// ============================================================================

const makeDM = (over: Partial<DecisionMaker> = {}): DecisionMaker => ({
  id: over.id ?? "dm-1",
  fullName: over.fullName ?? "Ana Silva",
  jobTitle: over.jobTitle ?? "Diretora Comercial",
  departments: over.departments ?? ["Comercial"],
  seniority: over.seniority ?? "director",
  company: over.company ?? "Ambev",
  location: over.location ?? "São Paulo, BR",
  linkedin: over.linkedin ?? "https://linkedin.com/in/ana-silva",
  hasEmail: over.hasEmail ?? true,
  hasPhone: over.hasPhone ?? true,
  emailCredits: over.emailCredits ?? 1,
  phoneCredits: over.phoneCredits ?? 1,
  linkedinSkills: over.linkedinSkills,
  linkedinCertifications: over.linkedinCertifications,
  linkedinCourses: over.linkedinCourses,
  linkedinAwards: over.linkedinAwards,
});

const dm1 = makeDM({
  id: "dm-1",
  fullName: "Ana Silva",
  linkedinSkills: ["SQL", "Growth"],
  linkedinCertifications: ["AWS SA"],
});
const dm2 = makeDM({
  id: "dm-2",
  fullName: "Bruno Costa",
  jobTitle: "Analista",
  seniority: "analyst",
  hasEmail: false,
  hasPhone: false,
  linkedin: "",
});

const baseResult: DMCompanyResult = {
  domain: "ambev.com.br",
  total: 2,
  decisionMakers: [dm1, dm2],
};

const seniorityClass = (s: string) => `sen-${s}`;

function renderGrid(overrides: Partial<React.ComponentProps<typeof DecisionMakersGrid>> = {}) {
  const props = {
    results: [baseResult],
    revealedData: {} as Record<string, RevealedEntry>,
    revealingIds: new Set<string>(),
    onReveal: vi.fn(),
    onClearReveal: vi.fn(),
    onOpenDetails: vi.fn(),
    seniorityBadgeClass: seniorityClass,
    ...overrides,
  };
  const utils = render(
    <TooltipProvider>
      <DecisionMakersGrid {...props} />
    </TooltipProvider>,
  );
  return { ...utils, props };
}

describe("DecisionMakersGrid", () => {
  it("renderiza header do domínio + badge com total quando não há erro", () => {
    renderGrid();
    expect(screen.getByText("ambev.com.br")).toBeInTheDocument();
    expect(screen.getByText("2 decisores")).toBeInTheDocument();
  });

  it("renderiza badge de erro e não desenha a tabela quando r.error existe", () => {
    renderGrid({
      results: [{ domain: "err.com", error: "not_found", decisionMakers: [] }],
    });
    expect(screen.getByText("not_found")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renderiza linha por decisor com nome, cargo e link do LinkedIn", () => {
    renderGrid();
    expect(screen.getByText("Ana Silva")).toBeInTheDocument();
    expect(screen.getByText("Bruno Costa")).toBeInTheDocument();
    expect(screen.getByText("Diretora Comercial")).toBeInTheDocument();
    const link = screen.getAllByRole("link", { name: /Perfil/i })[0];
    expect(link).toHaveAttribute("href", "https://linkedin.com/in/ana-silva");
  });

  it('botão "Revelar" chama onReveal(dm) uma vez', () => {
    const { props } = renderGrid();
    const buttons = screen.getAllByRole("button", { name: /^Revelar$/ });
    fireEvent.click(buttons[0]);
    expect(props.onReveal).toHaveBeenCalledTimes(1);
    expect(props.onReveal).toHaveBeenCalledWith(dm1);
  });

  it("em estado de erro chama onClearReveal antes de re-tentar", () => {
    const { props } = renderGrid({
      revealedData: { "dm-1": { emails: [], phones: [], error: "boom" } },
    });
    const retry = screen.getByRole("button", { name: /Tentar novamente/i });
    fireEvent.click(retry);
    expect(props.onClearReveal).toHaveBeenCalledWith("dm-1");
  });

  it("clique em certificação chama onOpenDetails com type=certifications", () => {
    const { props } = renderGrid();
    // O badge de certificação envolve o nome dentro de role=button
    const certBadge = screen.getByText(/AWS SA/).closest('[role="button"]')!;
    fireEvent.click(certBadge);
    expect(props.onOpenDetails).toHaveBeenCalledWith({ type: "certifications", dm: dm1 });
  });

  it("estado revelado mostra mailto/tel e desabilita o botão (Revelado)", () => {
    renderGrid({
      revealedData: {
        "dm-1": {
          emails: [{ email: "a@b.com", type: null }],
          phones: [{ number: "+5511999999999", type: null }],
        },
      },
    });
    expect(screen.getByRole("link", { name: "a@b.com" })).toHaveAttribute("href", "mailto:a@b.com");
    expect(screen.getByRole("link", { name: "+5511999999999" })).toHaveAttribute(
      "href",
      "tel:+5511999999999",
    );
    const btn = screen.getByRole("button", { name: /^Revelado$/ });
    expect(btn).toBeDisabled();
  });

  it("revealingIds mostra 'Revelando…' e botão desabilitado", () => {
    renderGrid({ revealingIds: new Set(["dm-1"]) });
    const btn = screen.getByRole("button", { name: /Revelando/i });
    expect(btn).toBeDisabled();
  });
});
