import { describe, it, expectTypeOf } from "vitest";
import type { DecisionMakersGridProps } from "./DecisionMakersGrid";
import type { DecisionMaker, DMCompanyResult, RevealedEntry } from "./types";

// ============================================================================
// R35 — Contrato de props do DecisionMakersGrid.
// Type-only. Blindado contra renomeação/remoção acidental de callbacks.
// ============================================================================

describe("DecisionMakersGrid — props (R35)", () => {
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

  it("onReveal: (dm: DecisionMaker) => void", () => {
    expectTypeOf<DecisionMakersGridProps["onReveal"]>().toEqualTypeOf<
      (dm: DecisionMaker) => void
    >();
  });

  it("onClearReveal: (id: string) => void", () => {
    expectTypeOf<DecisionMakersGridProps["onClearReveal"]>().toEqualTypeOf<
      (dmId: string) => void
    >();
  });

  it("onOpenDetails aceita payload discriminado", () => {
    type Payload = Parameters<DecisionMakersGridProps["onOpenDetails"]>[0];
    expectTypeOf<Payload>().toEqualTypeOf<{
      type: "certifications" | "courses" | "awards";
      dm: DecisionMaker;
    }>();
  });

  it("seniorityBadgeClass: (s: string) => string", () => {
    expectTypeOf<DecisionMakersGridProps["seniorityBadgeClass"]>().toEqualTypeOf<
      (s: string) => string
    >();
  });
});
