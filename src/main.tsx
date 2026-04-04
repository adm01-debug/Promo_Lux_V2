import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global unhandled error handlers
window.addEventListener("unhandledrejection", (event) => {
  console.error("[UnhandledRejection]", event.reason);
  event.preventDefault();
});

window.addEventListener("error", (event) => {
  console.error("[GlobalError]", event.error);
});

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker — skip in iframes and Lovable preview hosts
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((regs) =>
    regs.forEach((r) => r.unregister())
  );
} else if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
