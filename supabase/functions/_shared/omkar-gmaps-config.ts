/**
 * Alinhamento de schema de config: LUX (`scrape_jobs.config`) → contrato de
 * task do omkarcloud/google-maps-scraper (Botasaurus Desktop API).
 *
 * Contrato do provedor (scraper_name = "google_maps_scraper"):
 * ```json
 * {
 *   "queries": ["Web Developers in Bangalore"],
 *   "country": null,
 *   "business_type": "",
 *   "max_cities": null,
 *   "randomize_cities": true,
 *   "api_key": "",
 *   "enable_reviews_extraction": false,
 *   "max_reviews": 20,
 *   "reviews_sort": "newest",
 *   "lang": "en",
 *   "max_results": null,
 *   "coordinates": "",
 *   "zoom_level": 14
 * }
 * ```
 *
 * O nosso payload histórico é o do gosom/google-maps-scraper (Go), com campos
 * que o omkar não conhece (`radius`, `depth`, `max_time`, `proxies`, `email`).
 * Este módulo faz a tradução determinística e devolve, junto, a lista de
 * campos sem equivalente — para que o chamador registre o gap em auditoria em
 * vez de perdê-lo silenciosamente.
 */

/** Config canônica do LUX, como persistida em `scrape_jobs.config`. */
export interface LuxScrapeConfig {
  keywords?: unknown;
  lang?: unknown;
  zoom?: unknown;
  lat?: unknown;
  lon?: unknown;
  fast_mode?: unknown;
  radius?: unknown;
  depth?: unknown;
  email?: unknown;
  max_time?: unknown;
  proxies?: unknown;
  extra_reviews?: unknown;
  country?: unknown;
  business_type?: unknown;
  max_cities?: unknown;
  max_results?: unknown;
  max_reviews?: unknown;
  reviews_sort?: unknown;
}

export type OmkarReviewsSort =
  | "newest"
  | "most_relevant"
  | "highest_rating"
  | "lowest_rating";

/** Payload exato aceito pelo endpoint de criação de task do omkar. */
export interface OmkarTaskInput {
  queries: string[];
  country: string | null;
  business_type: string;
  max_cities: number | null;
  randomize_cities: boolean;
  api_key: string;
  enable_reviews_extraction: boolean;
  max_reviews: number;
  reviews_sort: OmkarReviewsSort;
  lang: string;
  max_results: number | null;
  coordinates: string;
  zoom_level: number;
}

export interface OmkarMapResult {
  input: OmkarTaskInput;
  /** Campos do schema LUX sem equivalente no contrato omkar. */
  unsupported: string[];
  /** Ajustes silenciosos aplicados (clamp, coerção, default). */
  warnings: string[];
}

const REVIEWS_SORTS: readonly OmkarReviewsSort[] = [
  "newest",
  "most_relevant",
  "highest_rating",
  "lowest_rating",
];

/** O omkar aceita apenas o código base ISO-639-1 ("pt-BR" → "pt"). */
export function normalizeLang(raw: unknown, fallback = "en"): string {
  if (typeof raw !== "string") return fallback;
  const base = raw.trim().toLowerCase().split(/[-_]/)[0];
  return /^[a-z]{2}$/.test(base) ? base : fallback;
}

/**
 * `depth` (1..5, contrato gosom) não existe no omkar. A profundidade é
 * expressa lá como teto de resultados por cidade — a tabela abaixo preserva a
 * intenção do usuário (mais profundidade = mais resultados) sem inventar
 * semântica nova. `depth >= 5` vira `null` (sem teto).
 */
const DEPTH_TO_MAX_RESULTS: Record<number, number | null> = {
  1: 100,
  2: 250,
  3: 500,
  4: 1000,
  5: null,
};

function toFiniteNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function toQueries(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
    ? raw.split(/[\n,]/)
    : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const q = String(item ?? "").trim();
    // Chave de dedupe insensível a caixa E a acentos ("Clínicas" == "clinicas").
    const key = q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!q || seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

function toCoordinates(lat: unknown, lon: unknown, warnings: string[]): string {
  const latN = toFiniteNumber(lat);
  const lonN = toFiniteNumber(lon);
  if (latN === null || lonN === null) return "";
  if (latN < -90 || latN > 90 || lonN < -180 || lonN > 180) {
    warnings.push("coordinates_out_of_range_ignored");
    return "";
  }
  return `${latN},${lonN}`;
}

/**
 * `fast_mode` do gosom mapeia para a estratégia de busca do omkar, que é
 * expressa via `zoom_level`:
 *  - fast_mode = true  → zoom 14 (estratégia "Fast", padrão do provedor)
 *  - fast_mode = false → zoom 16 (estratégia detalhada, mais resultados)
 * Um `zoom` explícito na config sempre vence e é limitado a 10..21.
 */
function toZoomLevel(zoom: unknown, fastMode: unknown, warnings: string[]): number {
  const explicit = toFiniteNumber(zoom);
  if (explicit !== null) {
    const clamped = Math.min(21, Math.max(10, Math.round(explicit)));
    if (clamped !== Math.round(explicit)) warnings.push("zoom_level_clamped");
    return clamped;
  }
  return fastMode === false ? 16 : 14;
}

export interface MapOptions {
  /** Chave de enriquecimento Omkar Cloud. Sem ela, e-mail/decisores não vêm. */
  apiKey?: string | null;
  /** Default de `max_reviews` quando a extração de reviews é ligada. */
  defaultMaxReviews?: number;
}

/**
 * Traduz a config canônica do LUX para o payload de task do omkar.
 * Puro e determinístico — nunca lança; entradas inválidas viram defaults do
 * provedor e são reportadas em `warnings`.
 */
export function mapToOmkarTaskInput(
  config: LuxScrapeConfig | null | undefined,
  options: MapOptions = {},
): OmkarMapResult {
  const cfg = config ?? {};
  const warnings: string[] = [];
  const unsupported: string[] = [];

  const queries = toQueries(cfg.keywords);
  if (queries.length === 0) warnings.push("empty_queries");

  // `email` (gosom) só é atendível via enriquecimento pago do Omkar Cloud.
  if (cfg.email === true && !options.apiKey) {
    warnings.push("email_requested_without_enrichment_key");
  }
  // Sem equivalente no contrato do omkar — a UI mantém o campo, mas ele não
  // viaja para o provedor. Reportado para auditoria.
  if (toFiniteNumber(cfg.radius) !== null) unsupported.push("radius");
  if (toFiniteNumber(cfg.max_time) !== null) unsupported.push("max_time");
  if (Array.isArray(cfg.proxies) && cfg.proxies.length > 0) unsupported.push("proxies");

  const depth = toFiniteNumber(cfg.depth);
  const explicitMaxResults = toFiniteNumber(cfg.max_results);
  let maxResults: number | null = null;
  if (explicitMaxResults !== null && explicitMaxResults > 0) {
    maxResults = Math.round(explicitMaxResults);
  } else if (depth !== null) {
    const key = Math.min(5, Math.max(1, Math.round(depth)));
    maxResults = DEPTH_TO_MAX_RESULTS[key] ?? null;
  }

  const enableReviews = cfg.extra_reviews === true;
  const rawMaxReviews = toFiniteNumber(cfg.max_reviews);
  const maxReviews = enableReviews
    ? Math.min(500, Math.max(1, Math.round(rawMaxReviews ?? options.defaultMaxReviews ?? 20)))
    : (options.defaultMaxReviews ?? 20);

  const sort = typeof cfg.reviews_sort === "string" ? cfg.reviews_sort.trim() : "";
  const reviewsSort = (REVIEWS_SORTS as readonly string[]).includes(sort)
    ? (sort as OmkarReviewsSort)
    : "newest";
  if (sort && reviewsSort !== sort) warnings.push("invalid_reviews_sort_defaulted");

  const maxCities = toFiniteNumber(cfg.max_cities);

  return {
    input: {
      queries,
      country: typeof cfg.country === "string" && cfg.country.trim()
        ? cfg.country.trim().toUpperCase()
        : null,
      business_type: typeof cfg.business_type === "string" ? cfg.business_type.trim() : "",
      max_cities: maxCities !== null && maxCities > 0 ? Math.round(maxCities) : null,
      randomize_cities: true,
      api_key: options.apiKey ?? "",
      enable_reviews_extraction: enableReviews,
      max_reviews: maxReviews,
      reviews_sort: reviewsSort,
      lang: normalizeLang(cfg.lang),
      max_results: maxResults,
      coordinates: toCoordinates(cfg.lat, cfg.lon, warnings),
      zoom_level: toZoomLevel(cfg.zoom, cfg.fast_mode, warnings),
    },
    unsupported,
    warnings,
  };
}

/** Corpo completo do POST de criação de task (async) no omkar. */
export function buildOmkarCreateTaskBody(
  config: LuxScrapeConfig | null | undefined,
  options: MapOptions = {},
): { body: { data: OmkarTaskInput; scraper_name: string }; unsupported: string[]; warnings: string[] } {
  const mapped = mapToOmkarTaskInput(config, options);
  return {
    body: { data: mapped.input, scraper_name: "google_maps_scraper" },
    unsupported: mapped.unsupported,
    warnings: mapped.warnings,
  };
}

/** Rotas da Botasaurus Desktop API usadas pelo worker. */
export const OMKAR_ROUTES = {
  createTaskAsync: "/api/tasks/create-task-async",
  task: (id: string | number) => `/api/tasks/${id}`,
  results: (id: string | number) => `/api/tasks/${id}/results`,
  download: (id: string | number) => `/api/tasks/${id}/download`,
  deleteTasks: "/api/tasks/delete",
} as const;
