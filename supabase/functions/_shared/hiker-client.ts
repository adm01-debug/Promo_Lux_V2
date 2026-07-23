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
    if (this.mockMode) return mockResult("profile", username);
    const raw = await this.request("/v1/user/by/username", { username });
    return this.wrap([normalizeProfile(raw)], raw, 1);
  }

  async fetchPosts(username: string, limit = 200): Promise<FetchResult> {
    if (this.mockMode) return mockResult("posts", username, limit);
    const raw = await this.request("/v2/user/medias", { username, amount: limit });
    const items = extractMedias(raw).map((m) => normalizePost(m));
    return this.wrap(items, raw, 1);
  }

  async fetchHashtag(tag: string, limit = 200): Promise<FetchResult> {
    if (this.mockMode) return mockResult("hashtag", tag, limit);
    const raw = await this.request("/v1/hashtag/medias/top", {
      name: tag.replace(/^#/, ""),
      amount: limit,
    });
    const items = extractMedias(raw).map((m) => normalizeHashtag(m, tag));
    return this.wrap(items, raw, 1);
  }

  async fetchComments(mediaIdOrShortcode: string, limit = 200): Promise<FetchResult> {
    if (this.mockMode) return mockResult("comments", mediaIdOrShortcode, limit);
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

// ---------- Normalizers (self-contained, defensive) ----------
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null =>
  typeof v === "string" && v.length ? v : null;
const bool = (v: unknown): boolean | null =>
  typeof v === "boolean" ? v : null;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strArr = (v: unknown): string[] =>
  arr(v).map((x) => (typeof x === "string" ? x : "")).filter(Boolean);
const iso = (v: unknown): string => {
  if (typeof v === "number") return new Date(v * (v < 1e12 ? 1000 : 1)).toISOString();
  if (typeof v === "string") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
};
const extractHashtags = (text: string | null): string[] =>
  text ? Array.from(text.matchAll(/#([\p{L}0-9_]+)/gu)).map((m) => m[1].toLowerCase()) : [];
const extractMentions = (text: string | null): string[] =>
  text ? Array.from(text.matchAll(/@([A-Za-z0-9._]+)/g)).map((m) => m[1].toLowerCase()) : [];
const uniq = (xs: string[]): string[] => Array.from(new Set(xs.filter(Boolean)));

function baseItem(source: NormalizedInstagramItem["source_type"]): NormalizedInstagramItem {
  return {
    source_type: source,
    username: null, fullName: null, bio: null,
    followers: null, following: null, posts: null,
    verified: null, isPrivate: null, isBusinessAccount: null,
    profilePicUrl: null,
    email: null, phone: null, website: null,
    businessCategory: null, city: null, country: null,
    post: null, media: null, comment: null,
  };
}

function extractEmailFromBio(bio: string | null): string | null {
  if (!bio) return null;
  const m = bio.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0].toLowerCase() : null;
}

function extractPhoneFromBio(bio: string | null): string | null {
  if (!bio) return null;
  const m = bio.match(/\+?\d[\d\s().-]{7,}\d/);
  return m ? m[0].replace(/[^\d+]/g, "") : null;
}

/** Dispatcher unificado — usado pelo worker e pelo modo mock. */
export function normalize(
  sourceType: NormalizedInstagramItem["source_type"],
  rawItem: unknown,
  ctx: { hashtag?: string; parentMediaId?: string } = {},
): NormalizedInstagramItem {
  switch (sourceType) {
    case "profile":
      return normalizeProfile(rawItem);
    case "posts":
      return normalizePost(rawItem);
    case "hashtag":
      return normalizeHashtag(rawItem, ctx.hashtag ?? "");
    case "comments":
      return normalizeComment(rawItem, ctx.parentMediaId ?? "");
    default:
      return baseItem("posts");
  }
}

export function normalizeProfile(raw: unknown): NormalizedInstagramItem {
  const r = (raw ?? {}) as Record<string, any>;
  const u = (r.user ?? r) as Record<string, any>;
  const bio = str(u.biography ?? u.bio);
  const item = baseItem("profile");
  item.username = str(u.username);
  item.fullName = str(u.full_name ?? u.fullName);
  item.bio = bio;
  item.followers = num(u.follower_count ?? u.followers_count ?? u.followersCount ?? u.followers);
  item.following = num(u.following_count ?? u.followsCount ?? u.following);
  item.posts = num(u.media_count ?? u.postsCount ?? u.posts);
  item.verified = bool(u.is_verified ?? u.verified);
  item.isPrivate = bool(u.is_private ?? u.private ?? u.isPrivate);
  item.isBusinessAccount = bool(u.is_business ?? u.is_business_account ?? u.isBusinessAccount);
  item.profilePicUrl = str(u.profile_pic_url_hd ?? u.profilePicUrlHD ?? u.profile_pic_url ?? u.profilePicUrl);
  item.email = str(u.public_email ?? u.publicEmail ?? u.email) ?? extractEmailFromBio(bio);
  item.phone =
    str(u.public_phone_number ?? u.publicPhoneNumber ?? u.contact_phone_number ?? u.phone) ??
    extractPhoneFromBio(bio);
  item.website = str(u.external_url ?? u.externalUrl ?? u.website);
  item.businessCategory = str(u.category ?? u.business_category_name ?? u.businessCategoryName);
  item.city = str(u.city_name ?? u.city);
  item.country = str(u.country ?? u.countryBlock);
  return item;
}

function classifyMedia(r: any): "image" | "video" | "carousel" {
  const t = typeof r.type === "string" ? r.type.toLowerCase() : "";
  const children = arr(r.carousel_media).length || arr(r.childPosts).length;
  if (t === "sidecar" || t === "carousel" || children > 1) return "carousel";
  if (
    t === "video" ||
    r.media_type === 2 ||
    r.is_video ||
    r.video_url ||
    r.videoUrl ||
    Array.isArray(r.video_versions)
  ) return "video";
  return "image";
}

export function normalizePost(raw: unknown): NormalizedInstagramItem {
  const r = (raw ?? {}) as Record<string, any>;
  const caption = str(
    r.caption?.text ?? r.caption ?? r.edge_media_to_caption?.edges?.[0]?.node?.text,
  );
  const mediaType = classifyMedia(r);
  const shortcode = str(r.code ?? r.shortcode ?? r.shortCode) ?? "";
  const owner = str(r.user?.username ?? r.owner?.username ?? r.ownerUsername);
  const isReel = Boolean(
    r.product_type === "clips" ||
      r.productType === "clips" ||
      r.is_reel ||
      (typeof r.url === "string" && r.url.includes("/reel/")),
  );
  const rawHashtags = uniq([...strArr(r.hashtags).map((s) => s.toLowerCase()), ...extractHashtags(caption)]);
  const rawMentions = uniq([...strArr(r.mentions).map((s) => s.toLowerCase()), ...extractMentions(caption)]);
  const item = baseItem("posts");
  item.username = owner;
  item.post = {
    id: str(r.id ?? r.pk) ?? "",
    shortcode,
    url:
      str(r.url) ??
      (shortcode
        ? `https://www.instagram.com/${isReel ? "reel" : "p"}/${shortcode}/`
        : ""),
    caption: caption,
    likes: num(r.like_count ?? r.likes ?? r.likesCount),
    commentsCount: num(r.comment_count ?? r.comments_count ?? r.commentsCount),
    views: num(
      r.play_count ??
        r.video_play_count ??
        r.videoPlayCount ??
        r.video_view_count ??
        r.videoViewCount ??
        r.views,
    ),
    timestamp: iso(r.taken_at ?? r.timestamp ?? r.taken_at_timestamp),
    isReel,
    isSponsored: Boolean(r.is_paid_partnership ?? r.isSponsored ?? false),
    hashtags: rawHashtags,
    mentions: rawMentions,
    ownerUsername: owner,
  };
  const childCount =
    arr(r.carousel_media).length || arr(r.childPosts).length || null;
  const width = num(r.original_width ?? r.dimensionsWidth);
  const height = num(r.original_height ?? r.dimensionsHeight);
  item.media = {
    type: mediaType,
    displayUrl: str(
      r.image_versions2?.candidates?.[0]?.url ??
        r.display_url ??
        r.displayUrl ??
        r.thumbnail_url ??
        r.thumbnailUrl,
    ),
    videoUrl: str(r.video_versions?.[0]?.url ?? r.video_url ?? r.videoUrl),
    thumbnailUrl: str(
      r.thumbnail_url ??
        r.thumbnailUrl ??
        r.image_versions2?.candidates?.[0]?.url ??
        r.display_url ??
        r.displayUrl,
    ),
    childCount: mediaType === "carousel" ? (childCount ?? 0) : (childCount ?? null),
    dimensions:
      width !== null && height !== null ? { width, height } : null,
  };
  return item;
}

export function normalizeHashtag(raw: unknown, tag: string): NormalizedInstagramItem {
  const r = (raw ?? {}) as Record<string, any>;
  const item = normalizePost(r);
  item.source_type = "hashtag";
  const t = (str(r.hashtag) ?? tag ?? "").replace(/^#/, "").toLowerCase();
  if (item.post) {
    item.post.hashtags = uniq(t ? [t, ...item.post.hashtags] : item.post.hashtags);
  }
  return item;
}

export function normalizeComment(raw: unknown, parentMediaId: string): NormalizedInstagramItem {
  const r = (raw ?? {}) as Record<string, any>;
  const text = str(r.text) ?? "";
  const author = str(r.user?.username ?? r.owner?.username ?? r.ownerUsername) ?? "";
  const item = baseItem("comments");
  item.username = author || null;
  item.comment = {
    id: str(r.pk ?? r.id) ?? "",
    text,
    author,
    likes: num(r.comment_like_count ?? r.like_count ?? r.likesCount),
    timestamp: iso(r.created_at ?? r.created_at_utc ?? r.timestamp),
    parentCommentId: str(r.parent_comment_id ?? r.parentCommentId ?? r.replied_to_comment_id),
    hashtags: uniq([...strArr(r.hashtags).map((s) => s.toLowerCase()), ...extractHashtags(text)]),
    mentions: uniq([...strArr(r.mentions).map((s) => s.toLowerCase()), ...extractMentions(text)]),
  };
  const postUrl = str(r.postUrl);
  const shortFromUrl = postUrl ? postUrl.match(/\/(?:p|reel)\/([^/]+)/)?.[1] ?? "" : "";
  item.post = {
    id: parentMediaId || "",
    shortcode: shortFromUrl,
    url: postUrl ?? "",
    caption: null,
    likes: null,
    commentsCount: null,
    views: null,
    timestamp: iso(null),
    isReel: false,
    isSponsored: false,
    hashtags: [],
    mentions: [],
    ownerUsername: null,
  };
  return item;
}

// ---------- Mock result (usa fixtures Apify-shape, roda pelos mesmos normalizers) ----------
async function mockResult(
  kind: "profile" | "posts" | "hashtag" | "comments",
  value: string,
  limit = 200,
): Promise<FetchResult> {
  const key = {
    profile: "apify/instagram-profile-scraper",
    posts: "apify/instagram-post-scraper",
    hashtag: "apify/instagram-hashtag-scraper",
    comments: "apify/instagram-comment-scraper",
  }[kind];
  const rows = (MOCK_DATASET_FIXTURES[key] ?? []).slice(0, limit);
  if (!rows.length) return { items: [], raw: null, attempts: 0 };
  let items: NormalizedInstagramItem[];
  switch (kind) {
    case "profile": items = rows.map((r) => normalizeProfile(r)); break;
    case "posts": items = rows.map((r) => normalizePost(r)); break;
    case "hashtag": items = rows.map((r) => normalizeHashtag(r, value)); break;
    case "comments": items = rows.map((r) => normalizeComment(r, value)); break;
  }
  return { items, raw: rows, attempts: 0 };
}
