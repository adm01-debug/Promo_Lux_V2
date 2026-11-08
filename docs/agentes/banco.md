# Banco de dados — referência para agentes

Ler quando for rodar SQL, criar/aplicar migration, montar Postgres local ou auditar o estado do banco.
Resumo das regras no `AGENTS.md`; aqui está o detalhe. Errar o banco aqui é o erro mais caro do repo.

## Onde se trabalha

| Situação | Banco | Como |
|---|---|---|
| Diagnóstico | **produção, só leitura** | edge function de leitura, `supabase` CLI linkado no ref correto, ou painel. **Nesta sessão não há MCP de SQL para o projeto vivo** — sem um desses, a afirmação é `NÃO VERIFICADO` |
| Migration nova | arquivo em `supabase/migrations/` | `supabase migration new <slug>` → `npm run db:lint` → replay local → PR → **chame o dono** |
| Teste de comportamento de banco | **Postgres descartável** | `npm run db:start` + `supabase migration up --local` (ou `npm run db:reset`); nunca no projeto vivo |
| Migration destrutiva, segredos, rotação de chaves | **só com o dono do projeto** | — |

## Projeto OFICIAL

| O que | Valor |
|---|---|
| Projeto Supabase | **`pttzwlbidamibjssqiqb`** — "Promo Lux - V2" |
| URL | `https://pttzwlbidamibjssqiqb.supabase.co` |
| Dashboard | https://supabase.com/dashboard/project/pttzwlbidamibjssqiqb |
| Provisionamento | Lovable Cloud / organização `vercel_icfg_ljrwZ7dvf5ItsrP0HGRAyo48` |
| Evidência | `supabase/.temp/linked-project.json` · `.env` (`VITE_SUPABASE_PROJECT_ID`) · `.lovable/mcp/manifest.json` (issuer) · `supabase/functions/mcp/index.ts:220` · `docs/estado/03-dados-e-runtime.md` |
| Ledger de migrations | **não existe** (`supabase_migrations.schema_migrations` ausente) |

### `pesfxhlbsjfmlysdkzhr` — ref divergente cravado no código

Este ref **não é o projeto vivo** e aparece em três lugares:

- `supabase/config.toml:1` → `project_id = "pesfxhlbsjfmlysdkzhr"` (o CLI usa isso para `link`/`db push`)
- `src/hooks/useWebScrape.ts:45` → URL absoluta de `functions/v1/` em produção
- `e2e/helpers/supabase.ts:18` → `FALLBACK_URL` + `FALLBACK_ANON` dos testes de RLS

**Consequência:** `supabase link`/`db push` sem `--project-ref` explícito mira o projeto errado, e os E2E
sem `E2E_SUPABASE_URL`/`VITE_SUPABASE_URL` no ambiente também. A divergência **não está resolvida** — pode
ser projeto antigo, pode ser um segundo projeto real para o web-scrape. **Não unifique por conta própria:**
é mudança de alvo de banco, item do dono. Ao rodar qualquer comando de CLI, passe o ref na mão.

### Bancos que NÃO são deste projeto (não escrever neles)

- `pgxfvjmuubtbowutlide` (MCP "SUPABASE - GESTÃO DE CLIENTES") e `doufsxqlfjyuvxuezpln`
  (MCP "SUPABASE - GESTÃO DE PRODUTOS") — outros sistemas. Se um MCP Supabase estiver carregado na sessão,
  **confira `get_project_url` antes de qualquer query**: nome de MCP não prova qual projeto respondeu.
- `tnnnlkbymytvtqngbbqh` — Zapp Web V2. Nada deste repo entra lá.

## Panorama medido do banco vivo

`docs/estado/03-dados-e-runtime.md` (leitura direta, 2026-08-16): 181 MB · **95 tabelas** em `public` ·
149 views · **107 funções `SECURITY DEFINER`** · 79 triggers · **255 policies RLS** · **30 cron jobs**.
RLS está ligado em **95 de 95** tabelas. Mas: **58 das 95 tabelas estão vazias**, apenas **8 tabelas
(8,4%)** têm trigger `log_audit_event` — a auditoria anterior que afirmava "100% auditado" é falsa — e
`idempotency_keys` tem 3 linhas (mecanismo existe, uso marginal).

## Regras de migration

1. **Nome:** `<timestamp 14 dígitos>_<slug>.sql`, gerado por `supabase migration new <slug>`. Sem timestamp
   duplicado (quebra a ordenação determinística do CLI). Validado por `npm run db:lint`
   (`scripts/check-migrations.sh`).
2. **Toda `CREATE TABLE` em `public` leva `GRANT` + `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` na mesma
   migration.** Sem `GRANT`, o PostgREST devolve `permission denied`; sem RLS, a tabela nasce aberta. O lint
   é estrito para timestamp `>= 20260727000000` (`MIGRATIONS_BASELINE`) e só avisa para as anteriores —
   **aviso de legado não é licença para copiar o padrão antigo**.
3. **Proibido:** `ALTER DATABASE` e criar/alterar/derrubar objetos nos schemas gerenciados
   (`auth`, `storage`, `realtime`, `supabase_functions`, `vault`). Referenciar `auth.uid()` numa policy ou
   `REFERENCES auth.users` é legítimo.
4. **Ordem obrigatória: arquivo → PR → dono aprova → merge em `main` → `db-migrations.yml` aplica.** O
   workflow deriva o ambiente do gatilho (`pull_request` → `staging`, só valida; push em `main` →
   `production`, aplica) e passa por `scripts/check-migration-target.sh`, que recusa ref ausente, mal
   formado ou diferente de `EXPECTED_PROJECT_REF`. Nunca `supabase db push` à mão em produção.
5. **`REVOKE`, `DROP`, rename ou mudança de contrato de função usada pelo front/edges: nunca antes do deploy
   do código correspondente.** Com deploy automático pela Lovable no merge, o intervalo é curto, mas não é zero.
6. **Não existe ledger.** `supabase_migrations.schema_migrations` não existe no projeto vivo — não há como
   saber pelo banco o que já foi aplicado. Em consequência: o ambiente **não é reconstruível a partir do
   repositório**, e `db push` pode tentar reaplicar tudo. Trate qualquer migration como alto risco e confirme
   o estado real por catálogo (`pg_get_functiondef`, `pg_policies`, `pg_indexes`, `information_schema`).
7. **6 migrations estão corrompidas em base64** e nenhum dos objetos que declaram existe em produção:
   `20260721083823_A1-assert-service-or-admin-guard.sql` (`assert_service_or_admin()`),
   `20260721084800_A3A4-extensions-audit-partial-indexes.sql` (view `v_extensions_audit`),
   `20260721235001_C13-campaign-warmup-throttling.sql` (tabelas `warmup_profiles`, `campaign_warmup_state` e RPC `get_warmup_slot()`),
   `20260721235500_C14-ab-testing-assignment-chisquare.sql` (tabela `ab_assignments`),
   `20260722000001_D18-durable-workflow-execution.sql` (tabela `workflow_run_events`),
   `20260722000500_H37-company-analytics-rpcs.sql` (RPCs `company_analytics_summary()`, `company_growth_trend()`, `company_ipc_distribution()`).
   **Decodificar essas seis é ação de produção** (entram no `db push` no merge seguinte) — só com o dono.
   Nenhum código vivo referencia esses objetos (`grep` em `src/`, `supabase/`, `scripts/` → zero), então
   não há incidente ativo: é entrega perdida, não quebra.
8. **Guards de banco só valem com `SUPABASE_DB_URL` exportada.** `scripts/check-function-grants.sh:14-19` e
   `scripts/check-audit-triggers.sh:13` fazem `exit 0` com um aviso quando a variável está vazia — verde sem
   ter consultado nada. `scripts/check-anon-grants-view.sh` está em base64 e é inexecutável.
9. Runbooks: `docs/runbooks/migrations.md`, `docs/runbooks/migration-template.md`,
   `docs/runbooks/disaster-recovery.md`. ERD e tabelas principais: `docs/erd.md`,
   `docs/schema-tabelas-principais.md`.

Sessões paralelas commitam no mesmo repo e miram o mesmo banco: re-sync antes de editar e confira o maior
timestamp em `supabase/migrations/` **e** as PRs abertas tocando a pasta antes de criar arquivo.
