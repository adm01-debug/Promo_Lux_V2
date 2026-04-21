import { test, expect } from "../playwright-fixture";
import { enterDemoMode, navigateToView } from "./helpers/auth";

const companies = {
  valid: {
    name: "Empresa Teste E2E",
    sector: "Tecnologia",
    location: "São Paulo, SP",
    email: "contato@teste-e2e.com",
    phone: "(11) 98765-4321",
    website: "https://teste-e2e.com.br",
    employees: "50-200",
  },
};

test.describe("Companies — CRUD Flow (Demo)", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
    await navigateToView(page, /Empresas/);
    await expect(page.getByText("Empresas Identificadas")).toBeVisible({ timeout: 5000 });
  });

  test("loads company list with header controls", async ({ page }) => {
    await expect(page.getByText("Filtros")).toBeVisible();
    await expect(page.getByText("Exportar CSV")).toBeVisible();
    await expect(page.getByText("Nova Empresa")).toBeVisible();
  });

  test("real-time search filters list", async ({ page }) => {
    const search = page.getByPlaceholder("Buscar empresas...");
    await search.fill("zzznoMatchqqq");
    await page.waitForTimeout(400);
    await expect(page.getByText(/0 resultado/i)).toBeVisible();
    await search.fill("");
  });

  test("opens Add Company dialog", async ({ page }) => {
    await page.getByText("Nova Empresa").click();
    await expect(page.getByPlaceholder("Nome da empresa")).toBeVisible();
  });

  test("validates required name field", async ({ page }) => {
    await page.getByText("Nova Empresa").click();
    await expect(page.getByPlaceholder("Nome da empresa")).toBeVisible();
    await page.getByText("Adicionar Empresa").click();
    await expect(page.getByText(/obrigatório|inválid/i).first()).toBeVisible({ timeout: 3000 });
  });

  test("fills add-company form with valid fixture data", async ({ page }) => {
    const c = companies.valid;
    await page.getByText("Nova Empresa").click();
    await page.getByPlaceholder("Nome da empresa").fill(c.name);
    await page.getByPlaceholder("Ex: SaaS B2B").fill(c.sector);
    await page.getByPlaceholder("Ex: São Paulo - SP").fill(c.location);
    await page.getByPlaceholder("contato@empresa.com").fill(c.email);

    await expect(page.getByPlaceholder("Nome da empresa")).toHaveValue(c.name);
    await expect(page.getByPlaceholder("contato@empresa.com")).toHaveValue(c.email);
  });

  test("dialog closes via X button", async ({ page }) => {
    await page.getByText("Nova Empresa").click();
    await expect(page.getByPlaceholder("Nome da empresa")).toBeVisible();
    await page.locator("[role='dialog'] button:has(svg.lucide-x)").first().click();
    await expect(page.getByPlaceholder("Nome da empresa")).not.toBeVisible({ timeout: 3000 });
  });

  test("filters panel exposes sector and IPC score facets", async ({ page }) => {
    await expect(page.getByText("SETOR")).toBeVisible();
    await expect(page.getByText("SCORE IPC")).toBeVisible();
  });

  test("sort controls are visible", async ({ page }) => {
    await expect(page.getByText("Score ↓").first()).toBeVisible();
    await expect(page.getByText("Nome")).toBeVisible();
  });

  test("Export CSV button is present and enabled", async ({ page }) => {
    const btn = page.getByRole("button", { name: /Exportar CSV/ });
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  test("IPC score tooltip information available in table headers", async ({ page }) => {
    // Score IPC header has a help icon — hover should not crash
    const header = page.getByText(/Score IPC/i).first();
    await expect(header).toBeVisible();
    await header.hover();
  });
});