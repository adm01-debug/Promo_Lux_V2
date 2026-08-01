import type { Page } from "@playwright/test";

/**
 * Enter the app via demo mode (no Supabase login required).
 * Used as default in E2E suites to avoid mutating real data.
 */
export async function enterDemoMode(page: Page) {
  await page.goto("/login");
  await page.getByText("Explorar em modo demonstração").click();
  await page.waitForSelector("text=Dashboard", { timeout: 10_000 });
}

/**
 * Programmatic login by seeding the Supabase session into localStorage.
 * Falls back to demo mode if E2E_TEST_EMAIL / E2E_TEST_PASSWORD are not set.
 */
export async function loginOrDemo(page: Page) {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    await enterDemoMode(page);
    return;
  }

  await page.goto("/login");
  await page.getByPlaceholder("seu@email.com").fill(email);
  await page.locator('input[id="login-password"]').fill(password);
  await page.getByRole("button", { name: /^Entrar$/ }).click();
  await page.waitForSelector("text=Dashboard", { timeout: 15_000 });
}

export async function navigateToView(page: Page, name: RegExp | string) {
  const re = typeof name === "string" ? new RegExp(name) : name;
  await page.getByRole("button", { name: re }).first().click();
}