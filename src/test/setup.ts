import "@testing-library/jest-dom";

// Suppress known harmless warnings in test output
const originalError = console.error;
const originalWarn = console.warn;
const SUPPRESSED = [
  "whileHover", "whileTap", "incorrect casing", "unrecognized in this browser",
];
const shouldSuppress = (...args: unknown[]) => {
  const msg = args.map(a => typeof a === "string" ? a : "").join(" ");
  return SUPPRESSED.some(s => msg.includes(s));
};
console.error = (...args: unknown[]) => { if (!shouldSuppress(...args)) originalError.apply(console, args); };
console.warn = (...args: unknown[]) => { if (!shouldSuppress(...args)) originalWarn.apply(console, args); };

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
