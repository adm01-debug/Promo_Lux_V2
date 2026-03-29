import { useState, useEffect, useCallback } from "react";

export type Skin = "gold" | "blue" | "green" | "red";

const SKIN_KEY = "lux-skin";

export function useSkin() {
  const [skin, setSkinState] = useState<Skin>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem(SKIN_KEY) as Skin) || "gold";
    }
    return "gold";
  });

  const setSkin = useCallback((s: Skin) => {
    setSkinState(s);
    localStorage.setItem(SKIN_KEY, s);
    document.documentElement.setAttribute("data-skin", s);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-skin", skin);
  }, [skin]);

  return { skin, setSkin };
}
