# Backlog verificado — Promo_Lux_V2

Data: 2026-11-20 16:30
Base: origin/main @ 8e0be69 (merge PR #79 = fix CORS)
Metodo: cada gap do docs/GAPS-ENTERPRISE.md conferido contra banco real (dotenv via query) e codigo do repo. Nada foi herdado do doc sem evidencia.

## Status geral
O GAPS-ENTERPRISE (abr-2026) esta DEFASADO: a maioria dos itens P0 que ele marcava como "Inexistente" ja foi implementada por agentes anteriores e esta viva no banco/codigo. Nao reinventar o que existe; focar no que falta.

## Nao-executar ainda (exige decisao de negocio/custo)
- SSO/SAML, SCIM, provider OIDC: tabela `saml_providers` nao existe (SEM migration). Custo infra, decisao de produto.
- BYOK/KMS, data residency por org: custo infra.
- SOC2/ISO27001/pentest/bug bounty: custo/processo, nao codigo.
- Mobile nativo iOS/Android: PWA ja existe; decisao de produto.

## 1. Gap REAL: soft delete fora das 8 tabelas principais
"Soft delete | Hard delete | deleted_at + recycle bin com retencao" (Quick Win #1)
- IMPLEMENTADO: campaigns, companies, deals, workflows, organization_members tem `deleted_at`; RecycleBinView (src/components/lux/RecycleBinView.tsx) e `purge-soft-deleted` function existem.
- PARCIAL: demais tabelas (suppressions, email_accounts, api_keys, webhooks, etc.) ainda sao hard delete. Decisao: ampliar padrao `deleted_at` para as tabelas de dados de negocio.
- EXECUTAVEL AGORA? Sim, migration nova + ajuste de views. Toca RLS/DDL -> regra 8, requer APROVADO do dono para merge.

## 2. Campos orphan da auditoria — RECONFERIDO em 2026-11-22 contra o banco real

O levantamento anterior estava errado: 6 das 7 tabelas **existem** em producao, com RLS e
triggers, e 5 delas estao integradas de ponta a ponta no front.

| Tabela | Existe? | RLS | Uso real no codigo |
| --- | --- | --- | --- |
| `scheduled_reports` | SIM | 4 politicas | `useScheduledReports` -> `ScheduledReportsTab` -> `AnalyticsView`; cron `send-scheduled-reports-hourly` ativo e versionado em `20261121230000` |
| `dashboard_layouts` | SIM | 5 politicas | `DashboardView.tsx:71-72` persiste por usuario no banco, localStorage so como cache de primeiro paint |
| `bulk_imports` | SIM | 3 politicas | `ImportCompaniesDialog.tsx:76,167` grava e le historico de importacao |
| `deal_predictions` | SIM | 5 politicas | usado no scoring |
| `lead_scores` | SIM | 5 politicas | usado no scoring |
| `role_permissions` | SIM | 5 politicas | 210 linhas; `useRolePermissions` + `usePermissions` + `PermissionGate` em 13 componentes |
| `field_history` | NAO | — | coberto por `audit_logs.old_data/new_data`; nao precisa de tabela propria |

Ausentes de verdade (nao citadas neste item): `saml_providers` (item 1 acima) e
`suppressions` (item 1 do soft-delete). Nenhuma das 6 e feature "enterprise P1/P2" pendente:
ja estao implementadas e em uso.

## 3. Gap REAL confirmado por request: CORS allowlist (RESOLVIDO nesta sessao)
- 15 edge functions com allowlist restritiva so tinham dominio Lovable; producao Vercel bloqueava no browser.
- FIX: PR #79 mergeada (8e0be69), deploy prod OK, preflight GET real 200 + ACAO correto.

## 4. Gap REAL observado no CI (Dependency Review)
- Dependency Review falha ~8s sempre por Advanced Security desligada na org (403). Nao usa licenca. Rebuttal via continue-on-error foi PR #73 (mantido). Nada a fazer sem AS paga.
- Missing: smoke test de preflight CORS em producao (peca hoje este gap de novo).

## 5. Proximos itens executaveis (por impacto)

1. [RESOLVIDO] smoke CORS no `production-smoke.yml` — presente e cobrindo 17 functions
   (`production-smoke.yml:53-64`, checa `Access-Control-Allow-Origin` com origem Vercel).
2. [DDL] ampliar soft-delete padrao p/ tabelas de negocio (regra 8; APROVADO do dono)
3. [DONO] desligar Lovable legacy no painel (acao manual) - URL serve bundle defasado

## 6. Reconciliacao de migrations (2026-11-22)

- repo = 225 migrations `supabase/migrations/*.sql`, banco = 225 registros. **Zero pendente,
  zero so-no-banco.**
- DDL esperado do repo (108 tabelas, 314 indices) x banco (104 tabelas, 426 indices): todas as
  diferencas investigadas e descartadas.
  - `ponto_*` (4 tabelas): criadas e dropadas 4 min depois por `20260512191500`.
  - `idx_email_messages_pending`, `idx_campaign_contacts_pending`: tabelas base inexistentes, o
    `DO $$` da migration tem guarda `IF EXISTS` e nunca executou.
  - `idx_lc_unique_linkedin_org`, `idx_lss_*`: renomeadas (`lusha_contacts_org_linkedin_uk`,
    `lusha_contacts_search_sessions_org_idem`...), cobertura equivalente.
- Unico caso real de "registrada sem efeito": `20260718140000`, resolvido pela PR #108.
- RLS: **0 tabelas** sem RLS em `public` e **0** com RLS ligado e nenhuma politica.