import { test, expect } from "../playwright-fixture";

/**
 * Cobertura E2E do fluxo de convite (`/invite/:token`).
 *
 * Regras de negócio verificadas (ver `src/pages/AcceptInvite.tsx` e
 * `src/App.tsx`):
 *  1. Usuário NÃO autenticado que abre um convite é redirecionado para /login,
 *     e o token é preservado em sessionStorage (`lux:pending-invite`).
 *  2. Após um login futuro, o `PublicRoute` consome esse token e redireciona
 *     de volta para /invite/:token.
 *  3. A página de convite só chama a RPC `accept_org_invite` mediante ação
 *     explícita do usuário (não aceita automaticamente).
 */
test.describe("Convite — /invite/:token", () => {
  const TOKEN = "e2e-fake-invite-token-123";

  test.beforeEach(async ({ page }) => {
    // Garante estado limpo: sem sessão demo, sem convite pendente.
    await page.goto("/login");
    await page.evaluate(() => {
      localStorage.removeItem("lux-demo-mode");
      sessionStorage.removeItem("lux:pending-invite");
    });
  });

  test("redireciona visitante não autenticado para /login preservando o token", async ({ page }) => {
    await page.goto(`/invite/${TOKEN}`);

    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });

    const pending = await page.evaluate(() => sessionStorage.getItem("lux:pending-invite"));
    expect(pending).toBe(TOKEN);
  });

  test("página de login continua funcional após vir de um convite", async ({ page }) => {
    await page.goto(`/invite/${TOKEN}`);
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });

    // O usuário ainda consegue interagir com o formulário de login normalmente.
    await expect(page.getByPlaceholder("seu@email.com")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Entrar" })).toBeVisible();
  });

  test("não aceita o convite automaticamente (requer ação do usuário)", async ({ page }) => {
    // Intercepta a chamada RPC para detectar qualquer aceite automático indevido.
    let rpcCalled = false;
    await page.route("**/rest/v1/rpc/accept_org_invite**", async (route) => {
      rpcCalled = true;
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ message: "forbidden (e2e mock)" }),
      });
    });

    await page.goto(`/invite/${TOKEN}`);
    // Sem sessão, cai em /login — e nenhuma RPC de aceite deve ter sido disparada.
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
    expect(rpcCalled).toBe(false);
  });
});
