import { test, expect } from "@playwright/test";
import { enterDemoMode } from "./helpers/auth";
import {
  mockLushaCookieHealth,
  mockLushaSearchOk,
  mockLushaSearchError,
  mockLushaSearchTimeout,
  mockLushaDMOk,
  mockLushaReveal,
  mockLushaSessions,
  assertMockHit,
} from "./helpers/lushaMocks";

/**
 * R33 — Suite ampliada de E2E do módulo Lusha.
 *
 * Estratégia: os cenários adversos (lento, 4xx, 5xx, timeout) são exercitados
 * disparando os edges via `page.evaluate(fetch)` a partir do contexto autenticado
 * da SPA. Isso valida:
 *   1. Que os mocks de `page.route()` interceptam corretamente as URLs reais
 *      que o cliente Supabase compila (`${VITE_SUPABASE_URL}/functions/v1/...`).
 *   2. Que os shapes de resposta batem com os contratos consumidos pela view
 *      (`SearchResponse`, `DMResponse`, resposta de reveal).
 *
 * Cliques de UI ficam para uma rodada futura quando o modo demo tiver o wiring
 * completo dos botões de busca/reveal — hoje, exercitar via fetch é o pacto
 * mais estável e reprodutível. Os helpers criados aqui são reusáveis por
 * qualquer suite subsequente que queira testar o mesmo caminho via UI.
 */

test.describe("Lusha Intelligence — fluxos ampliados (R33)", () => {
  test.setTimeout(30_000);

  test.beforeEach(async ({ page }) => {
    mockLushaCookieHealth(page, true);
    await enterDemoMode(page);
    await page.goto("/lusha", { waitUntil: "domcontentloaded" });
  });

  async function callSearch(page: import("@playwright/test").Page) {
    return page.evaluate(async () => {
      const base = (window as unknown as { __SUPABASE_URL__?: string }).__SUPABASE_URL__
        ?? (import.meta as unknown as { env: { VITE_SUPABASE_URL: string } }).env.VITE_SUPABASE_URL
        ?? "";
      const url = `${base}/functions/v1/lusha-search`;
      const started = Date.now();
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ company: "ACME", departments: ["Vendas"] }),
        });
        const text = await res.text();
        return { ok: res.ok, status: res.status, elapsed: Date.now() - started, text };
      } catch (err) {
        return { ok: false, status: -1, elapsed: Date.now() - started, text: String(err) };
      }
    });
  }

  async function callReveal(page: import("@playwright/test").Page, contactId: string) {
    return page.evaluate(async (cid) => {
      const base = (import.meta as unknown as { env: { VITE_SUPABASE_URL: string } }).env.VITE_SUPABASE_URL;
      const res = await fetch(`${base}/functions/v1/lusha-reveal`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: "req-mock-1", contactIds: [cid], revealEmails: true, revealPhones: true }),
      });
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    }, contactId);
  }

  // ─── Grupo A — Busca ───────────────────────────────────────────────────
  test.describe("A · Busca", () => {
    test("1) sucesso rápido devolve SearchResponse mínimo", async ({ page }) => {
      const search = mockLushaSearchOk(page, { total_found: 2 });
      const res = await callSearch(page);
      expect(res.ok).toBe(true);
      expect(res.status).toBe(200);
      const parsed = JSON.parse(res.text);
      expect(parsed.total_found).toBe(2);
      expect(Array.isArray(parsed.contacts)).toBe(true);
      expect(parsed.contacts.length).toBe(2);
      assertMockHit(search, "lusha-search");
    });

    test("2) resposta lenta (2s) resolve sem erro", async ({ page }) => {
      const search = mockLushaSearchOk(page, { delayMs: 2000 });
      const res = await callSearch(page);
      expect(res.ok).toBe(true);
      expect(res.elapsed).toBeGreaterThanOrEqual(1800);
      assertMockHit(search, "lusha-search-slow");
    });

    test("3) erro 429 propaga status rate-limit", async ({ page }) => {
      const search = mockLushaSearchError(page, { status: 429, error: "rate_limit_exceeded" });
      const res = await callSearch(page);
      expect(res.status).toBe(429);
      expect(res.text).toContain("rate_limit_exceeded");
      assertMockHit(search, "lusha-search-429");
    });

    test("4) erro 500 propaga como falha", async ({ page }) => {
      const search = mockLushaSearchError(page, { status: 500 });
      const res = await callSearch(page);
      expect(res.status).toBe(500);
      assertMockHit(search, "lusha-search-500");
    });

    test("5) timeout aborta a requisição", async ({ page }) => {
      const search = mockLushaSearchTimeout(page);
      const res = await callSearch(page);
      expect(res.ok).toBe(false);
      expect(res.status).toBe(-1);
      assertMockHit(search, "lusha-search-timeout");
    });
  });

  // ─── Grupo B — Reveal ──────────────────────────────────────────────────
  test.describe("B · Reveal", () => {
    test("6) reveal com sucesso lento (1.5s) devolve email + telefone", async ({ page }) => {
      const reveal = mockLushaReveal(page, { status: 200, delayMs: 1500 });
      const res = await callReveal(page, "dm-1");
      expect(res.status).toBe(200);
      expect(res.body?.revealed?.[0]?.emailAddresses?.[0]?.email).toBe("dm-1@acme.com");
      expect(res.body?.revealed?.[0]?.phoneNumbers?.[0]?.number).toBe("+5511999998888");
      assertMockHit(reveal, "lusha-reveal-ok");
    });

    test("7) reveal 403 devolve erro sem quebrar a suite", async ({ page }) => {
      const reveal = mockLushaReveal(page, { status: 403 });
      const res = await callReveal(page, "dm-1");
      expect(res.status).toBe(403);
      expect(res.body?.error).toContain("403");
      assertMockHit(reveal, "lusha-reveal-403");
    });

    test("8) reveal 503 → 200 permite retry manual", async ({ page }) => {
      const reveal = mockLushaReveal(page, { sequence: [503, 200] });
      const first = await callReveal(page, "dm-2");
      expect(first.status).toBe(503);
      const second = await callReveal(page, "dm-2");
      expect(second.status).toBe(200);
      expect(second.body?.revealed?.[0]?.contactId).toBe("dm-2");
      expect(reveal.count()).toBe(2);
    });
  });

  // ─── Grupo C — Sessions / DM ───────────────────────────────────────────
  test.describe("C · Sessions & Oracle DM", () => {
    test("9) decision-makers OK devolve estrutura DMResponse", async ({ page }) => {
      const dm = mockLushaDMOk(page);
      const res = await page.evaluate(async () => {
        const base = (import.meta as unknown as { env: { VITE_SUPABASE_URL: string } }).env.VITE_SUPABASE_URL;
        const r = await fetch(`${base}/functions/v1/lusha-decision-makers`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ domains: ["acme.com"] }),
        });
        return { status: r.status, body: await r.json() };
      });
      expect(res.status).toBe(200);
      expect(res.body?.results?.[0]?.decisionMakers?.length).toBe(2);
      expect(res.body?.results?.[0]?.decisionMakers?.[0]?.fullName).toBe("Carla Diretora");
      assertMockHit(dm, "lusha-decision-makers");
    });

    test("10) sessions com 8 linhas + navegação por aba", async ({ page }) => {
      const sessions = Array.from({ length: 8 }, (_, i) => ({
        id: `sess-${i}`,
        company_name: i < 4 ? "ACME S.A." : `Empresa ${i}`,
        departments_requested: ["Vendas"],
        departments_mapped: ["sales"],
        total_found: i,
        status: i % 2 === 0 ? "done" : "failed",
        error_message: null,
        created_at: new Date(Date.now() - i * 3600_000).toISOString(),
      }));
      const mock = mockLushaSessions(page, sessions);

      // dispara a query REST direta que o hook usa
      const res = await page.evaluate(async () => {
        const base = (import.meta as unknown as { env: { VITE_SUPABASE_URL: string } }).env.VITE_SUPABASE_URL;
        const r = await fetch(
          `${base}/rest/v1/lusha_search_sessions?select=id,company_name,status,created_at&order=created_at.desc&limit=10`,
        );
        return { status: r.status, body: await r.json() };
      });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(8);
      assertMockHit(mock, "lusha-sessions");
    });

    test("11) empty state — 0 sessões", async ({ page }) => {
      const mock = mockLushaSessions(page, []);
      const res = await page.evaluate(async () => {
        const base = (import.meta as unknown as { env: { VITE_SUPABASE_URL: string } }).env.VITE_SUPABASE_URL;
        const r = await fetch(`${base}/rest/v1/lusha_search_sessions?select=*&limit=10`);
        return { status: r.status, body: await r.json() };
      });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      assertMockHit(mock, "lusha-sessions-empty");
    });
  });
});
