# Dimensão 2 — Backend / Edge Functions

> Anexo de [`../ESTADO_ATUAL.md`](../ESTADO_ATUAL.md) · Commit `890c18d` · 2026-08-16
> **Método:** enumeração de 100% das 57 Edge Functions em `supabase/functions/`, cruzadas com (a) chamadores no frontend, (b) `cron.job.command` lido do banco, (c) tabela de evidência de execução real.

**Escopo medido:** 335 arquivos / 31.758 linhas em `supabase/`. Maior function: `lusha-decision-makers` (761 L). Menor: `mcp` (8 L).

**Total: 57 itens** — ✅ 12 · 🟨 33 · 🟦 9 · ⬛ 3

---

## 1. Como "quem chama" foi determinado

Três fontes, porque nenhuma sozinha é suficiente:

1. **Frontend:** `grep` por nome da function em `src/` (aceitando `invoke("x")`, `invoke('x')` e URLs `/x`). O padrão estreito `functions.invoke(...)` sozinho encontrou apenas 13 de 57 — **descartei-o por falso-negativo**.
2. **Cron:** `select substring(command from 'functions/v1/([a-z0-9-]+)') from cron.job`. **Importante:** `grep` nas migrations do repo encontrou **zero** agendamentos — os 30 jobs existem **apenas no banco**, nunca foram versionados. Isso é sintoma do risco R3 (ambiente não reconstruível).
3. **Evidência de execução:** tabela que a function escreve, com contagem de linhas real.

---

## 2. Functions com cron ativo (17)

Sucessos/falhas de `cron.job_run_details`, janela até 2026-08-16 18:56 UTC.

| # | Function | jobid · schedule | Execuções | Tabela de evidência | Classe |
|---:|---|---|---|---|:---:|
| 1 | `scrape-queue-worker` | 22 · `* * * * *` | **24.919 ok / 0** | `scrape_queue` 32 | ✅ |
| 2 | `gmaps-proxy` | 28 · `* * * * *` | **24.919 ok / 0** | `scrape_jobs` 1, `companies` 5 | ✅ |
| 3 | `web-scrape-worker` | 30 · `30 seconds` | **49.811 ok / 0** | `web_scrape_queue` **0** | 🟨 Flag `web_scrape_enabled=false`. Roda a cada 30s **para não fazer nada** |
| 4 | `cnpj-enrich-worker` | 17 · `*/2 * * * *` | **12.460 ok / 0** | `cnpj_enrich_queue` **0**, `cnpj_enrich_cache` **0** | 🟨 Nunca enriqueceu um CNPJ |
| 5 | `circuit-breaker-alerts` | 16 · `*/5 * * * *` | 4.984 ok / 0 | `circuit_breaker_snapshots` 40, `..._alert_history` 1 | ✅ |
| 6 | `email-poll-replies` | 19 · `*/5 * * * *` | 4.984 ok / 0 | `email_sync_log` **0**, `campaign_replies` **0** | 🟨 `email_accounts` = 0 → não há caixa para consultar |
| 7 | `campaign-dispatch` | 15 · `*/10 * * * *` | 2.492 ok / 0 | `campaign_messages` **0** | 🟨 Roda há 30 dias sem enviar mensagem |
| 8 | `dlq-alerts` | 18 · `*/15 * * * *` | 1.661 ok / 0 | `dlq_alert_history` **0** | 🟨 Lê `dlq_health_snapshots`, que está **sempre vazia** (§R4) |
| 9 | `latency-alerts` | 20 · `*/15 * * * *` | 1.661 ok / 0 | `api_latency_alert_history` **0** | 🟨 `api_latency_snapshots` = 0 |
| 10 | `pg-net-watchdog` | 21 · `*/30 * * * *` | 830 ok / 0 | `pg_net_health_snapshots` **0** | 🟨 Executa sem registrar |
| 11 | `reaper-alerts` | 24 · `*/30 * * * *` | 830 ok / 0 | `reaper_alert_history` **0** | 🟨 |
| 12 | `sla-alerts` | 26 · `7 * * * *` | 415 ok / 0 | `sla_alert_history` **0** | 🟨 |
| 13 | `vault-cookie-health` | 29 · `0 9 * * *` | 17 ok / 0 | `vault_cookie_snapshots` 51, `..._alert_history` 33 | ✅ |
| 14 | `purge-soft-deleted` | 23 · `0 3 * * *` | 17 ok / 0 | expurgo diário | ✅ |
| 15 | `retry-policy-tuner` | 25 · `0 3 * * *` | 17 ok / 0 | `retry_policy_advisories` **0** | 🟨 |
| 16 | `sla-auto-tune` | 27 · `20 4 * * *` | 17 ok / 0 | `sla_autotune_runs` **0** | 🟨 |
| 17 | `admin-list-companies` | — (via `/admin/companies`) | — | `companies` 5 | ✅ |

**Padrão:** 6 functions de **alerta** (`dlq-alerts`, `latency-alerts`, `reaper-alerts`, `sla-alerts`, `retry-policy-tuner`, `sla-auto-tune`) executam com sucesso e **nunca gravaram uma linha**. É exatamente a armadilha prevista: automações agendadas que falham sem erro visível.

---

## 3. Functions chamadas pelo frontend (25)

| # | Function | Linhas | Chamador | Evidência | Classe |
|---:|---|---:|---|---|:---:|
| 18 | `workflow-engine` | 706 | `WorkflowsView` | `workflow_runs` 23 | ✅ |
| 19 | `webhook-dispatcher` | 184 | `WebhooksPanel` | `webhook_deliveries` **63** | ✅ |
| 20 | `rls-tests` | 478 | `RLSDiscoveryView` | 255 policies, 95/95 RLS | ✅ |
| 21 | `auth-rate-limit` | 124 | `useLoginForm` | `auth_rate_limits` 2 | ✅ |
| 22 | `cnpj-settings-status` | 74 | `CnpjSettingsPage` | leitura de config | ✅ |
| 23 | `lusha-search` | 579 | `LushaIntelligenceView` | `lusha_contacts` 12, `lusha_search_sessions` 1 | ✅ |
| 24 | `ai-agent` | 200 | `AIAgentView` (10 refs) | `agent_chat_messages` **0** | 🟨 |
| 25 | `lusha-reveal` | 315 | `lusha/` | `lusha_credit_usage_log` **0** | 🟨 |
| 26 | `lusha-decision-makers` | 761 | `lusha/` | `lusha_dm_search_history` **0** | 🟨 |
| 27 | `lusha-cookie-health` | 172 | monitoring | `vault_cookie_snapshots` 51 | 🟨 |
| 28 | `oracle-search-decisors` | 737 | `useOracleV2` | `oracle_rate_limits` **0** | 🟨 |
| 29 | `oracle-enrich-contact` | 352 | `useOracleV2` | — | 🟨 |
| 30 | `oracle-push-bitrix` | 404 | `useOracleV2` | sem tabela de confirmação de push | 🟨 |
| 31 | `oracle-cookies-preflight` | 229 | `useOracleV2` | — | 🟨 |
| 32 | `cnpj-enrich` | 243 | `useCnpjEnrich` | `cnpj_enrich_cache` **0** | 🟨 |
| 33 | `email-oauth-connect` | 154 | `EmailAccountsPanel` | `email_accounts` **0** | 🟨 |
| 34 | `email-oauth-callback` | 146 | `EmailAccountsPanel` | `email_accounts` **0** | 🟨 |
| 35 | `email-oauth-disconnect` | 129 | `EmailAccountsPanel` | `email_accounts` **0** | 🟨 |
| 36 | `instagram-connection-status` | 128 | `InstagramConnectionPanel` | `instagram_scrape_*` **0** | 🟨 |
| 37 | `instagram-dlq-replay` | 89 | monitoring | `instagram_scrape_dead_letter` **0** | 🟨 |
| 38 | `web-scrape-enqueue` | 130 | `useWebScrape` | `web_scrape_queue` **0**; flag off | 🟨 |
| 39 | `web-scrape-extract` | 114 | `useWebScrape` | flag `web_scrape_extract_enabled=false` | 🟨 |
| 40 | `web-scrape-status` | 50 | `useWebScrape` | `web_scrape_results` **0** | 🟨 |
| 41 | `web-dlq-replay` | 88 | `useDlqReplay` | `web_scrape_dead_letter` **0** | 🟨 |
| 42 | `org-violation-alerts` | 257 | `OrgViolationsView` | `org_violation_alerts` **0** | 🟨 |
| 43 | `public-api` | 251 | `ApiDocsCard` | `api_keys` **0**, `api_request_logs` **0** | 🟨 |
| 44 | `qa-ingest-run` | 109 | monitoring | `qa_test_runs` **0** (mas `qa_reaper_runs` 24.841) | 🟨 |
| 45 | `mcp` | 8 | 7 refs no front | stub de 8 linhas | 🟨 |

---

## 4. Sem nenhum chamador — 🟦 e ⬛ (15)

Cada linha abaixo foi verificada individualmente contra falso-negativo, porque o prompt alerta que endossar lista de código morto sem testar o critério leva alguém a apagar código vivo.

### 🟦 SUGERIDO_OU_INICIADO (9) — existe, mas o fio nunca foi ligado

| # | Function | Linhas | Por que não funciona | Verificação anti-falso-negativo |
|---:|---|---:|---|---|
| 46 | `track-open` | 68 | **Ninguém gera a URL.** `campaign-dispatch` (655 L) tem **zero** ocorrências de `track`/`pixel`/`open`/`click` (`grep -in`) e envia `text/plain` (`index.ts:592`) | Busquei o produtor da URL, não só o consumidor. Única menção fora da própria function: comentário em `_shared/tracking-signature.ts:1` |
| 47 | `track-click` | 70 | idem | idem |
| 48 | `instagram-enqueue` | 145 | Sem cron e sem chamador | Única menção: **texto de documentação** em `InstagramConnectionPanel.tsx:227`, dentro de `<code>` — não é invocação |
| 49 | `instagram-worker` | 197 | idem | `InstagramConnectionPanel.tsx:226`, idem |
| 50 | `instagram-worker-health` | 87 | Sem cron e sem chamador | `instagram_scrape_*` = 0 linhas |
| 51 | `email-verify` | ~250 | **Arquivo em base64** (9.844 bytes, 0 linhas) — não deployável | Decodifica para TS válido (`import { serve } ... zod`) |
| 52 | `deliverability-check` | ~250 | **Arquivo em base64** (9.876 bytes, 0 linhas) | idem |
| 53 | `gmaps-places-search` | 121 | Flag `use_places_api_new = **false**`; `places_api_usage` = **0** | Flag lida direto de `feature_flags` |
| 54 | `health` | 104 | Sem chamador interno | Plausivelmente destinada a monitor externo — **não classifico como morta** por isso |

### ⬛ MORTO_OU_ABANDONADO (3) — nenhum caminho de execução chega

| # | Function | Linhas | Prova de ausência de chamador |
|---:|---|---:|---|
| 55 | `api-latency-alerts` | 124 | `grep` em `src/`, `supabase/`, `scripts/` → **0 ocorrências** fora da própria pasta. Não há cron com esse nome — o job 20 aponta para `latency-alerts`, function **distinta**. Provável refactor abandonado |
| 56 | `audit-logs-prune` | 77 | `grep` → **0**. O expurgo de logs é feito pelo job SQL 12 `daily-log-retention`, que **não** chama esta function |
| 57 | `system-recovery-status` | 61 | `grep` → **0** em todo o repositório |

**Confiança:** alta para as três. Critério é `grep` do nome literal em todo o repositório, insensível à forma de chamada — não depende de casar assinatura de função, que é onde regex de detecção de código morto costuma produzir falso-positivo.

---

## 5. Achado transversal: o tracking de campanha está partido

Vale destacar porque três times poderiam olhar para peças diferentes e cada um concluir que está pronto:

| Peça | Existe? | Evidência |
|---|:---:|---|
| Function que registra abertura | ✅ | `supabase/functions/track-open/index.ts` (68 L) |
| Function que registra clique | ✅ | `supabase/functions/track-click/index.ts` (70 L) |
| Assinatura HMAC anti-phishing dos links | ✅ | `_shared/tracking-signature.ts` + teste `tracking-signature.test.ts` |
| Tabela de eventos | ✅ | `campaign_events` (existe, RLS ativa) |
| UI que exibe as métricas | ✅ | `lux/campaigns/CampaignTrackingDrawer.tsx` |
| **Injeção do pixel / reescrita de links no envio** | ❌ | `campaign-dispatch/index.ts`: **0** ocorrências de `track`, `pixel`, `open`, `click` |
| **Dado real** | ❌ | `campaign_events` = **0 linhas** |

Cinco de sete peças prontas, e o produto não entrega a funcionalidade. Classificação honesta: **🟦, não 🟨** — a capacidade "medir engajamento de campanha" nunca funcionou uma vez.

---

## 6. Lacunas desta dimensão

- **Não executei nenhuma Edge Function.** Deno ausente no ambiente; `supabase_functions_list` via MCP exige `SUPABASE_ACCESS_TOKEN` não configurado. **Não sei quais das 57 estão de fato deployadas** — apenas quais existem no repo e quais são invocadas por cron (que prova deploy indireto, pois o cron retorna sucesso).
- As 33 classificadas 🟨 foram avaliadas por **tabela de evidência vazia**. Isso prova dormência, não prova defeito de lógica.
- **Não li integralmente** as functions acima de 300 linhas; foram inventariadas por chamador, secrets consumidos e tabela escrita.
