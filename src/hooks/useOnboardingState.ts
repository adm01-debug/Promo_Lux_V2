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
        const { data } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", user.id)
          .maybeSingle();

        if (data?.onboarding_completed) {
          localStorage.setItem(LOCAL_KEY, "true");
          setShouldShow(false);
        } else {
          setShouldShow(true);
        }
      } catch {
        // If profile doesn't exist yet, show onboarding
        setShouldShow(true);
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
        .update({ onboarding_completed: true } as Record<string, unknown>)
        .eq("id", user.id);
    }
  }, [user]);

  return { shouldShow, loading, markCompleted };
}
