import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for LUX IA.
 *
 * - `testDir` aponta para `./e2e`, onde vive a suíte principal (auth, convite,
 *   navegação protegida e garantias de RLS).
 * - O dev server do Vite roda na porta 8080 (ver `vite.config.ts`), portanto o
 *   `baseURL` e o `webServer.url` DEVEM refletir essa porta — caso contrário
 *   todos os `page.goto("/...")` falham por conexão recusada.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
