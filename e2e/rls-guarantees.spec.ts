import { test, expect } from "@playwright/test";
import {
  anonClient,
  authedClient,
  getTenantCreds,
  isReadBlocked,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
} from "./helpers/supabase";
import { RLS_REGISTRY_TABLES, RLS_REGISTRY_EXEMPT } from "../src/lib/rlsRegistry";

/**
 * Garantias de RLS e privilégios de função (defesa em profundidade).
 *
 * Estes testes NÃO usam o browser — falam direto com a Data API para provar,
 * de forma determinística, que:
 *
 *  1. O papel `anon` não consegue ler nenhuma tabela multi-tenant nem tabela
 *     isenta sensível (RLS nega todas as linhas ou a Data API recusa o acesso).
 *  2. As RPCs `SECURITY DEFINER` tiveram o EXECUTE revogado de `anon`
 *     (endurecimento aplicado nas migrações de segurança) — anon recebe erro.
 *  3. Quando dois usuários de teste (tenant A e B) estão configurados via env,
 *     um tenant nunca enxerga dados do outro (isolamento por organização/usuário).
 *
 * Tabelas cobertas vêm do registry compartilhado (`src/lib/rlsRegistry.ts`),
 * mantido em sincronia com o edge function de testes de RLS.
 */

// Tabelas isentas do modelo multi-tenant mas ainda assim sensíveis: anon não
// deve conseguir lê-las (contêm PII/segredos ou metadados internos).
const SENSITIVE_EXEMPT = RLS_REGISTRY_EXEMPT.filter(
  (t) => !["campaign_events"].includes(t), // campaign_events pode ter leitura pública por tracking
);

const RPCS_AUTHENTICATED_ONLY: Array<{ name: string; args: Record<string, unknown> }> = [
  { name: "get_dashboard_stats", args: {} },
  { name: "create_default_deal_stages", args: {} },
  { name: "accept_org_invite", args: { _token: "e2e-anon-should-not-execute" } },
  { name: "api_latency_stats", args: {} },
  { name: "dlq_health_metrics", args: {} },
  { name: "purge_dead_letter", args: {} },
  { name: "reset_circuit_breaker", args: { _name: "e2e" } },
];

test.describe("RLS — leitura anônima bloqueada em tabelas multi-tenant", () => {
  for (const table of RLS_REGISTRY_TABLES) {
    test(`anon não lê linhas de "${table}"`, async () => {
      const client = anonClient();
      const result = await client.from(table).select("*").limit(1);
      expect(
        isReadBlocked(result),
        `Esperava RLS bloquear anon em ${table}, mas retornou linhas`,
      ).toBe(true);
    });
  }
});

test.describe("RLS — leitura anônima bloqueada em tabelas isentas sensíveis", () => {
  for (const table of SENSITIVE_EXEMPT) {
    test(`anon não lê linhas de "${table}"`, async () => {
      const client = anonClient();
      const result = await client.from(table).select("*").limit(1);
      expect(
        isReadBlocked(result),
        `Esperava RLS bloquear anon em ${table}, mas retornou linhas`,
      ).toBe(true);
    });
  }
});

test.describe("Privilégios — RPCs SECURITY DEFINER negam EXECUTE para anon", () => {
  for (const rpc of RPCS_AUTHENTICATED_ONLY) {
    test(`anon não executa RPC "${rpc.name}"`, async () => {
      const client = anonClient();
      const { error } = await client.rpc(rpc.name, rpc.args);
      expect(error, `Esperava erro ao anon executar ${rpc.name}`).not.toBeNull();
    });
  }
});

test.describe("RLS — sanidade de configuração", () => {
  test("URL e chave anon do backend estão definidas", () => {
    expect(SUPABASE_URL).toMatch(/^https:\/\/.+\.supabase\.co$/);
    expect(SUPABASE_ANON_KEY.length).toBeGreaterThan(20);
  });

  test("registry não sobrepõe tabelas multi-tenant e isentas", () => {
    const overlap = RLS_REGISTRY_TABLES.filter((t) => RLS_REGISTRY_EXEMPT.includes(t));
    expect(overlap, `Tabelas em ambas as listas: ${overlap.join(", ")}`).toHaveLength(0);
  });
});

// Isolamento cross-tenant só roda quando dois usuários de teste estão configurados.
const { a: tenantA, b: tenantB } = getTenantCreds();
const isolationDescribe = tenantA && tenantB ? test.describe : test.describe.skip;

isolationDescribe("RLS — isolamento multi-tenant entre dois usuários", () => {
  test("tenant A e tenant B não compartilham empresas", async () => {
    const clientA = await authedClient(tenantA!);
    const clientB = await authedClient(tenantB!);

    const { data: rowsA } = await clientA.from("companies").select("id").limit(200);
    const { data: rowsB } = await clientB.from("companies").select("id").limit(200);

    const idsA = new Set((rowsA ?? []).map((r) => (r as { id: string }).id));
    const idsB = new Set((rowsB ?? []).map((r) => (r as { id: string }).id));

    for (const id of idsB) {
      expect(idsA.has(id), `Empresa ${id} do tenant B vazou para o tenant A`).toBe(false);
    }
  });

  test("um usuário autenticado consulta suas próprias empresas sem erro de permissão", async () => {
    const clientA = await authedClient(tenantA!);
    const { error } = await clientA.from("companies").select("id").limit(1);
    expect(error).toBeNull();
  });
});
