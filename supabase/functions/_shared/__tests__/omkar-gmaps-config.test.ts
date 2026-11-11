import { describe, it, expect } from "vitest";
import {
  mapToOmkarTaskInput,
  buildOmkarCreateTaskBody,
  normalizeLang,
  OMKAR_ROUTES,
} from "../omkar-gmaps-config.ts";

describe("normalizeLang", () => {
  it("reduz a tag regional ao código base", () => {
    expect(normalizeLang("pt-BR")).toBe("pt");
    expect(normalizeLang("es_AR")).toBe("es");
  });
  it("cai no fallback quando inválido", () => {
    expect(normalizeLang(undefined)).toBe("en");
    expect(normalizeLang("português")).toBe("en");
    expect(normalizeLang(42)).toBe("en");
  });
});

describe("mapToOmkarTaskInput", () => {
  it("traduz a config canônica do LUX", () => {
    const { input } = mapToOmkarTaskInput({
      keywords: ["clínicas em Curitiba", "clinicas em curitiba", " odontologia "],
      lang: "pt-BR",
      lat: -25.43,
      lon: -49.27,
      depth: 3,
      fast_mode: true,
      extra_reviews: true,
      max_reviews: 40,
      reviews_sort: "highest_rating",
    });
    expect(input.queries).toEqual(["clínicas em Curitiba", "odontologia"]);
    expect(input.lang).toBe("pt");
    expect(input.coordinates).toBe("-25.43,-49.27");
    expect(input.max_results).toBe(500);
    expect(input.zoom_level).toBe(14);
    expect(input.enable_reviews_extraction).toBe(true);
    expect(input.max_reviews).toBe(40);
    expect(input.reviews_sort).toBe("highest_rating");
    expect(input.scraper_name).toBeUndefined();
  });

  it("aceita keywords como string separada por vírgula/linha", () => {
    const { input } = mapToOmkarTaskInput({ keywords: "padaria, mercado\nacademia" });
    expect(input.queries).toEqual(["padaria", "mercado", "academia"]);
  });

  it("usa zoom 16 quando fast_mode é falso e não há zoom explícito", () => {
    expect(mapToOmkarTaskInput({ fast_mode: false }).input.zoom_level).toBe(16);
    expect(mapToOmkarTaskInput({ fast_mode: true }).input.zoom_level).toBe(14);
  });

  it("limita zoom explícito a 10..21", () => {
    const r = mapToOmkarTaskInput({ zoom: 30 });
    expect(r.input.zoom_level).toBe(21);
    expect(r.warnings).toContain("zoom_level_clamped");
  });

  it("descarta coordenadas fora de faixa", () => {
    const r = mapToOmkarTaskInput({ lat: 200, lon: 10 });
    expect(r.input.coordinates).toBe("");
    expect(r.warnings).toContain("coordinates_out_of_range_ignored");
  });

  it("reporta campos sem equivalente no contrato omkar", () => {
    const r = mapToOmkarTaskInput({
      keywords: ["x"],
      radius: 5000,
      max_time: 600,
      proxies: ["http://p:1"],
    });
    expect(r.unsupported).toEqual(["radius", "max_time", "proxies"]);
  });

  it("avisa quando email é pedido sem chave de enriquecimento", () => {
    expect(mapToOmkarTaskInput({ email: true }).warnings)
      .toContain("email_requested_without_enrichment_key");
    expect(mapToOmkarTaskInput({ email: true }, { apiKey: "k" }).warnings)
      .not.toContain("email_requested_without_enrichment_key");
  });

  it("depth 5 significa sem teto de resultados", () => {
    expect(mapToOmkarTaskInput({ depth: 5 }).input.max_results).toBeNull();
    expect(mapToOmkarTaskInput({ depth: 1 }).input.max_results).toBe(100);
  });

  it("max_results explícito vence sobre depth", () => {
    expect(mapToOmkarTaskInput({ depth: 1, max_results: 777 }).input.max_results).toBe(777);
  });

  it("normaliza reviews_sort inválido para newest", () => {
    const r = mapToOmkarTaskInput({ reviews_sort: "worst" });
    expect(r.input.reviews_sort).toBe("newest");
    expect(r.warnings).toContain("invalid_reviews_sort_defaulted");
  });

  it("nunca lança com config nula ou lixo", () => {
    const r = mapToOmkarTaskInput(null);
    expect(r.input.queries).toEqual([]);
    expect(r.warnings).toContain("empty_queries");
    expect(mapToOmkarTaskInput({ keywords: 5, lat: "abc" }).input.coordinates).toBe("");
  });
});

describe("buildOmkarCreateTaskBody", () => {
  it("monta o envelope de task do provedor", () => {
    const { body } = buildOmkarCreateTaskBody({ keywords: ["cafeteria"] }, { apiKey: "sk" });
    expect(body.scraper_name).toBe("google_maps_scraper");
    expect(body.data.api_key).toBe("sk");
    expect(body.data.randomize_cities).toBe(true);
  });
});

describe("OMKAR_ROUTES", () => {
  it("expõe as rotas da Botasaurus Desktop API", () => {
    expect(OMKAR_ROUTES.createTaskAsync).toBe("/api/tasks/create-task-async");
    expect(OMKAR_ROUTES.task(7)).toBe("/api/tasks/7");
    expect(OMKAR_ROUTES.results("7")).toBe("/api/tasks/7/results");
  });
});
