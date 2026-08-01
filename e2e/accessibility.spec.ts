import { test, expect } from "../playwright-fixture";
import { injectAxe, checkA11y } from "axe-playwright";
import { enterDemoMode } from "./helpers/auth";

/**
 * Auditoria de acessibilidade (WCAG 2 A/AA) via axe-core.
 *
 * Substitui playwright/accessibility.spec.ts, que estava fora do testDir
 * configurado em playwright.config.ts (nunca rodava) e assumia acesso sem
 * autenticação a conteúdo protegido — o app redireciona para /login sem
 * sessão/modo demo (ver e2e/protected-navigation.spec.ts), então os
 * seletores originais (`nav >> text=...`, `button[aria-label="Configurações"]`)
 * nunca seriam encontrados na prática.
 */
test.describe("Acessibilidade (axe-core)", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
  });

  test("Dashboard não tem violações WCAG 2 A/AA", async ({ page }) => {
    await injectAxe(page);
    await checkA11y(page, undefined, {
      axeOptions: { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } },
    });
  });

  test("Configurações não tem violações WCAG 2 A/AA", async ({ page }) => {
    await page.getByRole("button", { name: "Configurações" }).click();
    await expect(page.getByRole("heading", { name: "Configurações" })).toBeVisible();

    await injectAxe(page);
    await checkA11y(page, undefined, {
      axeOptions: { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } },
    });
  });
});
