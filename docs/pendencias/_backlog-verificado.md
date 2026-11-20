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

## 2. Atingir campos orphan da auditoria (SEM migration e SEM tabela no banco)
- `scheduled_reports` (relatorios agendados)
- `dashboard_layouts` (dashboards customizaveis)
- `field_history` (field-level history)
- `bulk_imports` (bulk import CSV dedup)
- `deal_predictions` / `lead_scores` (ML scoring turbinado)
- `role_permissions` (matriz de permissoes fina)
Todos nao existem no banco (271 tabelas consultadas) e nao ha migration. Sao features "enterprise P1/P2" - nao sao regressao nem bug.

## 3. Gap REAL confirmado por request: CORS allowlist (RESOLVIDO nesta sessao)
- 15 edge functions com allowlist restritiva so tinham dominio Lovable; producao Vercel bloqueava no browser.
- FIX: PR #79 mergeada (8e0be69), deploy prod OK, preflight GET real 200 + ACAO correto.

## 4. Gap REAL observado no CI (Dependency Review)
- Dependency Review falha ~8s sempre por Advanced Security desligada na org (403). Nao usa licenca. Rebuttal via continue-on-error foi PR #73 (mantido). Nada a fazer sem AS paga.
- Missing: smoke test de preflight CORS em producao (peca hoje este gap de novo).

## 5. Proximos itens executaveis (por impacto)
1. [EDGE] smoke CORS no production-smoke.yml (pega allowlist sem o dominio Vercel)
2. [DDL] ampliar soft-delete padrao p/ tabelas de negocio (regra 8; APROVADO do dono)
3. [DONO] desligar Lovable legacy no painel (acao manual) - URL serve bundle defasado