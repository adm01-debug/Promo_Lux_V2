import { test, expect } from "../playwright-fixture";
import { enterDemoMode } from "./helpers/auth";

/**
 * Smoke test da página de Monitoramento (/monitoring).
 *
 * Substitui tests/e2e/basic-flow.spec.ts ("Freight Quest E2E Flow" — nome e
 * asserções de outro app, fora do testDir configurado em
 * playwright.config.ts, então nunca rodava). O original assumia uma
 * `<table>` visível direto na página e um diálogo "Job Details" ao clicar
 * numa linha — a página real é uma interface com 14 abas (Tempo Real,
 * Execuções, Saúde do Banco, Disjuntores, etc.), sem essa estrutura.
 */
test.describe("Monitoramento — navegação", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
  });

  test("carrega a página com o título e as abas de monitoramento", async ({ page }) => {
    await page.goto("/monitoring");
    await expect(page.getByRole("heading", { name: "Monitoramento de Automações" })).toBeVisible();

    const tabs = page.getByRole("tab");
    await expect(tabs.first()).toBeVisible();
    expect(await tabs.count()).toBeGreaterThan(1);
  });

  test("troca de aba atualiza o conteúdo exibido", async ({ page }) => {
    await page.goto("/monitoring");

    const disjuntoresTab = page.getByRole("tab", { name: "Disjuntores" });
    await expect(disjuntoresTab).toBeVisible();
    await disjuntoresTab.click();
    await expect(disjuntoresTab).toHaveAttribute("data-state", "active");
  });
});
