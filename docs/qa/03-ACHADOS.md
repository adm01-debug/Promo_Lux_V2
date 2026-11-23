# 03 — ACHADOS, AGRUPADOS POR CAUSA RAIZ

> Auditoria de QA somente leitura · **Commit auditado:** `9b85ca6` · 2026-11-22/23
> **Confiança:** `CONFIRMADO` = evidência direta lida/executada · `HIPÓTESE` = não verificado, com o motivo.
> **Verificação:** `EXECUTADO` = comando/teste rodado · `RASTREADO` = caminho seguido no código.
> Um problema com N ocorrências é **um** achado com N locais.

## Contagem

| Severidade                                                                             | Quantidade |
| -------------------------------------------------------------------------------------- | ---------: |
| **Crítica** — perda ou vazamento de dado, falha de segurança, fluxo principal quebrado |     **10** |
| **Alta** — função importante falha ou dá resultado errado                              |     **45** |
| **Média** — funciona com defeito ou fragilidade                                        |     **40** |
| **Baixa** — acabamento e higiene                                                       |     **10** |
| **Total de achados**                                                                   |    **105** |
| _(+ 1 registro informativo positivo: G23-8)_                                           |            |

Os IDs seguem o formato `G<grupo>-<n>` e estão agrupados pela causa raiz: um problema com N ocorrências é **um** achado com N locais. Todos os 105 estão cobertos por pelo menos uma das 300 etapas de `04-PLANO.md` (verificado automaticamente).

---

## G1 — Isolamento multi-tenant depende só da RLS: o guarda do cliente falha aberto na leitura

**Causa raiz:** o wrapper `withOrg` foi escrito para "falhar fechado" em escrita e "falhar aberto" em leitura. Sem organização ativa, o SELECT segue sem filtro de organização e sem filtro de lixeira; além disso, dezenas de consultas nem passam pelo wrapper.

### G1-1 · Crítica · CONFIRMADO · RASTREADO+EXECUTADO — SELECT sem organização ativa roda sem filtro de organização e sem filtro de soft delete

**Evidência:** `src/integrations/supabase/withOrg.ts:358-371`

```ts
if (prop === "select" && isScoped) {
  return (...args: unknown[]) => {
    if (!orgId) {
      console.warn(`[withOrg] Tentativa de select em "${tableName}" sem org ativa. Retornando builder sem filtro automático ...`);
      return dispatch.select(...args);          // <- sem .eq("organization_id") e sem .is("deleted_at", null)
    }
    const q = dispatch.select(...args).eq("organization_id", orgId);
    if (SOFT_DELETE_TABLES.has(tableName)) return q.is("deleted_at", null);
```

Compare com `:317`, `:328`, `:346`: `insert`, `update` e `delete` lançam `MissingOrgContextError` quando não há organização — só a leitura é liberada.

**Prova de que a janela sem organização acontece de verdade (EXECUTADO):** ao rodar a suíte Playwright em modo demonstração, o console do navegador registrou o aviso para `companies`, `workflows`, `intent_signals` e `notifications` em todo carregamento de tela — log em `/tmp/.../scratchpad/e2e-demo.log`. A janela ocorre no primeiro acesso do navegador (localStorage vazio) e depois de sair da conta (`src/contexts/AuthContext.tsx:71` limpa a organização ativa).

**Agravante de cache:** `staleTime` de 2 minutos e `refetchOnWindowFocus: false` (`src/App.tsx:51,73`) mantêm o resultado não escopado servido por até 2 minutos. Hooks que disparam antes da organização carregar, sem `enabled: !!activeOrgId`: `src/hooks/useNotificationCount.ts:9-25`, `src/hooks/useDashboardData.ts:142-156` e `:172-187`, `src/hooks/useVirtualCompanies.ts:9-25`, `src/hooks/useICPConfig.ts:39-57`, `src/hooks/useAuditTrail.ts:134-166`.

**Efeito certo, independente da RLS:** registros na lixeira (soft delete) reaparecem nas listagens durante essa janela, porque o `.is("deleted_at", null)` também é perdido.
**Efeito possível, dependente da RLS:** se qualquer policy for mais ampla que "pertence à minha organização", linhas de outra organização chegam ao navegador. **NÃO VERIFICÁVEL nesta sessão** (sem acesso SQL ao projeto oficial — ver `01-INVENTARIO.md` §6).

**Impacto no negócio:** quem pertence a mais de uma empresa pode ver, nos primeiros segundos de uso, dados misturados das duas; e itens que foram excluídos voltam a aparecer na lista.

### G1-2 · Alta · CONFIRMADO · RASTREADO — Pelo menos 20 famílias de chave de cache não incluem a organização

**Evidência:** `src/hooks/useDeals.ts:117` (`["deals", user?.id]`), `:43` (`["deal_stages", user?.id]`), `:272`; `src/hooks/useEmailTemplates.ts:72,87`; `src/hooks/useICPConfig.ts:40` (`["ipc-configs"]`); `src/hooks/useVirtualCompanies.ts:10`; `src/hooks/useDashboardData.ts:143,173`; `src/hooks/useWeeklyPerformance.ts:18`; `src/hooks/useAutomationsMonitor.ts:42,60,77,94`; `src/hooks/useAuditTrail.ts:136,152`; `src/hooks/useApiKeys.ts:36`; `src/hooks/useWebhooks.ts:48`; `src/hooks/useEmailSuppressions.ts:40`; `src/hooks/useNotificationCount.ts:10`; `src/hooks/useScrapeQueue.ts:38,54`; `src/hooks/useFeatureFlags.ts:15`; `src/hooks/useResilienceComparison.ts:12`; `src/hooks/useWebScrape.ts:83`; `src/hooks/useOracleV2.ts:35`; `src/hooks/useApiLatency.ts:51,81`.

**Causa raiz:** `user?.id` foi usado como se fosse o escopo, mas o escopo do dado é a organização, não o usuário. O padrão correto já existe no repositório: `src/hooks/useSatisfaction.ts:32`, `src/hooks/usePiiRules.ts:50`, `src/hooks/useSalesGoals.ts:50`, `src/hooks/useDlqItems.ts:23`, `src/hooks/useLeaderboard.ts:30`, `src/hooks/useRolePermissions.ts:35`.

**Mitigação parcial existente:** a troca de organização chama `invalidateQueries()` (`src/contexts/ActiveOrgContext.tsx:62`), então o dado é refeito — mas o cache antigo é exibido enquanto isso.

**Impacto no negócio:** ao trocar de empresa dentro do sistema, a tela mostra por um instante números da empresa anterior.

### G1-3 · Alta · CONFIRMADO · RASTREADO — Leituras e escritas de tabelas multi-organização fora do wrapper `withOrg`

**Evidência (usam `supabase.from()` cru em tabelas listadas em `ORG_SCOPED_TABLES`, `withOrg.ts:87-126`):** `src/hooks/useDeals.ts:120-122` (deals), `:46-48` (deal_stages), `:303-306` (UPDATE de `deal_tasks` filtrando só por `id`); `src/hooks/useApiKeys.ts:39-42`; `src/hooks/useEmailTemplates.ts:74-78,111,115-119,135-137`; `src/hooks/useWeeklyPerformance.ts:27-31` (companies); `src/hooks/useTaskReminders.ts:25-32`; `src/hooks/useScrapeQueue.ts:40-44,56-60`; `src/hooks/useSatisfaction.ts:76,88`; `src/hooks/useSalesGoals.ts:104,119`.

**Causa raiz:** o wrapper é opcional por convenção, não obrigatório por tipo ou por lint. Nada impede `supabase.from()` direto.

**Impacto no negócio:** nessas telas, a trava de isolamento entre empresas não é aplicada no aplicativo; a proteção fica inteira nas regras do banco. Se uma regra do banco estiver frouxa, o vazamento acontece sem nenhum freio no caminho. Efeito final **NÃO VERIFICADO** (sem acesso ao banco).

### G1-4 · Média · CONFIRMADO · RASTREADO — Papel "admin" assumido por padrão enquanto a organização não carrega

**Evidência:** `src/hooks/usePermissions.ts:36` — `if (!activeOrgId) return "admin"`.
**Causa raiz:** valor padrão escolhido pelo lado permissivo.
**Impacto no negócio:** nos primeiros instantes após entrar (e logo depois de sair da conta), qualquer usuário vê itens de administração no menu. As ações continuam barradas pelo banco, mas a interface promete o que o usuário não pode fazer.

### G1-5 · Média · CONFIRMADO · RASTREADO — Rebaixamento de papel demora até 2 minutos para aparecer na interface

**Evidência:** `src/hooks/useRolePermissions.ts:37-49` e `src/hooks/useOrganizations.ts:56-66` não definem `staleTime` próprio; herdam 2 min de `src/App.tsx:51` com `refetchOnWindowFocus: false` (`:73`).
**Impacto no negócio:** tirar o acesso de alguém não tem efeito imediato na tela dessa pessoa.

---

## G2 — Portões de qualidade e de segurança que passam sem verificar nada

**Causa raiz:** testes e verificações escritos para "não quebrar o CI" acabaram tratando erro de ambiente como aprovação.

### G2-1 · Alta · CONFIRMADO · **EXECUTADO** — A suíte que prova o isolamento multi-tenant passa verde mesmo sem falar com banco nenhum

**Evidência de código:** `e2e/helpers/supabase.ts:70-73`

```ts
export function isReadBlocked(result: {
  data: unknown[] | null;
  error: unknown;
}): boolean {
  if (result.error) return true; // <- qualquer erro conta como "bloqueado"
  return Array.isArray(result.data) && result.data.length === 0;
}
```

Qualquer falha — DNS inexistente, chave inválida, projeto desligado, rede caída — é interpretada como "a RLS bloqueou".

**Prova executada:** rodando a suíte com um endereço de projeto inexistente e uma chave inválida de propósito:

```
E2E_SUPABASE_URL="https://projeto-que-nao-existe-qa-audit.supabase.co" \
E2E_SUPABASE_ANON_KEY="chave-invalida-de-proposito" npx playwright test rls-guarantees.spec.ts
→ 77 passed (2.5s), 2 skipped
```

Cada caso levou de 1 a 5 ms — não houve sequer ida à rede. Os 2 pulados são justamente os de isolamento entre dois inquilinos, que só rodam se `E2E_USER_A_*`/`E2E_USER_B_*` estiverem configurados.

**Agravante:** `e2e/helpers/supabase.ts:18-20` traz endereço e chave anônima cravados como padrão apontando para `pesfxhlbsjfmlysdkzhr`, que a própria documentação do repositório (`AGENTS.md`, §Banco) declara **não ser o projeto vivo**. Sem as variáveis de ambiente certas, a suíte testa outro banco. (Tipo do segredo: chave publicável/`anon` em texto no repositório — valor não reproduzido aqui.)

**Impacto no negócio:** a única prova automática de que uma empresa não enxerga os dados de outra não prova nada. Um vazamento real passaria despercebido pelo CI.

### G2-2 · Alta · CONFIRMADO · **EXECUTADO** — `npm run lint` falha na `main`, e a documentação do projeto afirma o contrário

**Evidência:** `npm run lint` → **exit 1**, `✖ 26 problems (22 errors, 4 warnings)`. Arquivos: `supabase/functions/_shared/hiker-client.ts` (15 erros), `supabase/functions/instagram-enqueue/index.ts:51,60`, `supabase/functions/instagram-worker/index.ts:37,74`, `supabase/functions/latency-alerts/index.ts:40`, entre outros — todos `@typescript-eslint/no-explicit-any`.
**Contradição documentada:** `docs/ESTADO_ATUAL.md` §2 afirma "eslint **0 errors** (4 warnings) em 457 arquivos" e `AGENTS.md` repete o portão como verde.
**Impacto no negócio:** o portão que deveria impedir código problemático de entrar está vermelho e ninguém percebeu; a documentação que o dono lê para decidir está errada nesse ponto.

### G2-3 · Média · CONFIRMADO · **EXECUTADO** — Dois testes de interface quebrados na `main`

**Evidência:** execução de 5 arquivos da suíte Playwright: `46 passed, 2 failed, 4 skipped`.

1. `e2e/monitoring-navigation.spec.ts:21` — procura o título `Monitoramento de Automações` e não encontra. Causa real: o texto renderizado está corrompido (ver G6-1), então o seletor nunca casa.
2. `e2e/navigation.spec.ts:22` — `getByText('Criar Conta')` encontra 2 elementos (a aba e o botão de envio) e viola o modo estrito do Playwright. Teste frágil, não defeito de produto.
   **Impacto no negócio:** a suíte de interface está vermelha, então deixou de servir como alarme.

---

## G3 — Texto corrompido no código-fonte chega à tela e aos arquivos exportados

### G3-1 · Alta · CONFIRMADO · **EXECUTADO** — Palavras com acento aparecem quebradas na tela de monitoramento

**Causa raiz:** três arquivos foram salvos com duplo encoding (texto UTF-8 relido como Latin-1 e gravado de novo). Os bytes no arquivo já são a sequência errada — não é problema do navegador.

**Evidência de código (EXECUTADO, `grep -rl` por sequências de duplo encoding em `src/`, `supabase/functions/`, `e2e/`, `scripts/` → exatamente 3 arquivos):**

| Arquivo                                 | Linhas afetadas | O texto é visível ao usuário?                                                    |
| --------------------------------------- | --------------: | -------------------------------------------------------------------------------- |
| `src/pages/Monitoring.tsx`              |              21 | **Sim** — título, campo de busca, nomes das abas, avisos e cabeçalho do CSV      |
| `src/components/lux/auth/LoginCard.tsx` |               2 | **Sim, para leitor de tela** — `:77` `aria-label="VerificaÃ§Ã£o em duas etapas"` |
| `src/contexts/auth-context.ts`          |               2 | Não — só comentários                                                             |

Exemplos em `src/pages/Monitoring.tsx`: `:239` `Monitoramento de AutomaÃ§Ãµes` (o `<h1>` da página), `:174` `ConfiguraÃ§Ãµes Salvas`, `:195` cabeçalhos do CSV `["ID","Nome","Status","Empresas","Criado em","DuraÃ§Ã£o"]`, `:214` `ExportaÃ§Ã£o Iniciada`.

**Prova de que chega à tela (EXECUTADO):** o retrato do DOM capturado pelo Playwright na falha de `e2e/monitoring-navigation.spec.ts` mostra, no navegador: `heading "Monitoramento de AutomaÃ§Ãµes"`, `textbox "Buscar execuÃ§Ãµes..."`, abas `"Status AutomaÃ§Ãµes"`, `"SaÃºde do Banco"`, `"LatÃªncia"`, `"Auditoria de ExecuÃ§Ã£o"`, opções `"ConcluÃdos"`, `"Ãšltimos 7 dias"`.

**Impacto no negócio:** a tela de monitoramento — a que o dono usa para saber se o sistema está saudável — exibe palavras quebradas, e o relatório CSV sai com cabeçalho quebrado. Passa impressão de produto abandonado.

---

## G4 — Modo demonstração e dados reais compartilham o mesmo cache

### G4-1 · Alta · CONFIRMADO · RASTREADO — Dados fictícios podem ser mostrados a um usuário autenticado como se fossem seus

**Causa raiz:** em várias telas, a função de busca ramifica em `isDemoMode`, mas a chave de cache não inclui esse estado. Entrar e sair do modo demonstração não troca de chave e não limpa o cache.

**Evidência — telas com chave fixa e busca que depende do modo:**

| Arquivo                                        | Chave (sem o modo)         | Busca que ramifica |
| ---------------------------------------------- | -------------------------- | ------------------ |
| `src/components/lux/CampaignsView.tsx`         | `:101` `["campaigns"]`     | `:102`             |
| `src/components/lux/CompaniesView.tsx`         | `:76` `["companies-list"]` | `:77`              |
| `src/components/lux/IntentSignalsView.tsx`     | `:58` `["intent-signals"]` | `:59`              |
| `src/components/lux/WorkflowsView.tsx`         | `:61` `["workflows"]`      | `:62`              |
| `src/components/lux/StakeholderFinderView.tsx` | `:64` `["stakeholders"]`   | `:65`              |
| `src/components/lux/NotificationsPanel.tsx`    | `:66` `NOTIFICATIONS_KEY`  | `:67`              |

**Padrão correto já existente no repositório:** `src/components/lux/AutomationsList.tsx:54` (`["dashboard-workflows", isDemoMode]`), `src/components/lux/EnrichmentFunnel.tsx:35`, `src/components/lux/analytics/useAnalyticsData.ts:41`.

**Caminho que produz o defeito (RASTREADO):** `src/pages/Login.tsx:17-20` chama `enterDemo()` e navega sem recarregar a página; `src/components/lux/DashboardView.tsx:269-272` chama `exitDemo()` e navega para `/login`, também sem recarregar e **sem** `queryClient.clear()`. O cache sobrevive à troca.

**Impacto no negócio:** um cliente que explorou a demonstração e depois entrou na conta na mesma aba pode ver, por até dois minutos, empresas e campanhas de exemplo achando que são a carteira dele.

### G4-2 · Média · CONFIRMADO · RASTREADO — Modo demonstração libera todas as telas protegidas sem login

**Evidência:** `src/App.tsx:145` — `if (isDemoMode) return <>{children}</>;` antes de qualquer checagem de sessão; o modo é ligado por uma chave no navegador (`src/contexts/DemoContext.tsx:5-12`, `lux-demo-mode`).
**Causa raiz:** o estado de demonstração mora no navegador e tem precedência sobre o guarda de rota.
**Impacto no negócio:** qualquer visitante pode ligar a chave pelo console e navegar por toda a interface sem conta. Não há vazamento de dados de clientes (o banco recusa quem não tem sessão), mas a estrutura interna do produto fica exposta e telas que não têm versão de exemplo quebram na frente do visitante — é o que acontece em `/monitoring` (ver G6-2).

---

## G5 — Erros silenciados: a tela afirma sucesso ou mostra zero quando houve falha

### G5-1 · Alta · CONFIRMADO · RASTREADO — Falhas de leitura viram "nenhum resultado" em vez de aviso

**Evidência:**

- `src/hooks/useWeeklyPerformance.ts:27` descarta `error` da consulta → o gráfico de desempenho da semana desenha zero como se não houvesse atividade nenhuma.
- `src/hooks/useDeals.ts:60-61` chama uma RPC sem checar erro.
- `src/hooks/useOnboardingState.ts:32-46` usa `try/catch` onde o cliente Supabase devolve `{ error }` em vez de lançar; o erro nunca é lido → o passo a passo de boas-vindas pode reaparecer para quem já concluiu.
- `src/hooks/useICPConfig.ts:88` executa `.neq("id", id)` sem conferir o erro antes de ativar o novo perfil → pode terminar com **dois perfis de cliente ideal ativos ao mesmo tempo**.

**Impacto no negócio:** o sistema mostra "zero" onde deveria mostrar "não consegui carregar". Decisão comercial tomada sobre número falso.

### G5-2 · Média · CONFIRMADO · RASTREADO — Ações de gravação sem tratamento de erro visível

**Evidência (mutações sem `onError`):** `src/hooks/useDeals.ts:89-96,192-200,283-297,301-309,312-320`; `src/hooks/useEmailTemplates.ts:98-127`; `src/hooks/useApiKeys.ts:66-86`; `src/hooks/useScrapeQueue.ts:68-101`; `src/hooks/useICPConfig.ts:85-110`.
**Evidência (catch que engole a causa):** `src/components/lux/CompaniesView.tsx:194` e `:209` — `catch { toast({ title: "Erro ao remover", variant: "destructive" }); }` sem registrar nem exibir o motivo.
**Impacto no negócio:** quando salvar falha, o usuário não sabe por quê e o suporte não tem rastro para investigar.

### G5-3 · Baixa · CONFIRMADO · RASTREADO — Exclusão em lote não atualiza os indicadores do painel

**Evidência:** `src/components/lux/CompaniesView.tsx:192-193` (exclusão de uma empresa) invalida `["companies-list"]` **e** `["dashboard-stats"]`; `:207` (exclusão em lote) invalida apenas `["companies-list"]`.
**Impacto no negócio:** depois de apagar várias empresas de uma vez, os números do painel continuam contando as apagadas.

---

## G6 — Telas e fluxos que não têm estado de erro, vazio ou carregamento adequado

### G6-2 · Média · CONFIRMADO · **EXECUTADO** — `/monitoring` não tem versão de demonstração nem aviso: abre em branco

**Evidência:** a página `/monitoring` não consulta nenhuma fonte de dados de exemplo (`grep` por `isDemoMode` em `src/pages/Monitoring.tsx` → zero ocorrências), ao contrário das telas de negócio. No retrato do DOM capturado no navegador durante a execução Playwright em modo demonstração, o conteúdo da página aparece montado mas todas as áreas de dado ficam vazias, sem mensagem de erro e sem indicação de carregamento.
**Impacto no negócio:** quem entra pela demonstração encontra a tela de monitoramento vazia e sem explicação.

---

## G7 — Documento de conformidade LGPD promete o que o sistema não faz

**Causa raiz:** `docs/LGPD.md` foi escrito como peça de marketing/compliance e não foi conferido contra o código.

### G7-1 · Alta · CONFIRMADO · RASTREADO — "Excluir Conta com eliminação permanente" não existe no sistema

**Evidência:** `docs/LGPD.md:21` — _"**Anonimização/Eliminação**: Função 'Excluir Conta' que remove permanentemente os dados (soft-delete por 30 dias para segurança, seguido de hard-delete)."_
Busca por `"Excluir Conta"`, `delete-account`, `deleteAccount`, `excluir-conta` em `src/` e `supabase/functions/` → **zero ocorrências** (EXECUTADO). O que existe é o registro manual de pedidos do titular em `src/components/lux/settings/DsarPanel.tsx` com `src/hooks/useDsar.ts` (tipos `access | portability | erasure | rectification`), tratado por uma pessoa, e a função `purge-soft-deleted` com cron versionado `purge-soft-deleted-daily`.
**Impacto no negócio:** o documento que a empresa apresenta como prova de conformidade descreve um botão que não existe. Se um titular exigir eliminação citando esse documento, a empresa não tem como cumprir no prazo prometido de forma automática.

### G7-2 · Alta · CONFIRMADO · RASTREADO — "MFA obrigatória para administradores" é falso

**Evidência:** `docs/LGPD.md:33` — _"**MFA**: Autenticação de dois fatores obrigatória para administradores."_
`src/contexts/AuthContext.tsx:13-21`:

```ts
const { data, error } =
  await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
if (error || !data) return false;
const { currentLevel, nextLevel } = data;
return nextLevel === "aal2" && currentLevel !== "aal2";
```

O segundo fator só é exigido de quem **já cadastrou** um fator; não há consulta ao papel do usuário em nenhum ponto do cálculo e nada obriga um administrador a cadastrar. Um administrador sem TOTP entra apenas com senha.
**Impacto no negócio:** a conta com mais poder no sistema pode estar protegida só por senha, ao contrário do que a empresa declara por escrito.

### G7-3 · Média · CONFIRMADO · RASTREADO — Documento de conformidade publicado com campo não preenchido

**Evidência:** `docs/LGPD.md:7` — _"**DPO (Encarregado)**: [NOME DO DPO/CONTATO] - `dpo@lux-ia.com.br`"_.
**Impacto no negócio:** a LGPD exige encarregado identificado; o documento tem um espaço em branco onde deveria estar o nome.

### G7-4 · Média · HIPÓTESE — NÃO VERIFICADO — Retenção de 90 dias dos registros de auditoria pode não estar agendada

**Evidência do que existe:** `supabase/functions/audit-logs-prune/index.ts:20` — `const RETENTION_DAYS = 90;`, consistente com `docs/LGPD.md:39`.
**Evidência do que falta:** entre os **18** agendamentos versionados em `supabase/migrations/` (`grep -rhoE "cron\.schedule\('[^']+'"`, EXECUTADO) **não há** nenhum para `audit-logs-prune`. A lista versionada é: `campaign-dispatch-10min`, `campaign-dispatch-every-10min`, `circuit-breaker-alerts-every-5min`, `cnpj-enrich-worker-every-2min`, `dlq-alerts-15min`, `email-poll-replies-5min`, `latency-alerts-15min`, `pg-net-watchdog-30m`, `process-scrape-queue`, `purge-soft-deleted-daily`, `reaper-alerts-30min`, `retry-policy-tuner-daily`, `round18-dlq-alerts-15m`, `sla-alerts-hourly`, `sla-auto-tune-daily`, `sync-gmaps-jobs`, `vault-cookie-health-daily`, `web-scrape-worker-30s`.
**Por que é hipótese:** os agendamentos vivem no banco e podem existir sem estar versionados; não há acesso SQL ao projeto oficial nesta sessão para conferir `cron.job`.
**O que falta para confirmar:** uma consulta a `cron.job` no projeto `pttzwlbidamibjssqiqb`.
**Impacto no negócio:** se não estiver agendado, os registros de auditoria crescem para sempre e a retenção prometida no documento de LGPD não acontece.

---

## G8 — Código gerado versionado está fora de sincronia com o gerador

### G8-1 · Alta · CONFIRMADO · **EXECUTADO** — O pacote da função `mcp` no repositório foi gerado por dependências três versões maiores atrás

**Evidência:** `package.json:72,130` declaram `"@lovable.dev/mcp-js": "^3.5.0"` e `"zod": "^4.6.7"`; `package-lock.json` resolve `3.5.0`; `node_modules` confirma `mcp-js 3.5.0` e `zod 4.6.7`. O arquivo versionado `supabase/functions/mcp/index.ts` importa `npm:@lovable.dev/mcp-js@0.24.0` e `npm:zod@^3.25.76`.
**Prova executada:** qualquer execução de `npm run dev` ou `npm run build` dispara `scripts/patch-mcp-plugin.mjs` + geração e deixa o arquivo modificado — aconteceu duas vezes nesta auditoria, confirmado por `git status`/`git diff --stat` (13 inserções, 13 remoções, todas de versão de dependência).
**Causa raiz:** o pacote gerado é versionado, mas não é regenerado nem conferido quando as dependências sobem; `eslint.config.js:9` ainda o exclui da análise.
**Impacto no negócio:** o canal de integração (MCP) que roda em produção usa bibliotecas antigas, e o próximo deploy pode subir, sem aviso, uma versão com duas quebras de compatibilidade (zod 3→4, mcp-js 0.24→3.5) que ninguém testou. Além disso, todo desenvolvedor que roda o projeto vê um arquivo "sujo" e pode comitá-lo por acidente.

### G8-2 · Média · CONFIRMADO · **EXECUTADO** — `package-lock.json` não é estável: `npm install` o altera

**Evidência:** `npm install --legacy-peer-deps` (o comando que o CI usa) deixou `package-lock.json` modificado — `git diff --stat` acusou 30 remoções, todas de blocos `"libc": ["glibc"|"musl"]`. O lock foi gerado por outra versão de npm/plataforma.
**Causa raiz:** o CI usa `npm install`, que reescreve o lock, em vez de `npm ci`, que o respeita e falha quando divergente.
**Impacto no negócio:** duas construções do mesmo commit podem instalar versões diferentes de bibliotecas; um defeito que aparece em produção pode não aparecer na máquina de quem for investigar.

---

## G9 — Código morto confirmado

### G9-1 · Baixa · CONFIRMADO · RASTREADO — Dois módulos de hook sem nenhum importador

**Evidência:** `src/hooks/useFeatureFlag.ts` (singular) — zero importadores; o consumidor real, `src/components/lux/LushaIntelligenceView.tsx:11`, importa de `@/hooks/useFeatureFlags` (plural). `src/hooks/useCircuitBreakerAlerts.ts` — 117 linhas, 4 hooks exportados, zero referências.
**Observação sobre o arquivo morto:** `src/hooks/useFeatureFlag.ts:74-75` cria um `AbortController` que nunca é usado (`grep -rn "abortSignal" src/` → vazio) e `:119-120` grava no cache de módulo sem checar se a requisição foi cancelada. Se alguém "reaproveitar" esse arquivo achando que ele cancela requisições, herda o defeito.
**Impacto no negócio:** peso morto que confunde quem for mexer em liberação de recursos por cliente.

---

## G10 — Chave de acesso total ao banco publicada em repositório aberto

**Causa raiz:** uma função criada como "temporária" para uma migração ficou no repositório, protegida por uma senha escrita no próprio código, e o repositório é público.

### G10-1 · **CRÍTICA** · CONFIRMADO · **EXECUTADO** — O repositório é público, ao contrário de tudo o que a documentação afirma

**Evidência (EXECUTADO, consulta à API do GitHub):**

```
repository(owner:"adm01-debug", name:"Promo_Lux_V2") →
  { "isPrivate": false, "visibility": "PUBLIC" }
```

**Contradição:** `AGENTS.md` §Fluxo Git afirma "Repo `adm01-debug/Promo_Lux_V2`, `main`, **privado**"; `docs/agentes/github-ci.md:8` e `.github/workflows/dependency-review.yml:8` repetem a premissa.
**Agravante:** a varredura de segredos do GitHub está **desligada** (`github_list_secret_scanning_alerts` → 404 "Secret scanning is disabled"), então nenhum alerta automático existiria.
**Impacto no negócio:** tudo o que está no repositório — incluindo o item seguinte — está visível para qualquer pessoa na internet, e ninguém será avisado se um segredo entrar.

### G10-2 · **CRÍTICA** · CONFIRMADO · RASTREADO — Função pública entrega a chave mestra do banco a quem apresentar uma senha que está no código

**Evidência:** `supabase/functions/migrate-helper/index.ts`

```ts
:1-3   // Edge function temporária para migração de banco.
       // Após a migração, remova esta função.
:5     const ACCESS_KEY = "<senha de 48 caracteres, em texto, no arquivo>";
:7     "Access-Control-Allow-Origin": "*",
:14-15 const key = req.headers.get("x-access-key");
       if (key !== ACCESS_KEY) return ... 401 ...
:24-29 if (action === "credentials") {
         return new Response(JSON.stringify({
           url:          Deno.env.get("SUPABASE_URL"),
           service_role: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
           db_url:       Deno.env.get("SUPABASE_DB_URL"),
         }), ...);
```

`supabase/config.toml:14-15` define `[functions.migrate-helper] verify_jwt = false` — não exige nem sessão nem chave da plataforma.
(Tipo do segredo: chave de acesso própria, 48 caracteres hexadecimais, em texto no arquivo. O valor **não** é reproduzido neste relatório.)

**Está publicada?** `.github/workflows/edge-functions-deploy.yml:137` executa `supabase functions deploy --use-api --yes` **sem nomear função**, ou seja, publica todas as pastas de `supabase/functions/`, e o comentário em `:136` registra "Sem `--prune`: functions publicadas mas ausentes da main ficam intactas". `docs/prod-readiness.md:77` lista `migrate-helper` entre as funções de produção.
**Confirmação ao vivo:** tentei sondar `https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/migrate-helper` **sem** enviar a chave, só para ver se a função responde; o proxy de rede desta sessão bloqueou a conexão (`HTTP 000`). Portanto "está ativa neste instante" é **NÃO VERIFICADO**; o que está confirmado é o código publicado, o `verify_jwt = false` e o deploy que publica tudo.

**Impacto no negócio:** quem ler o código no GitHub obtém a credencial que ignora todas as regras de acesso do banco — pode ler, alterar e apagar os dados de todos os clientes, e ainda obter a string de conexão direta do banco. É o risco mais grave desta auditoria.

**O que fazer primeiro (fora do plano, é ação imediata):** apagar a função em produção, rotacionar a `service_role` e a senha do banco, e tornar o repositório privado. Rotacionar sem apagar não resolve: a função devolve sempre o valor atual.

---

## G11 — Execução de SQL arbitrário em produção, protegida só por um texto fixo

### G11-1 · **CRÍTICA** · CONFIRMADO · RASTREADO — `mcp-query` roda SQL livre com a chave mestra; o filtro de comandos destrutivos deixa passar `DELETE`, `UPDATE` e `GRANT`

**Evidência:** `supabase/functions/mcp-query/index.ts`

- `:38` autorização = comparar o cabeçalho `x-mcp-secret` com o segredo `MCP_SECRET` (texto fixo, sem expiração, sem vínculo com usuário, comparação não constante no tempo).
- `:76` o filtro chamado `DESTRUCTIVE` cobre apenas `DROP`, `TRUNCATE`, `ALTER SYSTEM` e `RESET ALL`. Passam: `DELETE`, `UPDATE`, `INSERT`, `GRANT`, `CREATE ROLE`, `COPY`.
- `:81` executa via `rpc/exec_sql` usando a chave `service_role`.
- `:49-66` no modo `admin`, repassa chamadas para `auth/v1/*` e `storage/v1/*` sem restrição de rota.
- `:11` CORS `*`; `supabase/config.toml:45-46` `verify_jwt = false`; nenhum limite de requisições.

**Agravante — a função que o próprio repositório classificou como execução remota de código continua existindo:** `supabase/migrations/20261113185209_*.sql:2-5` descreve `exec_sql` como "RCE em produção (comprovado)" e afirma "Nenhum chamador em `src/` ou `supabase/functions/`". A migration só executa `REVOKE` de `anon` e `authenticated` (`:12`) — **não** faz `DROP`, e `REVOKE` não afeta `service_role`. A afirmação "nenhum chamador" está **falsa hoje**: `supabase/functions/mcp-query/index.ts:81` a chama.

**Impacto no negócio:** quem obtiver esse texto fixo (ele vive em variável de ambiente, mas é o único portão) executa qualquer comando no banco de produção, inclusive apagar dados de clientes, e ainda administra contas e arquivos. Soma-se a G10-2, que entrega a chave mestra por outro caminho.

---

## G12 — Edge functions: "tem sessão" foi confundido com "tem permissão"

**Causa raiz:** 61 funções foram escritas em momentos diferentes, sem um guarda comum obrigatório. Umas validam sessão, papel e pertencimento à organização; outras param em "existe um JWT"; três não checam nada.

### G12-1 · Alta · CONFIRMADO · RASTREADO — Qualquer usuário logado dispara campanhas de e-mail de qualquer organização

**Evidência:** `supabase/functions/campaign-dispatch/index.ts:124-134` encerra a verificação ao constatar que há um JWT válido; `:152-156` consulta `campaigns` por `status = 'active'` **sem filtro de organização**; `:145` aceita `campaign_id` vindo do corpo da requisição, de qualquer organização.
**Padrão correto no repositório:** `supabase/functions/oracle-push-bitrix/index.ts:151` usa `getUserOrgIds` antes de agir.
**Impacto no negócio:** um usuário de um cliente pode disparar a campanha de outro cliente, enviando e-mail em nome dele e queimando a reputação do domínio.

### G12-2 · Alta · CONFIRMADO · RASTREADO — `webhook-dispatcher` entrega qualquer registro de envio a qualquer usuário logado

**Evidência:** `supabase/functions/webhook-dispatcher/index.ts:42-60` aceita qualquer JWT; `:69-81` usa o `delivery_id` recebido sem confrontá-lo com a organização do usuário, e a consulta roda com a chave `service_role` (que ignora as regras do banco).
**Impacto no negócio:** conteúdo de integração de um cliente fica acessível a usuário de outro.

### G12-3 · Alta · CONFIRMADO · RASTREADO — `gmaps-proxy` usa proxies de rede de qualquer organização

**Evidência:** `supabase/functions/gmaps-proxy/index.ts:385-391` lê a tabela `org_proxies` com `service_role` **sem** `.eq("organization_id", userOrgId)`, embora `userOrgId` já esteja disponível em `:242`.
**Impacto no negócio:** endereços de proxy costumam embutir usuário e senha. O proxy pago por um cliente pode ser usado — e exposto — no trabalho de outro.

### G12-4 · Alta · CONFIRMADO · RASTREADO — Três funções sem nenhuma verificação no código

**Evidência:** `supabase/functions/instagram-worker/index.ts:53-62`, `supabase/functions/health/index.ts:29`, `supabase/functions/auth-rate-limit/index.ts:33`. Nenhuma aparece em `supabase/config.toml`, então herdam `verify_jwt = true` — o que **não** é autenticação de pessoa: a chave anônima do projeto é um JWT válido e está no pacote público do site.
**Agravantes medidos:** `instagram-worker` dispara o motor de Instagram, que consome crédito pago (HikerAPI/Apify). `health/index.ts:121` grava um registro a cada chamada, `:88-94` faz uma consulta **paga** ao Google Places e `:84` revela quais segredos estão faltando.
**Impacto no negócio:** um estranho pode rodar o motor de raspagem e queimar crédito pago, e descobrir quais integrações estão quebradas.

### G12-5 · Alta · CONFIRMADO · RASTREADO — Controle de tentativas de login é furável e serve de porta para encher o banco

**Evidência:** `supabase/functions/auth-rate-limit/index.ts:70-113` lê, calcula e grava em duas idas separadas ao banco (não é operação atômica); `:62` usa `email|IP` como chave; sem nenhum guarda de acesso (G12-4).
**Padrão correto no repositório:** `supabase/functions/public-api/index.ts:136` usa uma função do banco que incrementa de forma atômica.
**Impacto no negócio:** o teto de 5 tentativas pode ser contornado com requisições simultâneas, e qualquer anônimo pode inflar a tabela indefinidamente.

### G12-6 · Média · CONFIRMADO · RASTREADO — Limite de uso da API pública falha abrindo, e conta por usuário em vez de por organização

**Evidência:** `supabase/functions/_shared/api-rate-limit.ts:11-13` declara a política de "liberar em caso de falha"; `supabase/functions/public-api/index.ts:136` descarta o erro da função do banco. O escopo da contagem é `user_id` (`:221,236,246`), embora a chave de API já carregue a organização (`:161`, usada apenas para registro).
**Impacto no negócio:** se a contagem falhar, o teto de 600 requisições por hora desaparece sem aviso; e um cliente com vários usuários multiplica o limite que deveria ser da conta.

---

## G13 — O portão obrigatório de segurança do banco está desarmado

### G13-1 · **CRÍTICA** · CONFIRMADO · **EXECUTADO** — O check obrigatório "Database Guards" aprova sem consultar o banco, porque o segredo que ele exige não existe

**Evidência dos scripts (saem com sucesso quando falta `SUPABASE_DB_URL`):** `scripts/check-function-grants.sh:15-19`, `scripts/check-audit-triggers.sh:15-19`, `scripts/check-security-definer.sh:16-19`, `scripts/check-queue-kind-coverage.sh:9-12`, `scripts/check-anon-grants-view.sh:17-21`.
**Evidência de que o segredo não existe (EXECUTADO, API do GitHub):** o repositório tem 6 segredos de Actions e nenhum é `SUPABASE_DB_URL` (`E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`, `VITE_ADMIN_LIST_TOKEN`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`).
**Evidência de que é obrigatório:** regra ativa na `main` exigindo os checks `quality-gate`, `Security Scan (...)` e `Database Guards (Grants/RLS + Audit Triggers)`.
**Prova empírica, colhida no CI desta própria auditoria (EXECUTADO):** o job `Database Guards (Grants/RLS + Audit Triggers)` da execução sobre o commit `0c2d567` concluiu com **success** emitindo cinco avisos — e nada mais:

```
warning | SUPABASE_DB_URL (ou DATABASE_URL) não configurada — guard de grants/RLS ignorado.
warning | SUPABASE_DB_URL (ou DATABASE_URL) não configurada — guard de auditoria ignorado.
warning | SUPABASE_DB_URL não configurada — guard de SECURITY DEFINER ignorado.
warning | SUPABASE_DB_URL (ou DATABASE_URL) não configurada — guard de queue_kind ignorado.
warning | SUPABASE_DB_URL (ou DATABASE_URL) não configurada — guard de anon grants ignorado.
```

Os cinco guardas se declararam **ignorados** e o check obrigatório ficou **verde**. Não é inferência de leitura de código: é o portão da `main` aprovando, hoje, sem ter verificado nada.

**Contradição interna:** `scripts/check-anon-grants-view.sh:9-10` promete por escrito "Em push sem `SUPABASE_DB_URL`: FALHA (obrigatório)" e `:17-21` faz o contrário; a variável `EVENT` lida em `:15` nunca é usada.
**Impacto no negócio:** uma função exposta a visitante anônimo, um gatilho de auditoria removido ou uma tabela sem regra de acesso chegam a produção com o selo verde de aprovado. É este portão que deveria ter pegado G10-2, G11-1 e G14-1.

### G13-2 · Alta · CONFIRMADO · RASTREADO — A varredura de segredos do CI é decorativa

**Evidência:** `.github/workflows/ci.yml:77-93` procura apenas os padrões `AKIA...` (Amazon) e `sk_live_...` (Stripe), e apenas em `src/` e `supabase/functions/`.
**O que passa por baixo:** `e2e/helpers/supabase.ts:18-20` tem um JWT de chave publicável do Supabase em texto, com endereço de projeto cravado (fora das pastas varridas); e nenhum padrão cobre JWT, chave do Supabase, token do GitHub ou `postgres://`. A chave de `migrate-helper` (G10-2) também não casa com nenhum dos dois padrões.
**Impacto no negócio:** o passo chamado "Security Scan" dá a impressão de que segredos não passam, e na prática quase nada é checado.

### G13-3 · Alta · CONFIRMADO · **EXECUTADO** — O retrato do banco que a documentação manda ler como fonte de verdade nunca foi gerado

**Evidência:** `.github/workflows/contexto.yml:95,238,241-247` depende do mesmo segredo inexistente `SUPABASE_DB_URL`; `git show origin/contexto:docs/contexto/00-INDEX.md` registra `docs/contexto/supabase/` como "ainda não existe — o produtor não rodou".
**Impacto no negócio:** `AGENTS.md` instrui qualquer pessoa (ou agente) a conferir no banco real antes de mexer em tabela, e essa fonte está vazia desde sempre. Todo mundo decide pelas migrations, que são histórico e não estado.

---

## G14 — Regras de acesso do banco: uma política global anula o isolamento entre clientes

> Todos os itens deste grupo são **RASTREADOS sobre o versionado** (241 migrations reproduzidas em ordem). O estado do banco vivo é **NÃO VERIFICADO** — ver `01-INVENTARIO.md` §6.

### G14-1 · **CRÍTICA** · CONFIRMADO (no versionado) · RASTREADO — Administrador de um cliente lê o registro de auditoria de todos os clientes

**Evidência:** duas políticas convivem na tabela `audit_logs`:

- escopada por organização: `"Admins view org audit logs"` — `supabase/migrations/20260422204526_*.sql:415`, usa `has_org_role`;
- **global**: `"Admins view audit logs"` — `supabase/migrations/20260513140617_*.sql:54`, `USING (public.has_role(auth.uid(),'admin'))`.

Nenhuma migration remove nenhuma das duas, e políticas de leitura se somam (OR), então a global **amplia** o acesso. `has_role` é global porque a tabela `user_roles` não tem coluna de organização (`20260513140617_*.sql:10-15`).
**Mesma causa:** exclusão em `automation_execution_logs` (`20260712185444_*.sql:59`).
**Padrão correto no repositório:** `retry_policy_advisories` (`20260721204338_*.sql:38-43`).
**Impacto no negócio:** quem administra uma conta consegue ver o histórico de ações dos clientes concorrentes na mesma plataforma — inclusive quem acessou o quê. Em contrato multiempresa, é quebra de confidencialidade.

### G14-2 · Alta · CONFIRMADO (no versionado) · RASTREADO — Dois caches de enriquecimento são legíveis por qualquer usuário logado

**Evidência:** `apollo_search_cache` — `supabase/migrations/20260726202430_*.sql:18` e `cnpj_enrich_cache` — `supabase/migrations/20260723163333_*.sql:15`, ambas com `USING (true)` para `authenticated`.
**Nota de precisão:** as outras 13 ocorrências de `USING (true)` são tabelas de monitoramento sem dado de cliente, e as 44 do tipo `FOR ALL TO service_role USING (true)` são o padrão normal — não são achado.
**Impacto no negócio:** a lista de empresas que um cliente andou pesquisando e enriquecendo fica visível para usuários de outros clientes. É inteligência comercial vazando.

### G14-3 · Média · CONFIRMADO (no versionado) · RASTREADO — Onze políticas criadas com guarda "se não existir", o que esconde divergência

**Evidência:** blocos `DO $$ ... IF NOT EXISTS (… policyname = …)` em 11 políticas, inclusive nos arquivos cujo nome termina em `_redeclara`, afetando `lusha_contacts` e `lusha_search_sessions`.
**Causa raiz:** a guarda é por **nome**. Se o banco já tiver uma política com aquele nome e regra diferente, a migration passa em silêncio e a regra antiga permanece.
**Impacto no negócio:** não é possível afirmar pelo repositório qual regra vale nessas tabelas em produção. Precisa de conferência direta no banco.

---

## G15 — Telas que avisam "salvo" quando o banco recusou a gravação

### G15-1 · Alta · CONFIRMADO (no versionado) · RASTREADO — Três funcionalidades gravam no vazio e exibem sucesso

**Causa raiz:** uma atualização que nenhuma política permite afeta zero linhas **sem devolver erro**; o front interpreta "zero linhas" como sucesso.

| O que o usuário faz                                                | Onde o front grava                                                                     | Por que o banco recusa                                                                                                                                                                                                        |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Dispensar" recomendação de política de repetição                  | `src/components/lux/monitoring/RetryPolicyAdvisoriesPanel.tsx:87-91` (`UPDATE` direto) | `supabase/migrations/20260721204338_*.sql:35-36` remove a política de `UPDATE` de propósito ("só via funções `SECURITY DEFINER`"). O mesmo arquivo usa a chamada correta nas linhas 72 e 104 — só o "dispensar" ficou de fora |
| Ligar/desligar a API nova do Google Places (**controle de custo**) | `src/components/lux/settings/PlacesApiNewToggle.tsx:37-48` (`INSERT`/`UPDATE`)         | `feature_flags` só tem política de leitura para `authenticated` — `supabase/migrations/20260513143000_*.sql:45-50`                                                                                                            |
| Registro de violação de organização no histórico                   | `src/lib/orgErrorHandler.ts:479-488` (`INSERT` do navegador)                           | `audit_logs` não tem política de `INSERT` para `authenticated`; o erro é engolido em `:489`. Existe até um índice criado só para esse dado (`20260711194801_*.sql:3-5`) que nunca recebe nada                                 |

**Impacto no negócio:** o aviso "Recomendação dispensada" aparece e a recomendação volta sempre; o interruptor que controla gasto com a API do Google parece mudar e não muda; e o histórico de tentativas de acesso indevido nunca é gravado.

---

## G16 — Fluxos principais que terminam sem entregar o que prometeram

### G16-1 · **CRÍTICA** · CONFIRMADO · RASTREADO — Raspagem de contingência cobra, marca "concluído" e joga os resultados fora

**Evidência:** `supabase/functions/scrape-queue-worker/index.ts:106-144` — a função `completeWithPlacesFallback` entra em ação quando o provedor externo falha:

```ts
:118  const rows = await fetchPlacesResults(keywords, 20, ...);   // consulta PAGA ao Google Places
:119  if (!rows?.length) return false;
:122-131  await supabase.from("scrape_jobs").update({
            status: "completed", results_count: rows.length, completed_at: ...
          }).eq("id", task.scrape_job_id);
:132  await supabase.rpc("complete_scrape_task", { _id: task.id });
```

Entre a linha 118 e a 132 **não existe nenhuma gravação de `rows`** em `scrape_results` nem em `companies`. A persistência desses dados só existe em outro lugar: `supabase/functions/gmaps-proxy/index.ts:712-731`, na ação `sync-results`, que não roda para job já marcado como `completed` (`runAutoSync`, `gmaps-proxy/index.ts:125-172`, só altera `status`).
**Mesmo padrão:** `supabase/functions/gmaps-proxy/index.ts:506-525`; e ali o `sync-results` (`:601-610`) **refaz a mesma consulta paga**, pagando duas vezes pelo mesmo dado.
**Sinal coerente com o defeito:** `docs/agentes/servicos-externos.md` registra `scrape_results = 0`.
**Impacto no negócio:** quando o raspador externo falha, o cliente paga a consulta ao Google, vê "20 empresas encontradas, concluído" e não recebe empresa nenhuma na lista. Dinheiro gasto, resultado perdido, e o painel diz que deu tudo certo.

### G16-2 · Alta · CONFIRMADO (no versionado) · RASTREADO — Webhooks cadastrados pelo cliente nunca saem sozinhos

**Evidência do produtor:** `supabase/migrations/20260422203255_*.sql:113` grava a entrega com `status = 'pending'`, por gatilho nas tabelas de empresas, negócios e contatos (`:119-124`).
**Evidência da ausência de consumidor agendado:** nenhuma migration agenda `webhook-dispatcher` (busca por `webhook-dispatcher` em `supabase/migrations/` devolve só comentários, nas linhas `20260718140500_*.sql:2,17` e `20260711192630_*.sql:5`). O único chamador no repositório é o botão de reenvio manual da interface: `src/hooks/useWebhooks.ts:125`.
**Por que não é certeza absoluta:** agendamentos podem existir no banco sem estar versionados; não há acesso SQL nesta sessão.
**Impacto no negócio:** o cliente cadastra uma integração, o sistema enfileira os avisos e eles ficam parados até alguém clicar em "reenviar" na tela. A integração parece pronta e não funciona.

### G16-3 · Alta · CONFIRMADO · RASTREADO — Listar jobs do raspador traz trabalho de outros clientes do fornecedor para dentro da conta

**Evidência:** `supabase/functions/gmaps-proxy/index.ts:275-303` chama `GET https://gmaps.atomicabr.com.br/api/v1/jobs` **sem credencial alguma** e, para cada job devolvido, executa `insert({ user_id: userId, organization_id: userOrgId, external_id: job.ID, name: job.Name, config: job.Data })`.
**Causa raiz:** o endpoint do fornecedor é compartilhado e não filtra por cliente; o código assume que tudo o que volta é do usuário que pediu.
**Impacto no negócio:** ao abrir o painel de raspagem, o cliente vê nomes e configurações de buscas de outros clientes do mesmo fornecedor, contabilizados como dele. É vazamento em duas direções: ele vê o dos outros, e provavelmente os outros veem o dele.

### G16-4 · Alta · CONFIRMADO · RASTREADO — "Status do Sistema" no menu é inteiramente fictício, e o monitoramento real não tem link

**Evidência:** o item do menu (`src/components/lux/layout/nav-items.ts:52` → `src/lib/viewRegistry.ts:29`) abre `src/components/lux/monitoring/MonitoringView.tsx`, que contém:

```
:31-33  // for now mock success → return { status: "healthy" }
:51     // Simulated metrics for demonstration
:84,95,106,117   valores fixos: 124ms, 99.98%, 0.02%, 100%
:188-191         quatro edge functions com status="online" escrito à mão
:202             "Visualização de mapa em desenvolvimento"
```

O selo verde "Sistemas Operacionais" (`:70`) deriva desses valores fixos — **nunca** fica vermelho.
Em paralelo, `src/pages/Monitoring.tsx` (736 linhas, ~40 painéis reais de SLA, fila morta, disjuntores e incidentes) existe na rota `/monitoring` e **nenhum lugar do sistema tem link para ela** (busca exaustiva por `navigate()`, `to=`, `href=`, `window.location.href` em `src/` devolve apenas `/`, `/login` e `/?view=lusha`).
**Impacto no negócio:** o painel que o dono abre para saber se o sistema está de pé mostra "tudo operacional" mesmo durante uma queda total; e o painel que mostraria a verdade está escondido.

### G16-5 · Alta · CONFIRMADO · RASTREADO — Quatro rotas existem e não têm nenhuma porta de entrada

**Evidência:** `src/App.tsx:222` `/monitoring`, `:232` `/settings/cnpj`, `:242` `/admin/companies`, `:260` `/status` — nenhuma é alcançável por link, menu ou botão (mesma busca exaustiva do item anterior).
**Agravante:** `/settings/cnpj` é onde se guarda a credencial da CNPJá e fica o interruptor que **controla custo de enriquecimento**.
**Impacto no negócio:** quatro telas construídas e pagas que só funcionam para quem digitar o endereço de cabeça.

### G16-6 · Alta · CONFIRMADO · RASTREADO — Nove botões não fazem nada, e o caminho para criar o primeiro fluxo automatizado não aparece

**Evidência:** `src/components/lux/AutomationsList.tsx` — usado no **painel inicial** (`src/components/lux/DashboardView.tsx:235`) — não tem **nenhuma** ocorrência de `onClick`, `onSubmit` ou `handle` no arquivo: `:86` botão "Nova", `:162` play/pause, `:165` recarregar, `:128` linha com `cursor-pointer` sem clique. Em `:105-110`, passa `actionLabel="Criar Workflow"` **sem** `onAction`; pelo contrato de `src/components/lux/EmptyState.tsx:40-44`, o botão não é renderizado — então um cliente novo não tem caminho nenhum para criar o primeiro fluxo.
`src/components/lux/CompanyDetailModal.tsx:430-447` — cinco ações mortas: "Enviar Email", "Iniciar Sequência", "Adicionar ao CRM", "Enriquecer" e "Visitar Site" (esta nem abre `company.website`).
`src/components/lux/CompanyTableRow.tsx:141` — o ícone de olho "Ver detalhes" não tem `onClick` na versão de computador, e o `<td>` em `:139` bloqueia a propagação do clique da linha; a versão de celular (`:163`) funciona.
**Por que os testes não pegam:** `src/components/lux/__tests__/DashboardView.test.tsx:81` substitui `AutomationsList` por um dublê, então nenhum dos 987 testes passa por esse código.
**Impacto no negócio:** o cliente clica e nada acontece — o pior tipo de defeito, porque ele não sabe se foi ele que errou.

---

## G17 — Concorrência e repetição: e-mails e cobranças podem acontecer duas vezes

### G17-1 · Alta · CONFIRMADO · RASTREADO — Campanha pode enviar o mesmo e-mail duas vezes para o mesmo destinatário

**Evidência:** `supabase/functions/campaign-dispatch/index.ts:10-11` afirma em comentário que é idempotente pelos status `pending`/`queued`; a consulta real em `:209-218` **não filtra por esses status e não reserva nada**. O envio acontece em `:362-365`, e só depois, em `:369`, há a gravação em `campaign_messages`, cujo índice único (`supabase/migrations/20260711164350_*.sql:14-15`) impede o **registro** duplicado, não o **envio**. A função aceita tanto chamada de agendamento quanto de usuário, e o agendamento roda a cada 10 minutos.
**Padrão correto no repositório:** `supabase/functions/send-scheduled-reports/index.ts:369-382` reserva a etapa antes de enviar; `supabase/functions/webhook-dispatcher/index.ts:99-104` faz a reserva atômica.
**Impacto no negócio:** o mesmo cliente final recebe o e-mail duas vezes, o que derruba reputação de domínio e gera descadastro.

### G17-2 · Média · CONFIRMADO · RASTREADO — Enfileiramento do Instagram duplica sob concorrência e aceita parâmetro não validado

**Evidência:** `supabase/functions/instagram-enqueue/index.ts:108-112` verifica duplicidade e depois insere (duas operações separadas); `:118` monta `params: { limit, ...params }`, deixando o corpo bruto da requisição sobrescrever o `limit` que havia sido validado em `:66`.
**Impacto no negócio:** a mesma tarefa paga pode ser enfileirada duas vezes, e um valor de limite fora da faixa pode ser injetado pelo cliente.

### G17-3 · Alta · CONFIRMADO (no versionado) · RASTREADO — Três filas ficam fora do mecanismo que destrava item preso

**Evidência:** `reap_stuck_queue_tasks` (`supabase/migrations/20260723134028_*.sql`, agendado de 1 em 1 minuto) cobre `instagram_scrape_queue`, `scrape_queue` e `web_scrape_queue`. Ficam de fora:

- `webhook_deliveries` travadas em `sending` — `supabase/functions/webhook-dispatcher/index.ts:99-104` tranca, e `:74-81` só volta a buscar `pending`/`retrying`;
- `cnpj_enrich_queue` travada em `processing` — `supabase/migrations/20260723163333_*.sql:118-124`;
- `lusha_decision_makers` com `enrichment_status = 'pushing_bitrix'` — `supabase/functions/oracle-push-bitrix/index.ts:182`; a expressão `pushing_bitrix` não aparece em nenhuma migration, ou seja, nada destrava.
  **Impacto no negócio:** se um envio cair no meio, aquele item fica "em processamento" para sempre e ninguém é avisado.

### G17-4 · Média · CONFIRMADO · RASTREADO — Tarefa do Instagram pode repetir para sempre

**Evidência:** `supabase/functions/instagram-worker/index.ts:134-151` devolve o contador `attempt` em caso de erro de rede ou tempo esgotado, em vez de incrementá-lo rumo ao limite — a tarefa nunca "morre". Agrava: `supabase/functions/_shared/hiker-client.ts:133,211-218` dorme até 600 segundos dentro da mesma invocação, e `supabase/functions/dlq-alerts/index.ts:16` cobre apenas `"scrape"` e `"web"`, deixando a fila morta do Instagram sem alerta.
**Impacto no negócio:** uma tarefa com defeito fica chamando a API paga em círculo, sem teto e sem alarme.

### G17-5 · Média · CONFIRMADO · RASTREADO — Reenvio de webhook repete em erro que nunca vai dar certo

**Evidência:** `supabase/functions/webhook-dispatcher/index.ts:164-183` repete qualquer resposta diferente de 2xx, incluindo 400, 401 e 404; não há disjuntor por destino. A classificação correta de erro existe no repositório e não é usada: `supabase/functions/scrape-queue-worker/index.ts:90-95`. O intervalo real entre tentativas (`:28-32`: 30 s / 2 min / 8 min / 30 min) também não é o que `docs/webhooks.md` promete (1 min / 5 min / 15 min / 1 h / 6 h).
**Impacto no negócio:** um endereço de webhook digitado errado gera tentativas repetidas por horas, e o cliente nunca descobre que a URL está errada.

### G17-6 · Média · CONFIRMADO · RASTREADO — Rastreio de abertura e clique de e-mail pode ser inflado por repetição

**Evidência:** `supabase/functions/_shared/tracking-signature.ts:17-19` assina apenas o par (destinatário, URL) — sem prazo de validade e sem número de uso único; `supabase/functions/track-open/index.ts:57` e `supabase/functions/track-click/index.ts:56` gravam a cada chamada válida, sem limite de frequência.
**O que está correto e não deve mudar:** a assinatura é HMAC com comparação de tempo constante e o redirecionamento aberto está fechado (`_shared/tracking-signature.ts:38-54`).
**Impacto no negócio:** as taxas de abertura e de clique das campanhas podem ser infladas por repetição do mesmo link, e a decisão de qual campanha funciona passa a se basear em número falso.

---

## G18 — Chamadas a terceiros sem prazo-limite e sem teto de gasto

### G18-1 · Alta · CONFIRMADO · RASTREADO — Pelo menos 25 chamadas a serviços externos sem tempo-limite

**Evidência (arquivo:linha):** `supabase/functions/campaign-dispatch/index.ts:564,660,685,700`; `email-poll-replies/index.ts:250,283,292,328`; `send-scheduled-reports/index.ts:258,313,326`; `email-oauth-callback/index.ts:65,73,82,90`; `_shared/apify-gateway.ts:277,314,367`; `ai-agent/index.ts:161`; `web-scrape-extract/index.ts:70`; `lusha-reveal/index.ts:222`; `lusha-decision-makers/index.ts:440`; `gmaps-places-search/index.ts:74`; `mcp-query/index.ts:54,81`.
**Causa raiz:** os clientes compartilhados em `_shared/` têm tempo-limite; os `fetch` soltos escritos direto nas funções de entrada, não. `docs/agentes/servicos-externos.md` proíbe isso por escrito.
**Padrão correto no repositório:** `supabase/functions/webhook-dispatcher/index.ts:149-162` e `supabase/functions/health/index.ts:70,88,108`.
**Impacto no negócio:** quando um fornecedor fica lento, a função trava até o limite da plataforma, o agendamento seguinte se sobrepõe e a fila para. Todo o caminho de e-mail e de IA está nessa condição.

### G18-2 · Alta · CONFIRMADO · RASTREADO — Nenhum teto de gasto nas integrações pagas, e o registro de consumo nunca é gravado

**Evidência:** a tabela `lusha_credit_usage_log` está declarada como somente-inclusão em `src/integrations/supabase/withOrg.ts:177`, mas **nenhuma função grava nela**; o custo devolvido pela API é descartado em `supabase/functions/lusha-reveal/index.ts:302`. Sem nenhum limite de frequência: `ai-agent`, `web-scrape-extract`, `gmaps-places-search`, `instagram-enqueue`, `web-scrape-enqueue`. As duas verificações que existem liberam em caso de falha: `supabase/functions/lusha-search/index.ts:298-299` e `supabase/functions/_shared/api-rate-limit.ts:11-13`.
**Impacto no negócio:** não há como saber quanto cada cliente consumiu de crédito pago, nem como impedir que um laço de repetição gere uma fatura inesperada.

### G18-3 · Média · CONFIRMADO · RASTREADO — Resposta de terceiro usada sem conferência de formato

**Evidência:** `supabase/functions/_shared/apify-gateway.ts:287,318` (`payload.data as ApifyRun`, conversão de tipo sem validar); `_shared/bitrix-client.ts:108`; `supabase/functions/gmaps-proxy/index.ts:331,489` (`data?.id ?? data?.ID ?? null` — quando o formato muda, cai no caminho pago alternativo em silêncio).
**Impacto no negócio:** se o fornecedor mudar o formato da resposta, o sistema não acusa erro: ele passa a gastar pelo caminho alternativo sem ninguém perceber.

### G18-4 · Média · CONFIRMADO · RASTREADO — A proteção do fluxo de login por provedor externo (OAuth) é decorativa

**Evidência:** o valor de uso único é gerado em `supabase/functions/email-oauth-connect/index.ts:79` e **nunca é guardado**; `supabase/functions/email-oauth-callback/index.ts:28-36` apenas compara `stateParts[0] === userId`.
**Impacto no negócio:** a proteção contra um terceiro induzir a vítima a conectar a caixa de e-mail errada não está de pé.

---

## G19 — Listagens sem limite e consultas que trazem a tabela inteira

### G19-1 · Alta · CONFIRMADO · RASTREADO — As listas baixam tudo e paginam dentro do navegador

**Evidência:** `src/components/lux/CompaniesView.tsx:73` define `itemsPerPage = 20`, mas `:80` executa `db.from("companies").select("*")` **sem** `.limit()` nem `.range()`. O mesmo em `src/components/lux/StakeholderFinderView.tsx:63`, `src/components/lux/CompaniesMapView.tsx:27-37` (que ainda traz a coluna `raw_data`, um bloco JSON bruto) e em mais 21 arquivos.
**Agravante medido:** o PostgREST corta a resposta no teto `db_max_rows` **sem avisar o cliente**, e `supabase/config.toml` não define `db_max_rows` — vale o padrão da hospedagem. Passando do teto, lista, contadores, filtros e mapa ficam errados em silêncio.
**Padrão correto no repositório:** `src/pages/AdminCompanies.tsx:52` usa `limit: "500"` e mostra o total ao lado do exibido.
**Impacto no negócio:** quando a carteira de empresas crescer, a tela fica lenta e, pior, passa a mostrar números errados sem avisar — o cliente acha que tem menos empresas do que tem.

### G19-2 · Baixa · CONFIRMADO (no versionado) · RASTREADO — Índices faltando e índices repetidos

**Evidência:** `automation_execution_logs(organization_id, created_at DESC)` está indexada **três vezes**; `supabase/migrations/20260514211631_*.sql:10-14` recriou com sufixo `_org_id` cinco índices que já existiam com sufixo `_org` (11 grupos de duplicidade no total). Do outro lado, `organization_id` não é a primeira coluna de nenhum índice em 8 tabelas, e `idempotency_keys` (`supabase/migrations/20260513140150_*.sql:2`) não tem **nenhum** índice.
**Impacto no negócio:** escrita mais lenta e mais espaço pago do que o necessário; e consultas de controle de duplicidade percorrem a tabela toda.

---

## G20 — Regras de negócio que só existem no navegador

### G20-1 · Alta · CONFIRMADO · RASTREADO — CNPJ é validado só na tela; a restrição no banco está comentada

**Evidência:** `src/schemas/company.ts:5-16` valida os dígitos verificadores do CNPJ. Na migration `supabase/migrations/20260514211631_*.sql:16-18` a restrição equivalente está **comentada**, com o texto `-- Actually, let's keep it flexible for now.`, e nenhuma das 241 migrations cria uma restrição de CNPJ em `public.companies`.
**Prova da assimetria dentro do próprio repositório:** as tabelas de cache **exigem** o formato — `supabase/migrations/20260723163333_*.sql:4,36` tem `cnpj ~ '^[0-9]{14}$'`.
**Impacto no negócio:** qualquer gravação que não passe pelo formulário (raspagem, importação de planilha, função de backend, API pública) entra com CNPJ em formato livre e **nunca casa** com o cache de enriquecimento — o cliente paga de novo pelo mesmo CNPJ. Mesma situação, só no navegador: e-mail, site, LinkedIn, Instagram e nome obrigatório.

### G20-2 · Média · CONFIRMADO (no versionado) · RASTREADO — Vinte e quatro campos de situação aceitam qualquer texto

**Evidência:** 24 colunas `status`/`type` em texto livre sem restrição de valores permitidos, entre elas `campaigns.status` e `scrape_jobs.status`.
**Impacto no negócio:** um erro de digitação no código cria uma situação nova que nenhuma tela entende, e o registro desaparece dos filtros sem dar erro.

### G20-3 · Média · CONFIRMADO (no versionado) · RASTREADO — Quinze tabelas guardam a organização sem vínculo formal

**Evidência:** apenas 50 das 65 tabelas com `organization_id` declaram a chave estrangeira correspondente.
**Impacto no negócio:** se uma organização for removida, sobram registros apontando para ela — dado órfão que continua aparecendo em contagem e relatório.

### G20-4 · Média · CONFIRMADO (no versionado) · RASTREADO — Itens excluídos continuam visíveis em nove tabelas pelo lado do banco

**Evidência:** de 12 tabelas com a coluna `deleted_at`, nove têm política de leitura que **não** filtra os excluídos: `companies`, `deals`, `campaigns`, `workflows`, `api_keys`, `webhooks`, `email_accounts`, `email_suppressions`, `organization_members`. O padrão correto existe em `scheduled_reports`.
**Relação com G1-1:** o filtro de excluídos só é aplicado pelo wrapper do navegador; quando ele falha (sem organização ativa) ou quando a consulta não passa por ele, o item excluído reaparece.
**Impacto no negócio:** empresa que foi para a lixeira volta a aparecer em lista, contagem, relatório e exportação, dependendo da tela.

### G20-5 · Média · CONFIRMADO (no versionado) · RASTREADO — As tabelas de permissão e configuração não têm registro de auditoria

**Evidência:** o gatilho de auditoria está presente em 8 tabelas e ausente nas 15 de permissão e configuração, incluindo `user_roles`, `role_permissions`, `api_keys`, `ip_allowlist` e `organizations`.
**Impacto no negócio:** se alguém se promover a administrador ou criar uma chave de API, não fica rastro. Combinado com G14-1 (auditoria visível entre clientes), o controle de quem fez o quê está nas duas pontas quebrado.

---

## G21 — Permissões declaradas numa matriz que a interface não aplica

### G21-1 · Média · CONFIRMADO · RASTREADO — Menu mostra auditoria e infraestrutura para todos os papéis

**Evidência:** `src/lib/permissions.ts:45` declara `audit_logs.view: ADMIN_ONLY`, mas `src/components/lux/layout/Sidebar.tsx:116-142` renderiza os 23 itens de menu **sem filtro de papel**. O componente `PermissionGate` é usado em **3 de 272** componentes (`ScrapeResultsView`, `DealsView`, `IntegrationsView`). Sem nenhum portão: `AuditTrailPanel`, `VaultCookiesPanel`, `ChaosEngineeringPanel`, `RLSDiscoveryView` e `src/pages/Monitoring.tsx` inteira.
`src/components/lux/monitoring/MonitoringView.tsx:41` lê `audit_logs` com `supabase.from` **direto**, fora do wrapper de organização.
**Nota de precisão:** o portão real é a regra do banco, e `src/components/lux/permissions/PermissionGate.tsx:14-15` documenta isso. O achado é a divergência entre a matriz declarada e a interface. A cobertura real das regras do banco é **NÃO VERIFICADA** — e G14-1 mostra que, ao menos em `audit_logs`, ela é mais frouxa do que se supõe.
**Impacto no negócio:** um usuário de perfil básico vê no menu telas de auditoria e infraestrutura; quando clica, recebe erro ou tela vazia. Promete acesso que não existe e expõe a estrutura interna.

### G21-2 · Baixa · CONFIRMADO · RASTREADO — Nome e identificador de organização real embutidos no pacote público do site

**Evidência:** `src/pages/AdminCompanies.tsx:28-37` — mapa `ORG_LABELS` com um identificador real associado ao nome `"Promo Brindes"`, mais 8 identificadores de teste; organização fora da lista cai em `id.slice(0,8)` (`:41`).
**Impacto no negócio:** o nome de um cliente e identificadores internos ficam legíveis no código que vai para o navegador de qualquer visitante.

---

## G22 — Nenhum alarme: a falha acontece e ninguém é avisado

### G22-1 · Alta · CONFIRMADO · **EXECUTADO** — Não existe monitoramento de erro no site

**Evidência:** busca por Sentry, Datadog, LogRocket, Bugsnag e Rollbar em `src/`, `package.json` e `index.html` → zero ocorrências. Só existe o `src/components/lux/ErrorBoundary.tsx`, que troca a tela branca por uma mensagem — e não avisa ninguém.
**Impacto no negócio:** se o site quebrar para um cliente, a empresa só descobre se ele reclamar.

### G22-2 · Alta · CONFIRMADO · RASTREADO — Nenhum workflow de CI notifica falha, e o teste de produção roda uma vez por dia

**Evidência:** o único `if: failure()` do repositório escreve no resumo do run; o teste de fumaça de produção roda por agendamento às 09:00 UTC, desacoplado do deploy. Os guardas de fila só rodam dentro do `db-guards`, que está desarmado (G13-1).
**Impacto no negócio:** um deploy pode quebrar produção às 10h e ninguém saber até as 9h do dia seguinte — se alguém abrir o relatório.

### G22-3 · Alta · CONFIRMADO · RASTREADO — Não há caminho de volta documentado para nenhum dos dois deploys automáticos

**Evidência:** busca por `rollback`, `reverter` e `revert` em `docs/agentes/lovable-deploy.md` e `docs/agentes/github-ci.md` → zero. Entretanto, juntar na `main` publica o site automaticamente, e `.github/workflows/db-migrations.yml:165-169` executa `supabase db push --yes --linked` em produção.
**Impacto no negócio:** quando um deploy quebrar, ninguém sabe qual é o procedimento para voltar — e migration aplicada não volta sozinha.

### G22-4 · Média · CONFIRMADO · RASTREADO — Integração caída é reportada como "tudo certo"

**Evidência:** `supabase/functions/lusha-cookie-health/index.ts:162-171` — o bloco de captura devolve **HTTP 200** com `{status:"error"}` no corpo; o painel lê o código HTTP e marca verde. O padrão correto existe em `supabase/functions/dlq-alerts/index.ts:121-125` (devolve 500).
**Impacto no negócio:** a integração da Lusha pode estar fora do ar com o indicador verde na tela.

### G22-5 · Média · CONFIRMADO · RASTREADO — Três modelos diferentes de autenticação de agendamento convivem, e dois comparam com um segredo que o próprio repositório diz estar errado

**Evidência:** `supabase/functions/_shared/cron-auth.ts:3-7` registra por escrito que "o valor em tempo de execução de `SUPABASE_SERVICE_ROLE_KEY` NÃO corresponde a nenhuma chave listável do projeto… quebrava todos os crons". Ainda assim, continuam fazendo exatamente essa comparação: `supabase/functions/api-latency-alerts/index.ts:60`, `supabase/functions/audit-logs-prune/index.ts:11`, `supabase/functions/instagram-worker-health/index.ts:35`. Em contraste, 20 funções usam `isCronAuthorized` e 3 não têm portão nenhum.
**Consequência provável:** a limpeza de registros de auditoria com mais de 90 dias (G7-4) e os alertas de latência não rodam.
**Por que é provável e não certo:** exigiria o valor do segredo em produção ou os registros de execução do agendamento — **NÃO VERIFICADO** nesta sessão.

### G22-6 · Média · CONFIRMADO · RASTREADO — Detalhe interno de erro devolvido ao cliente em 47 pontos

**Evidência:** mais graves em `supabase/functions/public-api/index.ts:229,237,248,260,266,272` (é a API que clientes externos consomem) e `supabase/functions/mcp-query/index.ts:92` (erro cru do Postgres). Rastro de execução devolvido ao cliente em `supabase/functions/lusha-decision-makers/index.ts:752` e `supabase/functions/workflow-engine/index.ts:344,486,568`.
**Impacto no negócio:** nomes de tabela e estrutura interna do banco chegam a quem chama a API — material pronto para quem quiser atacar.

### G22-7 · Baixa · CONFIRMADO · RASTREADO — Três formatos de erro diferentes nas respostas das funções

**Evidência:** `{error}`, `{ok, error}` e **texto puro** (`supabase/functions/audit-logs-prune/index.ts:12`, `purge-soft-deleted/index.ts:19`, `track-click/index.ts:28,32,43,46`).
**Impacto no negócio:** quem integra com a API precisa tratar três formatos; a tela nem sempre consegue mostrar a mensagem certa.

---

## G23 — Configuração de ambiente e dependências com pontas soltas

### G23-1 · Alta · CONFIRMADO · RASTREADO — O domínio usado como padrão nas regras de origem é o endereço morto

**Evidência:** as 9 funções com lista de origens permitidas caem no padrão `ALLOWED_ORIGINS[0] = "https://lux-ai-company-finder.lovable.app"` — o endereço que `AGENTS.md` declara morto — em vez de `https://promo-lux-v2.vercel.app`, que é a produção real. Outras 24 funções usam `*` e 16 usam o padrão do SDK.
**Nota de precisão:** o `*` em si tem risco baixo aqui, porque nenhuma função usa cookie nem `Allow-Credentials`. O problema concreto é o padrão apontar para o domínio errado.
**Impacto no negócio:** quando alguém endurecer a configuração, o site de produção é que vai ser bloqueado.

### G23-2 · Alta · CONFIRMADO · **EXECUTADO** — O pacote gerado da função `mcp` está com o projeto de teste gravado dentro

**Evidência:** `supabase/functions/mcp/index.ts:220` — `var projectRef = "local-e2e"`, o que produz o emissor de autenticação `https://local-e2e.supabase.co/auth/v1`, combinado com `verify_jwt = false` em `supabase/config.toml:37-38`.
**Nota para a documentação:** `AGENTS.md` cita exatamente essa linha como prova de que o projeto oficial é `pttzwlbidamibjssqiqb`; hoje ela diz `local-e2e`.
**Impacto no negócio:** o canal de integração MCP valida credencial contra um projeto que não existe — ou seja, não valida nada.

### G23-3 · Média · CONFIRMADO · **EXECUTADO** — O verificador de mensagem de commit está instalado, duplicado e quebrado

**Evidência:** `npx commitlint` → **erro** `ReferenceError: module is not defined in ES module scope`; existem dois arquivos de configuração (`commitlint.config.cjs` e `commitlint.config.js`) e **não existe** `.husky/commit-msg` para executá-lo.
**Impacto no negócio:** ligar essa verificação hoje travaria todos os commits até que o arquivo duplicado fosse removido.

### G23-4 · Média · CONFIRMADO · RASTREADO — Dezesseis funções dependem de um caminho de importação com versão flutuante

**Evidência:** 16 funções importam `npm:@supabase/supabase-js@2/cors`. O comentário em `supabase/functions/purge-soft-deleted/index.ts:10-11` afirma que esse caminho "nem existe como subpath — a função nunca carregava"; hoje ele **existe** (`node_modules/@supabase/supabase-js/package.json` v2.101.1 declara `"./cors"` em `exports`).
**Causa raiz:** a versão está presa só na linha principal (`@2`), então qualquer publicação futura que remova esse caminho derruba as 16 funções no momento de iniciar.
**Impacto no negócio:** uma atualização da biblioteca, feita por terceiros, pode derrubar um terço do backend de uma vez.

### G23-5 · Média · CONFIRMADO · **EXECUTADO** — O segredo antigo do painel administrativo continua cadastrado

**Evidência:** o segredo `VITE_ADMIN_LIST_TOKEN` ainda existe nos segredos de Actions, com data de atualização igual à de criação (07/09), embora o código já tenha sido corrigido para exigir sessão e papel de administrador (`supabase/functions/admin-list-companies/index.ts:30-35`).
**Agravante:** `.gitignore:52` registra por escrito que esse token e chaves de produção **já vazaram** em um `.env` versionado.
**Impacto no negócio:** um segredo que já vazou continua cadastrado e nunca foi trocado.

### G23-6 · Média · CONFIRMADO · RASTREADO — O ambiente `staging` recebe credenciais sem nenhuma proteção

**Evidência:** o ambiente `staging` tem `protection_rules: []` e `deployment_branch_policy: null`, e recebe `SUPABASE_ACCESS_TOKEN` e `DB_PASSWORD` no passo de planejamento de qualquer pull request.
**Impacto no negócio:** qualquer alteração aberta no repositório — que é público (G10-1) — pode acionar um passo que tem acesso a essas credenciais.

### G23-7 · Baixa · CONFIRMADO · **EXECUTADO** — Três arquivos de trava de dependência e instalação que reescreve a trava

Ver G8-2. Complemento: coexistem `package-lock.json`, `bun.lock` e `bun.lockb`; `.husky/pre-commit:1` usa `node` (a documentação diz `bun`); a versão instalada do Vite é **8.3.8** (a documentação diz Vite 5).

### G23-8 · INFORMATIVO (positivo) · CONFIRMADO · **EXECUTADO** — Nenhuma vulnerabilidade conhecida nas dependências

Registro do que está **bom**, com medição: `npm audit --json` e `npm audit --omit=dev --json` → **0 vulnerabilidades** (313 pacotes de produção, 881 no total); 0 alertas do Dependabot em aberto. O comando foi validado contra um projeto de controle com pacote vulnerável conhecido, para descartar falso silêncio.

---

## G24 — A documentação que orienta as decisões está errada em sete pontos

### G24-1 · Média · CONFIRMADO · **EXECUTADO** — Divergências entre a documentação de agentes e a realidade medida

| Afirmação na documentação                              | Realidade medida                                                                                      | Onde                                                  |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| "repositório **privado**"                              | **PÚBLICO**                                                                                           | `AGENTS.md` §Fluxo Git, `docs/agentes/github-ci.md:8` |
| "eslint 0 errors (4 warnings)"                         | exit 1, **22 erros**                                                                                  | `docs/ESTADO_ATUAL.md` §2                             |
| "não há branch protection e não há CI verde"           | existe regra ativa com 3 checks obrigatórios; `ci.yml` conclui com sucesso (runs #797–806)            | `AGENTS.md` §Fluxo Git                                |
| "`ci.yml` em base64"                                   | é YAML legível, 154 linhas                                                                            | `AGENTS.md` §Fluxo Git                                |
| "`config.toml:1` cravado em `pesfxhlbsjfmlysdkzhr`"    | já é o projeto oficial `pttzwlbidamibjssqiqb`; o ref errado sobrou só em `e2e/helpers/supabase.ts:18` | `AGENTS.md` §Banco                                    |
| "pre-commit usa bun"                                   | `.husky/pre-commit:1` usa `node`                                                                      | `AGENTS.md` §Stack                                    |
| "Vite 5"                                               | instalado: **8.3.8**                                                                                  | `AGENTS.md` §Stack                                    |
| "`functions/mcp/index.ts:220` prova o projeto oficial" | a linha diz `local-e2e` (G23-2)                                                                       | `AGENTS.md` §Banco                                    |

**Impacto no negócio:** o dono e os agentes de IA decidem com base nesses documentos. Hoje eles subestimam dois riscos sérios (repositório aberto, lint vermelho) e superestimam outro (acham que não há proteção de branch quando há).

### G24-2 · Baixa · CONFIRMADO · **EXECUTADO** — O inventário de funções está defasado

**Evidência:** `inventario/estado/edges.json` é de 2026-11-08 e declara `total: 58`; não conhece `mcp-query` nem `send-scheduled-reports` — justamente as duas funções mais sensíveis desta auditoria — e reporta `deliverability-check` e `email-verify` com 1 linha quando têm 298 e 291.
**Impacto no negócio:** quem usar esse inventário para decidir o que apagar vai errar.

---

## G25 — Código morto confirmado (além de G9)

### G25-1 · Baixa · CONFIRMADO · RASTREADO — Quatro arquivos sem nenhuma referência em produção

**Evidência:** `src/components/automation/WorkflowEditor.tsx` (27 linhas, **o próprio arquivo declara nas linhas 1-2** que é um resto de arquivo corrompido e devolve `null`), `src/components/lux/LuxImage.tsx` (67 linhas), `src/components/NavLink.tsx` (32 linhas), e 12 arquivos de `src/components/ui/` que vieram do modelo e nunca foram usados.
**Importações não usadas que o lint não pega** (a regra está desligada em `eslint.config.js:27`): `src/pages/Index.tsx:11` `TopProgressBar` (o uso está comentado em `:123`), `src/components/lux/layout/Sidebar.tsx:4` `supabase`, `src/components/lux/monitoring/MonitoringView.tsx:30` `loadingHealth`.

---

## G26 — Acessibilidade: casos claros

### G26-1 · Baixa · CONFIRMADO · RASTREADO — Botões só com ícone sem rótulo para leitor de tela

**Evidência:** `src/components/lux/AutomationsList.tsx:162,165`; `src/components/lux/CompanyTableRow.tsx:158`; `src/components/lux/NotificationsPanel.tsx:191` (este executa `clearAll()`, que **apaga todas as notificações**); `src/components/lux/organizations/WorkspaceSwitcher.tsx:37`; `src/components/lux/settings/ApiKeysPanel.tsx:103`; `src/components/lux/CompanyDetailModal.tsx:111`. Some-se `src/components/lux/auth/LoginCard.tsx:77`, cujo rótulo existe mas está corrompido (G3-1).
**Também:** `src/pages/Index.tsx:188` envolve a view inteira em `<main aria-live="polite">`, o que faz o leitor de tela reanunciar a página toda a cada troca de aba.
**O que está correto e verificado:** todo diálogo da camada tem título; `PageLoader` tem `role="status"` e rótulo; a barra lateral tem `role="navigation"`; os botões de navegação usam `aria-current="page"`.

---

## G27 — Estados de erro ausentes nos painéis de monitoramento

### G27-1 · Média · CONFIRMADO · RASTREADO — Cerca de 20 painéis não distinguem "não há dado" de "não consegui carregar"

**Evidência:** `src/components/lux/monitoring/SlaTrendChart.tsx:36` usa `const { data } = useQuery(...)` sem `isLoading` nem `error`. `src/components/lux/monitoring/MonitoringView.tsx:30` declara `loadingHealth` e nunca usa; a lista de registros de auditoria exibe "Nenhum log crítico registrado recentemente." **inclusive quando a consulta falhou** — mensagem falsa. Mesmo padrão em `MultiQueueResilienceCard:134`, `QaHistoryPanel:65`, `SlaCompliancePanel:50`, `SlaHistoryCard:112,132`, `SlaRecommendationsCard:62`, `ChaosEngineeringPanel:20,33`, `JobDetailsSheet:82`, `EnrichmentFunnel:34`, `CampaignTrackingDrawer` (5 consultas, nenhum tratamento de erro), `CommandPalette:41,52`, `Sidebar:42,154`, `MobileBottomNav:34` e em `src/pages/Monitoring.tsx` inteira (736 linhas, nenhum `isError`).
**O que está correto:** as telas de negócio principais (empresas, campanhas, sinais de intenção, fluxos, contatos, resultados de raspagem, administração e página de status) tratam erro e oferecem nova tentativa.
**Impacto no negócio:** "nenhum alerta crítico" aparece tanto quando está tudo bem quanto quando o sistema não conseguiu olhar. São situações opostas com a mesma mensagem.

### G27-2 · Média · CONFIRMADO · RASTREADO — Ligar e desligar fluxo automatizado falha em silêncio

**Evidência:** `src/components/lux/WorkflowsView.tsx:95-104` (`toggleMutation`) não tem `onError`, e `isError` não é exibido em lugar nenhum; `:106-114` (`deleteMutation`) avisa o sucesso, não a falha. No total, 8 de 44 mutações da camada não têm tratamento de erro: `WorkflowsView:95,106`; `CampaignsView:185`; `IntentSignalsView:117`; `ChaosEngineeringPanel:47`; `DeliverabilityCheckDialog:72`; `EmailVerifyBadge:47`; `src/pages/Monitoring.tsx:158`.
**Nota:** o escutador global de `src/App.tsx:85` cobre erro de organização e promessa não tratada — **não** cobre erro de mutação.
**Impacto no negócio:** o usuário pausa uma automação, o botão volta sozinho ao estado anterior e ninguém explica por quê.

---

## G28 — O coração do produto: a pontuação de perfil ideal (ICP) está desligada da tela que a configura

### G28-1 · **CRÍTICA** · CONFIRMADO · RASTREADO — A tela "Perfil de Cliente Ideal" não altera a pontuação de nenhuma empresa

**Causa raiz:** a tela grava os critérios em um **formato**, e os dois cálculos leem **outro formato**. Como o valor lido é "indefinido" em vez de "vazio", nem o caminho alternativo de pontuação-base roda.

**O que a tela grava** — `src/hooks/useICPConfig.ts:10-16,27-32`: uma **lista** de critérios, cada um com identificador, rótulo, tipo, valor e **peso**:

```ts
export interface ICPConfig { ... criteria: ICPCriterion[]; ... }
const DEFAULT_CRITERIA: ICPCriterion[] = [
  { id: "sector",  label: "Setor / Indústria", type: "tags",  value: ["SaaS B2B", ...], weight: 90 },
  { id: "location",label: "Localização",       type: "tags",  value: ["São Paulo", ...], weight: 70 },
  { id: "employees", ... weight: 60 }, { id: "revenue", ... weight: 85 }, { id: "online_presence", ... weight: 40 },
];
```

**O que os cálculos leem** — um **objeto** com duas chaves:

```ts
supabase/functions/_shared/domain/ipc/scoring.ts:14-17
  export interface IPCHittingCriteria { sectors?: string[]; locations?: string[] }
:24-37  if (criteria) { if (... criteria.sectors?.some(...)) score += 30;
                        if (... criteria.locations?.some(...)) score += 20; }
        else { score = 50; }          // <- nunca executa: uma lista é "verdadeira"
supabase/functions/workflow-engine/index.ts:505-506
  const criterSectors   = (criteria.sectors   || []) as string[];
  const criterLocations = (criteria.locations || []) as string[];
```

**Consequências aritméticas (RASTREADO linha a linha):**

- Empresa que entra pela raspagem (`supabase/functions/gmaps-proxy/index.ts:655` chama `calculateIPCScore`): setor e local somam **zero**; sobram e-mail 15 + telefone 10 + site 10 + avaliação até 15 → **teto real de 50 pontos**.
- Empresa pontuada pelo motor de fluxos (`workflow-engine/index.ts:517-545`): os critérios vazios caem nos valores-base `+15` e `+10` → teto de 75, com **fórmula diferente** da primeira (`+30/+5` para setor, `+25/+5` para local, contra `+30/0` e `+20/0`), e só pontua empresa cujo score é exatamente 0 (`:511`), ou seja, **nunca recalcula**. Ainda filtra por `user_id` em vez de organização.
- Os pesos que o usuário ajusta na tela (90, 70, 60, 85, 40) **não são lidos em lugar nenhum**; `employees`, `revenue` e `online_presence` não são avaliados por nenhum dos dois cálculos.
- **Nenhuma empresa raspada atinge o limite de "qualificada"**, porque os limites usados no sistema são 60, 70 e 75 (ver G28-2) e o teto desse caminho é 50.

**Por que os testes não pegam:** `supabase/functions/_shared/domain/ipc/__tests__/scoring.test.ts:12-94` exercita somente o formato de objeto — o formato que a tela **não** produz.

**Impacto no negócio:** a funcionalidade que dá nome ao produto — encontrar empresas que combinam com o cliente ideal — não funciona. O usuário define setores, regiões, faixa de funcionários e faturamento, com pesos, e nada disso muda a nota de nenhuma empresa. A nota que aparece reflege apenas se a empresa tem e-mail, telefone, site e boa avaliação no Google.

### G28-2 · Alta · CONFIRMADO · RASTREADO — "Lead qualificado" tem quatro definições diferentes no mesmo sistema

**Evidência:** `>= 60` em `src/hooks/useWeeklyPerformance.ts:48`, `src/components/lux/map/MarkerClusterLayer.tsx:60` e `supabase/migrations/20260721225534_*.sql:11`; `>= 70` em `supabase/functions/workflow-engine/index.ts:579`; `>= 75` em `supabase/migrations/20260522142002_*.sql:32`, `20260721225534_*.sql:12` e `src/components/lux/automations/CompanyAutomationTable.tsx:67`; faixas 90/75/60 em `src/lib/company-filters-utils.ts:9-14`.
**Impacto no negócio:** o painel, o mapa, a automação e o relatório dão números diferentes de "leads qualificados" para a mesma carteira. Nenhum está errado isoladamente; juntos, destroem a confiança no número.

---

## G29 — Quatro funcionalidades de gestão comercial mostram zero para sempre

### G29-1 · **CRÍTICA** · CONFIRMADO · **EXECUTADO** — O campo que marca o fechamento do negócio nunca é gravado

**Evidência:** busca exaustiva por `closed_at` em `src/`, `supabase/functions/` e `supabase/migrations/` → **15 ocorrências, nenhuma gravação**:

- criação da coluna: `supabase/migrations/20260422202642_*.sql:33`;
- declarações de tipo: `src/hooks/useDeals.ts:27`, `src/integrations/supabase/types.ts:1959,1982,2005`;
- lista de campos graváveis da API externa: `supabase/functions/public-api/index.ts:54`;
- promessa não cumprida: `supabase/migrations/20261122160000_deal_lost_reasons.sql:1` — comentário "Motivos de perda + **automação de `closed_at`**"; o arquivo não cria gatilho nenhum para isso;
- **seis leituras**: ranking da organização (`20261122180000_org_leaderboard.sql:7,9,44,45`), metas de venda (`20261122170000_sales_goals.sql:95,96`), próxima melhor ação (`20261122270000_next_best_action.sql:187`), previsão de negócios (`20261121193000_*.sql:288`).

Nenhum gatilho de banco, nenhuma atualização no front e nenhuma função de backend escreve nesse campo. O único caminho possível hoje é alguém enviar o valor pela API externa.

**Impacto no negócio:** quatro funcionalidades construídas e entregues — ranking de vendedores, acompanhamento de metas, sugestão de próxima ação e previsão de fechamento — filtram por "negócio fechado" e, como nenhum negócio é marcado como fechado, exibem zero permanentemente. O dono olha o ranking e as metas e conclui que ninguém vendeu nada.

### G29-2 · Alta · CONFIRMADO · RASTREADO — Qualquer etapa do funil pode ir para qualquer outra, e perder negócio não exige motivo

**Evidência:** `src/components/lux/DealsView.tsx:70-74` move o negócio entre etapas sem consultar `deal_stages.type`; nada exige `lost_reason_id` ao entrar em etapa de perda, e é desse campo que depende o relatório `deal_lost_reason_stats` (`supabase/migrations/20261122160000_*.sql:81-85`).
**Impacto no negócio:** o relatório "por que perdemos negócios" fica vazio, e o funil aceita pular etapas, o que corrompe qualquer medida de taxa de conversão.

### G29-3 · Alta · CONFIRMADO · RASTREADO — Negócios são criados na organização errada para quem atende mais de uma empresa

**Evidência:** `src/hooks/useDeals.ts:131` cria o negócio **sem informar** a organização; o valor padrão da coluna vem de `default_org_for_current_user()`, que devolve a **organização mais antiga** do usuário, não a que está ativa na tela (`supabase/migrations/20260422204609_*.sql:2-9,15`). A leitura em `:120` também não filtra por organização nem por excluídos, e a regra de leitura do banco só exige ser membro (`20260422204526_*.sql:120`). Mesmo padrão em `:46`, `:68` (etapas), `:224`, `:303`.
**Agravante correlato:** `supabase/functions/web-scrape-enqueue/index.ts:78-84`, `supabase/functions/instagram-enqueue/index.ts:93-100` e `supabase/functions/gmaps-proxy/index.ts:644-648` resolvem a organização pela primeira associação do usuário ou pelo `user_id`, ignorando a organização ativa.
**Impacto no negócio:** um operador que atende duas empresas cria o negócio na empresa errada, vê os dois funis misturados, e a raspagem é cobrada da conta errada.

### G29-4 · Média · CONFIRMADO · RASTREADO — Valores em moedas diferentes são somados como se fossem reais

**Evidência:** `currency text NOT NULL DEFAULT 'BRL'` sem restrição de valores (`supabase/migrations/20260422202642_*.sql:28-29`). `src/components/lux/deals/DealCard.tsx:47-48` respeita a moeda do registro, mas `src/components/lux/DealsView.tsx:48,87`, `src/components/lux/deals/DealColumn.tsx:20,31` e `src/components/lux/deals/LostReasonsDialog.tsx:14` somam e rotulam tudo como real, assim como o `SUM(d.value)` das metas e do ranking.
**Impacto no negócio:** o valor total do funil fica errado para qualquer cliente que negocie em dólar ou euro.

---

## G30 — Relatórios agendados: funcionalidade completa que lança erro em toda chamada

### G30-1 · Alta · CONFIRMADO · RASTREADO — A aba está montada e todas as seis operações falham por classificação ausente

**Evidência:** as tabelas `scheduled_reports` e `scheduled_report_runs` não constam de nenhum dos três conjuntos de classificação em `src/integrations/supabase/withOrg.ts`; o wrapper nega por padrão o que não está classificado (`:302-306`: `throw new Error('[withOrg] Acesso bloqueado: tabela "…" não possui classificação de escopo definida.')`). As seis chamadas de `src/hooks/useScheduledReports.ts:53,67,79,92,104,114` passam por ele. A aba está montada na interface em `src/components/lux/AnalyticsView.tsx:162`.
**Impacto no negócio:** o cliente abre "Relatórios agendados", a tela dá erro, e a funcionalidade — que já tem backend, tabela e função de envio — nunca foi usada.

### G30-2 · Alta · CONFIRMADO · RASTREADO — O teste que deveria pegar G30-1 compara contra uma lista escrita à mão

**Evidência:** `src/integrations/supabase/__tests__/withOrg.registry.test.ts:34-42` confronta a classificação com o arquivo `org-scoped-tables.fixture.json`, não com o banco. Esse arquivo **não inclui** `role_permissions`, `scheduled_reports`, `bulk_imports` nem `changelog_entries`, todas com coluna de organização (`supabase/migrations/20261121230000_*.sql:15,87,118`).
**Impacto no negócio:** o teste de proteção multiempresa fica verde exatamente sobre o buraco que deveria apontar. É o mesmo padrão de G2-1.

---

## G31 — Lixeira e exclusão: cinco comportamentos divergentes para a mesma ação

### G31-1 · Alta · CONFIRMADO · RASTREADO — Quatro tipos de registro são apagados de verdade, mas aparecem na lixeira

**Evidência:** `src/integrations/supabase/withOrg.ts:129-139` lista **4** tabelas para exclusão reversível, enquanto o tipo `SoftDeleteTable` e a função `purge_soft_deleted()` listam **8** (`withOrg.ts:379-387` e `supabase/migrations/20261121083400_*.sql:6-9,31-39`). Consequência: `src/hooks/useWebhooks.ts:78`, `src/hooks/useApiKeys.ts:79` e `src/hooks/useEmailSuppressions.ts:76` apagam **definitivamente**, e quatro abas de `src/components/lux/RecycleBinView.tsx:19-28` ficam sempre vazias.
**Caso mais sério:** a lista de descadastros de e-mail (`email_suppressions`) é apagada de verdade. Quem pediu para não receber mais e-mail **volta a receber**, o que é infração de LGPD e de regra de envio de e-mail em massa.

### G31-2 · Média · CONFIRMADO · RASTREADO — A aba "Negócios" da lixeira sempre dá erro e o negócio não pode ser restaurado

**Evidência:** `src/integrations/supabase/withOrg.ts:393` define `TRASH_LABEL_COLUMN.deals = "name"` e `src/components/lux/RecycleBinView.tsx:42-45` monta `select("id, name, deleted_at")`; a tabela `deals` tem a coluna `title`, não `name`.
**Impacto no negócio:** negócio excluído por engano não tem como voltar.

### G31-3 · **CRÍTICA** · CONFIRMADO · RASTREADO — A API externa apaga empresa de forma irreversível e enxerga registro já excluído

**Evidência:** `supabase/functions/public-api/index.ts:217-220` (leitura) não filtra `deleted_at` nem organização; `:265` executa exclusão **física** usando a chave `service_role` (`:123-126`), passando por cima da regra "só administrador exclui". O padrão correto existe em `supabase/functions/mcp/index.ts:46`.
**Impacto no negócio:** uma integração externa consegue apagar empresas sem possibilidade de recuperação, e listar empresas que o cliente julgava excluídas.

### G31-4 · Alta · CONFIRMADO · RASTREADO — Os números do painel contam registros excluídos

**Evidência:** `get_dashboard_stats` (`supabase/migrations/20260522142002_*.sql:28-41`, única definição no repositório): **nenhum** dos 13 contadores filtra `deleted_at`. Mais sete leituras cruas sem esse filtro: `src/hooks/useDeals.ts:120`, `src/components/lux/CompaniesMapView.tsx:30`, `src/components/lux/CompanyDetailModal.tsx:124`, `src/components/lux/CampaignsView.tsx:105`, `src/components/lux/campaigns/CampaignTrackingDrawer.tsx:134`, `src/components/lux/AutomationsList.tsx:57`, `src/hooks/useWeeklyPerformance.ts:27`.
**Impacto no negócio:** o painel inicial conta empresas e negócios que o cliente já jogou na lixeira — os indicadores não fecham com a lista.

### G31-5 · Média · CONFIRMADO · RASTREADO — Contatos de empresa excluída continuam aparecendo

**Evidência:** a tabela `stakeholders` (nome, e-mail, telefone de pessoas) não tem coluna `deleted_at`; `src/components/lux/StakeholderFinderView.tsx` e `src/components/lux/command-palette/CommandPalette.tsx` continuam listando os contatos de uma empresa que foi excluída.
**Impacto no negócio:** dado pessoal de contato que deveria sair com a empresa permanece pesquisável — problema de LGPD somado ao de usabilidade.

---

## G32 — Permissões: a matriz que o administrador edita não existe no backend

### G32-1 · Alta · CONFIRMADO · RASTREADO — Desmarcar uma permissão esconde o botão e não bloqueia a operação

**Evidência:** a tabela `role_permissions` (`supabase/migrations/20261121230000_*.sql:116-128`) é lida apenas por `src/hooks/usePermissions.ts:44-49` e `src/hooks/useRolePermissions.ts:42`. **Nenhuma** regra de acesso do banco e **nenhuma** função de backend a consulta — todas usam `has_org_role` com papel fixo. O próprio `src/components/lux/permissions/PermissionGate.tsx:13-15` declara ser apenas "sugestão visual".
**Impacto no negócio:** a tela de permissões por papel dá ao dono a impressão de controlar o que cada pessoa pode fazer; na prática, só esconde botões. Quem chamar a API direto continua podendo.

### G32-2 · Alta · CONFIRMADO (no versionado) · RASTREADO — Perfil SDR consegue excluir empresas, negócios, campanhas e fluxos

**Evidência:** as regras do banco permitem `SDR+ update companies` e restringem `Admins delete companies` (`supabase/migrations/20260422204526_*.sql:83-88`); mas `src/integrations/supabase/withOrg.ts:344-353` converte a exclusão em uma **atualização** de `deleted_at`, e nenhuma regra dessas quatro tabelas menciona `deleted_at`. Resultado: a exclusão reversível passa pela permissão de atualização. Isso contraria `src/lib/permissions.ts:35-39`, que declara `delete: ADMIN_ONLY`.
**Impacto no negócio:** um operador comercial pode mandar para a lixeira a carteira inteira de empresas, e a matriz de permissões afirma que só o administrador pode.

### G32-3 · Alta · CONFIRMADO · RASTREADO — A API externa filtra por usuário quando a chave é da organização

**Evidência:** `supabase/functions/public-api/index.ts:217-220,246,253-254,265` filtra por `user_id`, mas a chave de API pertence à organização (`api_keys.organization_id`, com regra de acesso restrita a administrador).
**Impacto no negócio:** quem integra pela API só vê o que o administrador dono da chave criou; tudo que os operadores cadastraram simplesmente não existe para a integração — sem erro, sem aviso.

### G32-4 · Média · CONFIRMADO · RASTREADO — Perfil de leitura consegue reprocessar fila morta e gastar crédito

**Evidência:** `supabase/functions/web-dlq-replay/index.ts:51-63` valida que o usuário pertence à organização, mas **não** valida o papel; e `src/components/lux/monitoring/DLQReplayPanel.tsx:176` não tem portão de permissão.
**Nota de precisão:** as _configurações_ de alerta de fila morta estão corretamente restritas a administrador nas duas pontas.
**Impacto no negócio:** um usuário somente-leitura pode reprocessar a fila e gerar custo em serviço externo.

---

## G33 — Datas e fusos

### G33-1 · Média · CONFIRMADO · RASTREADO — O painel diz que nada aconteceu "hoje" a partir das 21h

**Evidência:** `get_dashboard_stats` usa `v_today := CURRENT_DATE` em UTC (`supabase/migrations/20260522142002_*.sql:17,34`).
**Impacto no negócio:** no horário de Brasília, entre 21h e a meia-noite o painel mostra zero raspagens "de hoje", mesmo tendo rodado.

### G33-2 · Média · CONFIRMADO · RASTREADO — Pedido de LGPD vencido aparece como "vencido há 0 dias"

**Evidência:** `supabase/migrations/20261122250000_dsar_lgpd.sql:417` limita `days_remaining` com `GREATEST(..., 0)`; `src/components/lux/settings/DsarPanel.tsx:155-157` aplica `Math.abs(r.days_remaining)` supondo que o valor venha negativo.
**Impacto no negócio:** um pedido de titular de dados vencido há duas semanas aparece como "Vencido há 0 dia(s)", e perde-se a noção da gravidade do atraso — justamente no prazo legal.

---

## O que está bom — medido, para não virar retrabalho

Registro explícito, porque o executor precisa saber onde **não** mexer:

- **Lock otimista de negócios** funcionando: `src/integrations/supabase/withOrg.ts:330-338` + `src/hooks/useDeals.ts:160-172`.
- **Limpeza da organização ativa ao sair da conta**: `src/integrations/supabase/withOrg.ts:52-67`.
- **Lista de colunas graváveis da API externa**: `supabase/functions/public-api/index.ts:39-69`.
- **Assinatura de links de rastreio** com HMAC e comparação de tempo constante, e redirecionamento aberto fechado: `supabase/functions/_shared/tracking-signature.ts:38-54`, links assinados em `campaign-dispatch/index.ts:349`.
- **Autenticação de agendamento** correta em `supabase/functions/_shared/cron-auth.ts` (comparação de tempo constante; liberação anônima só em teste) e usada por 20 funções.
- **Padrão de referência de fila**: `scrape-queue-worker` e `web-scrape-worker` (reserva, prazo de posse, disjuntor, fila morta, classificação de erro, tempo-limite).
- **Idempotência correta**: `replay_instagram_dead_letter_batch` (por `config_hash`), `email-poll-replies` (chave única por mensagem do provedor), `web-scrape-enqueue:113-123` (inserção + tratamento de conflito).
- **`cnpj-enrich-worker`** com limite de frequência reservado, espera com variação aleatória e teto de tentativas.
- **Funcionalidade de LGPD (DSAR)** bem construída no banco: restrições de valores, prazo calculado no banco, anonimização preservando auditoria.
- **Validação de pertencimento à organização** nas 4 funções Oracle e nas 2 de fila morta; `rls-tests:105-146` valida sessão, papel de administrador e audita a negativa.
- **Dependências sem vulnerabilidade conhecida** (G23-8), **zero divergência de schema** entre migrations e o que o código consulta, **118 tabelas com RLS ligada e nenhuma sem política**, **147 de 148 funções `SECURITY DEFINER` com `search_path` fixado**, **todas as views de negócio com `security_invoker`**.
- **Nenhum segredo de provedor externo no pacote do site**: só `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PROJECT_ID`; `.env` não é versionado; `.env.test` só com valores de exemplo.
- **Nenhum vazamento de escutador de eventos**: os 5 canais em tempo real têm limpeza, os 2 temporizadores são cancelados e os 14 escutadores de janela são removidos.
- **Todo diálogo da interface tem título** e os indicadores de carregamento principais têm papel acessível.

---

## G34 — Itens menores registrados durante a auditoria

### G34-1 · Média · CONFIRMADO · RASTREADO — Link de pesquisa de satisfação vale para sempre

**Evidência:** as funções públicas `get_survey_by_token` e `submit_survey_response` estão bem construídas — escopadas pelo token, sem expor a organização, com revogação de permissão pública antes da concessão — mas **não há prazo de validade nem limite de tentativas** por token.
**Impacto no negócio:** um link de pesquisa encaminhado ou vazado continua funcionando indefinidamente, e alguém pode tentar adivinhar tokens sem nenhum freio.
**Etapa:** 162.

### G34-2 · Média · CONFIRMADO · RASTREADO — O site não valida suas variáveis de configuração ao iniciar

**Evidência:** `src/integrations/supabase/client.ts:5-6,11` cria o cliente com `import.meta.env.VITE_SUPABASE_URL` e a chave publicável **sem verificar se existem**. O comentário em `.env.test` registra que o cliente gerado "nao tem fallback". Se uma variável faltar no ambiente, o aplicativo quebra na inicialização com erro de baixo nível.
**Impacto no negócio:** um erro de configuração em um novo ambiente aparece como tela branca sem explicação, em vez de uma mensagem dizendo o que falta.
**Etapa:** 260.

### G34-3 · Baixa · CONFIRMADO · **EXECUTADO** — Oito pull requests abertas simultâneas tocam áreas deste plano

**Evidência (EXECUTADO, consulta à API do GitHub em 2026-11-22):** 8 pull requests abertas, todas de 22/11 — #148 (aquecimento de domínio com teto diário), #149 (execução durável de fluxo), #150 (significância estatística em teste A/B), #151 (agregação de análises no servidor), #152 (guarda de organização em rotinas agendadas), #153 (interface de configuração de alertas de disjuntor), #155 (portão de administrador no reprocessamento de fila morta), #158 (passos de fluxo que controlam as fases executadas).
**Sobreposições diretas com este plano:** #155 com a etapa 045; #152 com a etapa 113.
**Impacto no negócio:** trabalho paralelo não concluído pode conflitar com as correções deste plano e gerar retrabalho.
**Etapa:** 298.
