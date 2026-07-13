import { createContext, useContext } from "react";

export interface DemoContextType {
  isDemoMode: boolean;
  enterDemo: () => void;
  exitDemo: () => void;
}

export const DemoContext = createContext<DemoContextType>({
  isDemoMode: false,
  enterDemo: () => {},
  exitDemo: () => {},
});

export const useDemo = () => useContext(DemoContext);

export const DEMO_KEY = "lux-demo-mode";
