/**
 * HikerAPI client (Instagram) — Deno / Edge Function runtime.
 *
 * Contrato:
 *  - Base URL: https://hikerapi.com
 *  - Auth: header `x-access-key: <HIKER_API_KEY>`
 *  - Modo mock: se `HIKER_MOCK_MODE=true`, devolve fixtures determinísticos
 *    (reuso do módulo `apify-fixtures.ts`) sem tocar na rede.
 *
 * Retry policy:
 *  - Base 15s, cap 600s, max 4 tentativas, jitter ±20%.
 *  - Respeita `Retry-After` (segundos ou HTTP-date) em 429/503.
 *  - Erros classificados: rate_limit | server | network | client | not_found | auth.
 *
 * Cada método devolve `{ items: NormalizedInstagramItem[], raw: unknown }`.
 */

import { MOCK_DATASET_FIXTURES, type NormalizedInstagramItem } from "./apify-fixtures.ts";

const BASE_URL = "https://hikerapi.com";

// -------------- Types --------------
export type HikerErrorClass =
  | "rate_limit"
  | "server"
  | "network"
  | "client"
  | "not_found"
  | "auth"
  | "timeout";

export class HikerError extends Error {
  constructor(
    public readonly errorClass: HikerErrorClass,
    message: string,
    public readonly status?: number,
    public readonly retryAfterMs?: number,
    public readonly body?: string,
  ) {
    super(message);
    this.name = "HikerError";
  }
  get retryable(): boolean {
    return (
      this.errorClass === "rate_limit" ||
      this.errorClass === "server" ||
      this.errorClass === "network" ||
      this.errorClass === "timeout"
    );
  }
}

export interface HikerClientOptions {
  apiKey?: string;
  mockMode?: boolean;
  baseUrl?: string;
  maxAttempts?: number;
  baseDelayMs?: number;
  capDelayMs?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface FetchResult {
  items: NormalizedInstagramItem[];
  raw: unknown;
  attempts: number;
}

// -------------- Helpers --------------
function parseRetryAfter(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const asInt = Number(raw);
  if (Number.isFinite(asInt)) return Math.max(0, asInt * 1000);
  const asDate = Date.parse(raw);
  if (!Number.isNaN(asDate)) return Math.max(0, asDate - Date.now());
  return undefined;
}

function classify(status: number): HikerErrorClass {
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server";
  return "client";
}

export function computeBackoff(
  attempt: number,
  baseMs: number,
  capMs: number,
  retryAfterMs?: number,
  rand: () => number = Math.random,
): number {
  if (retryAfterMs !== undefined) {
    // Retry-After tem precedência absoluta, com jitter leve.
    const jitter = 1 + (rand() * 0.2 - 0.1);
    return Math.min(capMs, Math.round(retryAfterMs * jitter));
  }
  const exp = Math.min(capMs, baseMs * Math.pow(2, Math.max(0, attempt - 1)));
  const jitter = 1 + (rand() * 0.4 - 0.2); // ±20%
  return Math.max(baseMs, Math.round(exp * jitter));
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// -------------- Client --------------
export class HikerClient {
  private readonly apiKey: string;
  private readonly mockMode: boolean;
  private readonly baseUrl: string;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly capDelayMs: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(opts: HikerClientOptions = {}) {
    this.mockMode =
      opts.mockMode ?? Deno.env.get("HIKER_MOCK_MODE") === "true";
    this.apiKey = opts.apiKey ?? Deno.env.get("HIKER_API_KEY") ?? "";
    if (!this.mockMode && !this.apiKey) {
      throw new HikerError(
        "auth",
        "HIKER_API_KEY não configurada e HIKER_MOCK_MODE desligado",
      );
    }
    this.baseUrl = opts.baseUrl ?? BASE_URL;
    this.maxAttempts = opts.maxAttempts ?? 4;
    this.baseDelayMs = opts.baseDelayMs ?? 15_000;
    this.capDelayMs = opts.capDelayMs ?? 600_000;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sleep = opts.sleep ?? defaultSleep;
  }

  // ---------- Public API ----------
  async fetchProfile(username: string): Promise<FetchResult> {
    if (this.mockMode) return this.mockResult("profile", username);
    const raw = await this.request("/v1/user/by/username", { username });
    return this.wrap([normalizeProfile(raw)], raw, 1);
  }

  async fetchPosts(username: string, limit = 200): Promise<FetchResult> {
    if (this.mockMode) return this.mockResult("posts", username, limit);
    const raw = await this.request("/v2/user/medias", { username, amount: limit });
    const items = extractMedias(raw).map(normalizePost);
    return this.wrap(items, raw, 1);
  }

  async fetchHashtag(tag: string, limit = 200): Promise<FetchResult> {
    if (this.mockMode) return this.mockResult("hashtag", tag, limit);
    const raw = await this.request("/v1/hashtag/medias/top", {
      name: tag.replace(/^#/, ""),
      amount: limit,
    });
    const items = extractMedias(raw).map((m) => normalizeHashtag(m, tag));
    return this.wrap(items, raw, 1);
  }

  async fetchComments(mediaIdOrShortcode: string, limit = 200): Promise<FetchResult> {
    if (this.mockMode) return this.mockResult("comments", mediaIdOrShortcode, limit);
    const raw = await this.request("/v2/media/comments", {
      id: mediaIdOrShortcode,
      amount: limit,
    });
    const items = extractComments(raw).map((c) =>
      normalizeComment(c, mediaIdOrShortcode),
    );
    return this.wrap(items, raw, 1);
  }

  // ---------- Core HTTP with retry ----------
  private async request(path: string, params: Record<string, unknown>): Promise<unknown> {
    const url = new URL(path, this.baseUrl);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }

    let lastErr: HikerError | undefined;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await this.fetchImpl(url.toString(), {
          method: "GET",
          headers: {
            "x-access-key": this.apiKey,
            "accept": "application/json",
          },
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.ok) {
          return await res.json();
        }
        const body = await res.text().catch(() => "");
        const retryAfterMs = parseRetryAfter(res.headers.get("retry-after"));
        const cls = classify(res.status);
        lastErr = new HikerError(
          cls,
          `HikerAPI ${res.status} em ${path}`,
          res.status,
          retryAfterMs,
          body.slice(0, 500),
        );

        if (!lastErr.retryable || attempt === this.maxAttempts) throw lastErr;
        const delay = computeBackoff(
          attempt,
          this.baseDelayMs,
          this.capDelayMs,
          retryAfterMs,
        );
        await this.sleep(delay);
        continue;
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof HikerError) {
          if (!err.retryable || attempt === this.maxAttempts) throw err;
          lastErr = err;
        } else {
          const isAbort = (err as Error)?.name === "AbortError";
          lastErr = new HikerError(
            isAbort ? "timeout" : "network",
            (err as Error)?.message ?? "erro de rede",
          );
          if (attempt === this.maxAttempts) throw lastErr;
        }
        const delay = computeBackoff(attempt, this.baseDelayMs, this.capDelayMs);
        await this.sleep(delay);
      }
    }
    throw lastErr ?? new HikerError("network", "retry esgotado sem erro registrado");
  }

  private wrap(
    items: NormalizedInstagramItem[],
    raw: unknown,
    attempts: number,
  ): FetchResult {
    return { items, raw, attempts };
  }

  private async mockResult(
    kind: "profile" | "posts" | "hashtag" | "comments",
    value: string,
    _limit?: number,
  ): Promise<FetchResult> {
    // Import dinâmico só quando em mock — evita puxar fixtures em produção.
    const mod = await import("./apify-fixtures.ts");
    switch (kind) {
      case "profile":
        return { items: [mod.fixtureProfile(value)], raw: null, attempts: 0 };
      case "posts":
        return { items: mod.fixturePosts(value), raw: null, attempts: 0 };
      case "hashtag":
        return { items: mod.fixtureHashtag(value), raw: null, attempts: 0 };
      case "comments":
        return { items: mod.fixtureComments(value), raw: null, attempts: 0 };
    }
  }
}

// ---------- Payload extractors (defensivos p/ variações do provedor) ----------
function extractMedias(raw: unknown): any[] {
  if (!raw) return [];
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.items)) return r.items as any[];
  if (Array.isArray(r.medias)) return r.medias as any[];
  if (Array.isArray(r.response)) return r.response as any[];
  if (Array.isArray(raw)) return raw as any[];
  return [];
}

function extractComments(raw: unknown): any[] {
  if (!raw) return [];
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.comments)) return r.comments as any[];
  if (Array.isArray(r.items)) return r.items as any[];
  if (Array.isArray(raw)) return raw as any[];
  return [];
}
