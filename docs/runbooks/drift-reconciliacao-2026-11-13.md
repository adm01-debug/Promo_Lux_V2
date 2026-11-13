# Incidente: drift de migrations em produção — reconciliação (2026-11-13)

Projeto: **pttzwlbidamibjssqiqb** (Promo Lux - V2).

## Causa raiz

\supabase_migrations.schema_migrations\ tinha 3 linhas órfãs de bootstrap
(\20260831173522/23/24\) inexistentes em \supabase/migrations/\. Isso abortava
\supabase db push --remote\ com \DbPushMissingLocalError\, deixando o job de plano vermelho
em toda PR (drift).

## Ação

DELETE das 3 órfãs do \supabase_migrations.schema_migrations\ via Management API
(\/v1/projects/pttzwlbidamibjssqiqb/database/query\).
Não-destrutiva: só o registro de tracking foi removido; objetos de schema (mcp_exec,
mcp_exec_many, índices) permanecem intactos.

## Estado

| | |
|---|---|
| ANTES | 219 linhas (216 locais + 3 órfãs) |
| DEPOIS | 216 linhas (== árvore local), 0 órfãs |

## Validação pós-fix

\\\
supabase db push --dry-run --remote
=> {"upToDate":true,"dryRun":true,"migrations":[],"message":"Remote database is up to date."}
\\\

Backup pré-escrita preservado em artefato local de sessão (JSON do tracking completo).

## Segurança do deploy (verificado em 2026-11-13)

Environment \production\ tem \equired_reviewers\ (reviewer: adm01-debug) + \ranch_policy\
(custom branch policies) — DDL requer aprovação humana.