import { useState, useCallback, ReactNode } from "react";
import { DemoContext, DEMO_KEY } from "./demo-context";

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(() => {
    try { return localStorage.getItem(DEMO_KEY) === "true"; } catch { return false; }
  });

  const enterDemo = useCallback(() => {
    setIsDemoMode(true);
    localStorage.setItem(DEMO_KEY, "true");
  }, []);

  const exitDemo = useCallback(() => {
    setIsDemoMode(false);
    localStorage.removeItem(DEMO_KEY);
  }, []);

  return (
    <DemoContext.Provider value={{ isDemoMode, enterDemo, exitDemo }}>
      {children}
    </DemoContext.Provider>
  );
}
