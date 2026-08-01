import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * E2E-ish tests do helper `db` (withOrg) cobrindo o fluxo completo de
 * troca de organização ativa no cliente. Simulamos um usuário que:
 *   1. entra na Org A, cria/lê/atualiza/deleta dados
 *   2. troca para Org B e repete as operações
 *   3. tenta cross-org (ler/escrever Org B com contexto Org A)
 *
 * Verificamos que:
 *   - INSERT/UPSERT injeta `organization_id` da org ativa
 *   - SELECT força `.eq("organization_id", activeOrg)`
 *   - UPDATE/DELETE força filtro de org e nunca aceita org diferente
 *   - Trocar a org ativa muda o filtro automaticamente nas próximas queries
 *   - Cross-org explícito é bloqueado com `OrgMismatchError`
 */

const calls: Record<string, unknown[]> = {
  select: [], insert: [], upsert: [], update: [], delete: [], eq: [], is: [],
};

function makeBuilder() {
  const b: Record<string, (...args: unknown[]) => unknown> = {};
  for (const m of ["select", "insert", "upsert", "update", "delete", "eq", "is"] as const) {
    b[m] = vi.fn((...args: unknown[]) => {
      calls[m].push({ method: m, args });
      return b;
    });
  }
  return b;
}

const builder = makeBuilder();
const fromSpy = vi.fn((_table: string) => builder);

vi.mock("../client", () => ({
  supabase: { from: (t: string) => fromSpy(t) },
}));

import { db, setActiveOrgId, OrgMismatchError } from "../withOrg";

const ORG_A = "11111111-1111-1111-1111-111111111111";
const ORG_B = "22222222-2222-2222-2222-222222222222";

function reset() {
  for (const k of Object.keys(calls)) calls[k].length = 0;
  for (const m of Object.keys(builder)) (builder[m] as unknown as { mockClear: () => void }).mockClear();
  fromSpy.mockClear();
}

/** Coleta apenas os filtros aplicados em organization_id. */
function orgFilters(): unknown[] {
  return calls.eq
    .map((c) => (c as { args: unknown[] }).args)
    .filter((args) => args[0] === "organization_id")
    .map((args) => args[1]);
}

describe("withOrg — E2E switching de organização ativa", () => {
  beforeEach(() => {
    reset();
    setActiveOrgId(null);
    if (typeof window !== "undefined") window.localStorage.removeItem("lux:active-org");
  });

  it("fluxo completo: opera em Org A, troca para Org B, e o filtro de leitura acompanha", () => {
    // ---- Org A ----
    setActiveOrgId(ORG_A);
    db.from("companies").select("*");
    db.from("companies").insert({ name: "Acme A" });
    db.from("companies").update({ name: "Acme A v2" });
    db.from("companies").delete();

    // SELECT, UPDATE e DELETE injetam .eq(organization_id); INSERT apenas injeta no payload.
    expect(orgFilters()).toEqual([ORG_A, ORG_A, ORG_A]);
    expect(calls.insert[0]).toEqual({
      method: "insert",
      args: [{ name: "Acme A", organization_id: ORG_A }],
    });

    reset();

    // ---- troca para Org B ----
    setActiveOrgId(ORG_B);
    db.from("companies").select("*");
    db.from("companies").insert({ name: "Acme B" });

    // todas as operações agora usam Org B
    // SELECT injeta .eq; INSERT injeta no payload (sem .eq).
    expect(orgFilters()).toEqual([ORG_B]);
    expect(calls.insert[0]).toEqual({
      method: "insert",
      args: [{ name: "Acme B", organization_id: ORG_B }],
    });
  });

  it("bloqueia leitura cross-org: estando em Org A, cliente NÃO consegue forçar SELECT em Org B", () => {
    setActiveOrgId(ORG_A);
    // Mesmo que o caller tente um .eq manual depois, o helper já injetou a org ativa.
    // O que importa é que SEMPRE existe um filtro pela org ativa, então o resultado
    // jamais retornaria registros de outra org, mesmo com encadeamento posterior.
    db.from("companies").select("*");
    expect(orgFilters()).toContain(ORG_A);
    expect(orgFilters()).not.toContain(ORG_B);
  });

  it("bloqueia escrita cross-org após switch: tentar inserir com org antiga é interceptado", () => {
    setActiveOrgId(ORG_A);
    // simulamos um payload "stale" que carregou a org A em memória do componente,
    // mas o usuário trocou para B antes do submit
    setActiveOrgId(ORG_B);
    expect(() =>
      db.from("companies").insert({ name: "stale", organization_id: ORG_A }),
    ).toThrow(OrgMismatchError);
    expect(calls.insert).toEqual([]);
  });

  it("bloqueia UPDATE cross-org após switch e nunca chega a chamar o builder", () => {
    setActiveOrgId(ORG_B);
    expect(() =>
      db.from("companies").update({ name: "x", organization_id: ORG_A }),
    ).toThrow(OrgMismatchError);
    expect(calls.update).toEqual([]);
  });

  it("propaga o switch para todas as tabelas org-escopadas (companies, deals, notifications)", () => {
    setActiveOrgId(ORG_A);
    db.from("companies").select("*");
    db.from("deals").select("*");
    db.from("notifications").select("*");
    expect(orgFilters()).toEqual([ORG_A, ORG_A, ORG_A]);

    reset();
    setActiveOrgId(ORG_B);
    db.from("companies").select("*");
    db.from("deals").select("*");
    db.from("notifications").select("*");
    expect(orgFilters()).toEqual([ORG_B, ORG_B, ORG_B]);
  });

  it("não vaza filtro de org em tabelas fora do escopo (profiles, organizations)", () => {
    setActiveOrgId(ORG_A);
    db.from("profiles").select("id, full_name");
    db.from("organizations").select("*");
    expect(orgFilters()).toEqual([]);
  });

  it("ao trocar org no meio de uma sessão, próximas operações usam o novo contexto sem precisar reimportar nada", () => {
    setActiveOrgId(ORG_A);
    db.from("companies").insert({ name: "first" });
    setActiveOrgId(ORG_B);
    db.from("companies").insert({ name: "second" });

    expect(calls.insert[0]).toEqual({
      method: "insert",
      args: [{ name: "first", organization_id: ORG_A }],
    });
    expect(calls.insert[1]).toEqual({
      method: "insert",
      args: [{ name: "second", organization_id: ORG_B }],
    });
  });

  it("bulk insert: bloqueia se QUALQUER item tentar org diferente após switch", () => {
    setActiveOrgId(ORG_B);
    expect(() =>
      db.from("companies").insert([
        { name: "ok" }, // será injetado com B
        { name: "bad", organization_id: ORG_A }, // estoura
      ]),
    ).toThrow(OrgMismatchError);
    expect(calls.insert).toEqual([]);
  });
});
