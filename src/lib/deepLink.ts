/**
 * Navega para uma rota real do SPA pelo mesmo canal dos deep links de
 * notificação (`lux:deep-link`), que o `DeepLinkBridge` (`src/App.tsx`)
 * converte em `navigate()` do react-router — mantém o SPA, sem recarregar a
 * página nem perder o cache das consultas.
 */
export const navigateToPath = (path: string) => {
  window.dispatchEvent(new CustomEvent("lux:deep-link", { detail: { url: path } }));
};
