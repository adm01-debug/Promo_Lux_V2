import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { MOCK_DATASET_FIXTURES, type NormalizedInstagramItem } from "../apify-fixtures.ts";
import { normalize } from "../hiker-client.ts";

function assertNoUndefined(obj: unknown, path = "$"): void {
  if (obj === undefined) throw new Error(`undefined at ${path}`);
  if (obj === null) return;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => assertNoUndefined(v, `${path}[${i}]`));
    return;
  }
  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      assertNoUndefined(v, `${path}.${k}`);
    }
  }
}

const REQUIRED_KEYS: (keyof NormalizedInstagramItem)[] = [
  "source_type", "username", "fullName", "bio",
  "followers", "following", "posts",
  "verified", "isPrivate", "isBusinessAccount", "profilePicUrl",
  "email", "phone", "website",
  "businessCategory", "city", "country",
  "post", "media", "comment",
];

function assertShape(item: NormalizedInstagramItem) {
  for (const k of REQUIRED_KEYS) {
    assert(k in item, `missing key ${k}`);
    assert((item as Record<string, unknown>)[k] !== undefined, `undefined ${k}`);
  }
  assertNoUndefined(item);
}

Deno.test("normalize(profile) — business + creator sem undefined", () => {
  const rows = MOCK_DATASET_FIXTURES["apify/instagram-profile-scraper"];
  const items = rows.map((r) => normalize("profile", r));
  items.forEach(assertShape);
  assertEquals(items[0].email, "contato@lux.ia");
  assertEquals(items[0].phone, "+5511999990000");
  assertEquals(items[0].isBusinessAccount, true);
  assertEquals(items[0].businessCategory, "Software");
  assertEquals(items[0].city, "São Paulo");
  assertEquals(items[0].country, "BR");
  assertEquals(items[0].followers, 12480);
  // creator: email vem da bio
  assertEquals(items[1].email, "ana@creator.com");
  assertEquals(items[1].verified, true);
});

Deno.test("normalize(posts) — image, reel, carousel, sponsored sem undefined", () => {
  const rows = MOCK_DATASET_FIXTURES["apify/instagram-post-scraper"];
  const [img, reel, carousel, sponsored] = rows.map((r) => normalize("posts", r));
  [img, reel, carousel, sponsored].forEach(assertShape);

  assertEquals(img.media?.type, "image");
  assertEquals(img.post?.isReel, false);
  assertEquals(img.post?.shortcode, "C_mock_post_1");
  assertEquals(img.post?.hashtags.sort(), ["b2b", "saas"]);

  assertEquals(reel.media?.type, "video");
  assertEquals(reel.post?.isReel, true);
  assertEquals(reel.post?.views, 22100);
  assert(reel.post?.url.includes("/reel/"));

  assertEquals(carousel.media?.type, "carousel");
  assertEquals(carousel.media?.childCount, 4);

  assertEquals(sponsored.post?.isSponsored, true);
  assertEquals(sponsored.post?.mentions, ["cliente.ads"]);
});

Deno.test("normalize(hashtag) — inclui tag e cobre reel/carousel", () => {
  const rows = MOCK_DATASET_FIXTURES["apify/instagram-hashtag-scraper"];
  const items = rows.map((r) => normalize("hashtag", r, { hashtag: "marketing" }));
  items.forEach(assertShape);
  items.forEach((it) => {
    assertEquals(it.source_type, "hashtag");
    assert(it.post?.hashtags.includes("marketing"), "hashtag deve estar presente");
  });
  assertEquals(items[1].media?.type, "video");
  assertEquals(items[1].post?.isReel, true);
  assertEquals(items[2].media?.type, "carousel");
});

Deno.test("normalize(comments) — root + reply sem undefined", () => {
  const rows = MOCK_DATASET_FIXTURES["apify/instagram-comment-scraper"];
  const items = rows.map((r) => normalize("comments", r, { parentMediaId: "3200000000000000001" }));
  items.forEach(assertShape);
  assertEquals(items[0].comment?.parentCommentId, null);
  assertEquals(items[0].comment?.mentions, ["lux.ia"]);
  assertEquals(items[1].comment?.hashtags, ["interessado"]);
  assertEquals(items[2].comment?.parentCommentId, "17900000000000001");
  // post context com shortcode extraído da postUrl
  assertEquals(items[0].post?.shortcode, "C_mock_post_1");
});

Deno.test("normalize() — item vazio ainda produz shape completo sem undefined", () => {
  for (const src of ["profile", "posts", "hashtag", "comments"] as const) {
    assertShape(normalize(src, {}));
    assertShape(normalize(src, null));
  }
});
