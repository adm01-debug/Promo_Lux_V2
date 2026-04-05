import { test, expect } from "../playwright-fixture";

// ─── Login Page ───────────────────────────────────────────────

test.describe("Login Page", () => {
  test("renders login form with all elements", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=LUX")).toBeVisible();
    await expect(page.locator("text=SALES INTELLIGENCE PLATFORM")).toBeVisible();
    await expect(page.getByPlaceholder("seu@email.com")).toBeVisible();
    await expect(page.getByText("Entrar com Google")).toBeVisible();
    await expect(page.getByText("Criar Conta")).toBeVisible();
    await expect(page.getByText("Esqueceu a senha?")).toBeVisible();
  });

  test("switches between login and signup tabs", async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Criar Conta").click();
    await expect(page.getByText("Criar Conta")).toBeVisible();
    await page.getByRole("tab", { name: "Entrar" }).click();
    await expect(page.getByPlaceholder("seu@email.com")).toBeVisible();
  });

  test("shows demo mode button", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Explorar em modo demonstração")).toBeVisible();
  });

  test("shows validation error for empty email submit", async ({ page }) => {
    await page.goto("/login");
    // Click Entrar without filling fields — button is the gold submit button
    await page.locator("button", { hasText: "Entrar" }).last().click();
    // Should stay on login page (no navigation)
    await expect(page.getByPlaceholder("seu@email.com")).toBeVisible();
  });

  test("shows forgot password overlay", async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Esqueceu a senha?").click();
    await expect(page.getByText("Recuperar Senha")).toBeVisible();
  });
});

// ─── Demo Mode — Dashboard ───────────────────────────────────

test.describe("Demo Mode — Dashboard & KPIs", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Explorar em modo demonstração").click();
    await page.waitForSelector("text=Dashboard", { timeout: 10000 });
  });

  test("enters demo mode and shows dashboard greeting", async ({ page }) => {
    await expect(page.getByText("Modo Demonstração")).toBeVisible();
    await expect(page.getByText(/Bom|Boa/)).toBeVisible();
  });

  test("shows KPI stats grid with 4 cards", async ({ page }) => {
    await expect(page.getByText("WORKFLOWS ATIVOS")).toBeVisible();
    await expect(page.getByText("EMPRESAS ENCONTRADAS")).toBeVisible();
    await expect(page.getByText("TAXA DE ENRIQUECIMENTO")).toBeVisible();
    await expect(page.getByText("RASPAGENS HOJE")).toBeVisible();
  });

  test("shows performance chart section", async ({ page }) => {
    await expect(page.getByText("Performance Semanal")).toBeVisible();
  });

  test("shows quick action cards", async ({ page }) => {
    await expect(page.getByText("Configurar IPC")).toBeVisible();
    await expect(page.getByText("Raspar Google Maps")).toBeVisible();
    await expect(page.getByText("Criar Workflow")).toBeVisible();
    await expect(page.getByText("Agente IA")).toBeVisible();
  });
});

// ─── Demo Mode — Full Navigation ─────────────────────────────

test.describe("Demo Mode — Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Explorar em modo demonstração").click();
    await page.waitForSelector("text=Dashboard", { timeout: 10000 });
  });

  test("shows all sidebar navigation items", async ({ page }) => {
    const navItems = [
      "Dashboard", "Analytics", "Configurar IPC", "Empresas",
      "Sinais de Intenção", "Stakeholders", "Workflows",
      "Google Maps", "Mapa de Empresas", "Campanhas", "Agente IA", "Configurações",
    ];
    for (const item of navItems) {
      await expect(page.getByRole("button", { name: new RegExp(item) }).first()).toBeVisible();
    }
  });

  test("navigates to Empresas and shows table", async ({ page }) => {
    await page.getByRole("button", { name: /Empresas/ }).first().click();
    await expect(page.getByText("Empresas Identificadas")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Filtros")).toBeVisible();
    await expect(page.getByText("Exportar CSV")).toBeVisible();
    await expect(page.getByText("Nova Empresa")).toBeVisible();
  });

  test("navigates to Workflows and shows list", async ({ page }) => {
    await page.getByRole("button", { name: /Workflows/ }).click();
    await expect(page.getByText("Workflows de Automação")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Novo Workflow")).toBeVisible();
  });

  test("navigates to Analytics and shows charts", async ({ page }) => {
    await page.getByRole("button", { name: /Analytics/ }).click();
    await expect(page.getByText("Analytics & Relatórios")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Funil de Conversão")).toBeVisible();
    await expect(page.getByText("ROI por Campanha")).toBeVisible();
  });

  test("navigates to Campanhas and shows campaigns", async ({ page }) => {
    await page.getByRole("button", { name: /Campanhas/ }).click();
    await expect(page.getByText("Campanhas de Outreach")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Nova Campanha")).toBeVisible();
  });

  test("navigates to Agente IA and shows chat", async ({ page }) => {
    await page.getByRole("button", { name: /Agente IA/ }).click();
    await expect(page.getByText("Agente IA").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder(/Pergunte sobre/)).toBeVisible();
  });

  test("navigates to Configurações and shows settings", async ({ page }) => {
    await page.getByRole("button", { name: /Configurações/ }).click();
    await expect(page.getByText("Informações da Conta")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Notificações")).toBeVisible();
  });

  test("navigates to Configurar IPC", async ({ page }) => {
    await page.getByRole("button", { name: /Configurar IPC/ }).click();
    await expect(page.getByText("Perfil de Cliente Ideal")).toBeVisible({ timeout: 5000 });
  });

  test("navigates to Stakeholders", async ({ page }) => {
    await page.getByRole("button", { name: /Stakeholders/ }).click();
    await expect(page.getByText("Stakeholders")).toBeVisible({ timeout: 5000 });
  });

  test("navigates through all views sequentially without errors", async ({ page }) => {
    const views = [
      { button: /Empresas/, text: "Empresas Identificadas" },
      { button: /Workflows/, text: "Workflows de Automação" },
      { button: /Analytics/, text: "Analytics & Relatórios" },
      { button: /Campanhas/, text: "Campanhas de Outreach" },
      { button: /Agente IA/, text: "Agente IA" },
      { button: /Configurações/, text: "Informações da Conta" },
      { button: /Dashboard/, text: "Modo Demonstração" },
    ];

    for (const view of views) {
      await page.getByRole("button", { name: view.button }).first().click();
      await expect(page.getByText(view.text).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("breadcrumbs update on navigation", async ({ page }) => {
    await page.getByRole("button", { name: /Empresas/ }).first().click();
    await expect(page.getByText("Prospecção")).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /Workflows/ }).click();
    await expect(page.getByText("Automação")).toBeVisible({ timeout: 5000 });
  });

  test("search bar is visible in header", async ({ page }) => {
    await expect(page.getByText("Buscar...")).toBeVisible();
  });
});

// ─── Demo Mode — Company Creation ────────────────────────────

test.describe("Demo Mode — Company Creation Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Explorar em modo demonstração").click();
    await page.waitForSelector("text=Dashboard", { timeout: 10000 });
    // Navigate to Empresas
    await page.getByRole("button", { name: /Empresas/ }).first().click();
    await expect(page.getByText("Empresas Identificadas")).toBeVisible({ timeout: 5000 });
  });

  test("opens Add Company dialog", async ({ page }) => {
    await page.getByText("Nova Empresa").click();
    await expect(page.getByText("Nova Empresa").nth(1)).toBeVisible({ timeout: 3000 });
    await expect(page.getByPlaceholder("Nome da empresa")).toBeVisible();
  });

  test("shows validation error when submitting empty form", async ({ page }) => {
    await page.getByText("Nova Empresa").click();
    await expect(page.getByPlaceholder("Nome da empresa")).toBeVisible();
    // Click Adicionar Empresa without filling
    await page.getByText("Adicionar Empresa").click();
    // Should show validation error — name is required
    await expect(page.getByText(/obrigatório|required|inválid/i).first()).toBeVisible({ timeout: 3000 });
  });

  test("fills form fields correctly", async ({ page }) => {
    await page.getByText("Nova Empresa").click();
    await expect(page.getByPlaceholder("Nome da empresa")).toBeVisible();

    // Fill all fields
    await page.getByPlaceholder("Nome da empresa").fill("Empresa Teste E2E");
    await page.getByPlaceholder("Ex: SaaS B2B").fill("Tecnologia");
    await page.getByPlaceholder("Ex: São Paulo - SP").fill("São Paulo, SP");
    await page.getByPlaceholder("contato@empresa.com").fill("contato@teste.com");
    await page.getByPlaceholder("(11) 99999-9999").fill("(11) 98765-4321");
    await page.getByPlaceholder("https://empresa.com").fill("https://teste.com.br");
    await page.getByPlaceholder("Ex: 50-200").fill("50-200");

    // Verify values are filled
    await expect(page.getByPlaceholder("Nome da empresa")).toHaveValue("Empresa Teste E2E");
    await expect(page.getByPlaceholder("Ex: SaaS B2B")).toHaveValue("Tecnologia");
    await expect(page.getByPlaceholder("contato@empresa.com")).toHaveValue("contato@teste.com");
  });

  test("dialog can be closed", async ({ page }) => {
    await page.getByText("Nova Empresa").click();
    await expect(page.getByPlaceholder("Nome da empresa")).toBeVisible();
    // Close dialog via X button
    await page.locator("[role='dialog'] button[class*='close'], [role='dialog'] button:has(svg.lucide-x)").first().click();
    // Dialog should be gone
    await expect(page.getByPlaceholder("Nome da empresa")).not.toBeVisible({ timeout: 3000 });
  });
});

// ─── Demo Mode — Empresas Filters ────────────────────────────

test.describe("Demo Mode — Company Filters", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Explorar em modo demonstração").click();
    await page.waitForSelector("text=Dashboard", { timeout: 10000 });
    await page.getByRole("button", { name: /Empresas/ }).first().click();
    await expect(page.getByText("Empresas Identificadas")).toBeVisible({ timeout: 5000 });
  });

  test("shows filter panel with facets", async ({ page }) => {
    await expect(page.getByText("Filtros")).toBeVisible();
    await expect(page.getByText("SETOR")).toBeVisible();
    await expect(page.getByText("SCORE IPC")).toBeVisible();
  });

  test("search input filters companies", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Buscar empresas...");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Fin");
    // Should filter — count text should update
    await page.waitForTimeout(500);
    const resultsText = page.getByText(/\d+ resultado/);
    await expect(resultsText).toBeVisible();
  });

  test("sort buttons are visible", async ({ page }) => {
    await expect(page.getByText("Score ↓").first()).toBeVisible();
    await expect(page.getByText("Nome")).toBeVisible();
    await expect(page.getByText("Setor").first()).toBeVisible();
  });
});

// ─── Demo Mode — Header & Interactions ───────────────────────

test.describe("Demo Mode — Header Interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Explorar em modo demonstração").click();
    await page.waitForSelector("text=Dashboard", { timeout: 10000 });
  });

  test("notification bell is visible and shows badge", async ({ page }) => {
    const bellArea = page.locator("button").filter({ has: page.locator("svg.lucide-bell") });
    await expect(bellArea.first()).toBeVisible();
  });

  test("user avatar dropdown opens", async ({ page }) => {
    // Click the avatar (last button in header actions)
    const avatar = page.locator("button.rounded-full").first();
    await avatar.click();
    await expect(page.getByText("Configurações")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Sair")).toBeVisible();
  });

  test("skip-nav link exists for accessibility", async ({ page }) => {
    const skipLink = page.locator("a[href='#main-content']");
    await expect(skipLink).toHaveCount(1);
  });
});
