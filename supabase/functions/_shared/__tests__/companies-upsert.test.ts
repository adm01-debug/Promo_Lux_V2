// Testes Deno para _shared/companies-upsert.ts.
//
// O alvo do `onConflict` no PostgREST precisa casar com um indice unico TOTAL.
// Em producao o schema tinha `companies_org_place_id_uk` como indice PARCIAL
// (WHERE place_id IS NOT NULL AND deleted_at IS NULL): o PostgREST respondia
// 42P10 e o lote inteiro de empresas era descartado — `sync-results` devolvia
// `{companies_created: 0, total_results: 20}` sem erro visivel ao usuario.
// Estes testes fixam a degradacao controlada: place_id -> name_source -> insert.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { upsertCompanies } from "../companies-upsert.ts";

const ERRO_42P10 = {
  code: "42P10",
  message: "there is no unique or exclusion constraint matching the ON CONFLICT specification",
};

type Behavior = Record<string, { code?: string; message?: string } | "ok">;

function mockClient(behavior: Behavior) {
  const calls: string[] = [];
  const client = {
    from() {
      return {
        upsert(_rows: unknown, opts: { onConflict: string }) {
          calls.push("upsert:" + opts.onConflict);
          return {
            select: () => {
              const r = behavior[opts.onConflict];
              if (r === "ok") return Promise.resolve({ data: [{ id: "c1" }], error: null });
              return Promise.resolve({
                data: null,
                error: r ?? ERRO_42P10,
              });
            },
          };
        },
        insert() {
          calls.push("insert");
          return { select: () => Promise.resolve({ data: [{ id: "c2" }], error: null }) };
        },
      };
    },
  };
  return { client: client as never, calls };
}

Deno.test("upsertCompanies: usa place_id quando o banco aceita", async () => {
  const { client, calls } = mockClient({ "organization_id,place_id": "ok" });
  const res = await upsertCompanies(client, { place_id: "p1", name: "A" }, { hasPlaceId: true });
  assertEquals(res.strategy, "place_id");
  assertEquals(res.error, null);
  assertEquals(calls, ["upsert:organization_id,place_id"]);
});

Deno.test("upsertCompanies: cai para name_source quando place_id da 42P10", async () => {
  const { client, calls } = mockClient({
    "organization_id,place_id": ERRO_42P10,
    "organization_id,name,source": "ok",
  });
  const res = await upsertCompanies(client, { place_id: "p1", name: "A" }, { hasPlaceId: true });
  assertEquals(res.strategy, "name_source");
  assertEquals(calls, ["upsert:organization_id,place_id", "upsert:organization_id,name,source"]);
});

Deno.test("upsertCompanies: cai para insert puro quando nao ha constraint unica", async () => {
  const { client, calls } = mockClient({
    "organization_id,place_id": ERRO_42P10,
    "organization_id,name,source": ERRO_42P10,
  });
  const res = await upsertCompanies(client, [{ place_id: "p1", name: "A" }], { hasPlaceId: true });
  assertEquals(res.strategy, "insert");
  assertEquals(res.data.length, 1);
  assertEquals(calls, [
    "upsert:organization_id,place_id",
    "upsert:organization_id,name,source",
    "insert",
  ]);
});

Deno.test("upsertCompanies: nao tenta outra chave em erro real (RLS)", async () => {
  const { client, calls } = mockClient({
    "organization_id,place_id": { code: "42501", message: "permission denied for table companies" },
  });
  const res = await upsertCompanies(client, { place_id: "p1", name: "A" }, { hasPlaceId: true });
  assertEquals(res.error?.code, "42501");
  assertEquals(calls, ["upsert:organization_id,place_id"]);
});

Deno.test("upsertCompanies: sem place_id vai direto para org,name,source", async () => {
  const { client, calls } = mockClient({ "organization_id,name,source": "ok" });
  const res = await upsertCompanies(client, { name: "A" }, { hasPlaceId: false });
  assertEquals(res.strategy, "name_source");
  assertEquals(calls, ["upsert:organization_id,name,source"]);
});

Deno.test("upsertCompanies: infere hasPlaceId do proprio lote", async () => {
  const { client, calls } = mockClient({ "organization_id,place_id": "ok" });
  const res = await upsertCompanies(client, [{ place_id: "p1" }, { place_id: "p2" }]);
  assertEquals(res.strategy, "place_id");
  assertEquals(calls, ["upsert:organization_id,place_id"]);
});
