import { test, expect } from "../playwright-fixture";

/**
 * Cobertura E2E de navegação protegida.
 *
 * O app usa `ProtectedRoute`/`PublicRoute` (ver `src/App.tsx`):
 *  - Sem sessão e sem modo demo → rotas protegidas redirecionam para /login.
 *  - Modo demo → concede acesso ao shell autenticado sem tocar em dados reais,
 *    permitindo validar a navegação entre views.
 */

test.describe("Navegação protegida — redirecionamento", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => localStorage.removeItem("lux-demo-mode"));
  });

  for (const route of ["/", "/monitoring"]) {
    test(`rota protegida ${route} redireciona para /login sem sessão`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
      await expect(page.getByPlaceholder("seu@email.com")).toBeVisible();
    });
  }

  test("rota inexistente renderiza página 404", async ({ page }) => {
    await page.goto("/rota-que-nao-existe-e2e");
    await expect(page.getByText(/404|não encontrada|not found/i).first()).toBeVisible({
      timeout: 8000,
    });
  });
});

test.describe("Navegação protegida — modo demo", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Explorar em modo demonstração").click();
    await expect(page.getByText("Modo Demonstração")).toBeVisible({ timeout: 10_000 });
  });

  test("entra no shell autenticado e mostra o Dashboard", async ({ page }) => {
    await expect(page.getByText("Dashboard").first()).toBeVisible();
  });

  test("navega entre views principais pela sidebar", async ({ page }) => {
    // O nome acessível do botão inclui o atalho de teclado (ex.: "Empresas
    // Alt+4") — âncora só no início, não no fim (`^label$` nunca casava).
    for (const label of ["Empresas", "Analytics", "Configurar IPC", "Dashboard"]) {
      await page.getByRole("button", { name: new RegExp(`^${label}`) }).first().click();
      // A view muda sem derrubar o shell (o botão da view continua acessível).
      await expect(
        page.getByRole("button", { name: new RegExp(`^${label}`) }).first(),
      ).toBeVisible({ timeout: 8000 });
    }
  });

  test("modo demo persiste ao recarregar a página", async ({ page }) => {
    await page.reload();
    await expect(page.getByText("Modo Demonstração")).toBeVisible({ timeout: 10_000 });
  });
});
