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

// Register service worker for PWA offline support
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
