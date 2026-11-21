import { assertEquals, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { fetchPlacesResults, placeToRow, checkPlacesApi } from "../places-fallback.ts";
import { mapGmapsRow } from "../gmaps-mapper.ts";

const realFetch = globalThis.fetch;
const realKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

function withEnv(key: string | undefined, fn: () => Promise<void>) {
  if (key === undefined) Deno.env.delete("GOOGLE_MAPS_API_KEY");
  else Deno.env.set("GOOGLE_MAPS_API_KEY", key);
  return fn().finally(() => {
    if (realKey === undefined) Deno.env.delete("GOOGLE_MAPS_API_KEY");
    else Deno.env.set("GOOGLE_MAPS_API_KEY", realKey);
  });
}

Deno.test("placeToRow maps Places API place to gosom-compatible row", () => {
  const row = placeToRow({
    id: "ChIJv6b7Up_1zpQRQ-u47vUPYYU",
    displayName: { text: "Restaurante Sapporo" },
    primaryTypeDisplayName: { text: "Restaurante japonês" },
    formattedAddress: "Praça Nossa Sra. Aparecida, 114 - Moema, São Paulo - SP",
    location: { latitude: -23.6, longitude: -46.66 },
    rating: 4.8,
    userRatingCount: 5733,
    websiteUri: "https://sapporo.example",
    nationalPhoneNumber: "(11) 5051-0000",
    businessStatus: "OPERATIONAL",
    googleMapsUri: "https://maps.google.com/?cid=1",
  });

  assertEquals(row.name, "Restaurante Sapporo");
  assertEquals(row.category, "Restaurante japonês");
  assertEquals(row.place_id, "ChIJv6b7Up_1zpQRQ-u47vUPYYU");
  assertEquals(row.review_rating, 4.8);
  assertEquals(row.review_count, 5733);
  assertEquals(row.phone, "(11) 5051-0000");
  assertEquals(row.link, "https://maps.google.com/?cid=1");

  // O row precisa ser consumível pelo mapper que grava em `companies`.
  const mapped = mapGmapsRow(row);
  assertEquals(mapped.name, "Restaurante Sapporo");
  assertEquals(mapped.sector, "Restaurante japonês");
  assertEquals(mapped.location, "Praça Nossa Sra. Aparecida, 114 - Moema, São Paulo - SP");
  assertEquals(mapped.rating, 4.8);
  assertEquals(mapped.review_count, 5733);
  assertEquals(mapped.latitude, -23.6);
  assertEquals(mapped.longitude, -46.66);
  assertEquals(mapped.place_id, "ChIJv6b7Up_1zpQRQ-u47vUPYYU");
});

Deno.test("placeToRow tolerates places with only required fields", () => {
  const row = placeToRow({ id: "ChIJ_only_id", displayName: { text: "Sem dados" } });
  const mapped = mapGmapsRow(row);
  assertEquals(mapped.name, "Sem dados");
  assertEquals(mapped.phone, "");
  assertEquals(mapped.rating, null);
  assertEquals(mapped.place_id, "ChIJ_only_id");
});

Deno.test("fetchPlacesResults returns null when API key is absent", async () => {
  await withEnv(undefined, async () => {
    const rows = await fetchPlacesResults(["restaurante"]);
    assertEquals(rows, null);
  });
});

Deno.test("fetchPlacesResults returns null when every keyword call fails", async () => {
  await withEnv("fake-key", async () => {
    globalThis.fetch = (() => Promise.resolve(new Response("erro", { status: 403 }))) as typeof fetch;
    try {
      const rows = await fetchPlacesResults(["restaurante"]);
      assertEquals(rows, null);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

Deno.test("fetchPlacesResults flattens results from all keywords and caps page size", async () => {
  await withEnv("fake-key", async () => {
    const sizes: number[] = [];
    globalThis.fetch = ((_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      sizes.push(body.maxResultCount);
      return Promise.resolve(new Response(JSON.stringify({
        places: [{ id: `id-${body.textQuery}`, displayName: { text: body.textQuery } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    }) as typeof fetch;
    try {
      const rows = await fetchPlacesResults(["a", "b"], 50, "pt-BR");
      assert(rows !== null);
      assertEquals(rows!.length, 2);
      assertEquals(rows!.map((r) => r.name), ["a", "b"]);
      // Places API limita maxResultCount a 20 por chamada.
      assertEquals(sizes, [20, 20]);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

Deno.test("fetchPlacesResults keeps going when one keyword fails", async () => {
  await withEnv("fake-key", async () => {
    let call = 0;
    globalThis.fetch = ((_url: string, init: RequestInit) => {
      call++;
      if (call === 1) return Promise.resolve(new Response("boom", { status: 500 }));
      const body = JSON.parse(String(init.body));
      return Promise.resolve(new Response(JSON.stringify({
        places: [{ id: "ok-1", displayName: { text: body.textQuery } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    }) as typeof fetch;
    try {
      const rows = await fetchPlacesResults(["falha", "sucesso"]);
      assert(rows !== null);
      assertEquals(rows!.length, 1);
      assertEquals(rows![0].name, "sucesso");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

Deno.test("checkPlacesApi reports unhealthy without key and healthy on 200", async () => {
  await withEnv(undefined, async () => {
    const r = await checkPlacesApi();
    assertEquals(r.status, "unhealthy");
    assert(r.error?.includes("GOOGLE_MAPS_API_KEY"));
  });

  await withEnv("fake-key", async () => {
    globalThis.fetch = (() => Promise.resolve(new Response("{}", { status: 200 }))) as typeof fetch;
    try {
      const r = await checkPlacesApi();
      assertEquals(r.status, "healthy");
      assertEquals(r.status_code, 200);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});