import { test, expect } from "../playwright-fixture";

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
});

test.describe("Demo Mode Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Explorar em modo demonstração").click();
    await page.waitForSelector("text=Dashboard", { timeout: 10000 });
  });

  test("enters demo mode and shows dashboard", async ({ page }) => {
    await expect(page.getByText("Modo Demonstração")).toBeVisible();
    await expect(page.getByText("Bom")).toBeVisible(); // greeting
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

  test("navigates to Empresas view", async ({ page }) => {
    await page.getByRole("button", { name: /Empresas/ }).first().click();
    await expect(page.getByText("Empresas Identificadas")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Filtros")).toBeVisible();
    await expect(page.getByText("Exportar CSV")).toBeVisible();
  });

  test("navigates to Workflows view", async ({ page }) => {
    await page.getByRole("button", { name: /Workflows/ }).click();
    await expect(page.getByText("Workflows de Automação")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Novo Workflow")).toBeVisible();
  });

  test("navigates to Analytics view", async ({ page }) => {
    await page.getByRole("button", { name: /Analytics/ }).click();
    await expect(page.getByText("Analytics & Relatórios")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Funil de Conversão")).toBeVisible();
  });

  test("navigates to Campanhas view", async ({ page }) => {
    await page.getByRole("button", { name: /Campanhas/ }).click();
    await expect(page.getByText("Campanhas de Outreach")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Nova Campanha")).toBeVisible();
  });

  test("navigates to Agente IA view", async ({ page }) => {
    await page.getByRole("button", { name: /Agente IA/ }).click();
    await expect(page.getByText("Agente IA").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder(/Pergunte sobre/)).toBeVisible();
  });

  test("navigates to Configurações view", async ({ page }) => {
    await page.getByRole("button", { name: /Configurações/ }).click();
    await expect(page.getByText("Informações da Conta")).toBeVisible({ timeout: 5000 });
  });

  test("navigates to Configurar IPC view", async ({ page }) => {
    await page.getByRole("button", { name: /Configurar IPC/ }).click();
    await expect(page.getByText("Perfil de Cliente Ideal")).toBeVisible({ timeout: 5000 });
  });

  test("navigates to Stakeholders view", async ({ page }) => {
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
  });

  test("search bar is visible in header", async ({ page }) => {
    await expect(page.getByPlaceholder("Buscar...")).toBeVisible();
  });

  test("theme toggle is visible", async ({ page }) => {
    const themeButton = page.locator("button").filter({ has: page.locator("[class*='lucide-sun'], [class*='lucide-moon']") });
    await expect(themeButton.first()).toBeVisible();
  });
});
