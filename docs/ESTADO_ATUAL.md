# ESTADO ATUAL DO SISTEMA — LUX IA

> **Auditoria de estado.** O que o sistema **deveria** fazer × o que **de fato** está implementado e rodando.
> **Data:** 2026-08-16 · **Commit auditado:** `890c18d` · **Branch:** `claude/system-status-roadmap-gzt829`
> **Projeto Supabase:** `pttzwlbidamibjssqiqb` (leitura verificada) · **Repositório:** `adm01-debug/promo-lux-v2`

**Este documento é o índice executivo.** As tabelas de evidência por dimensão estão em [`docs/estado/`](./estado/).

---

## 1. Veredito em uma tela

O LUX IA **não é um protótipo**: são ~118.000 linhas, 23 telas, 57 Edge Functions, 95 tabelas com RLS em 100% delas e 30 jobs agendados executando de verdade — mais de 150 mil execuções de cron com sucesso nos últimos 30 dias. A espinha dorsal de coleta (fila de scraping → GMaps → empresas) está viva e processa dados reais.

O problema não é o produto. É que **o aparato de qualidade em volta dele é decorativo**:

1. **O pipeline de CI nunca rodou uma única vez.** O arquivo `.github/workflows/ci.yml` está gravado em **base64** no disco. Não é YAML. As 30 execuções mais recentes (27/07 → 11/08) falharam — **100%**.
2. **Nenhum dos 3 workflows do repositório está verde.** `edge-tests-daily`: 24/24 falhas. `db-migrations`: 1 execução, falha.
3. **Os 111 arquivos de teste não protegem nada em CI.** Nenhum é executado por um pipeline que conclua.
4. **O ambiente não nasce do repositório.** Não existe ledger de migrations (`supabase_migrations.schema_migrations` **não existe**), e 4 migrations estão corrompidas em base64 — nenhum dos objetos que elas declaram existe em produção.
5. **61,1% das tabelas (58 de 95) estão vazias.** Destas, **40 não receberam nenhum INSERT** desde o reset de estatísticas (15/07/2026). Não é acaso: concentra-se onde o prompt previa — SLA, filas, DLQ, alertas, automações e dashboards. *(Ver Errata E3 — a redação original dizia "nunca receberam um registro", o que era mais forte do que a evidência permite.)*

**Tradução para decisão:** o que está em produção funciona porque foi construído direto no ambiente, não porque foi validado. Qualquer alteração hoje entra sem rede de proteção, e o ambiente não é reconstruível a partir do código.

---

## 2. Contagem honesta

156 funcionalidades classificadas com evidência. Denominadores reais, sem arredondamento favorável.

| Classificação | Qtd | % | Leitura |
|---|---:|---:|---|
| ✅ **IMPLEMENTADO_TOTAL** | 42 | **26,9%** | Fio completo e com uso real comprovado |
| 🟨 **IMPLEMENTADO_PARCIAL** | 78 | **50,0%** | Existe e roda, mas falta camada, flag desligada ou zero dado |
| 🟦 **SUGERIDO_OU_INICIADO** | 29 | **18,6%** | Esqueleto, tabela vazia, componente sem consumidor |
| ⬛ **MORTO_OU_ABANDONADO** | 7 | **4,5%** | Código presente, nenhum caminho de execução chega |

Por dimensão:

| Dimensão | Total | ✅ | 🟨 | 🟦 | ⬛ | Detalhe |
|---|---:|---:|---:|---:|---:|---|
| Frontend / apresentação | 29 | 11 | 13 | 4 | 1 | [`01-frontend.md`](./estado/01-frontend.md) |
| Backend / Edge Functions | 57 | 12 | 33 | 9 | 3 | [`02-backend-edge-functions.md`](./estado/02-backend-edge-functions.md) |
| Dados e runtime | 36 | 17 | 18 | 1 | 0 | [`03-dados-e-runtime.md`](./estado/03-dados-e-runtime.md) |
| Integrações | 22 | 2 | 7 | 13 | 0 | [`04-integracoes.md`](./estado/04-integracoes.md) |
| Infra, CI e testes | 12 | **0** | 7 | 2 | 3 | [`05-infra-ci-testes.md`](./estado/05-infra-ci-testes.md) |

A linha que mais importa é a última: **zero ✅ em infraestrutura de qualidade**.

---

## 3. Riscos estruturais, por gravidade

### 🔴 R1 — Nove arquivos de código-fonte estão corrompidos em base64

Não é hipótese. Varredura em 100% dos arquivos versionados (excluindo binários): 9 arquivos têm **0 quebras de linha** e conteúdo base64 válido que decodifica para código real.

| Arquivo | Bytes | Impacto medido |
|---|---:|---|
| `.github/workflows/ci.yml` | 6.168 | **Todo o portão de qualidade morto** (§R2) |
| `scripts/check-anon-grants-view.sh` | 2.784 | Guard de segurança de CI inexecutável |
| `supabase/functions/email-verify/index.ts` | 9.844 | Function não deployável |
| `supabase/functions/deliverability-check/index.ts` | 9.876 | Function não deployável |
| `supabase/migrations/20260721083823_A1-assert-service-or-admin-guard.sql` | 10.960 | `assert_service_or_admin()` **ausente do banco** |
| `supabase/migrations/20260721084800_A3A4-extensions-audit-partial-indexes.sql` | 8.968 | View `v_extensions_audit` **ausente** |
| `supabase/migrations/20260721235500_C14-ab-testing-assignment-chisquare.sql` | 8.824 | Tabela `ab_assignments` **ausente** |
| `supabase/migrations/20260722000001_D18-durable-workflow-execution.sql` | 9.778 | Tabela `workflow_run_events` **ausente** |
| `docs/auth.md` | 2.968 | Documentação ilegível |

**Verificação de contenção:** nenhum código vivo referencia os cinco objetos ausentes (`grep` em `src/`, `supabase/functions/`, `supabase/migrations/`, `scripts/` → zero ocorrências). **Produção não está quebrada por isso** — as features simplesmente nunca chegaram. Este risco é de *entrega perdida*, não de *incidente ativo*.

### 🔴 R2 — O portão de qualidade nunca executou

Três provas independentes de que `ci.yml` é inválido:

1. `od -c` mostra o blob base64; `wc -l` retorna **0 linhas** para 6.168 bytes.
2. A API do GitHub lista o workflow com `"name": ".github/workflows/ci.yml"` — não conseguiu ler o campo `name:`. Os outros dois aparecem com nome próprio (`Database Migrations`, `Edge Functions Daily Tests (Deno)`).
3. **382 execuções registradas; as 30 mais recentes, 100% `failure`.**

O que está morto junto: `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run build`, scan de `console.log`, scan de secrets hardcoded e **os 5 guards de banco** (grants, triggers de auditoria, anon grants, allowlist de `SECURITY DEFINER`, cobertura de `queue_kind`).

**Bug de segunda ordem — importa para o plano de correção.** Mesmo depois de consertar o YAML, dois guards passariam em falso. O arquivo usa `secrets.SUPAAASE_DB_URL` (3 letras A) em 2 dos 5 steps, contra `SUPABASE_DB_URL` nos outros 3. E `scripts/check-function-grants.sh:15-19` faz:

```bash
if [[ -z "$DB_URL" ]]; then
  echo "::warning::SUPABASE_DB_URL ... não configurada — guard ignorado."
  exit 0
fi
```

Variável vazia → `exit 0` → **verde**. Consertar só o base64 produz um CI que mente de forma mais discreta.

### 🔴 R3 — O ambiente não é reconstruível a partir do repositório

- `supabase_migrations.schema_migrations` **não existe** no banco. Não há registro de qual migration foi aplicada.
- 212 migrations versionadas no repo; 4 delas inexecutáveis (§R1).
- Amostragem dos objetos declarados nessas 4: `assert_service_or_admin`, `assign_ab_variant`, `record_ab_event`, `v_extensions_audit`, `workflow_run_events`, `ab_assignments` → **6 de 6 ausentes** em produção.

O banco foi construído pela interface do Lovable, não pelo `supabase/migrations/`. Um `supabase db reset` hoje não reproduz produção — e ninguém sabe o delta.

**Agravante não registrado na primeira versão:** `db-migrations.yml:27-30` aplica migrations **automaticamente em push para `main`** (Environment `production`, com *required reviewers*). Ou seja, o dia em que as 4 migrations em base64 forem decodificadas e chegarem à `main`, elas entram na fila de aplicação em produção. Isso **muda a natureza da correção**: decodificar os 5 arquivos não-migration é inócuo; decodificar as 4 migrations é uma mudança que toca produção e precisa de revisão do conteúdo antes. Ver Errata E5.

### 🟠 R4 — Alertas de DLQ silenciosamente mortos há 30 dias

Dois cron jobs falham de forma sistemática, e ninguém foi avisado porque **falha de cron não gera chamado**:

| Job | Sucessos | Falhas | Taxa |
|---|---:|---:|---:|
| `capture-dlq-health-hourly` | **0** | **415** | 100% de falha, nunca funcionou |
| `round18-capture-dlq-snapshots-10m` | 6 | **2.486** | 99,8% de falha |

Causa-raiz exata, extraída de `cron.job_run_details.return_message`:

```
ERROR: insert or update on table "dlq_health_snapshots" violates foreign key
constraint "dlq_health_snapshots_organization_id_fkey"
DETAIL: Key (organization_id)=(00000000-0000-0000-0000-000000000099)
        is not present in table "organizations".
CONTEXT: PL/pgSQL function capture_dlq_health_snapshots() line 7
```

As 13 linhas de `scrape_dead_letter` pertencem todas a uma organização de teste `...099` que **não existe** em `organizations`. Consequência em cadeia: `dlq_health_snapshots` = 0 linhas → o job `dlq-alerts-15min` roda 1.661 vezes "com sucesso" sobre uma tabela sempre vazia → `dlq_alert_history` = 0 linhas. **O alarme de fila morta está desligado e reporta saúde.**

### 🟠 R5 — Métricas de campanha: o fio está partido no meio

Três pontas existem, a costura não:

- `supabase/functions/track-open/index.ts` (68 linhas) e `track-click/index.ts` (70 linhas) — **existem**.
- `src/components/lux/campaigns/CampaignTrackingDrawer.tsx` — **lê** `campaign_events`.
- `supabase/functions/campaign-dispatch/index.ts` (655 linhas) — **zero ocorrências** de `track`, `pixel`, `open` ou `click` (`grep -in`). Envia `Content-Type: text/plain` (`index.ts:592`), sem pixel e sem reescrita de links.

Ninguém gera URLs apontando para as functions de tracking. `campaign_events` = **0 linhas hoje**. Enquanto `campaign-dispatch` não injetar o pixel nem reescrever links, a UI de métricas continuará exibindo zero.

*Correção (E4): a versão original afirmava que a funcionalidade "nunca funcionou uma vez". `pg_stat_user_tables` mostra **5 INSERTs** históricos em `campaign_events` (e 5 DELETEs) — provavelmente invocação manual das functions durante teste. A evidência de código permanece decisiva e o veredito não muda, mas a afirmação absoluta era forte demais.*

### 🟡 R6 — A documentação canônica está invertida

Amostragem das evidências citadas em `docs/AUDITORIA_FINAL_LUX_IA.md`, que se declara *"estado de perfeição absoluta (10/10)"* e *"assinado digitalmente por Lovable Auditor Engine v10.0"*:

| Afirmação do documento | Verificação |
|---|---|
| `src/domain/ipc/scoreCompany.ts` | ❌ **Não existe.** O real é `supabase/functions/_shared/domain/ipc/scoring.ts` |
| `_shared/logger.ts` — "tracing traceparent" | ❌ **Não existe** |
| Trigger `update_version_on_change` | ❌ **Não existe** (`pg_trigger` → 0) |
| "Logs em `api_request_logs`" | ❌ Tabela existe, **0 linhas** |
| "**100%** de INSERT/UPDATE auditados" | ❌ **8 de 95 tabelas** (8,4%) têm trigger `log_audit_event` |
| `withOrg.ts` L12: `new Proxy(client, ...)` | ❌ L12 é um **comentário** |
| `useRateLimit.ts` L15: `checkLimit()` | ❌ L15 é `const getStorage = ...` |
| "Blindagem RLS: 100% das tabelas" | ✅ **Verdadeiro** — 95/95 com `relrowsecurity = true` |
| Isolamento de org via `withOrg.ts` | ✅ **Verdadeiro** — arquivo existe e é usado |

7 de 9 afirmações amostradas não se sustentam. O README também afirma *"PostgreSQL + RLS — 12 tabelas"*; são **95**.

Recomendo tratar `AUDITORIA_FINAL_LUX_IA.md` como material de marketing, não como inventário. Este documento **não o edita** (guard-rail de não tocar em artefato de outra trilha) — a divergência fica registrada aqui.

### 🟡 R7 — Módulos inteiros construídos e desligados

| Módulo | Construído | Estado real |
|---|---|---|
| Web Scraping genérico | 4 functions, 3 tabelas, 1 view, cron de 30s (49.811 execuções) | `web_scrape_enabled = **false**`, `web_scrape_extract_enabled = **false**`; as 3 tabelas com **0 linhas** |
| Instagram / HikerAPI | 4 functions, 3 tabelas, painel de UI | **Nenhum cron, nenhum chamador**; 3 tabelas com 0 linhas; `HIKER_MOCK_MODE` |
| Automações | View `AutomationsRealtimeView`, 3 tabelas | `automation_steps`, `automation_execution_logs`, `automation_alerts` = **0 linhas** |
| Places API (New) | Function `gmaps-places-search` | `use_places_api_new = **false**`; `places_api_usage` = 0 |
| A/B testing de campanhas | Migration C14 | Migration em base64; `ab_assignments` **não existe** |

---

## 4. O que está bom — sem distorcer o quadro

Não é um sistema ruim. É um sistema bem construído com a governança apagada.

- **RLS: 95 de 95 tabelas** com row-level security ativa, 255 policies. A afirmação de blindagem multi-tenant **se sustenta**.
- **Cron confiável no núcleo:** `web-scrape-worker-30s` com 49.811 sucessos e 0 falhas; `process-scrape-queue` 24.919/0; `sync-gmaps-jobs` 24.919/0; `cnpj-enrich-worker` 12.460/0. 28 dos 30 jobs rodam limpos.
- **Observabilidade de banco funciona de verdade:** `db_health_snapshots` com 4.982 registros e captura a cada 5 min; `qa_reaper_runs` com 24.841.
- **Circuit breakers e vault cookies são reais:** 8 breakers, 40 snapshots, 51 snapshots de cookie, 33 alertas históricos — dados, não esqueleto.
- **Webhooks de saída entregam:** 63 registros em `webhook_deliveries`.
- **Arquitetura sólida:** proxy `withOrg` para isolamento, guard SSRF, assinatura HMAC de links de tracking, registry de RLS, 29 ADRs. A engenharia está acima da média; falta a linha de montagem.

---

## 5. O que esta auditoria NÃO cobriu

Declarado, não escondido.

- **Não executei build, lint, testes ou `tsc`.** `node_modules` vazio, Deno e Supabase CLI ausentes no ambiente. Nenhuma afirmação deste documento diz que algo "compila" ou que "o teste passa".
- **Não li linha a linha** os 285 componentes, 84 hooks, 53 arquivos de `src/lib` nem 208 das 212 migrations. Foram inventariados **por altitude** (objeto/função/consumidor). Lidos integralmente: os 4 migrations corrompidos, `viewRegistry.ts`, `IntegrationsView.tsx`, `ci.yml` decodificado e os scripts de guard.
- **Não avaliei corretude semântica das 255 policies RLS** nem dos 149 views — apenas presença e cobertura.
- **Não avaliei performance**, custo de infraestrutura, nem acessibilidade em runtime.
- **PWA / offline / service worker:** `NAO_VERIFICADO` — exigiria execução no navegador.
- **Não testei nenhuma integração externa ao vivo** (Lusha, Apollo, Bitrix, CNPJá, Apify, Hiker). O estado delas foi inferido de código + tabelas de evidência, e está marcado como tal.
- **Zero alterações em produção.** Somente `SELECT` e catálogo.

---

## 6. Próximos passos, por valor

### Barato e seguro — posso executar sozinho, sem tocar em produção

| # | Ação | Esforço | Por que primeiro |
|---|---|---|---|
| 1 | **Decodificar os 5 arquivos base64 que NÃO são migration** (`ci.yml`, `check-anon-grants-view.sh`, `email-verify`, `deliverability-check`, `auth.md`) | ~10 min | Destrava tudo o mais. Reversível, verificável por diff. **As 4 migrations ficam de fora** — ver item 8 e Errata E5 |
| 2 | Corrigir `secrets.SUPAAASE_DB_URL` → `SUPABASE_DB_URL` (2 ocorrências) | 2 min | Sem isso, 2 guards passam em falso mesmo com o CI vivo |
| 3 | Trocar `exit 0` por `exit 1` quando `DB_URL` está vazia nos guards | 10 min | Elimina a asserção vacuamente verdadeira |
| 4 | Apontar `edge-tests-daily.yml` para `vitest` em vez de `deno test` | ~20 min | Os 20 testes em `_shared/__tests__/` importam `vitest`, não Deno. Causa exata das 24 falhas: `Module not found ".../\_shared/bitrix-client"` em `bitrix-client.test.ts:2:91` |
| 5 | Adicionar step de Playwright ao CI | ~15 min | 20 arquivos e 2.221 linhas de E2E hoje sem runner nenhum |
| 6 | Remover as 3 functions mortas (`api-latency-alerts`, `audit-logs-prune`, `system-recovery-status`) e `PermissionGate.tsx` | ~10 min | Critério de detecção testado contra falso-negativo — ver [`02`](./estado/02-backend-edge-functions.md) §4 |

### Toca produção — é decisão sua

| # | Ação | Risco | Observação |
|---|---|---|---|
| 7 | Corrigir os 13 registros órfãos em `scrape_dead_letter` (org `...099`) | Baixo | Ressuscita o alarme de DLQ. É `DELETE` ou criação da org — **sua escolha**, não minha |
| 8 | Decodificar **e** aplicar as 4 migrations corrompidas | **Médio–Alto** | Criam tabelas e funções novas. **Atenção (E5):** `db-migrations.yml` aplica migrations automaticamente em push para `main`. Decodificar já as coloca na fila de produção — o Environment `production` exige revisor, mas a decisão de aplicar passa a ser um clique, não um passo separado. Revise o SQL antes de decodificar |
| 9 | Estabelecer o ledger de migrations (`supabase migration repair`) | **Alto** | É o caminho para reconstrutibilidade, mas precisa de baseline manual do delta repo × produção |
| 10 | Ligar `web_scrape_enabled` ou desmontar o módulo | Médio | Hoje um cron roda a cada 30s para não fazer nada. Decisão de produto |
| 11 | Costurar o tracking de campanhas (pixel + rewrite em `campaign-dispatch`) | Médio | Ou remover a UI de métricas, que exibirá zero indefinidamente |

**Minha recomendação:** faça 1–6 em um único PR. São mecânicos, reversíveis e transformam um CI decorativo em um CI que de fato reprova. Só depois disso vale discutir 7–11, porque a partir daí você terá rede.

---

## 7. Verificação independente desta auditoria (Fase D)

Antes de entregar, apliquei a este documento o mesmo teste que apliquei aos anteriores.

**Recontagem de cobertura.** Extraí todos os 44 caminhos de arquivo citados nos 6 documentos e conferi contra a árvore real:

```
caminhos citados: 44 · inexistentes: 1
  FALTA: src/domain/ipc/scoreCompany.ts
```

O único ausente é **justamente o que cito como evidência fabricada** da auditoria anterior (§R6). **43 de 43 caminhos afirmativos existem.**

**Conferência de `arquivo:linha`.** Amostrei 8 das citações com número de linha, lendo a linha exata:

| Citação | Conteúdo real da linha | ✓ |
|---|---|:---:|
| `campaign-dispatch/index.ts:592` | `` `Content-Type: text/plain; charset="UTF-8"`, `` | ✅ |
| `campaign-dispatch/index.ts:328` | `: await sendOutlook(fresh, r.email, subject, body);` | ✅ |
| `PermissionGate.tsx:17` | `export const PermissionGate = ({ entity, action, ...` | ✅ |
| `vitest.config.ts:45` | `include: ["src/**/*.{test,spec}.{ts,tsx}"]` | ✅ |
| `vitest.config.ts:54` | `include: ["supabase/functions/**/__tests__/**/*.test.ts"]` | ✅ |
| `check-audit-triggers.sh:13` | `DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"` | ✅ |
| `GAPS-ENTERPRISE.md:65` | `\| Billing por seat \| Inexistente \| Stripe/Paddle...` | ✅ |
| `viewRegistry.ts:10` | `dashboard: () => import("@/components/lux/DashboardView"),` | ✅ |

**Achados graves reproduzidos de forma independente:** R1 (3 métodos: `od -c`, `wc -l`, `base64 -di`), R2 (3 métodos: disco, API do GitHub, histórico de execuções), R3 (consulta ao catálogo + 6 objetos amostrados), R4 (mensagem literal do cron + consulta de FK órfã), R5 (`grep` no produtor + no consumidor + contagem da tabela).

**Achados que rebaixei após verificar** — registrados para que a revisão fique visível:

| Suspeita inicial | Verificação | Classificação final |
|---|---|---|
| 4 componentes órfãos em `src/components/lux/` | 3 eram arquivos `.test.tsx` — falso-positivo do meu critério | **1** órfão real (`PermissionGate`) |
| 2 testes de Edge sem runner (`apify-gateway.test.ts`, `rls-tests/index.test.ts`) | `edge-tests-daily.yml` roda `deno test` sobre toda a pasta — **têm** runner | Não é achado |
| "Resend" como integração de e-mail | É `handleResendInvite` — reenvio de convite | Removido do inventário |
| Migrations corrompidas quebram produção | Nenhum código vivo referencia os 6 objetos ausentes | Rebaixado de "incidente" para **entrega perdida** |

### Errata — segunda rodada de validação (2026-08-16, pós-publicação)

Uma segunda passada adversarial contra a própria auditoria encontrou **6 defeitos**. Os agregados (156 itens, 42/78/29/7) sobreviveram à recontagem mecânica; quatro afirmações não. O original fica registrado ao lado da correção.

| # | O que eu afirmei | O que é verdade | Como descobri |
|---|---|---|---|
| **E1** | *"O dano entrou junto com o arquivo no commit `f3400e4` (26/07). Não houve regressão posterior."* | **Falso.** A execução **#1** do `ci.yml`, em **2026-05-11**, já falhou — dez semanas antes daquele commit. O histórico git deste repo foi reimportado/esmagado, então `git log -- ci.yml` mostrando um único commit **não** indica quando a corrupção entrou. | Paginei até a página 13 da API de runs e li as 23 mais antigas |
| **E2** | *"Os 30 cron jobs existem apenas em `cron.job`, nunca foram versionados."* | **Exagerado.** **6 dos 30 são versionados** via `cron.schedule` em migrations — `capture-db-health`, `daily-log-retention`, `daily-campaign-logs-retention`, `evaluate-partition-policies-daily`, `pg-net-snapshots-prune-weekly`, `reap-stuck-queue-tasks` (todos do tipo SQL). Os **24 restantes**, incluindo os 17 que chamam Edge Functions, de fato não são. | Meu critério era `grep "functions/v1/"` — estreito demais. `grep "cron.schedule"` acha 6 arquivos. **Foi exatamente a armadilha de falso-negativo que eu mesmo documentei** |
| **E3** | *"58 tabelas nunca receberam um registro."* | **Exagerado.** 58 estão **vazias hoje**; **40** sem nenhum INSERT desde o reset de estatísticas (**15/07/2026**); **18** receberam tuplas e hoje estão vazias. E o próprio `n_tup_ins` é traiçoeiro: `dlq_health_snapshots` marca **2.920** inserts — número próximo das 2.901 falhas de cron, ou seja, quase certamente tuplas de transações **abortadas**, não dado real. | `pg_stat_user_tables.n_tup_ins` / `n_tup_del` |
| **E4** | *"Métricas de campanha nunca funcionaram uma vez."* | **Forte demais.** `campaign_events` teve **5 INSERTs** e 5 DELETEs históricos. A evidência de código (zero tracking em `campaign-dispatch`) permanece decisiva e o veredito 🟦 não muda. | idem |
| **E5** | Não registrei o gatilho do `db-migrations.yml` | **Gap.** O workflow **aplica migrations em push para `main`** (`db-migrations.yml:27-30`, Environment `production` com *required reviewers*). Decodificar as 4 migrations deixa de ser inócuo — vira mudança que toca produção. Reclassifiquei essa ação de "barato e seguro" para "toca produção" no §6. | Leitura do gatilho antes de propor a correção |
| **E6** | Rótulos das seções do anexo 02: "(25)" e "(15)" | **Erro de contagem nos títulos.** As seções têm **28** e **12** itens. As 57 linhas numeradas e os totais por classificação estavam corretos — só os rótulos estavam errados. | Recontagem mecânica de linhas numeradas por arquivo |

**O que sobreviveu intacto à segunda rodada**, agora com evidência mais forte que na primeira:

- **"O CI nunca executou" está confirmado e reforçado.** Amostrei as runs mais novas *e* as mais antigas: **383 execuções, zero sucessos em toda a história do workflow**, de 2026-05-11 a hoje.
- **Todos os denominadores conferem** por recontagem: 57 Edge Functions, 23 views, 111 arquivos de teste (69+22+20), 212 migrations, 95 tabelas.
- **As 3 classificações ⬛ resistiram ao teste mais duro.** A dúvida era se aquelas functions seriam chamadas de dentro do banco via `net.http_post` — o que meu `grep` no repositório não veria. Consulta a `pg_proc.prosrc`: **nenhuma função PL/pgSQL do schema `public` contém `functions/v1/`**. Nenhum chamador oculto.
- **A costura partida do tracking resistiu:** varredura em *todas* as 57 functions por geração de URL de tracking → única ocorrência é o arquivo de teste.

---

## 8. Critério de pronto — autoavaliação honesta

- [x] 100% dos arquivos versionados varridos para corrupção — recontagem, não autorrelato
- [x] 100% de views (23), Edge Functions (57), cron jobs (30), tabelas (95), workflows (3) e arquivos de teste (111) enumerados
- [x] Toda funcionalidade classificada com evidência `arquivo:linha`, objeto de banco ou `jobid`
- [x] Achados graves R1–R5 verificados de forma independente (≥2 provas cada)
- [x] **Segunda rodada adversarial contra a própria auditoria** — 6 defeitos encontrados e corrigidos em bloco de errata, com o texto original preservado (E1–E6)
- [x] Denominadores reconferidos por recontagem mecânica: 57 Edge Functions, 23 views, 111 testes, 212 migrations, 95 tabelas, 156 itens classificados
- [x] Hipótese de chamador oculto via `net.http_post` em PL/pgSQL testada e descartada — as 3 classificações ⬛ resistiram
- [x] Runtime marcado `VERIFICADO` ou `NAO_VERIFICADO`, sem meio-termo
- [x] Lacunas declaradas no próprio documento (§5)
- [x] Nada alterado em produção
- [ ] **212 migrations lidas integralmente** — não. 4 lidas, 208 inventariadas por altitude. Declarado.
- [ ] **Build/teste executados** — não. Toolchain ausente. Declarado.

Duas caixas ficam abertas de propósito. Uma auditoria honesta sobre os próprios limites vale mais que uma completa e não confiável.
