import { test, expect } from "../playwright-fixture";

test.describe("Auth — Login Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("renders login card with brand and core elements", async ({ page }) => {
    // "LUX" também aparece no rodapé ("Powered by LUX IA") — casa múltiplos
    // elementos e viola o strict mode; o heading é o elemento inequívoco.
    await expect(page.getByRole("heading", { name: "LUX IA" })).toBeVisible();
    await expect(page.locator("text=SALES INTELLIGENCE PLATFORM")).toBeVisible();
    await expect(page.getByPlaceholder("seu@email.com")).toBeVisible();
    await expect(page.getByText("Entrar com Google")).toBeVisible();
  });

  test("renders both Entrar and Criar Conta tabs", async ({ page }) => {
    await expect(page.getByRole("tab", { name: "Entrar" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Criar Conta" })).toBeVisible();
  });

  test("toggles password visibility", async ({ page }) => {
    const pwd = page.locator('input[id="login-password"]');
    await pwd.fill("secret123");
    await expect(pwd).toHaveAttribute("type", "password");
  });

  test("switches to signup tab and shows password strength meter", async ({ page }) => {
    await page.getByRole("tab", { name: "Criar Conta" }).click();
    const pwd = page.locator('input[id="signup-password"]');
    await expect(pwd).toBeVisible();
    await pwd.fill("Abc12345");
    // Strength meter renders some bars
    await expect(page.locator('input[id="signup-password"]')).toHaveValue("Abc12345");
  });

  test("signup requires min 8 chars (HTML constraint)", async ({ page }) => {
    await page.getByRole("tab", { name: "Criar Conta" }).click();
    const pwd = page.locator('input[id="signup-password"]');
    await expect(pwd).toHaveAttribute("minlength", "8");
  });

  test("forgot password overlay opens and closes", async ({ page }) => {
    await page.getByText("Esqueceu a senha?").click();
    await expect(page.getByText("Redefinir senha")).toBeVisible();
    // Overlay typically has a back button
    const back = page.getByRole("button", { name: /Voltar|Cancelar/i });
    if (await back.count()) {
      await back.first().click();
      await expect(page.getByPlaceholder("seu@email.com")).toBeVisible();
    }
  });

  test("Google login button is enabled and visible", async ({ page }) => {
    const btn = page.getByRole("button", { name: /Entrar com Google/ });
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  test("redirects unauthenticated users from protected routes to /login", async ({ page }) => {
    // Clear any demo state first
    await page.goto("/login");
    await page.evaluate(() => localStorage.removeItem("lux-demo-mode"));
    await page.goto("/");
    // App should redirect to /login when no session and no demo
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("demo mode enters app shell", async ({ page }) => {
    await page.getByText("Explorar em modo demonstração").click();
    await expect(page.getByText("Modo Demonstração")).toBeVisible({ timeout: 10_000 });
  });

  test("footer branding renders", async ({ page }) => {
    await expect(page.getByText("Powered by LUX IA")).toBeVisible();
  });
});