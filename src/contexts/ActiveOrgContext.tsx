/**
 * `useActiveOrganization` era estado local por instância (`useState` dentro
 * do próprio hook) — cada componente que o chamava tinha sua PRÓPRIA cópia
 * de `activeId`. `setActive` atualizava só a instância que o chamou (mais
 * memória do módulo + `invalidateQueries` + um evento `storage` sintético),
 * mas nada nesta árvore de componentes ESCUTAVA esse evento — outras
 * instâncias montadas (ex.: o rótulo do switcher vs. um painel de
 * monitoramento) e outras abas ficavam com a org antiga até um re-render
 * não relacionado as resincronizar por acaso. (Hoje este provider é quem
 * escuta o evento.)
 *
 * Convertido para Context: uma única fonte de verdade, um único listener de
 * `storage` (sincroniza entre abas de verdade), propagado para toda a
 * árvore. A API pública (`{ activeOrgId, activeOrg, setActive }`) é
 * idêntica — nenhum dos ~13 consumidores precisou mudar.
 */
import { useEffect, useState, useCallback, useMemo, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setActiveOrgId, ACTIVE_ORG_STORAGE_KEY } from "@/integrations/supabase/withOrg";
import { useMyOrganizations } from "@/hooks/useOrganizations";
import { ActiveOrgContext } from "./active-org-context";

/** Evento sintético de troca de organização carrega a aba de origem. */
type OrgStorageEvent = StorageEvent & { __originTab?: string };

export function ActiveOrgProvider({ children }: { children: ReactNode }) {
  const { data: orgs } = useMyOrganizations();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem(ACTIVE_ORG_STORAGE_KEY) : null
  );
  // Identificador desta aba, só em memória, para distinguir o evento sintético
  // que nós mesmos disparamos dos eventos vindos de outras abas.
  const tabId = useRef(`tab-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    if (!orgs || orgs.length === 0) return;
    const valid = orgs.find((o) => o.organization_id === activeId);
    if (!valid) {
      const first = orgs[0].organization_id;
      setActiveId(first);
      localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, first);
      setActiveOrgId(first);
    } else {
      setActiveOrgId(activeId);
    }
  }, [orgs, activeId]);

  // Sincroniza entre abas: outra aba trocando de org (ou o signOut limpando
  // a chave) dispara um evento `storage` que esta aba escuta e aplica.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== ACTIVE_ORG_STORAGE_KEY) return;
      // O evento sintético de `setActive` abaixo existe para alcançar quem
      // ficou fora deste Context, mas `dispatchEvent` também entrega ao
      // escutador da PRÓPRIA aba — sem esta marca, toda troca invalidava o
      // cache duas vezes (uma em `setActive`, outra aqui).
      if ((e as OrgStorageEvent).__originTab === tabId) return;
      const next = e.newValue;
      setActiveId(next);
      setActiveOrgId(next);
      qc.invalidateQueries();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [qc, tabId]);

  const setActive = useCallback((id: string) => {
    if (id === activeId) return;
    setActiveId(id);
    localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, id);
    setActiveOrgId(id);
    qc.invalidateQueries();
    // Eventos `storage` só disparam em OUTRAS abas nativamente — dispara um
    // sintético aqui também para instâncias fora desta árvore específica
    // (mantido por compatibilidade; a maioria dos consumidores agora recebe
    // o valor via este mesmo Context, então nem precisa dele). Vai marcado com
    // a aba de origem para o nosso próprio escutador ignorá-lo e não invalidar
    // o cache de novo.
    const echo = new StorageEvent("storage", {
      key: ACTIVE_ORG_STORAGE_KEY,
      newValue: id,
    }) as OrgStorageEvent;
    echo.__originTab = tabId;
    window.dispatchEvent(echo);
  }, [activeId, qc, tabId]);

  const active = useMemo(
    () => (orgs ?? []).find((o) => o.organization_id === activeId) ?? null,
    [orgs, activeId]
  );

  const value = useMemo(
    () => ({ activeOrgId: activeId, activeOrg: active, setActive }),
    [activeId, active, setActive]
  );

  return <ActiveOrgContext.Provider value={value}>{children}</ActiveOrgContext.Provider>;
}
