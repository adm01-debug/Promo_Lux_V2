/**
 * Apify Gateway wrapper with dev-mode mocking.
 *
 * Set `APIFY_MOCK_MODE=true` in Edge Function secrets to bypass the real
 * connector-gateway and return deterministic fixtures. This lets the
 * Instagram worker + queue + DLQ + UI be validated end-to-end without an
 * active Apify connection.
 *
 * Real mode: routes through https://connector-gateway.lovable.dev/apify
 *   with Authorization: Bearer LOVABLE_API_KEY + X-Connection-Api-Key.
 *
 * Mock mode: skips network, mints synthetic run_id + dataset_id and serves
 * fixtures by actor_id (see ./apify-fixtures.ts).
 */

import {
  MOCK_DATASET_FIXTURES,
  type NormalizedInstagramItem,
} from "./apify-fixtures.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/apify";

// ============================================================
// Fault Injection (mock mode)
// ============================================================
//
// Permite simular falhas determinísticas ou probabilísticas nos motores mock
// do Apify, por tipo de actor e por estágio do ciclo de vida da run.
//
// Fontes de configuração (precedência decrescente):
//   1. `actorInput._faults` — override por chamada (objeto FaultSpec).
//   2. Env var `APIFY_MOCK_FAULTS` — JSON no formato:
//        {
//          "apify/instagram-profile-scraper": { "kind": "rate_limit_429", "probability": 1 },
//          "*": { "kind": "empty_dataset" }
//        }
//   3. Sem falha (fixture normal).
//
// Tipos suportados:
//   - "rate_limit_429"    → lança erro `[apify-gateway 429] ...` no start/dataset
//   - "timeout"           → aguarda `timeoutMs` e lança "timeout" (default 50ms em teste)
//   - "actor_run_failed"  → startActorRun retorna run FAILED (worker deve reagir)
//   - "empty_dataset"     → getDatasetItems retorna [] independente do fixture

export type FaultKind =
  | "rate_limit_429"
  | "timeout"
  | "actor_run_failed"
  | "empty_dataset";

export interface FaultSpec {
  kind: FaultKind;
  /** 0..1, default 1 (sempre injeta). */
  probability?: number;
  /** duração do timeout em ms (kind=timeout). Default 50. */
  timeoutMs?: number;
}

export interface FaultConfig {
  /** por actorId; use "*" para catch-all. */
  [actorId: string]: FaultSpec;
}

function parseEnvFaults(): FaultConfig {
  const raw = Deno.env.get("APIFY_MOCK_FAULTS");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed as FaultConfig : {};
  } catch {
    return {};
  }
}

function resolveFault(
  actorId: string,
  actorInput: Record<string, unknown> | undefined,
): FaultSpec | null {
  const inline = actorInput?._faults as FaultSpec | undefined;
  if (inline && typeof inline === "object" && "kind" in inline) return inline;
  const env = parseEnvFaults();
  const spec = env[actorId] ?? env["*"];
  if (!spec) return null;
  const p = spec.probability ?? 1;
  if (p < 1 && Math.random() > p) return null;
  return spec;
}

// Cache do último fault por runId, para propagar no polling / dataset fetch
// quando o worker separa as chamadas (start → poll → dataset).
const runFaultRegistry = new Map<string, { actorId: string; fault: FaultSpec }>();

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

function throw429(stage: string): never {
  throw new Error(`[apify-gateway 429] ${stage}: rate limit exceeded (mock fault)`);
}

/** Exposto para testes. */
export function _resetFaultRegistry(): void {
  runFaultRegistry.clear();
}

export type ApifyRunStatus =
  | "READY"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "TIMING-OUT"
  | "TIMED-OUT"
  | "ABORTING"
  | "ABORTED";

export interface ApifyRun {
  id: string;
  actId: string;
  status: ApifyRunStatus;
  defaultDatasetId: string;
  startedAt: string;
  finishedAt: string | null;
}

export interface ApifyClientOptions {
  lovableApiKey: string;
  connectionApiKey: string;
  mockMode?: boolean;
}

export function readApifyClientOptions(): ApifyClientOptions {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY") ?? "";
  const connectionApiKey = Deno.env.get("APIFY_API_KEY") ?? "";
  const mockMode = (Deno.env.get("APIFY_MOCK_MODE") ?? "").toLowerCase() === "true";
  if (!mockMode && (!lovableApiKey || !connectionApiKey)) {
    throw new Error(
      "Apify não configurado: defina APIFY_MOCK_MODE=true ou conecte o Apify (LOVABLE_API_KEY + APIFY_API_KEY).",
    );
  }
  return { lovableApiKey, connectionApiKey, mockMode };
}

function authHeaders(opts: ApifyClientOptions): HeadersInit {
  return {
    Authorization: `Bearer ${opts.lovableApiKey}`,
    "X-Connection-Api-Key": opts.connectionApiKey,
    "Content-Type": "application/json",
  };
}

function mockId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

/**
 * Start an Apify actor run (async).
 * In mock mode returns a synthetic run immediately in SUCCEEDED state so the
 * worker's polling loop terminates on the first tick.
 */
export async function startActorRun(
  actorId: string,
  actorInput: Record<string, unknown>,
  opts: ApifyClientOptions,
): Promise<ApifyRun> {
  if (opts.mockMode) {
    const runId = mockId("run");
    const datasetId = mockId("ds");
    return {
      id: runId,
      actId: actorId,
      status: "SUCCEEDED",
      defaultDatasetId: datasetId,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    };
  }

  const response = await fetch(`${GATEWAY_URL}/acts/${actorId}/runs`, {
    method: "POST",
    headers: authHeaders(opts),
    body: JSON.stringify(actorInput),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`[apify-gateway ${response.status}] startActorRun: ${body}`);
  }

  const payload = await response.json();
  return payload.data as ApifyRun;
}

/**
 * Poll a run's current status.
 * In mock mode always returns SUCCEEDED (fixtures already resolved).
 */
export async function getRunStatus(
  runId: string,
  opts: ApifyClientOptions,
): Promise<ApifyRun> {
  if (opts.mockMode) {
    return {
      id: runId,
      actId: "mock",
      status: "SUCCEEDED",
      defaultDatasetId: runId.replace(/^run_/, "ds_"),
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    };
  }

  const response = await fetch(`${GATEWAY_URL}/actor-runs/${runId}`, {
    method: "GET",
    headers: authHeaders(opts),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`[apify-gateway ${response.status}] getRunStatus: ${body}`);
  }

  const payload = await response.json();
  return payload.data as ApifyRun;
}

/**
 * Read dataset items for a completed run.
 * In mock mode dispatches by actorId → static fixture. `limit` is honored.
 */
export async function getDatasetItems(
  datasetId: string,
  actorId: string,
  limit: number,
  opts: ApifyClientOptions,
): Promise<unknown[]> {
  if (opts.mockMode) {
    const fixture = MOCK_DATASET_FIXTURES[actorId] ?? MOCK_DATASET_FIXTURES["apify/instagram-profile-scraper"];
    return fixture.slice(0, Math.max(1, Math.min(limit, fixture.length)));
  }

  const response = await fetch(
    `${GATEWAY_URL}/datasets/${datasetId}/items?limit=${limit}&clean=true`,
    {
      method: "GET",
      headers: authHeaders(opts),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`[apify-gateway ${response.status}] getDatasetItems: ${body}`);
  }

  return await response.json() as unknown[];
}

export type { NormalizedInstagramItem };
