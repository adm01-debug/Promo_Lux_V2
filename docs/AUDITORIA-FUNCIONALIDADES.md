# Auditoria de Funcionalidades — Promo_Lux_V2

> Medido em 2026-11-21 contra o banco de producao `pttzwlbidamibjssqiqb` e o codigo em `main` (`e5ef06d9`).
> Metodo: cada afirmacao vem de uma query no banco real ou de um `git grep`/leitura de arquivo com linha. Nada foi herdado de doc anterior.

---

## 1. Veredito

**Nenhuma funcionalidade planejada e regressao.** O `docs/GAPS-ENTERPRISE.md` (abril/2026) descreve um produto vazio; o que existe hoje cobre **7 das 10 categorias** dele por inteiro e 2 parcialmente. Das 10 Quick Wins do mesmo doc, **8 estao entregues**.

O que realmente falta nao e funcionalidade de negocio — sao 3 itens de infraestrutura/produto que exigem decisao de custo, mais 2 features P2 sem base nenhuma.

---

## 2. GAPS-ENTERPRISE, categoria por categoria

| # | Categoria | Veredito | Evidencia no banco/codigo |
|---|---|---|---|
| 2.1 | Multi-tenancy & Organizacoes | **ENTREGUE** | `organizations`, `organization_members`, `organization_invites`, `user_roles`; RBAC com `has_role`/`has_org_role`; `audit_logs` |
| 2.2 | CRM & Pipeline | **ENTREGUE** | `deals` (`value`, `currency`, `expected_close_date`, `stage_id`, `position`), `deal_stages` (Kanban), `deal_activities` (timeline), `deal_tasks` |
| 2.3 | Outreach & Engagement | **ENTREGUE** | `campaigns`, `campaign_messages`, `campaign_recipients`, `campaign_replies`, `campaign_events`, `email_accounts`, `email_suppressions`, `email_sync_log` |
| 2.4 | Data Enrichment | **ENTREGUE** | Apollo (`apollo_search_cache`, `apollo_rate_state`), CNPJ (`cnpj_enrich_cache`/`queue`/`rate_state`), Lusha (6 tabelas + `v_lusha_cache_stats`), `v_lux_enrichment_health` |
| 2.5 | Workflows & Automacao | **ENTREGUE** | `workflows`, `workflow_runs`; `AutomationsRealtimeView` na UI |
| 2.6 | Analytics & Reporting | **PARCIAL** | `AnalyticsView` + `ConversionTab` + `DataEnrichmentTab` (recharts) existem e calculam por query. **Falta** relatorio agendado/exportado por email |
| 2.7 | Integracoes & API | **ENTREGUE** | `api_keys` (hash, scopes, expiry, `last_used_at`, soft delete), `webhooks` + `webhook_deliveries`, `oauth_sandbox_snapshots` |
| 2.8 | Seguranca & Compliance | **PARCIAL** | 2FA/TOTP entregue e **integrado no login** (`App.tsx:146-157`, `LoginCard.tsx:71`, `MFAVerify`, `MFAEnroll`, `MFASetup`). **Falta** SSO/SAML, SCIM, IP allowlist |
| 2.9 | IA & Machine Learning | **PARCIAL** | `ipc_score` em `companies` (5/5 preenchidas, faixa 55-87), `ipc_config`, `oracle_v2_health`. **Falta** score por lead/stakeholder e predicao de deal |
| 2.10 | Operacoes & DevEx | **ENTREGUE** | 22 tabelas: `feature_flags`, `health_checks`, `circuit_breakers` (+ snapshots/historico/alertas), `sla_*` (7), `reaper_*` (3), `dlq_*` (3), `qa_reaper_runs`, `db_health_snapshots` |

**Resumo:** 7 entregues por inteiro, 3 parciais, **0 ausentes**.

---

## 3. Quick Wins do GAPS-ENTERPRISE (10 itens)

| # | Quick Win | Status | Evidencia |
|---|---|---|---|
| 1 | Soft delete + recycle bin | **ENTREGUE** | `deleted_at` em 9 tabelas (campaigns, companies, deals, workflows, organization_members, api_keys, email_accounts, email_suppressions, webhooks) + `RecycleBinView` + funcao `purge-soft-deleted` |
| 2 | Audit log generico via trigger | **ENTREGUE e PROVADO** | `audit_logs` (`old_data`/`new_data` JSONB) + 8 triggers `log_audit_event`. Simulacao de UPDATE em `companies` gerou registro com old/new preenchidos; rollback confirmado (352 registros intactos) |
| 3 | Field-level history (JSONB diff) | **ENTREGUE** | Mesmo mecanismo do QW2: `old_data`/`new_data` guardam o diff por campo |
| 4 | Bulk import CSV com dedup | **ENTREGUE** | `ImportCompaniesDialog.tsx:62-137` — le CSV, deduplica por nome/cnpj contra `companies`, insere em lote com `source='import'`; integrado em `CompaniesView.tsx:282` |
| 5 | API key pessoal + REST minimo | **ENTREGUE** | `api_keys` + `useApiKeys.ts` na UI + `webhooks` para saida |
| 6 | Webhooks de saida | **ENTREGUE** | `webhooks` + `webhook_deliveries` |
| 7 | 2FA via TOTP | **ENTREGUE** | `MFAEnroll`/`MFAVerify`/`MFASetup` + gate AAL2 em `App.tsx` e desafio no `LoginCard` |
| 8 | Status page externo | **NAO ENTREGUE** | Exige Better Stack/Instatus (servico externo pago). Sem equivalente no codigo |
| 9 | In-app changelog | **NAO ENTREGUE** | Zero referencias a `changelog` em `src/` |
| 10 | Rate limit server-side | **ENTREGUE** | `supabase/functions/_shared/api-rate-limit.ts` + tabelas `auth_rate_limits`, `oracle_rate_limits` |

**8 de 10 entregues.**

---

## 4. As 7 features "enterprise P1/P2" do backlog

O backlog as listou como "sem migration e sem tabela". Reconfirmei uma a uma e o diagnostico **muda**:

| Feature | Reclassificacao | Base existente |
|---|---|---|
| `bulk_imports` | **ja e funcionalidade** | `ImportCompaniesDialog` faz import CSV com dedup de verdade. Falta so o **historico** de importacoes (registro do que foi importado quando) |
| `role_permissions` (matriz fina) | **parcial** | RBAC binario por papel existe (`app_role` = admin/sdr/viewer, `user_roles`, `has_role`, `has_org_role`). Falta permissao granular por recurso |
| `lead_scores` | **parcial** | `companies.ipc_score` populado. Falta score por stakeholder/lead |
| `field_history` | **ja e funcionalidade** | `audit_logs.old_data/new_data` cumpre o objetivo |
| `scheduled_reports` | **ausente** | Sem tabela, sem cron, sem UI |
| `dashboard_layouts` | **parcial** | `DashboardView.tsx:21,63,108` persiste ordem dos widgets em `localStorage` (por navegador, nao por usuario no banco) |
| `deal_predictions` | **ausente** | Sem tabela, sem modelo |

**Nenhuma e regressao nem bug.** Sao extensoes de produto.

---

## 5. Estado de saude medido

| Metrica | Valor | Como foi medido |
|---|---|---|
| Tabelas com RLS | **96 / 96** | `pg_class.relrowsecurity` no schema `public` |
| Tabelas com RLS sem policy | **0** | `pg_policies` cruzado com `pg_class` |
| Tabelas sem RLS | **0** | idem |
| Migrations repo vs banco | **220 = 220** | comparacao de `supabase/migrations/*.sql` com `supabase_migrations.schema_migrations`; **zero drift** nas duas direcoes |
| Crons ativos | **30 / 32** | `cron.job` (2 inativos: `campaign-dispatch-every-10min`, `round18-dlq-alerts-15m`) |
| Execucoes de cron 24h | **9.766 succeeded / 0 failed** | `cron.job_run_details` |
| Funcoes no banco (RPC) | 132 | `pg_proc` em `public` |
| Triggers | 116 | `pg_trigger` (`not tgisinternal`) |
| Funcoes edge | 59 em producao = 59 no repo | `functions download` + comparacao |
| Tamanho do banco | 1.073 MB | `pg_database_size` |
| Testes front | **987 passed / 987** (89 arquivos) | `npm test` |
| Build de producao | OK em 11,46s | `npx vite build` |

---

## 6. O que realmente falta (honesto)

**Exige decisao de custo/produto — nao e codigo:**
1. SSO/SAML + SCIM — plano enterprise de Supabase Auth ou IdP proprio
2. Status page externo — servico pago
3. IP allowlist / data residency — plano Supabase

**Features de produto, sem base:**
4. `scheduled_reports` — relatorio agendado por email (precisa tabela + cron + template)
5. `deal_predictions` — modelo de previsao de fechamento

**Extensoes de algo que ja funciona:**
6. Historico de importacoes CSV (`bulk_imports`)
7. Matriz de permissao granular (`role_permissions`)
8. Score por stakeholder (`lead_scores`)
9. `dashboard_layouts` persistido no banco em vez de `localStorage`
10. In-app changelog

---

## 7. Correcao ao backlog anterior

O `docs/pendencias/_backlog-verificado.md` (2026-11-20) afirma no item 2 que as 7 features enterprise "nao existem no banco e nao ha migration". Isso continua tecnicamente correto **para as tabelas com aquele nome exato**, mas induz a conclusao errada: 4 delas ja tem a **funcionalidade** entregue por outro mecanismo (`audit_logs` para field history, `ImportCompaniesDialog` para bulk import, RBAC para roles, `ipc_score` para scoring, `localStorage` para dashboard layout). Reimplementa-las "do zero" criaria duplicidade.

---

## 8. Como reproduzir esta auditoria

```bash
# drift de migrations
ls supabase/migrations/*.sql | wc -l        # 220
# aplicar no banco: select count(*) from supabase_migrations.schema_migrations;  -- 220

# RLS
# select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
#   where n.nspname='public' and c.relkind='r' and c.relrowsecurity;   -- 96

# crons
# select count(*) filter (where active), count(*) from cron.job;       -- 30 | 32

# testes e build
npm test        # 987 passed
npx vite build  # built in ~11s
```