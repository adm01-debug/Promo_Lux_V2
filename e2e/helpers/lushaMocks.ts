import type { Page, Route } from "@playwright/test";

/**
 * R33 — Mocks de rede para o módulo Lusha.
 *
 * Interceptam as chamadas do frontend às edges via `page.route()` — evita
 * consumir créditos Lusha reais, isola o teste de flutuações de rede/RLS
 * e permite injetar cenários adversos (lento, 4xx, 5xx, timeout).
 *
 * Convenções:
 * - Todos os helpers recebem `page` e devolvem um objeto com `count()` que
 *   expõe quantas vezes o mock foi atingido (útil para asserts de retry).
 * - Padrões glob (`**/functions/v1/...`) cobrem qualquer origem que o cliente
 *   Supabase compile a partir de `VITE_SUPABASE_URL`.
 */

interface MockHandle {
  count: () => number;
}

function jsonResponse(status: number, body: unknown) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

async function delay(ms: number) {
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
}

// ─── lusha-cookie-health ─────────────────────────────────────────────────
export function mockLushaCookieHealth(page: Page, healthy = true): MockHandle {
  let hits = 0;
  page.route("**/functions/v1/lusha-cookie-health*", async (route: Route) => {
    hits++;
    await route.fulfill(
      jsonResponse(200, {
        healthy,
        last_checked_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
      }),
    );
  });
  return { count: () => hits };
}

// ─── lusha-search ────────────────────────────────────────────────────────
interface SearchOkOptions {
  session_id?: string;
  company_resolved?: string;
  total_found?: number;
  departments_searched?: string[];
  departments_skipped?: string[];
  contacts?: Array<Record<string, unknown>>;
  delayMs?: number;
}

export function mockLushaSearchOk(page: Page, overrides: SearchOkOptions = {}): MockHandle {
  let hits = 0;
  const body = {
    session_id: overrides.session_id ?? "sess-mock-0001",
    company_resolved: overrides.company_resolved ?? "ACME S.A.",
    total_found: overrides.total_found ?? 2,
    departments_searched: overrides.departments_searched ?? ["Vendas", "Marketing"],
    departments_skipped: overrides.departments_skipped ?? [],
    contacts: overrides.contacts ?? [
      {
        id: "c-1",
        full_name: "Ana Vendedora",
        job_title: "Head of Sales",
        department_pt: "Vendas",
        linkedin_url: "https://linkedin.com/in/ana",
        enrichment_status: "pending_enrichment",
        created_at: new Date().toISOString(),
        session_id: overrides.session_id ?? "sess-mock-0001",
      },
      {
        id: "c-2",
        full_name: "Bruno Marketing",
        job_title: "CMO",
        department_pt: "Marketing",
        linkedin_url: "https://linkedin.com/in/bruno",
        enrichment_status: "pending_enrichment",
        created_at: new Date().toISOString(),
        session_id: overrides.session_id ?? "sess-mock-0001",
      },
    ],
  };
  page.route("**/functions/v1/lusha-search", async (route: Route) => {
    hits++;
    await delay(overrides.delayMs ?? 0);
    await route.fulfill(jsonResponse(200, body));
  });
  return { count: () => hits };
}

export function mockLushaSearchError(
  page: Page,
  opts: { status: number; delayMs?: number; error?: string } = { status: 500 },
): MockHandle {
  let hits = 0;
  page.route("**/functions/v1/lusha-search", async (route: Route) => {
    hits++;
    await delay(opts.delayMs ?? 0);
    await route.fulfill(
      jsonResponse(opts.status, { error: opts.error ?? `http_${opts.status}` }),
    );
  });
  return { count: () => hits };
}

export function mockLushaSearchTimeout(page: Page): MockHandle {
  let hits = 0;
  page.route("**/functions/v1/lusha-search", async (route: Route) => {
    hits++;
    await route.abort("timedout");
  });
  return { count: () => hits };
}

// ─── lusha-decision-makers (Oracle v2) ───────────────────────────────────
interface DMOkOptions {
  requestId?: string;
  creditsCharged?: number;
  decisionMakers?: Array<Record<string, unknown>>;
  domain?: string;
  delayMs?: number;
}

export function mockLushaDMOk(page: Page, opts: DMOkOptions = {}): MockHandle {
  let hits = 0;
  const dms = opts.decisionMakers ?? [
    {
      id: "dm-1",
      fullName: "Carla Diretora",
      jobTitle: "CEO",
      departments: ["Executive"],
      seniority: "cxo",
      company: "ACME",
      location: "São Paulo",
      linkedin: "https://linkedin.com/in/carla",
      hasEmail: true,
      hasPhone: true,
      emailCredits: 1,
      phoneCredits: 1,
    },
    {
      id: "dm-2",
      fullName: "Diego CTO",
      jobTitle: "CTO",
      departments: ["Engineering"],
      seniority: "cxo",
      company: "ACME",
      location: "São Paulo",
      linkedin: "https://linkedin.com/in/diego",
      hasEmail: true,
      hasPhone: false,
      emailCredits: 1,
      phoneCredits: 0,
    },
  ];
  page.route("**/functions/v1/lusha-decision-makers", async (route: Route) => {
    hits++;
    await delay(opts.delayMs ?? 0);
    await route.fulfill(
      jsonResponse(200, {
        requestId: opts.requestId ?? "req-mock-1",
        creditsCharged: opts.creditsCharged ?? 0,
        totalDecisionMakers: dms.length,
        results: [
          {
            domain: opts.domain ?? "acme.com",
            companyId: "co-1",
            total: dms.length,
            decisionMakers: dms,
          },
        ],
      }),
    );
  });
  return { count: () => hits };
}

// ─── lusha-reveal ────────────────────────────────────────────────────────
interface RevealOptions {
  status?: number;
  /** Sequência de status: primeira chamada usa [0], segunda [1], etc. */
  sequence?: number[];
  delayMs?: number;
  contactId?: string;
}

export function mockLushaReveal(page: Page, opts: RevealOptions = {}): MockHandle {
  let hits = 0;
  const okBody = (contactId: string) => ({
    requestId: "req-mock-1",
    creditsCharged: 1,
    totalRevealed: 1,
    totalRequested: 1,
    revealed: [
      {
        contactId,
        emailAddresses: [{ email: `${contactId}@acme.com`, type: "work" }],
        phoneNumbers: [{ number: "+5511999998888", type: "mobile" }],
      },
    ],
  });

  page.route("**/functions/v1/lusha-reveal", async (route: Route) => {
    const idx = hits;
    hits++;
    await delay(opts.delayMs ?? 0);

    const status = opts.sequence ? opts.sequence[Math.min(idx, opts.sequence.length - 1)] : (opts.status ?? 200);

    // extrai o primeiro contactId do payload para bater a resposta
    let contactId = opts.contactId ?? "dm-1";
    try {
      const body = route.request().postDataJSON() as { contactIds?: string[] };
      if (body?.contactIds?.[0]) contactId = body.contactIds[0];
    } catch {
      /* ignore */
    }

    if (status >= 200 && status < 300) {
      await route.fulfill(jsonResponse(status, okBody(contactId)));
      return;
    }
    await route.fulfill(jsonResponse(status, { error: `http_${status}` }));
  });
  return { count: () => hits };
}

// ─── REST direto: lusha_search_sessions ──────────────────────────────────
export function mockLushaSessions(page: Page, sessions: Array<Record<string, unknown>>): MockHandle {
  let hits = 0;
  page.route("**/rest/v1/lusha_search_sessions*", async (route: Route) => {
    hits++;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "content-range": `0-${Math.max(sessions.length - 1, 0)}/${sessions.length}` },
      body: JSON.stringify(sessions),
    });
  });
  return { count: () => hits };
}

/** Helper de asserção — falha explícita se um mock nunca foi atingido. */
export function assertMockHit(handle: MockHandle, label: string) {
  if (handle.count() === 0) {
    throw new Error(`[lushaMocks] mock '${label}' não foi atingido durante o teste`);
  }
}
