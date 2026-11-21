import { useEffect, useState, ReactNode, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { AuthContext } from "./auth-context";
import { clearActiveOrgId } from "@/integrations/supabase/withOrg";

/**
 * Usuário com fator TOTP verificado é obrigado a elevar a sessão a AAL2
 * antes de acessar o app. Retorna { mfaRequired } sem disparar erro quando
 * não há sessão.
 */
async function computeMfaRequired(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return false;
    const { currentLevel, nextLevel } = data;
    return nextLevel === "aal2" && currentLevel !== "aal2";
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  // true = senha confirmada, falta o codigo do autenticador (AAL1 -> AAL2).
  const [mfaRequired, setMfaRequired] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (event === "SIGNED_IN") {
        // A lib ja salvou a sessao AAL1; so liberamos a UI quando o nivel de
        // garantia e conhecido (evita tela piscando o dashboard no meio).
        setMfaRequired(await computeMfaRequired());
        setLoading(false);
      } else if (event === "MFA_CHALLENGE_VERIFIED") {
        // Codigo verificado; a sessao chegou elevada a AAL2.
        setMfaRequired(false);
        setLoading(false);
      } else {
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session) {
        setMfaRequired(await computeMfaRequired());
        setLoading(false);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    // Limpa o cache do React Query e a org ativa ANTES do signOut real: em
    // navegador compartilhado, sem isso, o próximo login (outro usuário, ou
    // até o mesmo usuário noutra conta) reaproveitava dados cacheados
    // (["companies-list"], ["deals",...], etc.) e a org ativa em memória/
    // localStorage do usuário anterior até as queries refazerem — uma
    // janela real de vazamento de dados entre contas na mesma máquina.
    clearActiveOrgId();
    queryClient.clear();
    setMfaRequired(false);
    await supabase.auth.signOut();
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ user, session, loading, mfaRequired, setMfaRequired, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
