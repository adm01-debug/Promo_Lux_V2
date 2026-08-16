# Dimensão 3 — Dados e Runtime

> Anexo de [`../ESTADO_ATUAL.md`](../ESTADO_ATUAL.md) · Commit `890c18d` · 2026-08-16
> **Todo este documento é `VERIFICADO` em runtime**, por leitura direta do projeto `pttzwlbidamibjssqiqb`.
> Nenhuma escrita foi feita: apenas `SELECT` e catálogo do PostgreSQL.

**Total: 36 itens** — ✅ 17 · 🟨 18 · 🟦 1 · ⬛ 0

---

## 1. Panorama do banco — VERIFICADO

| Métrica | Valor | Fonte |
|---|---:|---|
| Tamanho total | 181 MB | `pg_database_size` |
| Tabelas em `public` | **95** | `pg_class` / `relkind='r'` |
| Views | 149 | `pg_class` |
| Materialized views | 0 | — |
| Funções | 3.573 | inclui extensões |
| Funções `SECURITY DEFINER` em `public` | **107** | `pg_proc.prosecdef` |
| Triggers | 79 | `pg_trigger` |
| Policies RLS | **255** | `pg_policies` |
| Cron jobs | **30** | `cron.job` |
| Maior tabela | `cron.job_run_details` — 151 MB | histórico de execuções |

**Nota sobre o README:** afirma *"PostgreSQL + RLS — 12 tabelas"*. São **95**. A documentação ficou 8× defasada.

---

## 2. Mecanismos de dados (6 itens)

| # | Mecanismo | Medição | Classe |
|---:|---|---|:---:|
| 1 | **RLS multi-tenant** | **95 de 95** tabelas com `relrowsecurity = true`. Zero tabelas desprotegidas. 255 policies | ✅ |
| 2 | **Soft delete + expurgo** | Cron 23 `purge-soft-deleted-daily`, 17 execuções, 0 falhas | ✅ |
| 3 | **Circuit breakers** | `circuit_breakers` 8, `circuit_breaker_snapshots` 40, `..._alert_history` 1, `..._alert_settings` 1 | ✅ |
| 4 | **Auditoria via trigger** | Apenas **8 de 95** tabelas têm trigger `log_audit_event` (**8,4%**). `audit_logs` = 325 linhas | 🟨 A auditoria anterior afirma *"100% de INSERT/UPDATE auditados"* — **falso** |
| 5 | **Idempotência** | `idempotency_keys` = 3 linhas. Mecanismo existe, uso marginal | 🟨 |
| 6 | **Reprodutibilidade do ambiente** | `supabase_migrations.schema_migrations` **não existe**. 212 migrations no repo, 4 inexecutáveis | 🟦 Ver §5 |

---

## 3. Os 30 cron jobs — todos verificados

Janela: até 2026-08-16 18:56 UTC. Classificação exige **execução com sucesso E tabela de destino com dado**.

### ✅ Saudáveis e produzindo dado (14)

| jobid | Nome | Schedule | ok / falha | Evidência |
|---:|---|---|---|---|
| 30 | `web-scrape-worker-30s` | `30 seconds` | **49.811 / 0** | — (ver 🟨 abaixo: a exceção) |
| 22 | `process-scrape-queue` | `* * * * *` | 24.919 / 0 | `scrape_queue` 32 |
| 28 | `sync-gmaps-jobs` | `* * * * *` | 24.919 / 0 | `scrape_jobs` 1 |
| 11 | `reap-stuck-queue-tasks` | `* * * * *` | 24.884 / 36 | `qa_reaper_runs` **24.841** |
| 1 | `capture-db-health` | `*/5 * * * *` | 4.978 / 6 | `db_health_snapshots` **4.982** |
| 16 | `circuit-breaker-alerts-every-5min` | `*/5 * * * *` | 4.984 / 0 | 40 snapshots |
| 29 | `vault-cookie-health-daily` | `0 9 * * *` | 17 / 0 | 51 snapshots, 33 alertas |
| 7 | `sla-snapshot-daily` | `0 3 * * *` | 17 / 0 | `sla_snapshots` 3 |
| 23 | `purge-soft-deleted-daily` | `0 3 * * *` | 17 / 0 | expurgo |
| 10 | `purge-dead-letter-daily` | `17 3 * * *` | 17 / 0 | expurgo |
| 12 | `daily-log-retention` | `15 3 * * *` | 17 / 0 | retenção |
| 13 | `daily-campaign-logs-retention` | `30 3 * * *` | 17 / 0 | retenção |
| 8 | `prune-dlq-health-snapshots-daily` | `23 3 * * *` | 17 / 0 | expurgo |
| 9 | `prune-api-latency-snapshots-daily` | `29 3 * * *` | 17 / 0 | expurgo |
| 14 | `pg-net-snapshots-prune-weekly` | `0 3 * * 0` | 3 / 0 | expurgo |

> `web-scrape-worker-30s` aparece aqui pela execução impecável, mas está classificado **🟨** no cômputo final: a flag `web_scrape_enabled` está `false` e `web_scrape_queue` tem 0 linhas. Executa 2.880 vezes por dia sem trabalho a fazer.

### 🟨 Executam mas não produzem dado (14)

`campaign-dispatch-10min` (2.492 ok · `campaign_messages` 0) · `cnpj-enrich-worker-every-2min` (12.460 ok · `cnpj_enrich_queue` 0) · `email-poll-replies-5min` (4.984 ok · `email_sync_log` 0) · `dlq-alerts-15min` (1.661 ok · `dlq_alert_history` 0) · `latency-alerts-15min` (1.661 ok · `api_latency_alert_history` 0) · `capture-api-latency-15min` (1.659 ok · `api_latency_snapshots` **0**) · `pg-net-watchdog-30m` (830 ok · `pg_net_health_snapshots` 0) · `reaper-alerts-30min` (830 ok · `reaper_alert_history` 0) · `sla-alerts-hourly` (415 ok · `sla_alert_history` 0) · `round19-web-scrape-regression-1h` (414 ok · tabelas web 0) · `retry-policy-tuner-daily` (17 ok · `retry_policy_advisories` 0) · `sla-auto-tune-daily` (17 ok · `sla_autotune_runs` 0) · `evaluate-partition-policies-daily` (17 ok · `partition_advisories` 0) · `web-scrape-worker-30s` (flag off)

### 🟨 Quebrados de forma sistemática (2) — RISCO R4

| jobid | Nome | ok | **falha** | Taxa |
|---:|---|---:|---:|---:|
| 3 | `capture-dlq-health-hourly` | **0** | **415** | **100%** |
| 4 | `round18-capture-dlq-snapshots-10m` | 6 | **2.486** | 99,8% |

**Mensagem de erro literal** (de `cron.job_run_details.return_message`, 2.483 ocorrências idênticas):

```
ERROR:  insert or update on table "dlq_health_snapshots" violates foreign key
constraint "dlq_health_snapshots_organization_id_fkey"
DETAIL:  Key (organization_id)=(00000000-0000-0000-0000-000000000099)
         is not present in table "organizations".
CONTEXT:  SQL statement "INSERT INTO public.dlq_health_snapshots (...)
          FROM public.scrape_dead_letter d GROUP BY d.organization_id"
PL/pgSQL function capture_dlq_health_snapshots() line 7 at SQL statement
```

**Causa-raiz confirmada por consulta independente:**

```sql
select distinct organization_id,
       exists(select 1 from organizations o where o.id = d.organization_id) as org_existe,
       count(*)
from scrape_dead_letter d group by 1,2;
-- → 00000000-0000-0000-0000-000000000099 | false | 13
```

As **13** linhas da dead-letter queue pertencem a uma organização de teste que não existe. Cadeia de consequências:

`scrape_dead_letter` (13 órfãs) → `capture_dlq_health_snapshots()` **aborta** → `dlq_health_snapshots` **0 linhas** → `dlq-alerts` roda 1.661× sobre tabela vazia e retorna sucesso → `dlq_alert_history` **0 linhas** → **ninguém é avisado de fila morta**.

**Histórico adicional:** entre 2026-07-27 e 2026-07-30 houve uma segunda classe de falha — `function public.capture_db_health_snapshot() does not exist` (6×), `public.reap_stuck_queue_tasks(integer) does not exist` (36×), `capture_dlq_health_snapshots() does not exist` (4×). Cron jobs foram agendados **antes** das funções existirem. Já resolvido para 2 dos 3, mas ilustra que o agendamento não é versionado junto do schema.

---

## 4. Dormência: 58 de 95 tabelas (61,1%) estão vazias

```sql
select count(*) total, count(*) filter (where n=0) vazias,
       round(100.0*count(*) filter (where n=0)/count(*),1) pct
from (...) t;
-- → 95 | 58 | 61.1
```

> **🔧 CORREÇÃO (Errata E3).** O título original era *"…nunca receberam um registro"*. Isso é mais forte do que a evidência sustenta. Medição adicional em `pg_stat_user_tables`:
>
> ```sql
> select count(*) filter (where n_live_tup=0)                  as vazias_hoje,            -- 58
>        count(*) filter (where n_live_tup=0 and n_tup_ins=0)   as nunca_receberam_insert, -- 40
>        count(*) filter (where n_live_tup=0 and n_tup_ins>0)   as tiveram_e_esvaziaram;   -- 18
> ```
>
> **58 vazias hoje · 40 sem nenhum INSERT · 18 tiveram tuplas inseridas.** E os contadores têm ressalvas que importam:
> - As estatísticas foram **resetadas em 2026-07-15**. "Sem INSERT" cobre ~1 mês, não a vida inteira da tabela.
> - `n_tup_ins` conta tuplas de transações **abortadas**. `dlq_health_snapshots` marca **2.920** inserts — próximo das 2.901 falhas de cron documentadas em §3. São quase certamente os `INSERT` revertidos pelo erro de FK, **não** dado que existiu. Isso *reforça* o achado R4 em vez de enfraquecê-lo.
>
> As 18 tabelas com histórico de INSERT: `dlq_health_snapshots` (2.920, ver acima), `deal_activities` (28), `email_suppressions` (11), `automation_execution_logs` (10), `campaign_recipients` (10), `apollo_search_cache` (9), `cnpj_enrich_queue` (9), `web_scrape_queue` (6), `oracle_rate_limits` (6), `campaign_events` (5), `cnpj_enrich_rate_state` (4), `places_api_usage` (3), `dlq_alert_history` (3), `qa_test_runs` (2), `org_scrape_rate_limits` (1), `instagram_scrape_queue` (1), `cnpj_enrich_cache` (1), `web_scrape_dead_letter` (1).
>
> **Leitura honesta:** volumes de 1 a 28 tuplas, todas removidas, indicam **teste manual pontual** — não operação. O quadro de dormência se mantém; a redação absoluta é que estava errada.

**Não é distribuição aleatória.** Agrupando as 58 vazias por domínio:

| Domínio | Tabelas vazias | Leitura |
|---|---:|---|
| Alertas e SLA | 12 — `sla_alert_history`, `sla_alert_settings`, `sla_autotune_runs`, `reaper_alert_*`, `dlq_alert_*`, `api_latency_alert_*`, `org_violation_alert*` | Todo o subsistema de alerta é **silencioso por construção** |
| Web scraping genérico | 4 — `web_scrape_queue`, `web_scrape_results`, `web_scrape_dead_letter`, `robots_cache` | Flag desligada |
| Instagram | 3 — `instagram_scrape_queue`, `..._results`, `..._dead_letter` | Sem cron, sem chamador |
| Campanhas | 4 — `campaign_events`, `campaign_messages`, `campaign_recipients`, `campaign_replies` | Nunca disparada |
| E-mail | 4 — `email_accounts`, `email_suppressions`, `email_sync_log`, `oauth_sandbox_snapshots` | OAuth nunca concluído |
| Automações | 3 — `automation_steps`, `automation_execution_logs`, `automation_alerts` | Módulo dormente |
| CNPJ | 3 — `cnpj_enrich_cache`, `cnpj_enrich_queue`, `cnpj_enrich_rate_state` | Worker roda 12.460× a vazio |
| Observabilidade | 5 — `api_request_logs`, `api_latency_snapshots`, `pg_net_health_snapshots`, `dlq_health_snapshots`, `health_checks` | Tracing e latência **não gravam** |
| Config por org | 5 — `org_proxies`, `org_retry_policies`, `org_scrape_rate_limits`, `oracle_rate_limits`, `partition_policies` | Configuração avançada nunca usada |
| Demais | 15 — `api_keys`, `agent_chat_messages`, `ipc_config`, `deal_activities`, `deal_tasks`, `organization_invites`, `apollo_search_cache`, `lusha_credit_usage_log`, `lusha_dm_search_history`, `company_reviews`, `job_exports`, `qa_test_runs`, `scrape_results`, `partition_advisories`, `retry_policy_advisories` | — |

Confirma a previsão do prompt: features dormentes concentram-se em **SLA, filas, dashboards e automações agendadas** — precisamente as que falham sem erro visível.

---

## 5. Drift repo × banco — o achado mais grave da dimensão

### 5.1 Não existe ledger de migrations

```sql
select count(*) from information_schema.schemata where schema_name='supabase_migrations';
-- → 0
```

O schema **não existe**. Não há registro de qual das 212 migrations foi aplicada. O banco foi construído pela interface do Lovable, não pelo diretório `supabase/migrations/`.

### 5.2 Quatro migrations são inexecutáveis e seus objetos estão ausentes

Amostrei **todos** os objetos declarados pelas 4 migrations em base64 (decodificadas com `base64 -di` para leitura):

| Objeto declarado | Migration | Existe em produção? |
|---|---|:---:|
| `public.assert_service_or_admin()` | `20260721083823_A1` | ❌ **0** |
| `public.v_extensions_audit` (view) | `20260721084800_A3A4` | ❌ **0** |
| `public.ab_assignments` (tabela) | `20260721235500_C14` | ❌ **0** |
| `public.assign_ab_variant()` | `20260721235500_C14` | ❌ **0** |
| `public.record_ab_event()` | `20260721235500_C14` | ❌ **0** |
| `public.workflow_run_events` (tabela) | `20260722000001_D18` | ❌ **0** |

**6 de 6 ausentes.**

### 5.3 Contenção verificada — produção não está quebrada por isso

Antes de dimensionar este achado como incidente, testei se algo vivo depende dos objetos ausentes:

```
grep -rl "assert_service_or_admin\|workflow_run_events\|ab_assignments\|assign_ab_variant\|v_extensions_audit" \
     src/ supabase/functions/ supabase/migrations/ scripts/
→ nenhum resultado
```

**Nenhum código vivo os referencia.** O risco é de **entrega perdida** (A/B testing, execução durável de workflow, guard centralizado de privilégio e auditoria de extensões nunca chegaram a existir), **não** de falha ativa em produção. Registro a distinção porque tratá-lo como incidente levaria a uma correção apressada em produção sem necessidade.

### 5.4 Agendamentos parcialmente versionados

> **🔧 CORREÇÃO (2026-08-16, segunda rodada de validação — Errata E2 do documento executivo).**
> **Redação original, incorreta:** *"Os 30 cron jobs existem **apenas** em `cron.job`. `grep "functions/v1/"` em `supabase/migrations/` → 0 resultados. Se o banco for recriado do repositório, nenhum job é agendado."*
> **Por que estava errada:** meu critério de detecção era `grep "functions/v1/"`, que só encontra jobs cujo comando chama uma Edge Function por HTTP. Os jobs do tipo SQL não casam esse padrão. É precisamente a armadilha de falso-negativo que este próprio relatório documenta — apliquei-a a mim mesmo sem testar o critério.

**Medição correta:** `grep -rl "cron.schedule" supabase/migrations/` → **6 arquivos**.

**6 dos 30 jobs SÃO versionados** — todos do tipo SQL, com o padrão defensivo `cron.unschedule` seguido de `cron.schedule`:

| Job versionado | Migration |
|---|---|
| `capture-db-health` | `20260712183806_*.sql` |
| `daily-log-retention` | `20260712184705_*.sql` |
| `daily-campaign-logs-retention` | `20260721225851_*.sql` |
| `evaluate-partition-policies-daily` | `20260721225949_*.sql` |
| `pg-net-snapshots-prune-weekly` | `20260722123959_*.sql` |
| `reap-stuck-queue-tasks` | `20260723134028_*.sql:218-222` |

**Os 24 restantes não são versionados** — incluindo **todos os 17 que invocam Edge Functions** por `net.http_post` (`grep -rl "net.http_post" supabase/migrations/` → **0 arquivos**).

**O veredito muda de grau, não de direção:** se o banco for recriado a partir do repositório, **6 jobs são agendados e 24 não** — entre os ausentes, todo o processamento de filas (`process-scrape-queue`, `web-scrape-worker-30s`, `sync-gmaps-jobs`, `cnpj-enrich-worker`) e toda a camada de alertas. O ambiente continua não reconstruível; a lacuna é de 80%, não de 100%.

---

## 6. Lacunas desta dimensão

- **Não avaliei a corretude semântica** das 255 policies RLS nem dos 149 views — apenas presença, cobertura e contagem.
- **107 funções `SECURITY DEFINER`** em `public`: contadas, **não auditadas** individualmente. O guard `scripts/check-security-definer.sh` (68 L) existiria para isso, mas nunca executa (ver [`05`](./05-infra-ci-testes.md)).
- **208 das 212 migrations** não foram lidas — inventariadas por nome e timestamp. Só as 4 corrompidas foram decodificadas e lidas.
- Não medi performance, bloat, índices ausentes nem custo.
- Contagens de linha vêm de `pg_stat_user_tables.n_live_tup` (estimativa do planner). Para tabelas com 0, a leitura é confiável; para as grandes, há margem de erro irrelevante para esta análise.
