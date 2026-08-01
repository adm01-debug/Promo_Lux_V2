import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { mapGmapsRow, parseCsv } from "../gmaps-mapper.ts";

Deno.test("parseCsv respects quoted commas and escapes", () => {
  const csv = `title,address,phone\n"Café, do João","Rua A, 10","(11) 99999-0000"\n"Bar B","Rua B, 20",""`;
  const rows = parseCsv(csv);
  assertEquals(rows.length, 2);
  assertEquals(rows[0].title, "Café, do João");
  assertEquals(rows[0].address, "Rua A, 10");
  assertEquals(rows[1].phone, "");
});

Deno.test("mapGmapsRow extracts full 36-field set from gosom CSV row", () => {
  const raw = {
    title: "Pizzaria Bella",
    category: "Restaurante",
    address: "Av. Paulista, 1000",
    complete_address: "Av. Paulista, 1000, São Paulo, SP",
    phone: "+55 11 99999-0000",
    website: "https://bella.example",
    email: "contato@bella.example",
    latitude: "-23.561",
    longitude: "-46.656",
    place_id: "ChIJXYZ",
    cid: "1234567890",
    plus_code: "588MC9V3+8P",
    link: "https://maps.google.com/?cid=1234567890",
    street_view_url: "https://maps.google.com/streetview?...",
    review_rating: "4.7",
    review_count: "312",
    price_range: "$$",
    status: "OPERATIONAL",
    thumbnail: "https://lh5.googleusercontent.com/thumb.jpg",
    images: "https://img1.jpg|https://img2.jpg",
    open_hours: '{"mon":["09:00","23:00"]}',
    popular_times: "[]",
    timezone: "America/Sao_Paulo",
    descriptions: "Pizzaria artesanal desde 1990",
    owner: "true",
    reservations: "https://reservas.example",
    order_online: "https://pedidos.example",
    menu: "https://menu.example",
  };
  const m = mapGmapsRow(raw);
  assertEquals(m.name, "Pizzaria Bella");
  assertEquals(m.sector, "Restaurante");
  assertEquals(m.location, "Av. Paulista, 1000, São Paulo, SP");
  assertEquals(m.latitude, -23.561);
  assertEquals(m.longitude, -46.656);
  assertEquals(m.place_id, "ChIJXYZ");
  assertEquals(m.cid, "1234567890");
  assertEquals(m.rating, 4.7);
  assertEquals(m.review_count, 312);
  assertEquals(m.price_range, "$$");
  assertEquals(m.business_status, "OPERATIONAL");
  assertEquals(m.images, ["https://img1.jpg", "https://img2.jpg"]);
  assertEquals(m.owner_claimed, true);
  assertExists(m.open_hours);
  assertEquals(m.timezone, "America/Sao_Paulo");
});

Deno.test("mapGmapsRow uses safe fallbacks for missing fields", () => {
  const m = mapGmapsRow({});
  assertEquals(m.name, "Unknown");
  assertEquals(m.sector, "Não classificado");
  assertEquals(m.rating, null);
  assertEquals(m.place_id, null);
  assertEquals(m.images, null);
});
