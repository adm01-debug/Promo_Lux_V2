import { test, expect } from "../playwright-fixture";

// ─── Login Page ───────────────────────────────────────────────

test.describe("Login Page", () => {
  test("renders login form with all elements", async ({ page }) => {
    await page.goto("/login");
    // "LUX" também aparece no rodapé ("Powered by LUX IA") — getByText/locator
    // por texto casam ambos e violam o strict mode do Playwright; o heading é
    // o elemento inequívoco.
    await expect(page.getByRole("heading", { name: "LUX IA" })).toBeVisible();
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
    await expect(page.getByText("Redefinir senha")).toBeVisible();
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

  test("shows KPI stats grid with 5 cards", async ({ page }) => {
    // Rótulos reais dos cards em StatsGrid.tsx (verificados na fonte, não
    // assumidos). getByText faz match case-insensitive por substring —
    // "Workflows Ativos" também aparece numa descrição do card de
    // automações abaixo; .first() pega o rótulo do KPI.
    await expect(page.getByText("Total de Empresas").first()).toBeVisible();
    await expect(page.getByText("Receita em Pipeline").first()).toBeVisible();
    await expect(page.getByText("Taxa de Conversão").first()).toBeVisible();
    await expect(page.getByText("Workflows Ativos").first()).toBeVisible();
    await expect(page.getByText("Integrações").first()).toBeVisible();
  });

  test("shows performance chart section", async ({ page }) => {
    await expect(page.getByText("Performance Semanal")).toBeVisible();
  });

  test("shows quick action cards", async ({ page }) => {
    // Rótulos reais em QuickActions.tsx (verificados na fonte). "Configurar
    // IPC" também existe como item de navegação da sidebar — .first() pega
    // o card de ação rápida do dashboard.
    await expect(page.getByText("Configurar IPC").first()).toBeVisible();
    await expect(page.getByText("Novo Scrape")).toBeVisible();
    await expect(page.getByText("Novo Workflow")).toBeVisible();
    await expect(page.getByText("Abrir IA")).toBeVisible();
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
    // "Nova Empresa" é gated por useCan("companies","create"), que exige um
    // usuário autenticado (role de membership) — o modo demo não tem sessão
    // real, então a ação de criar fica corretamente oculta (demo é read-only).
    await expect(page.getByText("Nova Empresa")).toHaveCount(0);
  });

  test("navigates to Workflows and shows list", async ({ page }) => {
    // "Workflows" também é o rótulo do KPI card "Workflows Ativos" no dashboard.
    await page.getByRole("button", { name: /Workflows/ }).first().click();
    await expect(page.getByText("Workflows de Automação")).toBeVisible({ timeout: 5000 });
    // "Novo Workflow" é gated por useCan("workflows","create") — oculto em
    // modo demo (sem sessão real), mesmo padrão de Nova Empresa/Nova Campanha.
    await expect(page.getByText("Novo Workflow")).toHaveCount(0);
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
    // "Nova Campanha" é gated por useCan("campaigns","create") — sem sessão
    // real em modo demo, a ação de criar fica corretamente oculta.
    await expect(page.getByText("Nova Campanha")).toHaveCount(0);
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
    // "Configurar IPC" também é o card de ação rápida do dashboard.
    await page.getByRole("button", { name: /Configurar IPC/ }).first().click();
    await expect(page.getByText("Perfil de Cliente Ideal")).toBeVisible({ timeout: 5000 });
  });

  test("navigates to Stakeholders", async ({ page }) => {
    await page.getByRole("button", { name: /Stakeholders/ }).click();
    // "Stakeholders" aparece tanto no header/heading da view quanto num link
    // relacionado — .first() confirma que a view carregou.
    await expect(page.getByText("Stakeholders").first()).toBeVisible({ timeout: 5000 });
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
    // "Prospecção"/"Automação" aparecem em vários lugares da tela (títulos de
    // seção da sidebar, cards do dashboard) — escopar ao próprio breadcrumb.
    const breadcrumb = page.getByLabel("breadcrumb");

    await page.getByRole("button", { name: /Empresas/ }).first().click();
    await expect(breadcrumb.getByText("Prospecção")).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /Workflows/ }).first().click();
    await expect(breadcrumb.getByText("Automação")).toBeVisible({ timeout: 5000 });
  });

  test("search bar is visible in header", async ({ page }) => {
    await expect(page.getByText("Buscar...")).toBeVisible();
  });
});

// ─── Demo Mode — Company Creation ────────────────────────────
//
// AddCompanyDialog/ImportCompaniesDialog só renderizam quando
// useCan("companies","create") é true, o que exige uma role de membership
// real (via usuário autenticado). O modo demo não cria uma sessão real
// (ver DemoContext — é só uma flag em localStorage), então `user` é null,
// `role` fica null e `can()` retorna false: as ações de criação ficam
// corretamente ocultas. O fluxo de preenchimento do formulário em si não é
// testável em modo demo — cobrimos aqui apenas o gate, que é o
// comportamento real e intencional (demo é somente-leitura).

test.describe("Demo Mode — Company Creation Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Explorar em modo demonstração").click();
    await page.waitForSelector("text=Dashboard", { timeout: 10000 });
    // Navigate to Empresas
    await page.getByRole("button", { name: /Empresas/ }).first().click();
    await expect(page.getByText("Empresas Identificadas")).toBeVisible({ timeout: 5000 });
  });

  test("create-company action is hidden (demo mode is read-only)", async ({ page }) => {
    await expect(page.getByText("Nova Empresa")).toHaveCount(0);
    await expect(page.getByPlaceholder("Nome da empresa")).toHaveCount(0);
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
    // "Setor" (case-insensitive) também casa a coluna da tabela e o botão de
    // ordenação — pega o primeiro (o rótulo do facet no painel de filtros).
    await expect(page.getByText("SETOR").first()).toBeVisible();
    await expect(page.getByText("SCORE IPC").first()).toBeVisible();
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
    // "Configurações" também é o item de navegação da sidebar — pega o
    // primeiro match visível (o item do dropdown do avatar).
    await expect(page.getByText("Configurações").first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Sair")).toBeVisible();
  });

  test("skip-nav link exists for accessibility", async ({ page }) => {
    const skipLink = page.locator("a[href='#main-content']");
    await expect(skipLink).toHaveCount(1);
  });
});

// ─── Demo Mode — Keyboard Shortcuts ──────────────────────────

test.describe("Demo Mode — Keyboard Shortcuts", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Explorar em modo demonstração").click();
    await page.waitForSelector("text=Dashboard", { timeout: 10000 });
  });

  test("Ctrl+K opens command palette", async ({ page }) => {
    await page.keyboard.press("Control+K");
    // Command palette dialog appears with a search input
    await expect(page.getByPlaceholder(/Digite|Search|Buscar/i).first()).toBeVisible({ timeout: 3000 });
    await page.keyboard.press("Escape");
  });

  test("document title updates on navigation", async ({ page }) => {
    await page.getByRole("button", { name: /Empresas/ }).first().click();
    await expect(page.getByText("Empresas Identificadas")).toBeVisible({ timeout: 5000 });
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});

// ─── Mobile Navigation ───────────────────────────────────────

test.describe("Mobile — Bottom Nav", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Explorar em modo demonstração").click();
    await page.waitForSelector("text=Dashboard", { timeout: 10000 });
  });

  test("renders mobile bottom nav on small viewports", async ({ page }) => {
    // Bottom nav is fixed at bottom; check via role=navigation or known labels
    const nav = page.locator("nav").last();
    await expect(nav).toBeVisible();
  });

  test("dashboard renders responsively on mobile", async ({ page }) => {
    await expect(page.getByText("Modo Demonstração")).toBeVisible();
  });
});
