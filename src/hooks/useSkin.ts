import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Skin = "gold" | "blue" | "green" | "red";

const SKIN_KEY = "lux-skin";

export function useSkin() {
  const { user } = useAuth();
  const [skin, setSkinState] = useState<Skin>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem(SKIN_KEY) as Skin) || "gold";
    }
    return "gold";
  });

  // Load skin from DB when user is authenticated
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("skin")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.skin) {
          const dbSkin = data.skin as Skin;
          setSkinState(dbSkin);
          localStorage.setItem(SKIN_KEY, dbSkin);
          document.documentElement.setAttribute("data-skin", dbSkin);
        }
      });
  }, [user]);

  const setSkin = useCallback((s: Skin) => {
    setSkinState(s);
    localStorage.setItem(SKIN_KEY, s);
    document.documentElement.setAttribute("data-skin", s);

    // Persist to DB if authenticated
    if (user) {
      supabase
        .from("profiles")
        .update({ skin: s })
        .eq("id", user.id)
        .then(({ error }) => {
          if (error) console.error("Failed to save skin:", error);
        });
    }
  }, [user]);

  useEffect(() => {
    document.documentElement.setAttribute("data-skin", skin);
  }, [skin]);

  return { skin, setSkin };
}
