import { useState, useEffect } from "react";
import { useTheme } from "next-themes";

/**
 * Reads live CSS custom properties from the DOM so charts/canvas
 * elements can use the active skin colors instead of hardcoded values.
 */
export function useThemeColors() {
  const { theme, resolvedTheme } = useTheme();
  const [colors, setColors] = useState(() => readColors());

  useEffect(() => {
    // Small delay to let CSS variables settle after theme/skin change
    const id = setTimeout(() => setColors(readColors()), 50);
    return () => clearTimeout(id);
  }, [theme, resolvedTheme]);

  // Also listen for data-skin attribute changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTimeout(() => setColors(readColors()), 50);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-skin", "class"],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}

function readColors() {
  if (typeof window === "undefined") return fallback;
  const s = getComputedStyle(document.documentElement);
  return {
    primary: hslToString(s.getPropertyValue("--primary")),
    primaryFg: hslToString(s.getPropertyValue("--primary-foreground")),
    success: hslToString(s.getPropertyValue("--success")),
    destructive: hslToString(s.getPropertyValue("--destructive")),
    warning: hslToString(s.getPropertyValue("--warning")),
    muted: hslToString(s.getPropertyValue("--muted")),
    mutedFg: hslToString(s.getPropertyValue("--muted-foreground")),
    foreground: hslToString(s.getPropertyValue("--foreground")),
    background: hslToString(s.getPropertyValue("--background")),
    border: hslToString(s.getPropertyValue("--border")),
    card: hslToString(s.getPropertyValue("--card")),
  };
}

function hslToString(raw: string): string {
  const v = raw.trim();
  if (!v) return "hsl(0 0% 50%)";
  if (v.startsWith("hsl")) return v;
  return `hsl(${v})`;
}

const fallback = {
  primary: "hsl(45 100% 55%)",
  primaryFg: "hsl(225 30% 3%)",
  success: "hsl(142 80% 50%)",
  destructive: "hsl(0 85% 58%)",
  warning: "hsl(38 100% 55%)",
  muted: "hsl(225 20% 10%)",
  mutedFg: "hsl(220 15% 60%)",
  foreground: "hsl(48 20% 96%)",
  background: "hsl(225 30% 3%)",
  border: "hsl(225 20% 20%)",
  card: "hsl(225 26% 7%)",
};
