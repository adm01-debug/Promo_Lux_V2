/**
 * Fases executaveis de um workflow.
 *
 * O campo `workflows.steps` (jsonb) declara quais fases do pipeline rodam.
 * Cada step pode trazer `{ phase: "scrape" | "enrich" | "ipc_score" }`.
 * Workflows legados tem `steps` vazio ou sem `phase` — nesse caso todas as
 * fases rodam, exatamente como antes deste campo passar a ser interpretado.
 */
export const WORKFLOW_PHASES = ["scrape", "enrich", "ipc_score"] as const;
export type WorkflowPhase = (typeof WORKFLOW_PHASES)[number];

export function declaredPhases(steps: unknown): string[] {
  if (!Array.isArray(steps)) return [];
  return steps
    .map((s: unknown) => (s as Record<string, unknown> | null)?.phase)
    .filter((p: unknown): p is string => typeof p === "string");
}

export function phaseEnabled(steps: unknown, phase: WorkflowPhase): boolean {
  const declared = declaredPhases(steps);
  if (declared.length === 0) return true;
  return declared.includes(phase);
}
