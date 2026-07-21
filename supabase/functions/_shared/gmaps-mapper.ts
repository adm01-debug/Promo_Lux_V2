/**
 * Paridade com gosom/google-maps-scraper (36 data points).
 * Mapeia uma linha bruta (CSV parseado ou JSON do backend externo) para o
 * shape da tabela `companies` + preserva o `raw_data` original.
 */

export interface RawGmapsRow {
  [key: string]: unknown;
}

export interface MappedCompany {
  name: string;
  sector: string;
  location: string;
  website: string;
  phone: string;
  email: string;
  latitude: number | null;
  longitude: number | null;
  place_id: string | null;
  cid: string | null;
  plus_code: string | null;
  google_maps_url: string | null;
  street_view_url: string | null;
  rating: number | null;
  review_count: number | null;
  price_range: string | null;
  business_status: string | null;
  thumbnail_url: string | null;
  images: string[] | null;
  open_hours: unknown;
  popular_times: unknown;
  timezone: string | null;
  descriptions: string | null;
  owner_claimed: boolean | null;
  reservations_url: string | null;
  order_online_url: string | null;
  menu_url: string | null;
}

const pick = (row: RawGmapsRow, ...keys: string[]): string => {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== "") return String(v).trim();
  }
  return "";
};

const num = (row: RawGmapsRow, ...keys: string[]): number | null => {
  const v = pick(row, ...keys);
  if (!v) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const bool = (row: RawGmapsRow, ...keys: string[]): boolean | null => {
  const v = pick(row, ...keys).toLowerCase();
  if (!v) return null;
  return v === "true" || v === "1" || v === "yes" || v === "sim";
};

const arr = (row: RawGmapsRow, ...keys: string[]): string[] | null => {
  for (const k of keys) {
    const v = row[k];
    if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
    if (typeof v === "string" && v) {
      // "url1|url2" ou "url1;url2" ou JSON array
      try {
        const p = JSON.parse(v);
        if (Array.isArray(p)) return p.map((x) => String(x)).filter(Boolean);
      } catch { /* not JSON */ }
      return v.split(/[|;]/).map((x) => x.trim()).filter(Boolean);
    }
  }
  return null;
};

const json = (row: RawGmapsRow, ...keys: string[]): unknown => {
  for (const k of keys) {
    const v = row[k];
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "object") return v;
    try { return JSON.parse(String(v)); } catch { return String(v); }
  }
  return null;
};

export function mapGmapsRow(row: RawGmapsRow): MappedCompany {
  return {
    name: pick(row, "title", "name") || "Unknown",
    sector: pick(row, "category", "type") || "Não classificado",
    location: pick(row, "complete_address", "address", "city"),
    website: pick(row, "website", "web_site"),
    phone: pick(row, "phone"),
    email: pick(row, "email", "emails"),
    latitude: num(row, "latitude", "lat"),
    longitude: num(row, "longitude", "lon", "lng"),
    place_id: pick(row, "place_id") || null,
    cid: pick(row, "cid") || null,
    plus_code: pick(row, "plus_code") || null,
    google_maps_url: pick(row, "link", "url", "google_maps_url") || null,
    street_view_url: pick(row, "street_view_url") || null,
    rating: num(row, "review_rating", "rating"),
    review_count: num(row, "review_count", "reviews") as number | null,
    price_range: pick(row, "price_range") || null,
    business_status: pick(row, "status", "business_status") || null,
    thumbnail_url: pick(row, "thumbnail") || null,
    images: arr(row, "images"),
    open_hours: json(row, "open_hours"),
    popular_times: json(row, "popular_times"),
    timezone: pick(row, "timezone") || null,
    descriptions: pick(row, "descriptions", "description") || null,
    owner_claimed: bool(row, "owner"),
    reservations_url: pick(row, "reservations") || null,
    order_online_url: pick(row, "order_online") || null,
    menu_url: pick(row, "menu") || null,
  };
}

/**
 * Parser CSV mínimo RFC 4180 — trata aspas e vírgulas dentro de campos.
 * Suficiente para os CSVs do gosom/gmaps.
 */
export function parseCsv(text: string): RawGmapsRow[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { cur.push(field); field = ""; }
      else if (ch === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (ch === "\r") { /* skip */ }
      else field += ch;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }

  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1)
    .filter((r) => r.some((v) => v.trim() !== ""))
    .map((r) => {
      const obj: RawGmapsRow = {};
      headers.forEach((h, i) => { obj[h] = r[i] ?? ""; });
      return obj;
    });
}
