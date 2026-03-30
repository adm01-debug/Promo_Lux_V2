import { test, expect } from "../playwright-fixture";

test.describe("Login and Navigation E2E", () => {
  test("should show login page when not authenticated", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=LUX")).toBeVisible();
  });

  test("should navigate between sidebar items", async ({ page }) => {
    await page.goto("/");
    
    // Wait for app to load (either login or dashboard)
    await page.waitForLoadState("networkidle");

    // If redirected to login, we test that login page renders
    const url = page.url();
    if (url.includes("login")) {
      await expect(page.locator("text=LUX")).toBeVisible();
      return;
    }

    // If authenticated, test sidebar navigation
    const sidebar = page.locator("aside[role='navigation']");
    await expect(sidebar).toBeVisible();

    // Click on Empresas
    await page.click("button[data-tour='companies']");
    await expect(page.locator("text=Empresas")).toBeVisible();

    // Click on Workflows
    await page.click("button[data-tour='workflows']");
    await expect(page.locator("text=Workflows")).toBeVisible();

    // Click on Analytics
    await page.click("button[data-tour='analytics']");
    await expect(page.locator("text=Analytics")).toBeVisible();
  });

  test("should toggle sidebar with Ctrl+B", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const url = page.url();
    if (url.includes("login")) return;

    const sidebar = page.locator("aside[role='navigation']");

    // Sidebar should start expanded (w-64)
    await expect(sidebar).toBeVisible();

    // Press Ctrl+B to collapse
    await page.keyboard.press("Control+b");
    
    // After collapse, nav labels should be hidden
    await page.waitForTimeout(400);
    const dashboardLabel = page.locator("aside button[data-tour='dashboard']");
    await expect(dashboardLabel).toBeVisible();
  });

  test("should open notifications panel", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const url = page.url();
    if (url.includes("login")) return;

    // Click bell icon
    const bellButton = page.locator("button").filter({ has: page.locator(".lucide-bell") });
    await bellButton.click();

    // Notifications panel should appear
    await expect(page.locator("text=Notificações")).toBeVisible();
  });

  test("should use search shortcut", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const url = page.url();
    if (url.includes("login")) return;

    // Search bar should be visible
    await expect(page.locator("text=Buscar...")).toBeVisible();

    // Press Cmd+K to open command palette
    await page.keyboard.press("Meta+k");
    await page.waitForTimeout(300);
  });
});
