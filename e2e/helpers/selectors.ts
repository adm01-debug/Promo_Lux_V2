/**
 * Centralized stable selectors for E2E tests.
 * Prefer accessible queries (getByRole/getByLabel) — fall back to these for
 * elements that lack semantic markers.
 */
export const Selectors = {
  // Auth
  loginEmail: () => 'input[id="login-email"], input[placeholder="seu@email.com"]',
  loginPassword: () => 'input[id="login-password"]',
  signupEmail: () => 'input[id="signup-email"]',
  signupPassword: () => 'input[id="signup-password"]',
  demoButton: () => "text=Explorar em modo demonstração",

  // App shell
  sidebarNav: (name: string | RegExp) => ({ role: "button" as const, name }),
  searchHeader: () => "Buscar...",

  // Companies
  companiesTable: () => "Empresas Identificadas",
  newCompanyButton: () => "Nova Empresa",
  companySearchInput: () => "Buscar empresas...",
  addCompanySubmit: () => "Adicionar Empresa",
  exportCSV: () => "Exportar CSV",

  // Dialogs
  dialog: () => "[role='dialog']",
  dialogClose: () => "[role='dialog'] button:has(svg.lucide-x)",
} as const;

export const Routes = {
  login: "/login",
  resetPassword: "/reset-password",
  index: "/",
} as const;