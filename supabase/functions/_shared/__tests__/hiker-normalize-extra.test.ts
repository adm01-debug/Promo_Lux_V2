/**
 * Testes complementares ao normalizador:
 *  - Extração determinística de hashtags/mentions (unicode, dedup, case).
 *  - Reply threads: parentCommentId em N níveis, com resolução do root.
 *  - Fixtures expandidas (thread aninhada + comentário com acentos/emoji).
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { MOCK_DATASET_FIXTURES, type NormalizedInstagramItem } from "../apify-fixtures.ts";
import { normalize } from "../hiker-client.ts";

const commentsFixture = MOCK_DATASET_FIXTURES["apify/instagram-comment-scraper"];
const parentMediaId = "3200000000000000001";
const normalizedComments = commentsFixture.map((r) =>
  normalize("comments", r, { parentMediaId }),
);

Deno.test("hashtags/mentions: unicode preservado, case lowercased, dedup", () => {
  const posts = MOCK_DATASET_FIXTURES["apify/instagram-post-scraper"].map((r) =>
    normalize("posts", r),
  );
  // sponsored caption "Parceria com @cliente.ads · #ad"
  const sponsored = posts.find((p) => p.post?.isSponsored)!;
  assertEquals(sponsored.post?.hashtags, ["ad"]);
  assertEquals(sponsored.post?.mentions, ["cliente.ads"]);

  // Comentário aninhado (índice 4 nas fixtures expandidas) tem acento + duplicatas
  const acentuado = normalizedComments[4];
  assert(acentuado.comment);
  // dedup: @lux.ia e @Lux.IA colapsam
  assertEquals(acentuado.comment!.mentions, ["lux.ia"]);
  // dedup + preservação de unicode
  assertEquals(acentuado.comment!.hashtags.sort(), ["growth", "inovação"]);
});

Deno.test("hashtags: extraídos do caption combinam com o campo `hashtags` da fixture", () => {
  const posts = MOCK_DATASET_FIXTURES["apify/instagram-post-scraper"].map((r) =>
    normalize("posts", r),
  );
  const first = posts[0]; // caption inclui #saas #b2b, fixture também
  assertEquals(first.post?.hashtags.sort(), ["b2b", "saas"]);
  assertEquals(first.post?.mentions, ["lux.ia"]);
});

Deno.test("hashtag(): tag do contexto entra como primeira hashtag sem duplicar", () => {
  const hashtagRows = MOCK_DATASET_FIXTURES["apify/instagram-hashtag-scraper"];
  const items = hashtagRows.map((r) => normalize("hashtag", r, { hashtag: "#Marketing" }));
  for (const it of items) {
    const tags = it.post?.hashtags ?? [];
    assertEquals(tags.filter((t) => t === "marketing").length, 1, "sem duplicata");
    assertEquals(tags[0], "marketing", "tag do contexto vem primeiro");
  }
});

Deno.test("reply threads: parentCommentId resolvido em N níveis", () => {
  // Fixtures: id1 (root), id2 (root), id3 (reply→id1), id4 (reply→id3), id5 (root)
  const byId = new Map<string, NormalizedInstagramItem>();
  for (const it of normalizedComments) {
    if (it.comment?.id) byId.set(it.comment.id, it);
  }

  const parentOf = (id: string) => byId.get(id)?.comment?.parentCommentId ?? null;
  assertEquals(parentOf("17900000000000001"), null);
  assertEquals(parentOf("17900000000000002"), null);
  assertEquals(parentOf("17900000000000003"), "17900000000000001");
  assertEquals(parentOf("17900000000000004"), "17900000000000003");
  assertEquals(parentOf("17900000000000005"), null);

  // Resolução de root (walk até null) — inclui thread de 2 níveis
  function rootOf(id: string, seen = new Set<string>()): string {
    if (seen.has(id)) throw new Error(`ciclo em ${id}`);
    seen.add(id);
    const p = parentOf(id);
    return p ? rootOf(p, seen) : id;
  }
  assertEquals(rootOf("17900000000000004"), "17900000000000001");
  assertEquals(rootOf("17900000000000003"), "17900000000000001");
  assertEquals(rootOf("17900000000000002"), "17900000000000002");
});

Deno.test("reply threads: post.shortcode extraído da postUrl inclui /reel/", () => {
  // Último comentário aponta para uma reel URL
  const last = normalizedComments.at(-1)!;
  assertEquals(last.post?.shortcode, "C_mock_reel_1");
  assertEquals(last.post?.id, parentMediaId);
});

Deno.test("comments: timestamps são ISO 8601 e ordenáveis cronologicamente", () => {
  const ts = normalizedComments.map((c) => c.comment!.timestamp);
  const sorted = [...ts].sort();
  assertEquals(ts, sorted, "fixtures já estão em ordem cronológica");
  for (const t of ts) assert(/^\d{4}-\d{2}-\d{2}T/.test(t));
});
