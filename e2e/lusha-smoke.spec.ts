import { test, expect } from "@playwright/test";

/**
 * R30 — Lusha Intelligence smoke test.
 * Objetivo: garantir que a rota carrega e que os módulos extraídos
 * (StatusBadge / DEPT_GROUPS / types) não quebram o boot da view.
 * Este harness é o pré-requisito para o split completo planejado na R31.
 */
test.describe("Lusha Intelligence — smoke", () => {
  test("carrega a view sem erros de runtime", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/lusha", { waitUntil: "domcontentloaded" });
    // O redirect leva a /?view=lusha; aguarda o wrapper de app hidratar.
    await page.waitForLoadState("networkidle");

    // Sem erros bloqueantes do runtime (ignora warnings de rede/RLS esperados).
    const blocking = errors.filter(
      (e) => !/(Failed to fetch|401|403|NetworkError|preload)/i.test(e),
    );
    expect(blocking, `Erros: ${blocking.join("\n")}`).toEqual([]);
  });
});
