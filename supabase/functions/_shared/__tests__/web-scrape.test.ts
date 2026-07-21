import { describe, it, expect } from "vitest";
import { parseRobotsTxt, isAllowed } from "../web-scrape/robots.ts";
import { extractContent } from "../web-scrape/html-to-markdown.ts";
import { isEmptyShell, isTransientHttp, hostnameOf } from "../web-scrape/heuristics.ts";

describe("robots.txt parser", () => {
  it("permite quando não há regras", () => {
    const p = parseRobotsTxt("");
    expect(isAllowed(p, "/qualquer")).toBe(true);
  });

  it("aplica Disallow para User-agent: *", () => {
    const txt = `User-agent: *\nDisallow: /admin\nAllow: /admin/public`;
    const p = parseRobotsTxt(txt);
    expect(isAllowed(p, "/admin/secret")).toBe(false);
    expect(isAllowed(p, "/admin/public/x")).toBe(true);
    expect(isAllowed(p, "/home")).toBe(true);
  });

  it("prefere grupo específico do UA sobre wildcard", () => {
    const txt = `User-agent: *\nDisallow: /\n\nUser-agent: lux-web-scraper\nAllow: /`;
    const p = parseRobotsTxt(txt, "lux-web-scraper");
    expect(isAllowed(p, "/qualquer")).toBe(true);
  });
});

describe("extractContent", () => {
  it("extrai title, description e links", () => {
    const html = `<html><head><title>Ex</title><meta name="description" content="Desc"></head>
      <body><h1>Olá</h1><p>Mundo</p><a href="/x">Link</a></body></html>`;
    const r = extractContent(html, "https://a.com/");
    expect(r.title).toBe("Ex");
    expect(r.description).toBe("Desc");
    expect(r.markdown).toMatch(/# Olá/);
    expect(r.markdown).toMatch(/Mundo/);
    expect(r.links[0]).toEqual({ href: "https://a.com/x", text: "Link" });
  });

  it("remove script e style", () => {
    const html = `<html><body><script>alert(1)</script><p>ok</p><style>a{}</style></body></html>`;
    const r = extractContent(html);
    expect(r.markdown).not.toMatch(/alert/);
    expect(r.markdown).toMatch(/ok/);
  });
});

describe("heurísticas", () => {
  it("detecta SPA shell vazio", () => {
    const html = `<html><body><div id="root"></div><script src="a"></script><script src="b"></script></body></html>`;
    expect(isEmptyShell(html, 20)).toBe(true);
  });

  it("classifica status transitório vs permanente", () => {
    expect(isTransientHttp(null)).toBe(true);
    expect(isTransientHttp(429)).toBe(true);
    expect(isTransientHttp(503)).toBe(true);
    expect(isTransientHttp(404)).toBe(false);
    expect(isTransientHttp(401)).toBe(false);
  });

  it("extrai hostname", () => {
    expect(hostnameOf("https://Example.COM/x")).toBe("example.com");
    expect(hostnameOf("bad")).toBe(null);
  });
});
