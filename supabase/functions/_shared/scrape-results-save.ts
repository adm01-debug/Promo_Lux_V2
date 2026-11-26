// ============================================================================
// _shared/scrape-results-save.ts
//
// Grava o resultado de uma raspagem do Google Maps: upsert em `companies` e
// uma linha crua por resultado em `scrape_results`.
//
// Antes este laco vivia so dentro de `gmaps-proxy` (action=sync-results). Quando
// o provedor externo cai e a Places API assume (`scrape-queue-worker` ->
// `completeWithPlacesFallback`), o job era marcado como concluido com
// `results_count` preenchido e NENHUMA empresa gravada: o usuario via "20
// resultados" no job e a lista de empresas vazia, sem erro nenhum.
//
// Por isso a gravacao vive aqui, e os dois caminhos usam exatamente o mesmo
// codigo.
// ============================================================================
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mapGmapsRow, type RawGmapsRow } from "./gmaps-mapper.ts";
import { upsertCompanies, type UpsertStrategy } from "./companies-upsert.ts";
import {
  calculateIPCScore,
  type IPCHittingCriteria,
} from "./domain/ipc/scoring.ts";

export interface SaveScrapeResultsOptions {
  organizationId: string;
  /** Autor das empresas/resultados (`null` quando a tarefa nao tem usuario). */
  userId: string | null;
  /**
   * Job dono dos resultados. Sem ele as empresas sao gravadas mas nenhuma
   * linha entra em `scrape_results` (a coluna `job_id` e NOT NULL).
   */
  jobId?: string | null;
  rows: RawGmapsRow[];
  /** Valor gravado em `companies.source`. Default `gmaps`. */
  source?: string;
  /** Criteria de `ipc_config`; ver `loadIpcCriteria`. */
  ipcCriteria?: IPCHittingCriteria;
  /** Chamado a cada linha recusada pelo banco (para o log do chamador). */
  onRowError?: (error: { message: string }, name: string) => void;
}

export interface SaveScrapeResultsOutcome {
  /** Empresas efetivamente gravadas. */
  saved: number;
  /** Linhas recusadas pelo banco. */
  failed: number;
  /** Chave de conflito usada no ultimo upsert bem-sucedido. */
  strategy: UpsertStrategy | null;
}

/** Le a configuracao de IPC ativa do usuario (entra no `ipc_score`). */
export async function loadIpcCriteria(
  supabase: SupabaseClient,
  userId: string | null,
): Promise<IPCHittingCriteria | undefined> {
  if (!userId) return undefined;
  const { data } = await supabase
    .from("ipc_config")
    .select("*")
    .eq("is_active", true)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data?.criteria as IPCHittingCriteria | undefined;
}

/**
 * Grava `rows` e devolve a contagem. Nao lanca por linha recusada: o chamador
 * decide o que fazer quando `saved` fica em 0 (job sem resultado de verdade).
 */
export async function saveScrapeResults(
  supabase: SupabaseClient,
  options: SaveScrapeResultsOptions,
): Promise<SaveScrapeResultsOutcome> {
  const { organizationId, userId, jobId = null, rows, ipcCriteria } = options;
  const source = options.source ?? "gmaps";
  let saved = 0;
  let failed = 0;
  let strategy: UpsertStrategy | null = null;

  for (const rawRow of rows ?? []) {
    const mapped = mapGmapsRow(rawRow);
    const ipcScore = calculateIPCScore(
      {
        category: mapped.sector,
        address: mapped.location,
        email: mapped.email,
        phone: mapped.phone,
        website: mapped.website,
        rating: mapped.rating ?? undefined,
      },
      ipcCriteria,
    );

    // G9: deduplicacao por place_id quando disponivel (o Google garante
    // unicidade global); senao cai no par legado (org, name, source). A escolha
    // da chave e o fallback vivem em upsertCompanies: o schema de producao pode
    // estar com indice unico PARCIAL, que o PostgREST recusa em ON CONFLICT
    // (42P10) e fazia o lote inteiro ser descartado.
    //
    // organization_id vem do job (nao do DEFAULT da coluna): o client
    // service_role nao repassa Authorization, entao auth.uid() e NULL.
    const payload = {
      user_id: userId,
      organization_id: organizationId,
      name: mapped.name,
      sector: mapped.sector,
      location: mapped.location,
      website: mapped.website,
      phone: mapped.phone,
      email: mapped.email,
      source,
      ipc_score: ipcScore,
      enriched: !!(mapped.email || mapped.phone),
      raw_data: rawRow,
      latitude: mapped.latitude,
      longitude: mapped.longitude,
      place_id: mapped.place_id,
      cid: mapped.cid,
      plus_code: mapped.plus_code,
      google_maps_url: mapped.google_maps_url,
      street_view_url: mapped.street_view_url,
      rating: mapped.rating,
      review_count: mapped.review_count,
      price_range: mapped.price_range,
      business_status: mapped.business_status,
      thumbnail_url: mapped.thumbnail_url,
      images: mapped.images,
      open_hours: mapped.open_hours,
      popular_times: mapped.popular_times,
      timezone: mapped.timezone,
      descriptions: mapped.descriptions,
      owner_claimed: mapped.owner_claimed,
      reservations_url: mapped.reservations_url,
      order_online_url: mapped.order_online_url,
      menu_url: mapped.menu_url,
    };

    const {
      data: upserted,
      error,
      strategy: usedStrategy,
    } = await upsertCompanies<{ id: string }>(supabase, payload, {
      hasPlaceId: !!mapped.place_id,
    });

    if (error) {
      failed++;
      options.onRowError?.(error, mapped.name);
      continue;
    }

    strategy = usedStrategy;
    const company = upserted[0];
    if (!company) continue;

    saved++;
    if (jobId) {
      await supabase.from("scrape_results").insert({
        user_id: userId,
        organization_id: organizationId,
        job_id: jobId,
        company_id: company.id,
        raw_data: rawRow,
        processed: true,
      });
    }
  }

  return { saved, failed, strategy };
}
