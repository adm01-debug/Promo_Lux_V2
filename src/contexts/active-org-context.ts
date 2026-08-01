import { createContext, useContext } from "react";
import type { OrgMembership } from "@/hooks/useOrganizations";

export interface ActiveOrgContextValue {
  activeOrgId: string | null;
  activeOrg: OrgMembership | null;
  setActive: (id: string) => void;
}

// Valor-padrão seguro (mesma convenção de auth-context.ts) em vez de lançar
// quando não há <ActiveOrgProvider> — cobre componentes renderizados fora
// da árvore do provider em testes unitários (a maioria só mocka o módulo
// @/hooks/useOrganizations e nunca chega perto do provider real) sem
// precisar caçar cada teste um a um. Produção sempre tem o provider (ver
// App.tsx), então isto só é observável em testes/uso indevido.
const DEFAULT_VALUE: ActiveOrgContextValue = {
  activeOrgId: null,
  activeOrg: null,
  setActive: () => {},
};

export const ActiveOrgContext = createContext<ActiveOrgContextValue>(DEFAULT_VALUE);

/** Lê a organização ativa do Context — mesma API de antes, agora compartilhada. */
export function useActiveOrganization(): ActiveOrgContextValue {
  return useContext(ActiveOrgContext);
}
