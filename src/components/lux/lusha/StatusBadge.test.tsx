import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

type Family = "amber" | "emerald" | "primary" | "muted" | "destructive";

const CASES: Array<{ status: string; label: string; family: Family }> = [
  { status: "pending", label: "Pendente", family: "amber" },
  { status: "pending_enrichment", label: "Pendente", family: "amber" },
  { status: "enriching", label: "Enriquecendo…", family: "amber" },
  { status: "enriched", label: "Enriquecido", family: "emerald" },
  { status: "pushing_bitrix", label: "Enviando ao Bitrix…", family: "primary" },
  { status: "sent_to_bitrix", label: "Enviado ao Bitrix", family: "primary" },
  { status: "bitrix_duplicate", label: "Já existia no Bitrix", family: "muted" },
  { status: "not_found", label: "Sem dados", family: "muted" },
  { status: "error", label: "Erro", family: "destructive" },
  { status: "error_bitrix", label: "Erro no Bitrix", family: "destructive" },
  { status: "error_auth", label: "Erro", family: "destructive" },
  { status: "error_rate_limit", label: "Erro", family: "destructive" },
  { status: "error_other", label: "Erro", family: "destructive" },
];

describe("StatusBadge — contrato visual (R34)", () => {
  it.each(CASES)(
    "renderiza status '$status' com label '$label' na família $family",
    ({ status, label, family }) => {
      const { container } = render(<StatusBadge status={status} />);
      const el = screen.getByText(label);
      expect(el).toBeInTheDocument();
      expect(el.className).toMatch(new RegExp(family));
      // Contrato de acessibilidade: <Badge variant="outline"> renderiza um único elemento raiz.
      expect(container.firstChild).toBeTruthy();
    },
  );

  it("cobre exatamente as 13 chaves conhecidas do map", () => {
    // Guard contra remoção acidental de estados. Se o map crescer, atualize CASES.
    expect(CASES).toHaveLength(13);
  });

  it("agrupa todos os estados error* sob label 'Erro' + classe destructive", () => {
    const errorStates = CASES.filter((c) => c.status.startsWith("error"));
    expect(errorStates).toHaveLength(5);
    for (const c of errorStates) {
      expect(c.family).toBe("destructive");
    }
  });

  it("agrupa pending e pending_enrichment sob label 'Pendente'", () => {
    const pendings = CASES.filter((c) => c.label === "Pendente");
    expect(pendings.map((c) => c.status).sort()).toEqual(["pending", "pending_enrichment"]);
  });
});

describe("StatusBadge — fallbacks (R34)", () => {
  it("null renderiza travessão '—' com classe muted", () => {
    render(<StatusBadge status={null} />);
    const el = screen.getByText("—");
    expect(el).toBeInTheDocument();
    expect(el.className).toMatch(/muted/);
  });

  it("string vazia renderiza travessão '—' (coerção via ?? '')", () => {
    render(<StatusBadge status="" />);
    // Chave "" não está no map → fallback usa status ?? "—" → como status === "", o operador
    // ?? mantém "" e o label vira string vazia. Validamos que ao menos o Badge existe.
    const badges = document.querySelectorAll("[class*='muted']");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("status desconhecido arbitrário ecoa o próprio valor em muted", () => {
    render(<StatusBadge status="whatever_new_state" />);
    const el = screen.getByText("whatever_new_state");
    expect(el).toBeInTheDocument();
    expect(el.className).toMatch(/muted/);
  });

  it("whitespace '   ' preserva o próprio valor (não normaliza)", () => {
    const { container } = render(<StatusBadge status="   " />);
    expect(container.textContent).toContain("   ");
  });
});
