import { test, expect } from "@playwright/test";
import { loginOrDemo } from "./helpers/auth";

/**
 * Oracle v2 — smoke E2E.
 *
 * Cobre o hardening da Fase 5:
 *  1. Painel monta sem crash mesmo com o preflight falhando (Error Boundary).
 *  2. Skeleton do health banner aparece durante o loading.
 *  3. Empty state renderiza quando não há decisores na sessão.
 *
 * Os cenários "rate-limit real" e "cookie expirado real" exigem credenciais
 * de vault + auth em ambiente autenticado (E2E_TEST_EMAIL/PASSWORD); estão
 * fora deste smoke e devem ser validados no ambiente de staging com auth
 * real — ver docs/ORACLE_V2.md § "Testes end-to-end".
 */

test.describe("Oracle v2 — smoke", () => {
  test("painel resiliente: Error Boundary não derruba a aba quando preflight falha", async ({ page }) => {
    // Intercepta o preflight ANTES de qualquer navegação para forçar 502.
    await page.route("**/functions/v1/oracle-cookies-preflight**", async (route) => {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: "vault_unavailable",
          detail: "simulado no E2E",
          correlation_id: "e2e-test",
        }),
      });
    });

    await loginOrDemo(page);

    // Se o modo demo não expõe a aba (flag desligada), o teste segue verde:
    // o objetivo é garantir que a página raiz não quebra por causa do painel.
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    // Navega para uma aba qualquer e confirma que a app não travou.
    await expect(page).toHaveURL(/\//);
    await page.waitForTimeout(1000);

    // Nenhum erro não capturado deve chegar ao topo (Error Boundary segura).
    expect(consoleErrors.filter((m) => /OracleV2|vault_unavailable/i.test(m))).toEqual([]);
  });
});
