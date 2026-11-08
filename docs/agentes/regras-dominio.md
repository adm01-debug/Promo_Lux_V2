# Regras de domínio que o código não deixa óbvio — referência para agentes

Ler quando mexer em multi-tenant, filas/DLQ, scoring IPC, soft delete, Oracle/decisores ou nos testes de RLS.

## Multi-tenant — `withOrg` é obrigatório no front

- Acesso a tabela org-scoped vai por `import { db } from "@/integrations/supabase/withOrg"`, **não** pelo
  `supabase` cru. O wrapper injeta `organization_id` no INSERT/UPSERT, força `.eq("organization_id", ...)`
  em SELECT/UPDATE/DELETE e **lança** se o payload trouxer outra org
  (`src/integrations/supabase/withOrg.ts`).
- O escopo de cada tabela é declarado em `ORG_SCOPED_TABLES` (`withOrg.ts:87`) e `ORG_UNSCOPED_TABLES`
  (`withOrg.ts:151`). **Tabela sem classificação é bloqueada em runtime** (`withOrg.ts:292`). Criou tabela
  com `organization_id`? Entra em `ORG_SCOPED_TABLES` **e** no fixture
  `src/integrations/supabase/__tests__/org-scoped-tables.fixture.json` — `withOrg.registry.test.ts` falha
  se faltar. Rode junto: `npx vitest run src/integrations/supabase`.
- Org ativa fica em `localStorage` sob `lux:active-org` (`ACTIVE_ORG_STORAGE_KEY`); trocar de org é
  `setActiveOrgId` (coberto por `withOrg.switching.test.ts`).

## Multi-tenant — `service_role` nas edge functions é bypass de RLS

Função que roda com `service_role` ignora RLS por definição. **Toda** função que recebe id de linha
org-scoped no corpo da requisição (`contact_ids`, `organization_id`, …) precisa revalidar a associação do
chamador antes de ler/escrever, com `getUserOrgIds` / `isUserOrgMember` de
`supabase/functions/_shared/org-membership.ts`. Sem essa checagem, o `service_role` vira o bypass de
isolamento. Alertas de violação têm função própria (`org-violation-alerts`).

## Cobertura de RLS — registro obrigatório

`supabase/functions/_shared/rlsTableRegistry.ts` é a whitelist das tabelas multi-tenant exercitadas pela
edge `rls-tests`. **Tabela nova com RLS por organização sem entrada aqui faz o teste
`rls_coverage_complete` falhar.** Cada entrada declara `payload(orgId, userId, ctx)`, `requires` (tabelas
auxiliares criadas antes) e `excludeFromAnon` (para tabelas só de `service_role`, como
`webhook_deliveries`). ADR-002 e ADR-007 explicam o modelo.

## Update que não pode falhar em silêncio

`lusha_contacts` tem 4 colunas `GENERATED` e 6 `CHECK`s: um `.update()` sem checar o retorno transforma
`428C9`/`23514` em nada e o contato trava no status anterior. Use
`updateContact` de `supabase/functions/_shared/safe-update.ts` — foi assim que um bug de persistência
sobreviveu semanas em produção.

## Filas, DLQ e reaper

- Toda fila declara `queue_kind`; a cobertura é verificada por
  `scripts/check-queue-kind-coverage.sh` (`scripts/sql/check-queue-kind-coverage.sql`). Fila nova sem
  `queue_kind` passa batido hoje porque o guard vive no `ci.yml` morto — rode à mão com `SUPABASE_DB_URL`.
- Tarefa presa é recuperada pelo cron `reap-stuck-queue-tasks` (24.884 execuções, 36 falhas;
  `qa_reaper_runs` com 24.841 linhas). Replay de DLQ tem função dedicada por domínio
  (`instagram-dlq-replay`, `web-dlq-replay`) e alertas em `dlq-alerts`.
- Chamada externa passa por `_shared/circuit-breaker.ts`; estado em `circuit_breakers` e
  `circuit_breaker_snapshots`, alertas no cron `circuit-breaker-alerts-every-5min`. Não contorne o breaker
  com `fetch` direto.

## Soft delete

Exclusão de dado de negócio é **soft delete** (ADR-008); o expurgo real é o cron diário
`purge-soft-deleted-daily` / edge `purge-soft-deleted`. Nunca `DELETE` físico em tabela de negócio sem o
dono. Consulta que esquece o filtro de soft delete devolve registro apagado — confira o padrão do módulo
vizinho antes de escrever a query.

## Auditoria

Trigger `log_audit_event` existe em apenas **8 das 95 tabelas** e `audit_logs` tem 325 linhas
(`docs/estado/03-dados-e-runtime.md` §2). A afirmação de auditorias antigas de que "100% dos
INSERT/UPDATE são auditados" é **falsa** — não construa feature assumindo trilha completa.
`scripts/check-audit-triggers.sh` cobra 1 trigger por tabela, sem duplicata.

## `SECURITY DEFINER` e allowlist

Há **107** funções `SECURITY DEFINER` em `public`. Função nova com `SECURITY DEFINER` precisa de
`SET search_path`, `EXECUTE` revogado de `anon`/`public` e entrada em
`scripts/sql/security-definer-allowlist.txt` (ADR-009, cobrado por `scripts/check-security-definer.sh`). A
view `v_sec_definer_anon_grants` deveria vigiar grants indevidos a `anon` — **o guard dela
(`scripts/check-anon-grants-view.sh`) está corrompido em base64** e não roda.

## Logging

ADR-006: **nenhum `console.log` em código de produção** (`src/`, `supabase/functions/`). Logging é
estruturado em JSON — nas edges, via `_shared/oracle-logger.ts` / `_shared/tracing.ts`. O scan que cobrava
isso vive no `ci.yml` morto; a regra continua valendo.

## Feature flags

Integração desligada é flag em `feature_flags`, não código comentado. Exemplo vivo:
`use_places_api_new = false` com `"requires_connector": "google_maps"`. Antes de "ativar" algo, confira a
flag e o conector — e trate ativação de provedor pago como custo (item do dono).

## E2E — fixtures e usuários de teste

- `e2e/helpers/supabase.ts` fala direto com a Data API usando a chave `anon` para provar RLS; usa dois
  usuários (`E2E_USER_A_*` / `E2E_USER_B_*`) para provar isolamento entre tenants. Sem essas variáveis o
  helper cai no ref divergente `pesfxhlbsjfmlysdkzhr` (ver `banco.md`) — exporte
  `E2E_SUPABASE_URL`/`E2E_SUPABASE_ANON_KEY` antes de concluir qualquer coisa a partir desses testes.
- `e2e/fixtures/companies.json` e `e2e/helpers/lushaMocks.ts` são fixtures — não troque por chamada real.
- A suíte E2E **não roda em CI nenhum** (`github-ci.md`): rodar `npm run test:e2e` localmente é a única
  execução que existe.
