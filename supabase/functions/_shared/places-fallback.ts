/**
 * Fallback de extracao Google Maps via Places API (New).
 *
 * O backend `gmaps.atomicabr.com.br` (scraper gosom/omkar) pode estar fora do
 * ar. Quando isso acontece o fluxo historico criava o job, nunca recebia
 * `external_id` e a extracao ficava inerte — `gmaps-proxy` respondia
 * `api_online: false` e nenhuma empresa era importada. Este modulo da ao
 * chamador uma segunda fonte de dados real (Google Places API) para que a
 * feature continue funcionando sem depender do scraper externo.
 */
import type { RawGmapsRow } from "./gmaps-mapper.ts";

const PLACES_API_URL = "https://places.googleapis.com/v1/places:searchText";

const PLACES_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.primaryTypeDisplayName",
  "places.businessStatus",
  "places.googleMapsUri",
  "places.priceLevel",
  "places.regularOpeningHours",
].join(",");

/** Traduz um `Place` da Places API para o shape cru que `mapGmapsRow` consome. */
export function placeToRow(place: Record<string, unknown>): RawGmapsRow {
  const displayName = (place.displayName as { text?: string } | undefined)?.text ?? "";
  const primaryType = (place.primaryTypeDisplayName as { text?: string } | undefined)?.text ?? "";
  const loc = place.location as { latitude?: number; longitude?: number } | undefined;
  const hours = place.regularOpeningHours as { weekdayDescriptions?: string[] } | undefined;
  return {
    name: displayName,
    category: primaryType,
    complete_address: place.formattedAddress ?? place.shortFormattedAddress ?? "",
    website: place.websiteUri ?? "",
    phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? "",
    latitude: loc?.latitude ?? "",
    longitude: loc?.longitude ?? "",
    place_id: place.id ?? "",
    link: place.googleMapsUri ?? "",
    review_rating: place.rating ?? "",
    review_count: place.userRatingCount ?? "",
    price_range: place.priceLevel ?? "",
    status: place.businessStatus ?? "",
    open_hours: hours?.weekdayDescriptions ? { weekday_text: hours.weekdayDescriptions } : null,
  } as RawGmapsRow;
}

/**
 * Executa a busca de texto na Places API para cada keyword e devolve as linhas
 * no formato aceito por `mapGmapsRow`. Retorna `null` quando a chave nao esta
 * configurada ou quando TODAS as buscas falham, permitindo que o chamador
 * diferencie "sem resultados" de "nao foi possivel consultar".
 */
export async function fetchPlacesResults(
  keywords: string[],
  maxResults = 20,
  lang = "pt-BR",
  region = "br",
): Promise<RawGmapsRow[] | null> {
  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) return null;

  const rows: RawGmapsRow[] = [];
  // A Places API limita `maxResultCount` a 20 por chamada.
  const pageSize = Math.min(Math.max(maxResults, 1), 20);
  let anySuccess = false;

  for (const keyword of keywords) {
    try {
      const res = await fetch(PLACES_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": PLACES_FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery: keyword,
          languageCode: lang,
          regionCode: region,
          maxResultCount: pageSize,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        console.error(JSON.stringify({
          function: "gmaps-proxy",
          level: "error",
          msg: "places_api_error",
          keyword,
          status: res.status,
          body: (await res.text()).slice(0, 300),
        }));
        continue;
      }

      anySuccess = true;
      const data = await res.json();
      const places = Array.isArray(data.places) ? data.places : [];
      for (const place of places) rows.push(placeToRow(place as Record<string, unknown>));
    } catch (err) {
      console.error(JSON.stringify({
        function: "gmaps-proxy",
        level: "error",
        msg: "places_api_fetch_error",
        keyword,
        error: (err as Error).message,
      }));
    }
  }

  return anySuccess ? rows : null;
}

/** Health check dedicado: responde se a chave esta configurada e se a API responde. */
export async function checkPlacesApi(): Promise<{ status: "healthy" | "unhealthy"; status_code?: number; error?: string }> {
  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) return { status: "unhealthy", error: "GOOGLE_MAPS_API_KEY ausente" };
  try {
    const res = await fetch(PLACES_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id",
      },
      body: JSON.stringify({ textQuery: "cafe", maxResultCount: 1 }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? { status: "healthy", status_code: res.status } : { status: "unhealthy", status_code: res.status };
  } catch (err) {
    return { status: "unhealthy", error: (err as Error).message };
  }
}