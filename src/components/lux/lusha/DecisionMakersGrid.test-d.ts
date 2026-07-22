import { describe, it, expectTypeOf } from "vitest";
import type { DecisionMakersGridProps } from "../DecisionMakersGrid";
import type { DecisionMaker, DMCompanyResult, RevealedEntry } from "../types";

// ============================================================================
// R35 — Contrato de props do DecisionMakersGrid.
// Type-only. Blindado contra renomeação/remoção acidental de callbacks.
// ============================================================================

describe("DecisionMakersGrid — props (R35)", () => {
  it("expõe exatamente as chaves esperadas", () => {
    expectTypeOf<keyof DecisionMakersGridProps>().toEqualTypeOf<
      | "results"
      | "revealedData"
      | "revealingIds"
      | "onReveal"
      | "onClearReveal"
      | "onOpenDetails"
      | "seniorityBadgeClass"
    >();
  });

  it("results tipa como DMCompanyResult[]", () => {
    expectTypeOf<DecisionMakersGridProps["results"]>().toEqualTypeOf<DMCompanyResult[]>();
  });

  it("revealedData indexa por id do DM", () => {
    expectTypeOf<DecisionMakersGridProps["revealedData"]>().toEqualTypeOf<
      Record<string, RevealedEntry>
    >();
  });

  it("revealingIds é Set<string>", () => {
    expectTypeOf<DecisionMakersGridProps["revealingIds"]>().toEqualTypeOf<Set<string>>();
  });

  it("onReveal recebe DecisionMaker", () => {
    expectTypeOf<DecisionMakersGridProps["onReveal"]>().parameter(0).toEqualTypeOf<DecisionMaker>();
    expectTypeOf<DecisionMakersGridProps["onReveal"]>().returns.toBeVoid();
  });

  it("onClearReveal recebe id string", () => {
    expectTypeOf<DecisionMakersGridProps["onClearReveal"]>().parameter(0).toBeString();
    expectTypeOf<DecisionMakersGridProps["onClearReveal"]>().returns.toBeVoid();
  });

  it("onOpenDetails aceita tipos discriminados", () => {
    type Payload = Parameters<DecisionMakersGridProps["onOpenDetails"]>[0];
    expectTypeOf<Payload["type"]>().toEqualTypeOf<"certifications" | "courses" | "awards">();
    expectTypeOf<Payload["dm"]>().toEqualTypeOf<DecisionMaker>();
  });

  it("seniorityBadgeClass é (s: string) => string", () => {
    expectTypeOf<DecisionMakersGridProps["seniorityBadgeClass"]>().toEqualTypeOf<
      (s: string) => string
    >();
  });
});
