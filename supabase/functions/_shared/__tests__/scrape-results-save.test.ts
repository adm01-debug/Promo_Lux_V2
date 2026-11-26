// Testes Deno para _shared/scrape-results-save.ts.
//
// G16-1: quando o provedor externo cai e a Places API assume a tarefa, o worker
// tem de GRAVAR o que obteve. Antes ele marcava o job como concluido com
// `results_count` preenchido e nenhuma empresa entrava — o usuario via "20
// resultados" e a lista de empresas vazia, sem erro nenhum.
//
// Os dois ultimos testes sao guardas estruturais: a ordem gravar -> concluir e
// o contrato da contingencia, nao um detalhe de implementacao.
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadIpcCriteria, saveScrapeResults } from "../scrape-results-save.ts";

type Row = Record<string, unknown>;

function mockClient(options: { failNames?: string[] } = {}) {
  const inserted: { table: string; row: Row }[] = [];
  const upserts: { onConflict: string; rows: Row[] }[] = [];
  const reads: { table: string; filters: [string, unknown][] }[] = [];
  let seq = 0;

  const client = {
    from(table: string) {
      return {
        upsert(rows: Row | Row[], opts: { onConflict: string }) {
          const list = Array.isArray(rows) ? rows : [rows];
          upserts.push({ onConflict: opts.onConflict, rows: list });
          const fail = (options.failNames ?? []).includes(String(list[0].name));
          return {
            select: () =>
              Promise.resolve(
                fail
                  ? {
                      data: null,
                      error: { code: "23505", message: "duplicate" },
                    }
                  : { data: [{ id: `c${++seq}` }], error: null },
              ),
          };
        },
        insert(row: Row) {
          inserted.push({ table, row });
          return Promise.resolve({ error: null });
        },
        select() {
          const filters: [string, unknown][] = [];
          const builder = {
            eq(column: string, value: unknown) {
              filters.push([column, value]);
              return builder;
            },
            limit() {
              return builder;
            },
            maybeSingle() {
              reads.push({ table, filters });
              return Promise.resolve({
                data: { criteria: { sectors: ["padaria"] } },
                error: null,
              });
            },
          };
          return builder;
        },
      };
    },
  };

  return { client, inserted, upserts, reads };
}

const ROWS = [
  { name: "Padaria A", complete_address: "Rua 1", place_id: "p1" },
  { name: "Padaria B", complete_address: "Rua 2", place_id: "p2" },
];

function supabaseDo(mock: ReturnType<typeof mockClient>): SupabaseClient {
  return mock.client as unknown as SupabaseClient;
}

Deno.test(
  "saveScrapeResults: grava empresas e resultados com org e job do chamador",
  async () => {
    const mock = mockClient();
    const outcome = await saveScrapeResults(supabaseDo(mock), {
      organizationId: "org-1",
      userId: "user-1",
      jobId: "job-1",
      rows: ROWS,
      ipcCriteria: { sectors: ["padaria"] },
    });

    assertEquals(outcome, { saved: 2, failed: 0, strategy: "place_id" });
    assertEquals(mock.upserts.length, 2);
    assertEquals(mock.upserts[0].onConflict, "organization_id,place_id");
    assertEquals(mock.upserts[0].rows[0].organization_id, "org-1");
    assertEquals(mock.upserts[0].rows[0].source, "gmaps");
    assert(typeof mock.upserts[0].rows[0].ipc_score === "number");

    assertEquals(
      mock.inserted.map((i) => i.table),
      ["scrape_results", "scrape_results"],
    );
    assertEquals(mock.inserted[0].row.organization_id, "org-1");
    assertEquals(mock.inserted[0].row.job_id, "job-1");
    assertEquals(mock.inserted[0].row.processed, true);
    assertEquals(mock.inserted[0].row.company_id, "c1");
  },
);

Deno.test(
  "saveScrapeResults: linha recusada nao vira resultado nem some do log",
  async () => {
    const mock = mockClient({ failNames: ["Padaria B"] });
    const erros: string[] = [];
    const outcome = await saveScrapeResults(supabaseDo(mock), {
      organizationId: "org-1",
      userId: "user-1",
      jobId: "job-1",
      rows: ROWS,
      onRowError: (_error, name) => erros.push(name),
    });

    assertEquals(outcome.saved, 1);
    assertEquals(outcome.failed, 1);
    assertEquals(erros, ["Padaria B"]);
    assertEquals(mock.inserted.length, 1);
  },
);

Deno.test(
  "saveScrapeResults: sem job grava a empresa e nao tenta scrape_results",
  async () => {
    const mock = mockClient();
    const outcome = await saveScrapeResults(supabaseDo(mock), {
      organizationId: "org-1",
      userId: null,
      rows: ROWS,
    });

    assertEquals(outcome.saved, 2);
    assertEquals(mock.inserted.length, 0);
  },
);

Deno.test(
  "saveScrapeResults: lote vazio devolve zero sem tocar no banco",
  async () => {
    const mock = mockClient();
    const outcome = await saveScrapeResults(supabaseDo(mock), {
      organizationId: "org-1",
      userId: "user-1",
      jobId: "job-1",
      rows: [],
    });

    assertEquals(outcome, { saved: 0, failed: 0, strategy: null });
    assertEquals(mock.upserts.length, 0);
    assertEquals(mock.inserted.length, 0);
  },
);

Deno.test(
  "loadIpcCriteria: le so a configuracao ativa do usuario",
  async () => {
    const mock = mockClient();
    const criteria = await loadIpcCriteria(supabaseDo(mock), "user-1");

    assertEquals(criteria, { sectors: ["padaria"] });
    assertEquals(mock.reads, [
      {
        table: "ipc_config",
        filters: [
          ["is_active", true],
          ["user_id", "user-1"],
        ],
      },
    ]);
  },
);

Deno.test("loadIpcCriteria: sem usuario nao consulta o banco", async () => {
  const mock = mockClient();
  assertEquals(await loadIpcCriteria(supabaseDo(mock), null), undefined);
  assertEquals(mock.reads.length, 0);
});

Deno.test(
  "scrape-queue-worker: contingencia grava antes de concluir a tarefa",
  () => {
    const fonte = Deno.readTextFileSync(
      new URL("../../scrape-queue-worker/index.ts", import.meta.url),
    );
    const inicio = fonte.indexOf("async function completeWithPlacesFallback");
    const fim = fonte.indexOf("interface QueueTask");
    assert(
      inicio > 0 && fim > inicio,
      "completeWithPlacesFallback mudou de lugar",
    );
    const corpo = fonte.slice(inicio, fim);

    const grava = corpo.indexOf("saveScrapeResults(");
    const conclui = corpo.indexOf("complete_scrape_task");
    assert(grava > 0, "a contingencia precisa usar o gravador comum");
    assert(conclui > grava, "a gravacao tem de vir antes de concluir a tarefa");
    assert(
      corpo.includes("if (saved === 0)"),
      "sem gravacao a tarefa nao pode ser dada como concluida",
    );
    assert(
      !corpo.includes("results_count: rows.length"),
      "results_count tem de refletir o que foi gravado",
    );
  },
);

Deno.test("gmaps-proxy: download do provedor usa o mesmo gravador", () => {
  const proxy = Deno.readTextFileSync(
    new URL("../../gmaps-proxy/index.ts", import.meta.url),
  );
  assert(
    proxy.includes("saveScrapeResults("),
    "o download do provedor precisa do gravador comum",
  );
  assert(
    !proxy.includes("upsertCompanies"),
    "o upsert de empresas nao pode voltar a ser duplicado no proxy",
  );
});
