import "@testing-library/jest-dom";

// Suppress known harmless warnings in test output
const originalError = console.error;
console.error = (...args: unknown[]) => {
  const msg = typeof args[0] === "string" ? args[0] : "";
  // Suppress framer-motion prop warnings (whileHover, whileTap) and SVG casing warnings in jsdom
  if (
    msg.includes("whileHover") ||
    msg.includes("whileTap") ||
    msg.includes("is using incorrect casing") ||
    msg.includes("is unrecognized in this browser")
  ) return;
  originalError.apply(console, args);
};

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
