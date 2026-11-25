import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/integrations/supabase/client";

const LOCAL_KEY = "lux-onboarding-done";

/**
 * Manages onboarding completion state.
 * Persists in the database (profiles.onboarding_completed) and uses localStorage as fallback/cache.
 */
export function useOnboardingState() {
  const { user } = useAuth();
  const [shouldShow, setShouldShow] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Quick local check first
    if (localStorage.getItem(LOCAL_KEY) === "true") {
      setShouldShow(false);
      setLoading(false);
      return;
    }

    // Check database
    const check = async () => {
      try {
        // O cliente devolve `{ data, error }` em vez de lançar em erro de
        // resposta: ler só `data` faria o bloco `catch` nunca rodar e a tela
        // mostrar o passo a passo para quem já concluiu (etapa 197).
        const { data, error } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          // Falha de leitura: na dúvida não incomodar quem já concluiu.
          setShouldShow(false);
        } else if (data?.onboarding_completed) {
          localStorage.setItem(LOCAL_KEY, "true");
          setShouldShow(false);
        } else {
          setShouldShow(true);
        }
      } catch {
        // Falha de rede (o cliente lança aqui): mesmo critério do erro lido.
        setShouldShow(false);
      } finally {
        setLoading(false);
      }
    };

    check();
  }, [user]);

  const markCompleted = useCallback(async () => {
    setShouldShow(false);
    localStorage.setItem(LOCAL_KEY, "true");

    if (user) {
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", user.id);
    }
  }, [user]);

  return { shouldShow, loading, markCompleted };
}
