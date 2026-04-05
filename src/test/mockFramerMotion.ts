/**
 * Shared framer-motion mock factory for Vitest.
 *
 * Usage in test files:
 *   vi.mock("framer-motion", () => mockFramerMotion());
 *
 * Supports all motion.* elements including SVG (circle, path, etc.)
 * and all commonly used hooks (useInView, useMotionValue, etc.).
 */
import React from "react";

const SVG_ELEMENTS = new Set(["circle", "path", "rect", "line", "ellipse", "polygon", "polyline", "g", "svg"]);
const TABLE_ELEMENTS = new Set(["tr", "td", "th", "thead", "tbody", "tfoot"]);
const INLINE_ELEMENTS = new Set(["span", "a", "strong", "em", "b", "i"]);

export function mockFramerMotion() {
  const handler = {
    get: (_target: unknown, prop: string) => {
      if (SVG_ELEMENTS.has(prop)) {
        return (props: Record<string, unknown>) => React.createElement(prop);
      }
      if (TABLE_ELEMENTS.has(prop)) {
        return ({ children, className }: { children?: React.ReactNode; className?: string }) =>
          React.createElement(prop, { className }, children);
      }
      if (INLINE_ELEMENTS.has(prop)) {
        return ({ children, className, style }: { children?: React.ReactNode; className?: string; style?: React.CSSProperties }) =>
          React.createElement(prop, { className, style }, children);
      }
      // Default: render as div
      return ({ children, className, style, onClick }: { children?: React.ReactNode; className?: string; style?: React.CSSProperties; onClick?: () => void }) =>
        React.createElement("div", { className, style, onClick }, children);
    },
  };

  return {
    motion: new Proxy({}, handler),
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => children ?? null,
    useInView: () => true,
    useMotionValue: () => ({ get: () => 0, set: () => {} }),
    useTransform: () => ({ get: () => 0 }),
    useAnimation: () => ({ start: () => Promise.resolve(), stop: () => {} }),
    useScroll: () => ({ scrollY: { get: () => 0, set: () => {} }, scrollYProgress: { get: () => 0, set: () => {} } }),
    animate: (_mv: unknown, _to: unknown, opts?: { onUpdate?: (v: unknown) => void }) => {
      opts?.onUpdate?.(_to);
      return { stop: () => {} };
    },
  };
}
