import { test, expect } from "../playwright-fixture";
import { enterDemoMode, loginOrDemo, navigateToView } from "./helpers/auth";

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

test.describe("Companies — List & Filters (Demo)", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
    await navigateToView(page, /Empresas/);
    await expect(page.getByText("Empresas Identificadas")).toBeVisible({ timeout: 5000 });
  });

  test("loads company list with header controls", async ({ page }) => {
    await expect(page.getByText("Filtros")).toBeVisible();
    await expect(page.getByText("Exportar CSV")).toBeVisible();
    // "Nova Empresa" é gated por useCan("companies","create"), que exige um
    // usuário autenticado — modo demo não tem sessão real, então a ação de
    // criar fica corretamente oculta (demo é read-only).
    await expect(page.getByText("Nova Empresa")).toHaveCount(0);
  });

  test("real-time search filters list", async ({ page }) => {
    const search = page.getByPlaceholder("Buscar empresas...");
    await search.fill("zzznoMatchqqq");
    await page.waitForTimeout(400);
    await expect(page.getByText(/0 resultado/i)).toBeVisible();
    await search.fill("");
  });

  test("filters panel exposes sector and IPC score facets", async ({ page }) => {
    // "Setor" (case-insensitive) também casa a coluna da tabela e o botão de
    // ordenação — .first() pega o rótulo do facet no painel de filtros.
    await expect(page.getByText("SETOR").first()).toBeVisible();
    await expect(page.getByText("SCORE IPC").first()).toBeVisible();
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

// AddCompanyDialog só renderiza para usuários com role de membership real
// (useCan("companies","create")) — modo demo não autentica ninguém, então
// esses testes exigem credenciais reais via E2E_TEST_EMAIL/E2E_TEST_PASSWORD
// (ver helpers/auth.ts). Sem elas, ficam pulados em vez de falhar tentando
// clicar num botão que o próprio app oculta corretamente.
test.describe("Companies — Create Flow (requires real credentials)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.E2E_TEST_EMAIL, "E2E_TEST_EMAIL/E2E_TEST_PASSWORD não configurados");
    await loginOrDemo(page);
    await navigateToView(page, /Empresas/);
    await expect(page.getByText("Empresas Identificadas")).toBeVisible({ timeout: 5000 });
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
});
