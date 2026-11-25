import { useState, useCallback, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DemoContext, DEMO_KEY } from "./demo-context";

export function DemoProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [isDemoMode, setIsDemoMode] = useState(() => {
    try { return localStorage.getItem(DEMO_KEY) === "true"; } catch { return false; }
  });

  // Trocar de modo invalida todo o cache: dados de demonstração nunca devem
  // reaparecer numa sessão real (e vice-versa).
  const enterDemo = useCallback(() => {
    setIsDemoMode(true);
    queryClient.clear();
    localStorage.setItem(DEMO_KEY, "true");
  }, [queryClient]);

  const exitDemo = useCallback(() => {
    setIsDemoMode(false);
    queryClient.clear();
    localStorage.removeItem(DEMO_KEY);
  }, [queryClient]);

  return (
    <DemoContext.Provider value={{ isDemoMode, enterDemo, exitDemo }}>
      {children}
    </DemoContext.Provider>
  );
}
