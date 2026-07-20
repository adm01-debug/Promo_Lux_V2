import { useEffect, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { AuthContext } from "./auth-context";
import { clearActiveOrgId } from "@/integrations/supabase/withOrg";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // Limpa o cache do React Query e a org ativa ANTES do signOut real: em
    // navegador compartilhado, sem isso, o próximo login (outro usuário, ou
    // até o mesmo usuário noutra conta) reaproveitava dados cacheados
    // (["companies-list"], ["deals",...], etc.) e a org ativa em memória/
    // localStorage do usuário anterior até as queries refazerem — uma
    // janela real de vazamento de dados entre contas na mesma máquina.
    clearActiveOrgId();
    queryClient.clear();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
