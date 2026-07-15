import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LUSHA_API_KEY = "07668666-792b-42bd-a933-b16a74bd10cf";
const LUSHA_API_URL = "https://api.lusha.com/v3/contacts/decision-makers";
const FUNCTION_NAME = "lusha-decision-makers";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Logger estruturado (JSON em stdout — consumido pelo Edge Function Logs) ──
type LogLevel = "debug" | "info" | "warn" | "error";
function log(level: LogLevel, correlationId: string, event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    fn: FUNCTION_NAME,
    correlation_id: correlationId,
    event,
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

// ── Helpers de normalização defensiva para payload V3 parcial ──
const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v : null;
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const arrStr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0) : [];
const bool = (v: unknown): boolean => v === true;

function errorResponse(
  correlationId: string,
  status: number,
  code: string,
  message: string,
  detail?: unknown
) {
  return new Response(
    JSON.stringify({
      error: { code, message, detail: detail ?? null },
      correlation_id: correlationId,
    }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const correlationId =
    req.headers.get("x-correlation-id") ?? crypto.randomUUID();
  const startedAt = Date.now();
  const warnings: Array<{ scope: string; reason: string; ref?: string }> = [];

  try {
    // ── 1. Parse do body (tolerante) ──
    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      log("warn", correlationId, "invalid_json_body", { detail: (e as Error).message });
      return errorResponse(correlationId, 400, "invalid_json", "Body inválido: JSON esperado");
    }

    const {
      domains,
      bitrix_card_id,
      cache_ttl_hours,
      force_refresh,
      company_linkedin_url,
    } = body ?? {};
    const companyLinkedinUrl = str(company_linkedin_url);
    if (!Array.isArray(domains) || domains.length === 0) {
      return errorResponse(correlationId, 400, "missing_domains", "Campo 'domains' obrigatório (array não vazio)");
    }
    const cleanDomains = Array.from(
      new Set(
        domains
          .filter((d: unknown) => typeof d === "string" && d.trim().length > 0)
          .map((d: string) => d.toLowerCase().trim())
      )
    );
    if (cleanDomains.length === 0) {
      return errorResponse(correlationId, 400, "empty_domains", "Nenhum domínio válido informado");
    }

    const ttlHours = Math.min(Math.max(num(cache_ttl_hours) ?? 24, 0), 720); // 0 desativa, teto 30 dias
    const skipCache = bool(force_refresh) || ttlHours === 0;

    log("info", correlationId, "request_received", {
      domains: cleanDomains.length,
      bitrix_card_id: bitrix_card_id ?? null,
      cache_ttl_hours: ttlHours,
      force_refresh: skipCache,
    });

    // ── Cliente Supabase (reusado para cache + persistência) ──
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase =
      authHeader.startsWith("Bearer ")
        ? createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: authHeader } } }
          )
        : null;

    // ── 2. Cache lookup em public.lusha_contacts (por domínio + org via RLS) ──
    const cachedResults: any[] = [];
    const cacheHitDomains = new Set<string>();
    const cacheStats = { hits: 0, misses: 0, checked: 0 };

    if (supabase && !skipCache) {
      const sinceIso = new Date(Date.now() - ttlHours * 3_600_000).toISOString();
      try {
        const { data: cachedRows, error: cacheErr } = await supabase
          .from("lusha_contacts")
          .select(
            "lusha_company_name, lusha_company_lid, company_type, company_linkedin_followers, company_email_domain, company_locations, lusha_popularity_tier, raw_lusha_payload, linkedin_url, linkedin_followers_count, linkedin_connections_count, linkedin_skills, linkedin_certifications, linkedin_courses, linkedin_awards, x_url, created_at"
          )
          .in("lusha_company_name", cleanDomains)
          .gte("created_at", sinceIso);

        if (cacheErr) {
          log("warn", correlationId, "cache_lookup_failed", { detail: cacheErr.message });
        } else if (cachedRows && cachedRows.length > 0) {
          // Agrupa por domínio
          const byDomain = new Map<string, any[]>();
          for (const row of cachedRows) {
            const d = row.lusha_company_name;
            if (!byDomain.has(d)) byDomain.set(d, []);
            byDomain.get(d)!.push(row);
          }

          for (const [domain, rows] of byDomain.entries()) {
            const head = rows[0];
            const decisionMakers = rows.map((row: any) => {
              // Prefere o payload cru quando disponível (contém todos os campos V3)
              const dm = (row.raw_lusha_payload && typeof row.raw_lusha_payload === "object")
                ? row.raw_lusha_payload
                : {};
              return {
                id: str(dm.id),
                firstName: str(dm.firstName),
                lastName: str(dm.lastName),
                fullName: str(dm.fullName) ?? `${dm.firstName ?? ""} ${dm.lastName ?? ""}`.trim() || null,
                jobTitle: str(dm.jobTitle) ?? "",
                departments: arrStr(dm.departments),
                seniority: str(dm.seniority) ?? "",
                company: str(dm.company) ?? "",
                companyId: str(head.lusha_company_lid),
                location: str(dm.location) ?? "",
                linkedin: str(row.linkedin_url) ?? "",
                hasEmail: bool(dm.hasEmail),
                hasPhone: bool(dm.hasPhone),
                emailCredits: num(dm.emailCredits) ?? 0,
                phoneCredits: num(dm.phoneCredits) ?? 0,
                linkedinFollowersCount: num(row.linkedin_followers_count),
                linkedinConnectionsCount: num(row.linkedin_connections_count),
                linkedinSkills: arrStr(row.linkedin_skills),
                linkedinCertifications: arrStr(row.linkedin_certifications),
                linkedinCourses: arrStr(row.linkedin_courses),
                linkedinAwards: arrStr(row.linkedin_awards),
                xUrl: str(row.x_url),
              };
            });

            cachedResults.push({
              domain,
              companyId: str(head.lusha_company_lid),
              companyType: str(head.company_type),
              companyLinkedinFollowers: num(head.company_linkedin_followers),
              companyEmailDomain: str(head.company_email_domain),
              lushaPopularityTier: str(head.lusha_popularity_tier),
              companyLocations: Array.isArray(head.company_locations)
                ? head.company_locations
                : [],
              clientReferenceId: null,
              total: decisionMakers.length,
              decisionMakers,
              fromCache: true,
              cachedAt: head.created_at,
            });
            cacheHitDomains.add(domain);
          }
        }
      } catch (cacheThrow) {
        log("warn", correlationId, "cache_exception", { detail: (cacheThrow as Error).message });
      }
    }

    const pendingDomains = cleanDomains.filter((d) => !cacheHitDomains.has(d));
    cacheStats.checked = cleanDomains.length;
    cacheStats.hits = cacheHitDomains.size;
    cacheStats.misses = pendingDomains.length;

    log("info", correlationId, "cache_summary", cacheStats);

    // Se tudo veio do cache, pula Lusha por completo
    let data: any = { requestId: null, results: [] };
    if (pendingDomains.length > 0) {
      const companies = pendingDomains.map((domain, idx) => ({
        domain,
        clientReferenceId: bitrix_card_id ? `${bitrix_card_id}-${idx}` : `req-${idx}`,
      }));

      // ── 3. Chamada Lusha V3 (apenas domínios sem cache) ──
      let lushaResp: Response;
      try {
        lushaResp = await fetch(LUSHA_API_URL, {
          method: "POST",
          headers: {
            "x-api-key": LUSHA_API_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({ companies }),
        });
      } catch (fetchErr) {
        log("error", correlationId, "lusha_fetch_failed", { detail: (fetchErr as Error).message });
        return errorResponse(correlationId, 502, "lusha_unreachable", "Falha ao contatar Lusha", (fetchErr as Error).message);
      }

      if (!lushaResp.ok) {
        const errText = await lushaResp.text().catch(() => "");
        log("error", correlationId, "lusha_error_status", {
          status: lushaResp.status,
          detail: errText.slice(0, 500),
        });
        return errorResponse(
          correlationId,
          lushaResp.status,
          "lusha_api_error",
          `Lusha retornou status ${lushaResp.status}`,
          errText
        );
      }

      try {
        data = await lushaResp.json();
      } catch (e) {
        log("error", correlationId, "lusha_invalid_json", { detail: (e as Error).message });
        return errorResponse(correlationId, 502, "lusha_invalid_json", "Resposta Lusha não é JSON válido");
      }
    } else {
      log("info", correlationId, "cache_full_hit_skipping_lusha", {});
    }

    // ── 3. Normalização defensiva por item / DM (tolerante a nulls V3) ──
    const results: any[] = [];
    const rawResults = Array.isArray(data?.results) ? data.results : [];

    for (const item of rawResults) {
      const itemDomain = str(item?.domain) ?? "unknown";

      if (item?.error) {
        warnings.push({
          scope: "company",
          reason: str(item?.error?.code) ?? "lusha_item_error",
          ref: itemDomain,
        });
        results.push({
          domain: itemDomain,
          clientReferenceId: str(item?.clientReferenceId),
          error: str(item?.error?.code) ?? "unknown_error",
          decisionMakers: [],
        });
        continue;
      }

      const rawDMs = Array.isArray(item?.decisionMakers) ? item.decisionMakers : [];
      const decisionMakers: any[] = [];

      for (const dm of rawDMs) {
        try {
          if (!dm || typeof dm !== "object") {
            warnings.push({ scope: "dm", reason: "not_object", ref: itemDomain });
            continue;
          }
          const firstName = str(dm.firstName) ?? "";
          const lastName = str(dm.lastName) ?? "";
          const fullName = `${firstName} ${lastName}`.trim();
          if (!fullName) {
            warnings.push({ scope: "dm", reason: "missing_name", ref: str(dm.id) ?? itemDomain });
          }

          const canReveal = Array.isArray(dm.canReveal) ? dm.canReveal : [];
          const hasArr = Array.isArray(dm.has) ? dm.has : [];

          decisionMakers.push({
            id: str(dm.id),
            firstName: firstName || null,
            lastName: lastName || null,
            fullName: fullName || null,
            jobTitle: str(dm.jobTitle?.title) ?? "",
            departments: arrStr(dm.jobTitle?.departments),
            seniority: str(dm.jobTitle?.seniority) ?? "",
            company: str(dm.company?.name) ?? "",
            companyId: str(item?.companyId),
            location: str(dm.location?.country) ?? "",
            linkedin: str(dm.socialLinks?.linkedin) ?? "",
            hasEmail: hasArr.includes("emails"),
            hasPhone: hasArr.includes("phones"),
            emailCredits:
              num(canReveal.find((r: any) => r?.field === "emails")?.credits) ?? 0,
            phoneCredits:
              num(canReveal.find((r: any) => r?.field === "phones")?.credits) ?? 0,
            linkedinFollowersCount: num(dm.linkedinFollowersCount),
            linkedinConnectionsCount: num(dm.linkedinConnectionsCount),
            linkedinSkills: arrStr(dm.linkedinSkills),
            linkedinCertifications: arrStr(dm.linkedinCertifications),
            linkedinCourses: arrStr(dm.linkedinCourses),
            linkedinAwards: arrStr(dm.linkedinAwards),
            xUrl: str(dm.socialLinks?.xUrl),
          });
        } catch (mapErr) {
          warnings.push({
            scope: "dm",
            reason: `map_failed:${(mapErr as Error).message}`,
            ref: str(dm?.id) ?? itemDomain,
          });
        }
      }

      results.push({
        domain: itemDomain,
        companyId: str(item?.companyId),
        companyType: str(item?.company?.companyType),
        companyLinkedinFollowers: num(item?.company?.linkedinFollowers),
        companyEmailDomain: str(item?.company?.emailDomain),
        lushaPopularityTier: str(item?.company?.lushaPopularityTier),
        companyLocations: Array.isArray(item?.company?.companyLocations)
          ? item.company.companyLocations
          : [],
        clientReferenceId: str(item?.clientReferenceId),
        total: decisionMakers.length,
        decisionMakers,
      });
    }

    // ── Merge: resultados frescos + cache ──
    for (const cached of cachedResults) {
      results.push(cached);
    }

    const totalDMs = results.reduce(
      (acc: number, r: any) => acc + (r.decisionMakers?.length || 0),
      0
    );
    log("info", correlationId, "normalization_done", {
      companies: results.length,
      total_decision_makers: totalDMs,
      warnings: warnings.length,
      from_cache: cachedResults.length,
    });

    // ── 4. Persistência em public.lusha_contacts (apenas resultados frescos) ──
    const persistence: {
      attempted: number;
      upserted: number;
      skipped: number;
      errors: string[];
    } = { attempted: 0, upserted: 0, skipped: 0, errors: [] };

    if (supabase) {
      try {
        const rows: Record<string, unknown>[] = [];
        for (const r of results) {
          if (r.error || r.fromCache) continue; // não regrava cache
          for (const dm of r.decisionMakers as any[]) {
            persistence.attempted++;
            if (!dm.linkedin) {
              persistence.skipped++;
              continue;
            }
            rows.push({
              lusha_company_name: r.domain,
              lusha_company_lid: r.companyId ?? null,
              full_name:
                dm.fullName ||
                `${dm.firstName ?? ""} ${dm.lastName ?? ""}`.trim() ||
                "Desconhecido",
              job_title: dm.jobTitle || null,
              department_en: dm.departments?.[0] ?? null,
              seniority: dm.seniority || null,
              linkedin_url: dm.linkedin,
              enrichment_status: "pending",
              bitrix_card_id: bitrix_card_id ?? null,
              confidence_score: 60,
              raw_lusha_payload: dm,
              linkedin_followers_count: dm.linkedinFollowersCount,
              linkedin_connections_count: dm.linkedinConnectionsCount,
              linkedin_skills: dm.linkedinSkills?.length ? dm.linkedinSkills : null,
              linkedin_certifications: dm.linkedinCertifications?.length
                ? dm.linkedinCertifications
                : null,
              linkedin_courses: dm.linkedinCourses?.length ? dm.linkedinCourses : null,
              linkedin_awards: dm.linkedinAwards?.length ? dm.linkedinAwards : null,
              x_url: dm.xUrl ?? null,
              company_locations: r.companyLocations?.length ? r.companyLocations : null,
              company_type: r.companyType ?? null,
              company_linkedin_followers: r.companyLinkedinFollowers ?? null,
              company_email_domain: r.companyEmailDomain ?? null,
              company_linkedin_url: companyLinkedinUrl,
              lusha_popularity_tier: r.lushaPopularityTier ?? null,
            });
          }
        }

        if (rows.length > 0) {
          const { error: upsertErr, count } = await supabase
            .from("lusha_contacts")
            .upsert(rows, {
              onConflict: "organization_id,linkedin_url",
              ignoreDuplicates: false,
              count: "exact",
            });
          if (upsertErr) {
            log("error", correlationId, "persistence_upsert_failed", {
              detail: upsertErr.message,
              rows: rows.length,
            });
            persistence.errors.push(upsertErr.message);
          } else {
            persistence.upserted = count ?? rows.length;
            log("info", correlationId, "persistence_ok", {
              upserted: persistence.upserted,
              skipped: persistence.skipped,
              attempted: persistence.attempted,
            });
          }
        }
      } catch (persistErr) {
        log("error", correlationId, "persistence_exception", {
          detail: (persistErr as Error).message,
        });
        persistence.errors.push((persistErr as Error).message);
      }
    } else {
      log("warn", correlationId, "no_auth_header", {});
      persistence.errors.push("no_auth_header_skipping_persistence");
    }

    const durationMs = Date.now() - startedAt;
    log("info", correlationId, "request_completed", {
      duration_ms: durationMs,
      total_decision_makers: totalDMs,
      persistence,
      cache: cacheStats,
    });

    return new Response(
      JSON.stringify({
        correlation_id: correlationId,
        requestId: str(data?.requestId),
        creditsCharged: 0,
        duration_ms: durationMs,
        results,
        totalDecisionMakers: totalDMs,
        warnings,
        persistence,
        cache: {
          ...cacheStats,
          ttl_hours: ttlHours,
          force_refresh: skipCache,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    log("error", correlationId, "unhandled_exception", {
      detail: (err as Error).message,
      stack: (err as Error).stack?.split("\n").slice(0, 5).join("\n"),
    });
    return errorResponse(
      correlationId,
      500,
      "internal_error",
      "Erro interno na função",
      (err as Error).message
    );
  }
});
