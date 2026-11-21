import { describe, expect, it } from "vitest";
import {
  openTrackingUrl,
  clickTrackingUrl,
  applyEmailTracking,
  verifyTrackingParams,
} from "../tracking-links.ts";

const BASE = "https://pttzwlbidamibjssqiqb.supabase.co";
const SECRET = "test-secret-tracking";
const RECIPIENT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("tracking-links", () => {
  it("abre pixel com parâmetros assinados que o track-open aceita", async () => {
    const url = await openTrackingUrl(BASE, RECIPIENT, SECRET);
    expect(url).toContain("/functions/v1/track-open");
    const u = new URL(url);
    const sig = u.searchParams.get("s")!;
    expect(sig.length).toBeGreaterThan(20);
    expect(await verifyTrackingParams(RECIPIENT, null, sig, SECRET)).toBe(true);
  });

  it("gera link de click assinado para a URL destino", async () => {
    const url = await clickTrackingUrl(BASE, RECIPIENT, "https://empresa.com/promo", SECRET);
    const u = new URL(url);
    expect(u.pathname).toContain("/functions/v1/track-click");
    expect(u.searchParams.get("u")).toBe("https://empresa.com/promo");
    expect(await verifyTrackingParams(RECIPIENT, "https://empresa.com/promo", u.searchParams.get("s"), SECRET)).toBe(true);
  });

  it("aplica pixel e reescreve links no corpo, preservando o texto original", async () => {
    const body = "Olá, veja nossa oferta: https://empresa.com/promo\n" +
      "E o blog: https://blog.empresa.com/artigo";
    const { html, trackedCount } = await applyEmailTracking(BASE, RECIPIENT, body, SECRET);
    expect(trackedCount).toBe(2);
    expect(html).toContain("<img src=");
    expect(html).toContain("/functions/v1/track-open?");
    expect(html).toContain("/functions/v1/track-click?");
    // O texto simples continua legível no HTML
    expect(html).toContain("veja nossa oferta:");
    expect(html).toContain("E o blog:");
  });

  it("não faz wrap de links que já são do domínio público (evita redirect recursivo)", async () => {
    const inner = `${BASE}/functions/v1/track-open?r=x&s=y`;
    const { html } = await applyEmailTracking(BASE, RECIPIENT, `Veja ${inner} aí`, SECRET);
    expect(html).toContain(`href="${inner.replace(/&/g, "&amp;")}"`);
    expect((html.match(/functions\/v1\/track-click/g) ?? []).length).toBe(0);
  });

  it("respeita o limite de links reescritos", async () => {
    const many = Array.from({ length: 60 }, (_, i) => `https://site${i}.com/link`).join(" ");
    const { trackedCount, html } = await applyEmailTracking(BASE, RECIPIENT, many, SECRET);
    expect(trackedCount).toBe(50);
    expect((html.match(/track-click/g) ?? []).length).toBe(50);
  });
});