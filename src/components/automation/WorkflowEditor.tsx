// Stub: implementação anterior perdida (arquivo corrompido em base64 truncado).
// Não é referenciado em nenhuma tela ativa. Reimplementar quando necessário.
export type StepType = "email" | "wait" | "condition" | "notify" | "webhook" | "tag";

export interface WorkflowStep {
  id: string;
  type: StepType;
  label: string;
  config: Record<string, unknown>;
}

export interface WorkflowEditorProps {
  initialSteps?: WorkflowStep[];
  onSave?: (steps: WorkflowStep[]) => void;
  readOnly?: boolean;
  className?: string;
}

export function WorkflowEditor(_props: WorkflowEditorProps) {
  return null;
}
