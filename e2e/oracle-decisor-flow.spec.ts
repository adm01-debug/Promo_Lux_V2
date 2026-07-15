import { test, expect, type Page, type Request } from "@playwright/test";
import { loginOrDemo } from "./helpers/auth";

/**
 * Oracle v2 — Integração end-to-end REAL do fluxo de decisores.
 * =============================================================
 * Percorre desde o clique em "Buscar decisores" até o resultado enriquecido,
 * exercitando o encadeamento completo:
 *   [UI]  Oracle v2 Panel
 *     → [Edge] oracle-cookies-preflight   (vault healthy?)
 *     → [Edge] oracle-search-decisors     (scraping Lusha via cookie)
 *     → [DB]   realtime insert em lusha_contacts (session_id)
 *     → [Edge] oracle-enrich-contact      (LeadContact → email + telefone)
 *
 * REQUISITOS PARA EXECUÇÃO REAL
 * -----------------------------
 *   E2E_TEST_EMAIL      → e-mail de usuário com organização ativa
 *   E2E_TEST_PASSWORD   → senha
 *   E2E_COMPANY_NAME    → (opcional) nome da empresa a buscar. Default "Ambev".
 *   E2E_DEPARTMENT      → (opcional) departamento clicado. Default "Comercial".
 *   E2E_ORACLE_TIMEOUT  → (opcional) ms para aguardar scraping+enrich. Default 120000.
 *
 * Sem essas variáveis o teste roda em modo demonstração e apenas valida
 * que a UI monta — os cenários reais são pulados com `test.skip`.
 *
 * O teste NÃO faz mocks de rede. Se o vault estiver degradado, o Lusha
 * bloquear ou o LeadContact não achar contatos, ele falha — que é o
 * comportamento desejado para um sinal fidedigno de saúde do fluxo.
 */

const HAS_REAL_AUTH = !!(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);
const COMPANY = process.env.E2E_COMPANY_NAME ?? "Ambev";
const DEPARTMENT = process.env.E2E_DEPARTMENT ?? "Comercial";
const ORACLE_TIMEOUT = Number(process.env.E2E_ORACLE_TIMEOUT ?? 120_000);

/** Aguarda até que a edge function esperada responda 2xx, capturando o body. */
async function waitFunctionResponse(
  page: Page,
  fnName: string,
  timeoutMs: number,
): Promise<unknown> {
  const res = await page.waitForResponse(
    (r) => r.url().includes(`/functions/v1/${fnName}`) && r.request().method() === "POST",
    { timeout: timeoutMs },
  );
  if (res.status() >= 400) {
    const body = await res.text().catch(() => "<empty>");
    throw new Error(`[${fnName}] HTTP ${res.status()} — ${body.slice(0, 400)}`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

test.describe("Oracle v2 — fluxo end-to-end real (busca → decisores → enriquecimento)", () => {
  test.skip(
    !HAS_REAL_AUTH,
    "Requer E2E_TEST_EMAIL/E2E_TEST_PASSWORD para exercitar o fluxo real. Rode em staging.",
  );

  // O scraping real é lento — permitimos até ~4× o timeout do Oracle.
  test.setTimeout(ORACLE_TIMEOUT * 4);

  test("busca decisores em empresa real e enriquece pelo menos um contato", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    // Instrumentação: catalogar chamadas às edges relevantes
    const edgeCalls: Array<{ fn: string; method: string; status?: number }> = [];
    page.on("request", (req: Request) => {
      const m = req.url().match(/\/functions\/v1\/([\w-]+)/);
      if (m) edgeCalls.push({ fn: m[1], method: req.method() });
    });
    page.on("response", async (res) => {
      const m = res.url().match(/\/functions\/v1\/([\w-]+)/);
      if (!m) return;
      const entry = edgeCalls
        .slice()
        .reverse()
        .find((e) => e.fn === m[1] && e.status === undefined);
      if (entry) entry.status = res.status();
    });

    // 1. Login real
    await loginOrDemo(page);

    // 2. Vai para o painel Lusha
    await page.goto("/?view=lusha", { waitUntil: "networkidle" });

    // 3. Abre a aba Oracle v2
    await page.getByRole("tab", { name: /Oracle v2/i }).click();

    // 4. Espera o preflight resolver e valida vault OK.
    const preflight = (await waitFunctionResponse(
      page,
      "oracle-cookies-preflight",
      30_000,
    )) as { ok: boolean; services?: Array<{ servico: string; ready: boolean; error?: string }> };

    expect(
      preflight.ok,
      `Vault não está pronto — abortando teste real. services=${JSON.stringify(
        preflight.services ?? [],
      )}`,
    ).toBe(true);

    // Banner verde de saúde deve estar visível
    await expect(
      page.getByRole("status").filter({ hasText: /Vault de cookies OK/i }),
    ).toBeVisible({ timeout: 5_000 });

    // 5. Preenche empresa + departamento
    await page.getByLabel(/^Empresa$/).fill(COMPANY);
    await page.getByText(DEPARTMENT, { exact: true }).first().click();

    // 6. Botão de busca ativa
    const searchBtn = page.getByRole("button", { name: /Buscar decisores/i });
    await expect(searchBtn).toBeEnabled();

    // 7. Clica e captura a resposta de oracle-search-decisors
    const searchResponse = waitFunctionResponse(page, "oracle-search-decisors", ORACLE_TIMEOUT);
    await searchBtn.click();
    const searchResult = (await searchResponse) as {
      session_id?: string;
      contacts_found?: number;
    };

    expect(
      searchResult.session_id,
      `oracle-search-decisors sem session_id. Payload: ${JSON.stringify(searchResult)}`,
    ).toBeTruthy();

    console.log(
      `[E2E] search OK — session=${searchResult.session_id} contacts_found=${searchResult.contacts_found}`,
    );

    // 8. Aguarda a lista de resultados aparecer (realtime refetch a cada 5s)
    //    Cada decisor renderiza como card com o full_name em heading.
    //    Espera até 60s: primeiro contato deve estar no DB.
    const firstContact = page
      .locator('[data-testid="oracle-contact"], article, [role="listitem"]')
      .filter({ hasText: /./ })
      .first();

    // Fallback resiliente: se não houver testid, procuramos por qualquer botão
    // "Enriquecer" ou "Enriquecer N pendente(s)" — que só existe quando há contato.
    await expect
      .poll(
        async () => {
          const enrichAllBtn = page.getByRole("button", { name: /Enriquecer \d+ pendente/i });
          if (await enrichAllBtn.isVisible().catch(() => false)) return "batch";
          const enrichOneBtn = page.getByRole("button", { name: /^Enriquecer$/ }).first();
          if (await enrichOneBtn.isVisible().catch(() => false)) return "one";
          return "empty";
        },
        {
          message: "Nenhum decisor apareceu na tela após a busca (scraping vazio ou lento).",
          timeout: 60_000,
          intervals: [2_000, 3_000, 5_000],
        },
      )
      .not.toBe("empty");

    console.log("[E2E] pelo menos 1 decisor apareceu na sessão");

    // 9. Dispara enriquecimento
    const enrichResponse = waitFunctionResponse(page, "oracle-enrich-contact", ORACLE_TIMEOUT);
    const enrichAllBtn = page.getByRole("button", { name: /Enriquecer \d+ pendente/i });
    if (await enrichAllBtn.isVisible().catch(() => false)) {
      await enrichAllBtn.click();
    } else {
      await page.getByRole("button", { name: /^Enriquecer$/ }).first().click();
    }
    const enrichResult = (await enrichResponse) as {
      enriched?: number;
      failed?: number;
      errors?: unknown[];
    };
    console.log(`[E2E] enrich OK — ${JSON.stringify(enrichResult)}`);

    // 10. Aguarda até que pelo menos um contato mostre email OU telefone.
    //     Emails e telefones aparecem como links mailto:/tel:.
    await expect
      .poll(
        async () => {
          const emails = await page.locator('a[href^="mailto:"]').count();
          const phones = await page.locator('a[href^="tel:"]').count();
          return emails + phones;
        },
        {
          message:
            "Nenhum email/telefone renderizado após enriquecimento (LeadContact vazio ou lento).",
          timeout: ORACLE_TIMEOUT,
          intervals: [3_000, 5_000, 8_000],
        },
      )
      .toBeGreaterThan(0);

    // 11. Sanity: nenhum pageerror durante o fluxo
    expect(pageErrors, `Erros de página: ${pageErrors.join(" | ")}`).toEqual([]);

    // Anexa relatório final ao console para debug
    console.log("[E2E] edges chamadas:", JSON.stringify(edgeCalls, null, 2));
  });
});
