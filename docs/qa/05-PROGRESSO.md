# 05 — PROGRESSO DA EXECUÇÃO

> Uma linha por etapa. O agente executor marca `[x]` **somente** depois de executar a verificação do campo "Como verificar" e anotar a evidência na própria linha.

> Marcações: `[ ]` não feita · `[x]` concluída com evidência · `[~]` parada por divergência (o código não corresponde à evidência da etapa — ver regra 2 do plano) · `[A]` pull request aberta aguardando aprovação do dono.

> `APROV` = precisa de aprovação humana antes do merge. **Atenção:** onze etapas dependem de outra de número maior — ver a tabela "Dependências que apontam para uma etapa de número maior" em `04-PLANO.md`.

**Total: 300 etapas** · Críticas: 15 · Altas: 106 · Médias: 143 · Baixas: 36 · Exigem aprovação humana: 154

## Onda 1 — Segurança e risco de perda de dado

- [ ] **001** — Fazer os guardas de banco do CI falharem quando não houver conexão com o banco — onda 1 — Crítica · **APROV** — achados: G13-1
- [ ] **002** — Cadastrar o segredo de conexão de leitura do banco para o CI — onda 1 — Crítica · **APROV** — achados: G13-1, G13-3
- [ ] **003** — Remover a função `migrate-helper` do repositório — onda 1 — Crítica · **APROV** — achados: G10-2
- [ ] **004** — Adicionar ao deploy de edge functions uma trava que recusa função que devolva segredo — onda 1 — Crítica · **APROV** — achados: G10-2, G13-2
- [ ] **005** — Ampliar a varredura de segredos do CI para chaves de banco, JWT e tokens — onda 1 — Alta · **APROV** — achados: G13-2
- [x] **006** — Remover endereço e chave cravados da suíte de garantias de acesso — onda 1 — Alta — achados: G2-1, G13-2 · **FECHADO 2026-11-25 -- `e2e/helpers/supabase.ts`: as constantes `FALLBACK_URL` (`pesfxhlbsjfmlysdkzhr`, que o AGENTS.md diz nao ser o projeto do sistema) e `FALLBACK_ANON` foram apagadas; `SUPABASE_URL` e `SUPABASE_ANON_KEY` agora vem de `requiredEnv([...])`, que lanca `[e2e] defina E2E_SUPABASE_URL ou VITE_SUPABASE_URL`. Prova: sem as variaveis, `npx playwright test rls-guarantees.spec.ts -g sanidade` falha na coleta com a mensagem nova (antes as duas constantes faziam a suite falar com outro banco). tsc 0, eslint 0
- [x] **007** — Fazer a suíte de garantias de acesso distinguir "bloqueado" de "não consegui falar com o banco" — onda 1 — Alta — achados: G2-1 · **FECHADO 2026-11-25 -- `isReadBlocked` so aceita como bloqueio o que e negativa de acesso: `status` 401/403, codigos `42501`/`PGRST301`/`PGRST302` (mesma lista de `src/App.tsx:63-68`) ou lista vazia; qualquer outro erro lanca. Fail-first com URL inexistente e chave invalida: antes 76 passed / 1 failed em 47s (a unica falha era o teste de comprimento da chave), depois 69 failed com `[e2e] nao foi possivel falar com o backend (codigo ): TypeError: fetch failed`. Com o backend real (chave publishable do projeto): 75 passed / 2 failed em 15s, ~190 ms por caso em 2 workers (prova de ida a rede). As 2 falhas sao exposicoes reais que a suite agora revela: `health_checks` legivel por anon (HTTP 200, 2 linhas com latencia e metadados) e `dlq_health_metrics` executavel por anon (HTTP 200 com contadores)
- [x] **008** — Fazer o teste de classificação de tabelas comparar com o banco, não com uma lista escrita à mão — onda 1 — Alta — achados: G30-2, G1-3 · **FECHADO 2026-11-25 -- `scripts/ci/gerar-org-scoped-fixture.mjs` (novo) monta a lista a partir de `supabase/migrations/*.sql` (CREATE TABLE, DROP TABLE, ALTER TABLE ADD/DROP COLUMN organization_id) e reproduz exatamente as 82 tabelas do banco (`--check` em dia). O gerador respeita o `IF NOT EXISTS` como o banco respeita: foi assim que ele revelou que `idempotency_keys` tem `organization_id` nas migrations (20260513165326) mas NAO no banco — a migration anterior (20260513140150) criou a tabela sem a coluna e o `CREATE TABLE IF NOT EXISTS` seguinte foi no-op; hoje a tabela tem 3 linhas e as colunas id,user_id,key,response_body,status_code,created_at. Fixture regravado pelo gerador (mesmas 82, formato normalizado) e guarda nova `src/integrations/supabase/__tests__/orgFixtureSync.test.ts` (2 casos) que falha quando o arquivo fica dessincronizado: fail-first removendo `agent_chat_messages` do fixture -> 2 failed apontando o nome, restaurado -> 2 passed. Scripts npm `org:fixture` e `org:fixture:check`. Suite: 81 arquivos / 695 testes; tsc 0; eslint 0
- [x] **009** — Classificar as quatro tabelas de organização que faltam no wrapper — onda 1 — Alta — achados: G30-1, G1-3 · **FECHADO 2026-11-25 -- `withOrg.ts`: `scheduled_reports` entra em `ORG_SCOPED_TABLES`; `changelog_entries` e `scheduled_report_runs` em `EXEMPT_TABLES` (global a primeira, escopo por `user_id` a segunda); 10 tabelas com `organization_id` lidas por `supabase.from` cru/edge (bulk_imports, instagram_scrape_*, org_integrations, places_api_usage, retry_policy_advisories, role_permissions, web_scrape_*) em `ORG_UNSCOPED_TABLES`. O fixture `org-scoped-tables.fixture.json` estava com 70 tabelas contra 82 do banco real: 12 tabelas fora do guarda. Fixture regenerado; `withOrg.registry.test.ts` com 7 casos (2 novos, um deles prova que o deny-by-default continua). Sem o fix: `2 failed | 5 passed`; com o fix: 7/7
- [x] **010** — Fazer a leitura sem organização ativa falhar fechada no wrapper — onda 1 — Crítica — achados: G1-1 · **FECHADO 2026-11-25 -- `withOrg.ts`: o `select` em tabela org-escopada sem organizacao ativa agora chama `raise(new MissingOrgContextError(table, "select"))` (o `console.warn` saiu); nenhuma consulta chega ao cliente sem `.eq("organization_id", ...)`. Falta fechar os consumidores que rodariam antes da org: `CompaniesView`, `WorkflowsView`, `StakeholderFinderView`, `CommandPalette` (3 consultas), `JobDetailsSheet` (4) e `Monitoring` (alertas) ganharam `activeOrgId` na chave + `enabled`; `useScheduledReports` tambem (era o caso que a etapa 009 previa). `useTaskReminders` nao mexe: a leitura usa `supabase` cru com `user_id`. Guarda novo `src/integrations/supabase/__tests__/withOrg.readGuard.test.ts` (6 casos) falha 4/6 sem o fix; `src/tests/multi-tenant.test.ts` foi atualizado do comportamento antigo (avisar e consultar) para o novo (lancar). Suite: 80 arquivos / 693 testes
- [x] **011** — Condicionar as consultas do painel inicial à existência da organização ativa — onda 1 — Crítica — achados: G1-1 · **FECHADO 2026-11-25 -- `useDashboardData.ts`: `useRecentCompanies` e `useRecentActivity` passam a ler `useActiveOrganization` e a declarar `enabled: isDemoMode || !!activeOrgId` (a consulta de estatisticas ja tinha); sem organizacao, nenhuma das tres sai
- [x] **012** — Condicionar a contagem de notificações à organização ativa — onda 1 — Alta — achados: G1-1 · **FECHADO 2026-11-25 -- `useNotificationCount.ts:11` `enabled: isDemoMode || !!activeOrgId`; o selo do cabecalho (`Header.tsx:245`) so desenha quando a contagem e maior que zero, entao sem organizacao ele aparece vazio, nao zerado
- [x] **013** — Condicionar a lista virtualizada de empresas à organização ativa — onda 1 — Alta — achados: G1-1 · **FECHADO 2026-11-25 -- `useVirtualCompanies.ts:11` `enabled: !!activeOrgId`; virtualizacao e tamanho de pagina intactos
- [x] **014** — Condicionar a leitura do perfil de cliente ideal à organização ativa — onda 1 — Alta — achados: G1-1 · **FECHADO 2026-11-25 -- `useICPConfig.ts:41` `enabled: !!activeOrgId` na consulta das configuracoes; a chave de cache fica para a etapa 017 e o formato de `criteria` para a 093
- [x] **015** — Condicionar a trilha de auditoria à organização ativa — onda 1 — Alta — achados: G1-1 · **FECHADO 2026-11-25 -- `useAuditTrail.ts`: `useAuditTables` e `useAuditTrail` com `enabled: !!activeOrgId`; filtros e paginacao no servidor intactos
- [x] **016** — Varrer os hooks restantes em busca de consulta sem condição de organização — onda 1 — Alta — achados: G1-1 · **FECHADO 2026-11-25 -- varredura: `useAutomationsMonitor` ja falhava fechado (`getActiveOrgId()` dentro dos 4 `queryFn`, `:44/62/79/96`); `useOAuthSandboxSnapshots` ganhou `enabled: !!activeOrgId`; guarda novo `src/hooks/__tests__/orgGateQueries.test.ts` cobre as 8 consultas e falha 17/17 sem as condicoes
- [x] **017** — Incluir a organização na chave de cache das famílias de consulta que a ignoram — onda 1 — Alta — achados: G1-2 · **FECHADO 2026-11-25 -- `activeOrgId` no fim da `queryKey` de 17 hooks (deals/estagios/tarefas, modelos e estatisticas de e-mail, desempenho semanal, automacoes x4, chaves de API, webhooks, supressoes, fila e fila morta de raspagem, flags, web scrape, Oracle preflight, latencia x2, trilha e tabelas de auditoria x2, painel x2, empresas virtuais, ICP). O update otimista de `useDeals.ts:179-186` foi alinhado a chave nova, senao o rollback do `onError` gravaria em chave inexistente. `useResilienceComparison` fica fora: le `/reports/*.json` estatico, nao dado de organizacao. Guarda novo `src/hooks/__tests__/orgCacheKeys.test.ts` (24 casos) falha 24/24 sem as chaves e passa 24/24 com elas
- [ ] **018** — Remover a política global que dá acesso à auditoria de todas as organizações — onda 1 — Crítica · **APROV** — achados: G14-1
- [ ] **019** — Escopar por organização a exclusão de registros de execução de automação — onda 1 — Alta · **APROV** — achados: G14-1
- [ ] **020** — Varrer as políticas em busca de outras verificações de papel sem escopo de organização — onda 1 — Alta · **APROV** — achados: G14-1
- [ ] **021** — Escopar por organização o cache de pesquisa da Apollo — onda 1 — Alta · **APROV** — achados: G14-2
- [ ] **022** — Escopar por organização o cache de enriquecimento de CNPJ — onda 1 — Alta · **APROV** — achados: G14-2
- [ ] **023** — Varrer o restante das políticas com liberação total — onda 1 — Média · **APROV** — achados: G14-2
- [ ] **024** — Conferir no banco real as 11 políticas criadas com guarda por nome — onda 1 — Média — achados: G14-3
- [ ] **025** — Trocar a guarda por nome das políticas por comparação de definição — onda 1 — Média · **APROV** — achados: G14-3
- [ ] **026** — Trocar o portão do canal de consulta MCP por autenticação com papel — onda 1 — Crítica · **APROV** — achados: G11-1
- [ ] **027** — Restringir o canal de consulta MCP a comandos de leitura — onda 1 — Crítica · **APROV** — achados: G11-1
- [ ] **028** — Restringir as rotas que o modo administrador do canal MCP repassa — onda 1 — Alta · **APROV** — achados: G11-1
- [ ] **029** — Remover de vez a função de execução de SQL arbitrário do banco — onda 1 — Crítica · **APROV** — achados: G11-1
- [ ] **030** — Corrigir o comentário da migration que afirma não haver chamador de `exec_sql` — onda 1 — Baixa — achados: G11-1, G24-1
- [ ] **031** — Exigir pertencimento à organização no disparo de campanhas — onda 1 — Alta · **APROV** — achados: G12-1
- [ ] **032** — Exigir pertencimento à organização na consulta de envios de webhook — onda 1 — Alta · **APROV** — achados: G12-2
- [ ] **033** — Filtrar os proxies de rede pela organização do usuário — onda 1 — Alta · **APROV** — achados: G12-3
- [ ] **034** — Fechar o trabalhador de Instagram atrás de autenticação de agendamento — onda 1 — Alta · **APROV** — achados: G12-4
- [ ] **035** — Fechar a verificação de saúde atrás de autenticação e parar de gravar a cada chamada — onda 1 — Alta · **APROV** — achados: G12-4
- [ ] **036** — Fechar o controle de tentativas de login atrás de autenticação de serviço — onda 1 — Alta · **APROV** — achados: G12-4, G12-5
- [ ] **037** — Tornar atômica a contagem de tentativas de login — onda 1 — Alta · **APROV** — achados: G12-5
- [ ] **038** — Fazer o limite de uso da API pública falhar fechado — onda 1 — Alta · **APROV** — achados: G12-6
- [ ] **039** — Contar o limite da API pública por organização, não por usuário — onda 1 — Média · **APROV** — achados: G12-6
- [ ] **040** — Apagar o segredo de painel administrativo que já vazou — onda 1 — Média · **APROV** — achados: G23-5
- [ ] **041** — Proteger o ambiente `staging` que recebe credenciais em qualquer pull request — onda 1 — Média · **APROV** — achados: G23-6
- [ ] **042** — Confirmar a correspondência exata do nome do ambiente de produção nos workflows — onda 1 — Alta · **APROV** — achados: G13-1, G22-3
- [ ] **043** — Fixar por identificador de commit as ações de terceiro nos workflows que tocam produção — onda 1 — Média · **APROV** — achados: G23-6
- [ ] **044** — Parar de aceitar exclusão física pela API pública — onda 1 — Crítica · **APROV** — achados: G31-3
- [ ] **045** — Exigir papel de administrador para reprocessar fila morta — onda 1 — Média · **APROV** — achados: G32-4
- [ ] **046** — Corrigir o emissor de autenticação gravado no pacote da função MCP — onda 1 — Alta · **APROV** — achados: G23-2

## Onda 2 — Fluxos principais quebrados

- [x] **047** — Incluir as quatro tabelas que faltam na lista de exclusão reversível do wrapper — onda 2 — Alta — achados: G31-1 · **FECHADO 2026-11-25 -- `src/integrations/supabase/withOrg.ts`: as duas listas mantidas à mão viraram uma (`SOFT_DELETE_TABLE_LIST` com as 8 tabelas, `as const`); o `Set` do wrapper e o tipo `SoftDeleteTable` saem dela, então não há mais como divergirem. `email_suppressions`, `email_accounts`, `api_keys` e `webhooks` passam a marcar `deleted_at` em vez de apagar de vez (as quatro estavam em `ORG_SCOPED_TABLES`, então o `.eq("organization_id")` continua sendo injetado). Colunas conferidas na produção (Management API, `information_schema.columns`, projeto `pttzwlbidamibjssqiqb`): as 8 tabelas têm `deleted_at` e `organization_id`. Prova comportamental nova em `src/integrations/supabase/__tests__/withOrg.bulkDelete.test.ts`: para cada uma das 8 tabelas, `delete().in("id", [...])` emite exatamente `update(deleted_at) → eq(organization_id) → is(deleted_at,null) → in(id)`; fail-first reduzindo a lista às 4 antigas → 1 failed (o teste novo), restaurado → 8/8 e o diretório inteiro 68/68. tsc 0, eslint 0
- [ ] **048** — Garantir que a lista de descadastros de e-mail nunca seja consultada sem o filtro de excluídos — onda 2 — Alta · **APROV** — achados: G31-1
- [x] **049** — Corrigir a coluna de rótulo da aba Negócios na lixeira — onda 2 — Média — achados: G31-2 · **FECHADO 2026-11-25 -- `withOrg.ts`: `TRASH_LABEL_COLUMN.deals` passou de `"name"` para `"title"`. Conferido na produção (`information_schema.columns`): `deals` tem `title` e NÃO tem `name`, então a aba Negócios dava erro sempre e o negócio excluído nunca podia ser restaurado. As outras sete entradas do mapa foram passadas pela mesma régua e estão corretas (name/name/name/email/email/name/name). `RecycleBinView.tsx` não mudou: ele monta o `select` a partir do mapa (`id, title, deleted_at`). tsc 0, eslint 0, `src/integrations/supabase/__tests__` 68/68
- [x] **050** — Criar um teste que compare o mapa de rótulos da lixeira com o schema — onda 2 — Baixa — achados: G31-2 · **FECHADO 2026-11-25 -- novo `src/integrations/supabase/__tests__/trashLabelColumns.test.ts` (10 casos, sem banco): lê `src/integrations/supabase/types.ts` como texto e extrai o bloco `Row` de cada tabela, então compara com `TRASH_LABEL_COLUMN`. Cobre as 8 chaves (falha se alguém adicionar tabela sem rótulo), exige a coluna de rótulo dentro do `Row` de cada tabela (nome do teste carrega a coluna, ex. "a coluna de rotulo de deals (title) existe no schema") e um caso explícito de que `deals` usa `title` e não `name`. Fail-first conforme a etapa pede: `TRASH_LABEL_COLUMN.deals` de volta para `"name"` → `2 failed | 8 passed`; restaurado → 10/10. `npx vitest run src/integrations/supabase/__tests__` 68/68, tsc 0, eslint 0
- [ ] **051** — Gravar os resultados obtidos no caminho de contingência da raspagem — onda 2 — Crítica · **APROV** — achados: G16-1
- [ ] **052** — Gravar os resultados no segundo caminho de contingência, dentro do proxy de raspagem — onda 2 — Alta · **APROV** — achados: G16-1
- [ ] **053** — Parar de pagar duas vezes pela mesma busca na sincronização de resultados — onda 2 — Alta · **APROV** — achados: G16-1
- [ ] **054** — Parar de importar jobs de outros clientes do raspador compartilhado — onda 2 — Alta · **APROV** — achados: G16-3
- [ ] **055** — Registrar e relatar os jobs importados indevidamente — onda 2 — Média — achados: G16-3
- [ ] **056** — Agendar o entregador de webhooks — onda 2 — Alta · **APROV** — achados: G16-2
- [ ] **057** — Avaliar e comunicar as entregas de webhook acumuladas — onda 2 — Média — achados: G16-2
- [ ] **058** — Destravar entregas de webhook presas em "enviando" — onda 2 — Alta · **APROV** — achados: G17-3
- [ ] **059** — Destravar itens da fila de enriquecimento de CNPJ presos em "processando" — onda 2 — Alta · **APROV** — achados: G17-3
- [ ] **060** — Destravar contatos presos no envio para o Bitrix — onda 2 — Alta · **APROV** — achados: G17-3
- [ ] **061** — Reservar o destinatário antes de enviar o e-mail da campanha — onda 2 — Alta · **APROV** — achados: G17-1
- [ ] **062** — Destravar mensagens de campanha presas em "enviando" — onda 2 — Alta · **APROV** — achados: G17-1, G17-3
- [x] **063** — Ligar o painel de monitoramento real a uma entrada na interface — onda 2 — Alta — achados: G16-4, G16-5 · **FECHADO 2026-11-25 -- `nav-items.ts` ganhou o discriminante `path` (uniao `NavViewItem`/`NavLinkItem` + guarda `isNavLink`); `Sidebar.tsx` navega por `navigateToPath` (`src/lib/deepLink.ts`) no canal `lux:deep-link`, que o `DeepLinkBridge` (`App.tsx:286-297`) converte em `navigate()` do react-router sem recarregar o SPA; teste em `Sidebar.test.tsx` confirma o evento com `/monitoring` e que `onNavigate` nao e chamado
- [x] **064** — Trocar os indicadores fictícios da tela "Status do Sistema" por dados reais — onda 2 — Alta — achados: G16-4 · **FECHADO 2026-11-25 -- `MonitoringView.tsx` reescrita: selo derivado do pior estado (`fontes.reduce(worstState)`), KPIs de `useApiLatency`/`usePublicUptime`, grafico de `useApiLatencyTrend`, logs de `useAuditTrail`; `MonitoringView.test.tsx` com 5 casos (inclui "tudo saudavel -> Sistemas Operacionais" e "so latencia -> 900 ms / 10.00%")
- [x] **065** — Remover o estado "online" escrito à mão das quatro funções no painel de status — onda 2 — Média — achados: G16-4 · **FECHADO 2026-11-25 -- os quatro `HealthItem` fixos foram removidos (a funcao `health` nao tem o portao da etapa 035, que e APROV) e no lugar entrou a secao "Fila morta e alertas do banco" com `useDlqHealth` + `computeAlerts` reais; teste cobre DLQ critico e 95% de conexoes -> "Falha Detectada"
- [x] **066** — Criar entrada de menu para as configurações de CNPJ — onda 2 — Alta — achados: G16-5 · **FECHADO 2026-11-25 -- `SettingsView.tsx` aba "Integracoes", bloco `isAdmin`, card "Configuracoes de CNPJ" -> `navigateToPath("/settings/cnpj")` (helper novo `src/lib/deepLink.ts`, reusado pelo `Sidebar`); `CnpjSettingsPage.tsx` nao mudou
- [x] **067** — Criar entrada de menu para a administração de empresas — onda 2 — Média — achados: G16-5 · **FECHADO 2026-11-25 -- `nav-items.ts:69` `{ path: "/admin/companies", adminOnly: true }` e `:74` `{ path: "/monitoring", adminOnly: true }`; `Sidebar.tsx` filtra por `usePermissions().isAdmin`; `Sidebar.test.tsx` prova admin ve as duas rotas e nao-admin nao ve
- [ ] **068** — Decidir e aplicar o destino da página pública de status — onda 2 — Baixa · **APROV** — achados: G16-5
- [x] **069** — Ligar o botão "Nova" da lista de automações do painel inicial — onda 2 — Alta — achados: G16-6 · **FECHADO 2026-11-25 -- `AutomationsList.tsx:63` `openWorkflows` -> `:107` botao "Nova" e `:157` "Ver todos" navegam para a tela de automacoes; teste `AutomationsList.test.tsx:73`
- [x] **070** — Ligar ou remover os controles de pausar e recarregar da lista de automações — onda 2 — Alta — achados: G16-6 · **FECHADO 2026-11-25 -- `:144` `canToggle` (exige permissao de edicao e estado com efeito) e `:189-199` pausar/retomar com `stopPropagation`; o botao de recarregar sem efeito foi removido; testes `:96`, `:108` e `:120`
- [x] **071** — Fazer aparecer o botão "Criar Workflow" para quem ainda não tem nenhum — onda 2 — Alta — achados: G16-6 · **FECHADO 2026-11-25 -- estado vazio usa `EmptyState` com `actionLabel="Criar Workflow"` e `onAction={openWorkflows}` (`:131-132`); teste `AutomationsList.test.tsx:84`
- [x] **072** — Varrer o repositório por outros estados vazios sem ação — onda 2 — Média — achados: G16-6 · **FECHADO 2026-11-25** — `actionLabel` tem 2 usos (`AutomationsList.tsx:131`, `CompaniesView.tsx:367`), ambos com `onAction`; varredura ampla achou 16 estados vazios: 12 informativos ou com a ação na mesma tela, 4 ganharam CTA que já existia (criar campanha, registrar sinal, novo workspace, limpar busca) — nenhuma ação inventada
- [x] **073** — Cobrir a lista de automações do painel com teste de verdade — onda 2 — Média — achados: G16-6 · **FECHADO 2026-11-25 -- `src/components/lux/__tests__/AutomationsList.test.tsx` com 5 casos: Nova, CTA do vazio, pausar, retomar e ausencia de controle sem efeito
- [x] **074** — Ligar a ação "Visitar Site" no detalhe da empresa — onda 2 — Média — achados: G16-6 · **FECHADO 2026-11-25** — `CompanyDetailModal.tsx:visitSite` abre `sanitizeUrl(website)` em nova aba; avisa quando o site é inválido
- [x] **075** — Ligar a ação "Enriquecer" no detalhe da empresa — onda 2 — Média — achados: G16-6 · **FECHADO 2026-11-25** — usa `useCnpjEnrich` (edge `cnpj-enrich`) e grava só os campos vazios, com `enriched: true`; sem CNPJ avisa e não chama o provedor
- [x] **076** — Ligar ou remover a ação "Adicionar ao CRM" no detalhe da empresa — onda 2 — Média · **APROV** — achados: G16-6 · **FECHADO 2026-11-25** — ligado ao `hubspot-sync` (single-company, JWT de admin); mostra o motivo real quando o HubSpot não está configurado
- [x] **077** — Ligar ou remover a ação "Enviar Email" no detalhe da empresa — onda 2 — Média — achados: G16-6 · **FECHADO 2026-11-25** — abre `mailto:` do primeiro contato com e-mail (ou do e-mail da empresa); avisa quando não há e-mail
- [x] **078** — Ligar ou remover a ação "Iniciar Sequência" no detalhe da empresa — onda 2 — Média — achados: G16-6 · **FECHADO 2026-11-25** — removida: não existe motor de sequências no repositório (0 referências a `sequences`/`EnrollInSequence`), então era um botão que não fazia nada
- [x] **079** — Fazer o ícone "Ver detalhes" funcionar na versão de computador da lista — onda 2 — Média — achados: G16-6 · **FECHADO 2026-11-25** — `CompanyTableRow.tsx` ganhou `onClick={() => onOpen(company)}` (o menu do celular já funcionava)
- [x] **080** — Varrer o repositório por botões sem manipulador — onda 2 — Média — achados: G16-6 · **FECHADO 2026-11-25** — 407 tags `<Button>` em 136 arquivos `src/**/*.tsx`: 19 candidatos brutos sem `onClick` (18 gatilho do Radix com `asChild`, 1 dentro de `<Link>`), 0 confirmados; teste-guarda `src/__tests__/botoes-com-manipulador.test.ts` reprova botão sem manipulador (provado fail-first: acusa `CompanyTableRow.tsx:141` com o `onClick` removido)
- [x] **081** — Corrigir o teste de interface que quebra por rótulo ambíguo — onda 2 — Média — achados: G2-3 · **FECHADO 2026-11-25** — `e2e/navigation.spec.ts` passou a usar `getByRole("tab")` na aba e `getByRole("button")` no envio: a aba "Criar Conta" e o botão de envio do cadastro têm o mesmo texto, então `getByText` casava 2 elementos e estourava o strict mode assim que o painel montava (medido: 1 elemento antes do clique, 2 depois); suíte "Login Page" 5/5 verde
- [x] **082** — Confirmar que o teste do painel de monitoramento volta a passar — onda 2 — Baixa — achados: G2-3, G3-1 · **FECHADO 2026-11-25 -- `E2E_BASE_URL=https://promo-lux-v2.vercel.app npx playwright test e2e/monitoring-navigation.spec.ts` -> 2 passed (9.1s) contra o deploy com o fix de encoding (#220)
- [x] **083** — Incluir o estado de demonstração na chave de cache das campanhas — onda 2 — Alta — achados: G4-1 · **FECHADO 2026-11-25** — chave da consulta e as 5 invalidações passaram a ser `["campaigns", isDemoMode]`
- [x] **084** — Incluir o estado de demonstração na chave de cache da lista de empresas — onda 2 — Alta — achados: G4-1 · **FECHADO 2026-11-25** — `["companies-list", isDemoMode]` na consulta, nas 4 invalidações e no `setQueryData` do favorito
- [x] **085** — Incluir o estado de demonstração na chave dos sinais de intenção — onda 2 — Média — achados: G4-1 · **FECHADO 2026-11-25** — `["intent-signals", isDemoMode]` na consulta e nas 4 invalidações
- [x] **086** — Incluir o estado de demonstração na chave dos fluxos automatizados — onda 2 — Média — achados: G4-1 · **FECHADO 2026-11-25** — `["workflows", isDemoMode]` na consulta e nas 4 invalidações
- [x] **087** — Incluir o estado de demonstração na chave dos contatos — onda 2 — Média — achados: G4-1 · **FECHADO 2026-11-25** — `["stakeholders", isDemoMode]` na consulta
- [x] **088** — Incluir o estado de demonstração na chave das notificações — onda 2 — Média — achados: G4-1 · **FECHADO 2026-11-25** — `NOTIFICATIONS_KEY` virou `notificationsKey(isDemoMode)` na consulta e nas 2 invalidações; `useNotificationCount` já usava `["notifications-count", isDemoMode]`
- [x] **089** — Limpar o cache ao entrar e ao sair do modo demonstração — onda 2 — Alta — achados: G4-1 · **FECHADO 2026-11-25** — `DemoProvider` chama `queryClient.clear()` ao entrar e ao sair; teste `src/contexts/__tests__/DemoContext.test.tsx` (2 casos, falham sem a mudança)
- [x] **090** — Dar estado de demonstração às telas que não têm — onda 2 — Média — achados: G6-2, G4-2 · **FECHADO 2026-11-25 -- regra unica em `src/lib/demoViews.ts` (`DEMO_UNSUPPORTED_VIEWS` com as 17 telas sem dados de exemplo) e aviso `src/components/lux/DemoNotice.tsx`; `src/lib/__tests__/demoViews.test.ts` falha se uma view nova do `VIEW_MAP` ficar sem cobertura
- [x] **091** — Mostrar o aviso e o botão de sair da demonstração em todas as telas — onda 2 — Baixa — achados: G4-2 · **FECHADO 2026-11-25 -- aviso de demonstracao movido para o layout (`src/pages/Index.tsx`, dentro do `<main>`), aparece em todas as telas com o botao de sair; banner duplicado removido do `DashboardView`; testes `DemoNotice.test.tsx` (2 casos) e `demoViews.test.ts` (4 casos)
- [ ] **092** — Decidir com o dono se a demonstração deve continuar liberando as rotas protegidas — onda 2 — Média · **APROV** — achados: G4-2

## Onda 3 — Integridade de dados e regras de negócio

- [ ] **093** — Fazer o cálculo de pontuação ler o formato que a tela de perfil ideal grava — onda 3 — Crítica · **APROV** — achados: G28-1
- [ ] **094** — Cobrir o cálculo de pontuação com teste no formato real da tela — onda 3 — Alta — achados: G28-1
- [ ] **095** — Unificar a fórmula de pontuação entre os dois caminhos — onda 3 — Alta · **APROV** — achados: G28-1
- [ ] **096** — Fazer os pesos configurados pelo usuário influenciarem a pontuação — onda 3 — Alta · **APROV** — achados: G28-1
- [ ] **097** — Avaliar os critérios de funcionários, faturamento e presença online — onda 3 — Média · **APROV** — achados: G28-1
- [ ] **098** — Permitir recálculo de pontuação de empresas já pontuadas — onda 3 — Alta · **APROV** — achados: G28-1
- [ ] **099** — Definir um único limite de "lead qualificado" e colocá-lo num só lugar — onda 3 — Alta · **APROV** — achados: G28-2
- [ ] **100** — Gravar a data de fechamento quando o negócio entra em etapa de ganho ou perda — onda 3 — Crítica · **APROV** — achados: G29-1
- [ ] **101** — Preencher a data de fechamento dos negócios já fechados — onda 3 — Alta · **APROV** — achados: G29-1
- [ ] **102** — Confirmar que o ranking de vendedores passou a mostrar dados — onda 3 — Média — achados: G29-1
- [ ] **103** — Confirmar que o acompanhamento de metas passou a mostrar progresso — onda 3 — Média — achados: G29-1
- [ ] **104** — Confirmar que a sugestão de próxima ação passou a aparecer — onda 3 — Média — achados: G29-1
- [ ] **105** — Confirmar que a previsão de fechamento passou a funcionar — onda 3 — Média — achados: G29-1
- [ ] **106** — Impedir transição inválida entre etapas do funil — onda 3 — Alta · **APROV** — achados: G29-2
- [ ] **107** — Exigir o motivo da perda ao mover negócio para etapa de perdido — onda 3 — Alta · **APROV** — achados: G29-2
- [ ] **108** — Impedir que campanha concluída volte a "ativa" por um clique — onda 3 — Alta · **APROV** — achados: G29-2
- [ ] **109** — Restringir os valores aceitos nas colunas de situação mais usadas — onda 3 — Média · **APROV** — achados: G20-2, G29-2
- [x] **110** — Criar o negócio na organização ativa, não na mais antiga do usuário — onda 3 — Crítica — achados: G29-3 · **FECHADO 2026-11-25 -- `useDeals.ts:134` o insert de `deals` passa pelo `db` (wrapper `withOrg`), que injeta `organization_id` da organização ativa no payload (`withOrg.ts:5`, `:285-286`) em vez de deixar o banco herdar a organização mais antiga do usuário; `supabase.rpc("create_default_deal_stages")` em `:62` fica fora do escopo e virou achado novo (correção exige migration)
- [x] **111** — Passar as leituras e escritas de negócios pelo wrapper de organização — onda 3 — Alta — achados: G1-3, G29-3, G31-4 · **FECHADO 2026-11-25 -- seis trocas `supabase` -> `db` em `useDeals.ts`: `:48` e `:70` (`deal_stages`), `:123` (leitura de `deals`), `:134` (insert de `deals`), `:227` (`deal_activities`) e `:307` (`deal_tasks`); toda leitura passa a levar `.eq("organization_id")` e `.is("deleted_at", null)` automáticos e toda escrita leva o escopo da organização ativa; resta apenas `supabase.rpc` em `:62` (rpc não passa pelo wrapper e não é do escopo desta etapa)
- [ ] **112** — Trocar o filtro por usuário pelo filtro por organização no motor de fluxos — onda 3 — Alta · **APROV** — achados: G29-3, G28-1
- [ ] **113** — Resolver a organização pela ativa, não pela primeira associação, no enfileiramento de raspagem web — onda 3 — Alta · **APROV** — achados: G29-3
- [ ] **114** — Resolver a organização ativa no enfileiramento do Instagram — onda 3 — Alta · **APROV** — achados: G29-3
- [ ] **115** — Resolver a configuração de perfil ideal pela organização no proxy de raspagem — onda 3 — Média · **APROV** — achados: G28-1, G29-3
- [ ] **116** — Reativar a restrição de formato de CNPJ na tabela de empresas — onda 3 — Alta · **APROV** — achados: G20-1
- [ ] **117** — Normalizar os CNPJ já gravados fora do padrão — onda 3 — Alta · **APROV** — achados: G20-1
- [ ] **118** — Validar o CNPJ também na API pública — onda 3 — Alta · **APROV** — achados: G20-1
- [ ] **119** — Validar e-mail, site, LinkedIn e Instagram no lado do servidor — onda 3 — Média · **APROV** — achados: G20-1
- [x] **120** — Somar valores de negócio respeitando a moeda — onda 3 — Média — achados: G29-4 · **FECHADO 2026-11-25 -- novo `src/lib/money.ts` (`groupByCurrency`, `formatMoney`, `formatCurrencyTotals`); `DealsView.tsx` mostra o total e o ponderado com um valor por moeda no cabeçalho do funil; `DealColumn.tsx` empilha um total por moeda no cabeçalho de cada coluna (coluna vazia não exibe total); `LostReasonsDialog.tsx` deriva o valor perdido dos próprios negócios, porque `deal_lost_reason_stats` soma moedas diferentes e não tem coluna de moeda; testes novos `money.test.ts` 6/6, `DealsView.currency.test.tsx` 3/3 e `LostReasonsDialog.currency.test.tsx` 3/3 (os dois últimos provam que as duas moedas aparecem rotuladas e que a soma cruzada não existe); suíte `src/components/lux src/hooks src/lib` 70 arquivos/636 testes verdes, `tsc --noEmit` 0, `eslint` 0 nos 8 arquivos tocados
- [ ] **121** — Restringir os valores aceitos na coluna de moeda — onda 3 — Baixa · **APROV** — achados: G29-4
- [ ] **122** — Filtrar os registros excluídos nos contadores do painel — onda 3 — Alta · **APROV** — achados: G31-4
- [x] **123** — Filtrar excluídos na leitura do mapa de empresas — onda 3 — Média — achados: G31-4, G19-1 · **FECHADO 2026-11-25 -- `CompaniesMapView.tsx:29` passou a ler `db.from("companies")` (o import cru de `supabase` saiu do arquivo: era o unico uso). Colunas selecionadas nao foram tocadas, como a etapa pede. Prova: `src/integrations/supabase/__tests__/orgScopedCallSites.test.ts` (novo) le o proprio fonte e exige `db .from("companies") .select(` e proibe `supabase .from("companies") .select(`; fail-first trocando `db` por `supabase` em `CampaignsView.tsx` -> o caso do arquivo falha, restaurado -> 6/6. Producao hoje (`pttzwlbidamibjssqiqb`): 5 empresas, 0 com `deleted_at` -- o defeito estava latente: a primeira exclusao pela lixeira voltaria a aparecer no mapa
- [x] **124** — Filtrar excluídos no detalhe da empresa — onda 3 — Média — achados: G31-4 · **FECHADO 2026-11-25 -- `CompanyDetailModal.tsx:132` (a etapa citava `:124`) passou a ler `db.from("companies")`; o import de `db` foi adicionado e o `supabase` cru ficou apenas onde a etapa nao alcanca (o `update` de enriquecimento em `:188` e o `invoke("hubspot-sync")` em `:210`). Prova comportamental em `CompanyDetailModal.actions.test.tsx` (caso novo): renderiza o modal com o wrapper real e a organizacao ativa, e exige na cadeia registrada `eq("organization_id", "org-1")` + `is("deleted_at", null)`; fail-first restaurando o `supabase` cru -> o caso falha, restaurado -> 9/9. O acesso `db.trash(...)` nao foi tocado, entao a lixeira continua podendo restaurar o registro
- [x] **125** — Filtrar excluídos na lista de campanhas — onda 3 — Média — achados: G31-4 · **FECHADO 2026-11-25 -- `CampaignsView.tsx:105` (`db` ja estava importado no arquivo). A chave de cache (`["campaigns", ...]`, etapa 083) foi preservada. Os mocks dos testes existentes foram trocados por um builder encadeavel compartilhado (`src/test/mockSupabaseClient.ts`), que reproduz o builder real do supabase-js (aguardavel em qualquer ponto) e registra cada chamada; o `beforeEach` ativa a organizacao (`setActiveOrgId`). Prova: caso novo exige `eq("organization_id", ORG)` + `is("deleted_at", null)` na cadeia de `campaigns`; fail-first com `supabase` cru -> o caso de escopo falha (a consulta sai sem `.eq` de organizacao), restaurado -> verde. Producao hoje: 3 campanhas, 0 excluidas
- [x] **126** — Filtrar excluídos no painel de rastreio de campanha — onda 3 — Média — achados: G31-4 · **FECHADO 2026-11-25 -- `campaigns/CampaignTrackingDrawer.tsx:136` (a unica das 5 consultas do drawer que toca tabela com exclusao reversivel; `:74/:88/:103` sao `campaign_recipients`/`campaign_events`/`campaign_replies` e `:119` e uma rpc, todas fora do escopo da etapa) passou a `db.from("campaigns")` com o import de `db` adicionado. Nenhuma das outras 4 consultas foi alterada. Cobertura: as 5 consultas do drawer seguem exercitadas pelo caso de render do arquivo de teste; `tsc --noEmit` 0 e `eslint` 0 no arquivo
- [x] **127** — Filtrar excluídos na lista de automações e no desempenho semanal — onda 3 — Média — achados: G31-4, G5-1 · **FECHADO 2026-11-25 -- `AutomationsList.tsx:69` -> `db.from("workflows")` (o import cru de `supabase` saiu: era o unico uso) e `useWeeklyPerformance.ts:29` -> `db.from("companies")`. O hook tambem passou a propagar o erro (`if (error) throw error;`), como a etapa pede, e `DashboardView.tsx` (a pagina que consome o hook, `:69`) passou a desestruturar `error` e a mostrar o aviso do widget em vez do grafico -- sem ele o erro falharia em silencio. Prova: `useWeeklyPerformance.test.tsx` (novo, 2 casos) exige `eq("organization_id")` + `is("deleted_at", null)` e que o erro chegue ao componente; `DashboardView.test.tsx` ganhou o caso "mostra aviso e esconde o grafico quando a consulta de desempenho falha"; `AutomationsList.test.tsx` ganhou o caso de escopo. Fail-first: removendo o `throw` -> 2 casos falham; fixando `perfError` em `undefined` -> o caso do aviso falha; `supabase` cru -> o caso de escopo falha. Producao hoje: 4 workflows, 0 excluidos; o grafico semanal e montado a partir de `companies`
- [ ] **128** — Trocar o filtro por usuário pelo filtro por organização na API pública — onda 3 — Alta · **APROV** — achados: G32-3
- [ ] **129** — Fazer as regras de acesso do banco respeitarem a exclusão reversível — onda 3 — Alta · **APROV** — achados: G32-2, G20-4
- [ ] **130** — Fazer as políticas de leitura esconderem registros excluídos nas nove tabelas afetadas — onda 3 — Alta · **APROV** — achados: G20-4, G1-1
- [ ] **131** — Decidir o que fazer com os contatos de empresa excluída — onda 3 — Média · **APROV** — achados: G31-5
- [ ] **132** — Criar as chaves estrangeiras de organização que faltam — onda 3 — Média · **APROV** — achados: G20-3
- [ ] **133** — Acrescentar gatilho de auditoria às tabelas de permissão — onda 3 — Alta · **APROV** — achados: G20-5
- [ ] **134** — Permitir que o registro de violação de organização seja gravado — onda 3 — Média · **APROV** — achados: G15-1
- [ ] **135** — Fazer o botão "dispensar recomendação" usar a chamada certa — onda 3 — Alta · **APROV** — achados: G15-1
- [ ] **136** — Fazer o interruptor da API do Google Places gravar de verdade — onda 3 — Alta · **APROV** — achados: G15-1
- [x] **137** — Varrer o repositório por outras gravações que o banco recusa em silêncio — onda 3 — Alta — achados: G15-1 · **FECHADO 2026-11-25 -- varredura completa executada sobre 525 arquivos do `src/`: 60 gravacoes cruas (`supabase.from(...).insert/update/upsert/delete`) e 161 leituras cruas, cruzadas com as listas de `withOrg.ts`. Resultado: **23 ORG_UNSCOPED** (decisao consciente ja registrada no codigo), **11 EXEMPT** (profiles/organizations/members/invites), **22 ORG_SCOPED** (as que o wrapper existe para injetar/forcar a organizacao) e **4 nao classificadas** (`sla_alert_settings`, `queue_sla_defaults`, `circuit_breaker_alert_settings`, `partition_advisories` - sem `organization_id`, o teste `withOrg.registry.test.ts` cobre coluna por coluna). Caso confirmado e corrigido nesta rodada: `notifications` (ORG_SCOPED, `organization_id` NOT NULL com default) era inserido em `LushaIntelligenceView.tsx:398` com `user_id` mas **sem** `organization_id`, entao a notificacao de enriquecimento nascia na organizacao padrao antiga do usuario, nao na ativa; passou a usar `db` (`withOrg`), que injeta a organizacao ativa. Verificacao: `npx tsc --noEmit -p tsconfig.app.json` 0, `npx eslint` 0, `npx vitest run src/components/lux/lusha` -> 7 arquivos/78 testes verdes. Os outros 21 casos ORG_SCOPED ficam listados na tabela comparativa publicada na PR #234 (nao corrigidos aqui: cada um exige decidir se o fluxo e autenticado com organizacao ativa, como `incidents` e `satisfaction_responses`, que sao telas publicas)
- [ ] **138** — Fazer a matriz de permissões ser aplicada no banco, não só na interface — onda 3 — Alta · **APROV** — achados: G32-1
- [x] **139** — Corrigir a leitura de auditoria que não passa pelo wrapper — onda 3 — Média — achados: G21-1, G1-3 · **FECHADO 2026-11-25 -- resolvida pela reescrita da etapa 064: `MonitoringView.tsx` nao tem mais nenhuma ocorrencia de `supabase` (`rg 'supabase' src/components/lux/monitoring/MonitoringView.tsx` -> vazio); a trilha vem de `useAuditTrail` (`src/hooks/useAuditTrail.ts:73`), que usa `db` de `withOrg` e `audit_logs` esta classificada em `ORG_SCOPED_TABLES` (`src/integrations/supabase/withOrg.ts:91`), entao o wrapper aplica `.eq("organization_id", activeOrgId)` (comportamento em `:7`) e o hook so roda com `enabled: !!activeOrgId`
- [x] **140** — Corrigir as outras duas leituras cruas das views do registro — onda 3 — Média — achados: G1-3 · **FECHADO 2026-11-25 -- levantamento das tabelas dos dois componentes: `LushaIntelligenceView` usa `lusha_dm_search_history`, `lusha_search_sessions`, `lusha_contacts` e `notifications`; `AutomationStatusPanel` usa `scrape_queue`, `web_scrape_queue`, `scrape_dead_letter`, `web_scrape_dead_letter` e `automation_execution_logs`. Todas, exceto `notifications`, estao em `ORG_UNSCOPED_TABLES` (`withOrg.ts:192-216`) - decisao consciente registrada desde a rodada #27, com RLS propria -, entao trocar o import nao mudaria escopo nenhum; a unica tabela escopada desses arquivos, `notifications`, foi corrigida na etapa 137
- [ ] **141** — Corrigir o fuso horário do "hoje" nos indicadores do painel — onda 3 — Média · **APROV** — achados: G33-1
- [ ] **142** — Mostrar corretamente o atraso dos pedidos de titular de dados — onda 3 — Média · **APROV** — achados: G33-2

## Onda 4 — Funcionalidades incompletas

- [ ] **143** — Fazer a aba de relatórios agendados funcionar de ponta a ponta — onda 4 — Alta — achados: G30-1
- [ ] **144** — Agendar o envio dos relatórios agendados — onda 4 — Alta · **APROV** — achados: G30-1
- [ ] **145** — Agendar a limpeza dos registros de auditoria com mais de 90 dias — onda 4 — Média · **APROV** — achados: G7-4
- [ ] **146** — Padronizar a autenticação de agendamento nas três funções que usam o modelo antigo — onda 4 — Alta · **APROV** — achados: G22-5
- [ ] **147** — Verificar quais rotinas agendadas estão de fato rodando — onda 4 — Alta — achados: G22-5, G7-4, G16-2
- [ ] **148** — Versionar os agendamentos que existem no banco e não no repositório — onda 4 — Média · **APROV** — achados: G22-5
- [ ] **149** — Implementar o registro de consumo de crédito da Lusha — onda 4 — Alta · **APROV** — achados: G18-2
- [ ] **150** — Mostrar ao dono o consumo de crédito por organização — onda 4 — Média — achados: G18-2
- [ ] **151** — Criar teto de gasto por organização nas integrações pagas — onda 4 — Alta · **APROV** — achados: G18-2
- [ ] **152** — Decidir e implementar o direito de eliminação prometido no documento de LGPD — onda 4 — Alta · **APROV** — achados: G7-1
- [ ] **153** — Decidir e implementar a obrigatoriedade de segundo fator para administradores — onda 4 — Alta · **APROV** — achados: G7-2
- [ ] **154** — Preencher o encarregado de dados no documento de LGPD — onda 4 — Média · **APROV** — achados: G7-3
- [ ] **155** — Conferir o documento de LGPD inteiro contra o sistema — onda 4 — Média · **APROV** — achados: G7-1, G7-2, G7-3, G7-4
- [ ] **156** — Restringir o painel de trilha de auditoria a administradores — onda 4 — Média — achados: G21-1
- [ ] **157** — Restringir o painel de cofre de cookies a administradores — onda 4 — Média — achados: G21-1
- [ ] **158** — Restringir o simulador de falhas a administradores — onda 4 — Alta · **APROV** — achados: G21-1
- [ ] **159** — Restringir a tela de descoberta de regras de acesso a administradores — onda 4 — Média — achados: G21-1
- [ ] **160** — Filtrar o menu pelo papel do usuário — onda 4 — Média · **APROV** — achados: G21-1
- [ ] **161** — Remover o identificador e o nome de organização real do código do site — onda 4 — Baixa — achados: G21-2
- [ ] **162** — Dar prazo de validade ao token de resposta de pesquisa — onda 4 — Média · **APROV** — achados: G34-1
- [ ] **163** — Dar prazo de validade e uso único à assinatura dos links de rastreio — onda 4 — Média · **APROV** — achados: G17-6
- [ ] **164** — Guardar e validar o valor de uso único do fluxo de conexão de e-mail — onda 4 — Média · **APROV** — achados: G18-4
- [ ] **165** — Acrescentar chave de idempotência nas gravações da API pública — onda 4 — Média · **APROV** — achados: G31-3
- [ ] **166** — Acrescentar chave de idempotência na ingestão de resultados de QA — onda 4 — Baixa · **APROV** — achados: G22-6 (C-11 da camada de backend)
- [ ] **167** — Documentar a justificativa das duas funções sem verificação de token — onda 4 — Baixa — achados: G12-4 (H2 da camada de infraestrutura)
- [ ] **168** — Validar a entrada do enfileiramento do Instagram com esquema — onda 4 — Média · **APROV** — achados: G17-2
- [ ] **169** — Tornar atômica a verificação de duplicidade no enfileiramento do Instagram — onda 4 — Média · **APROV** — achados: G17-2
- [ ] **170** — Dar teto de tentativas às tarefas do Instagram — onda 4 — Alta · **APROV** — achados: G17-4
- [ ] **171** — Reduzir a espera do cliente de integração do Instagram dentro da invocação — onda 4 — Média · **APROV** — achados: G17-4
- [ ] **172** — Incluir a fila morta do Instagram no alerta — onda 4 — Média · **APROV** — achados: G17-4
- [ ] **173** — Classificar os erros que não devem gerar nova tentativa de webhook — onda 4 — Média · **APROV** — achados: G17-5
- [ ] **174** — Criar disjuntor por destino de webhook — onda 4 — Média · **APROV** — achados: G17-5
- [ ] **175** — Alinhar a espera entre tentativas de webhook com o que a documentação promete — onda 4 — Baixa · **APROV** — achados: G17-5
- [ ] **176** — Validar as respostas dos provedores externos antes de usá-las — onda 4 — Média · **APROV** — achados: G18-3
- [ ] **177** — Corrigir o domínio padrão da lista de origens permitidas — onda 4 — Alta · **APROV** — achados: G23-1
- [ ] **178** — Fixar a versão do caminho de importação compartilhado pelas edge functions — onda 4 — Média · **APROV** — achados: G23-4
- [ ] **179** — Padronizar o formato das respostas de erro das funções — onda 4 — Média · **APROV** — achados: G22-7
- [ ] **180** — Parar de devolver detalhe interno de erro ao cliente — onda 4 — Média · **APROV** — achados: G22-6

## Onda 5 — Robustez: erros, estados, concorrência

- [ ] **181** — Aplicar tempo-limite às chamadas externas do disparo de campanhas — onda 5 — Alta · **APROV** — achados: G18-1
- [ ] **182** — Aplicar tempo-limite às chamadas da leitura de respostas de e-mail — onda 5 — Alta · **APROV** — achados: G18-1
- [ ] **183** — Aplicar tempo-limite às chamadas do envio de relatórios agendados — onda 5 — Alta · **APROV** — achados: G18-1
- [ ] **184** — Aplicar tempo-limite às chamadas do retorno de conexão de e-mail — onda 5 — Média · **APROV** — achados: G18-1
- [ ] **185** — Aplicar tempo-limite às chamadas do portal de automação externa — onda 5 — Alta · **APROV** — achados: G18-1
- [ ] **186** — Aplicar tempo-limite à chamada do agente de IA — onda 5 — Média · **APROV** — achados: G18-1
- [ ] **187** — Aplicar tempo-limite à extração de conteúdo web — onda 5 — Média · **APROV** — achados: G18-1
- [ ] **188** — Aplicar tempo-limite às chamadas de enriquecimento de contato — onda 5 — Média · **APROV** — achados: G18-1
- [ ] **189** — Aplicar tempo-limite à busca de lugares — onda 5 — Média · **APROV** — achados: G18-1
- [ ] **190** — Aplicar tempo-limite às chamadas do canal de consulta — onda 5 — Média · **APROV** — achados: G18-1
- [ ] **191** — Fazer a verificação de saúde da integração devolver código de erro — onda 5 — Média · **APROV** — achados: G22-4
- [ ] **192** — Varrer as funções por erro devolvido como sucesso — onda 5 — Média · **APROV** — achados: G22-4
- [x] **193** — Tratar o erro da leitura de desempenho semanal — onda 5 — Alta — achados: G5-1 · **FECHADO 2026-11-25 -- ja resolvida pelo lote 123-127 (PR #232), como o proprio contrato da etapa preve: `useWeeklyPerformance.ts` propaga o erro (`if (error) throw error;`) e `DashboardView.tsx` mostra o aviso do widget em vez do grafico de zeros. Sem duplicar trabalho. Provas: caso do hook que exige que o erro chegue ao componente e caso do painel que exige o aviso; fail-first removendo o `throw` -> 2 casos falham; fail-first fixando o erro em `undefined` no painel -> o caso do aviso falha
- [ ] **194** — Garantir que apenas um perfil de cliente ideal fique ativo — onda 5 — Alta · **APROV** — achados: G5-1
- [x] **195** — Tratar o erro da chamada de função na leitura de negócios — onda 5 — Média — achados: G5-1 · **FECHADO 2026-11-25** — `useDeals.ts`: a chamada a `create_default_deal_stages` agora le `error` e avisa com o motivo em vez de deixar o funil vazio em silencio; a etapa 196 entrou no mesmo efeito
- [x] **196** — Eliminar o risco de laço no auto-preenchimento das etapas do funil — onda 5 — Média — achados: G5-1 (A8 da camada de hooks) · **FECHADO 2026-11-25** — `useDeals.ts`: marca `seedKeyRef` (usuario + organizacao ativa) posta **antes** da chamada, entao o efeito roda no maximo uma vez por montagem e nao depende da identidade da lista vazia; `create_default_deal_stages` retorna `void`, logo a invalidacao so acontece no caminho sem erro. Prova: teste novo devolve lista vazia nova a cada render e exige 1 chamada (sem o fix: 3)
- [x] **197** — Corrigir a leitura de estado do passo a passo de boas-vindas — onda 5 — Média — achados: G5-1 · **FECHADO 2026-11-25** — `useOnboardingState.ts:32-43`: le `error` do resultado; em erro de resposta ou de rede o passo a passo **nao** reaparece (criterio do contrato). Perfil ausente sem erro continua mostrando. Prova: 3 casos novos, 1 falhava no codigo antigo
- [x] **198** — Varrer os hooks por erro ignorado na desestruturação — onda 5 — Média — achados: G5-1 · **FECHADO 2026-11-25** — varredura dos 149 `const { data } = await` de `src/hooks/*`: os enriquecimentos best-effort (`useAuditTrail`, `useEmailAccountAuditLog`, `useMembershipAuditLog` ×2, `useOrganizations` ×2, `useFeatureFlag` ×5, `usePartitionAdvisories`) agora declaram por comentário que o erro é ignorado de propósito, `useWebScrape` `invoke()` propaga `Sessão indisponível: <motivo>` quando `getSession` falha, e nos demais pontos o `error` já era lido na mesma desestruturação (nada a corrigir).
- [x] **199** — Tratar erro nas mutações de negócios — onda 5 — Média — achados: G5-2 · **FECHADO 2026-11-25** — `useDeals.ts`: `onError` com motivo em `updateStage`, `deleteDeal`, `addActivity`, `createTask`, `toggleTask` e `deleteTask`; `updateDeal` nao foi tocado (ja tinha desfazimento otimista). Prova: teste exige que nenhuma mutacao exposta fique sem `onError`
- [x] **200** — Tratar erro nas mutações de modelos de e-mail — onda 5 — Média — achados: G5-2 · **FECHADO 2026-11-25** — `useEmailTemplates.ts`: `onError` com o motivo real em salvar, excluir e duplicar (`toast.error("Não foi possível salvar/excluir/duplicar o modelo", { description })`); antes a mutação falhava sem nenhum aviso.
- [x] **201** — Tratar erro nas mutações de chaves de API — onda 5 — Média — achados: G5-2 · **FECHADO 2026-11-25** — `useApiKeys.ts`: `onError` com motivo em revogar e excluir; antes a chave continuava na tela como se a ação tivesse funcionado.
- [x] **202** — Tratar erro nas mutações da fila de raspagem — onda 5 — Média — achados: G5-2 · **FECHADO 2026-11-25** — só evidência: `useScrapeQueue.ts` já tinha `onError` nas 3 mutações (`replay`, `replayBatch`, `purge`) — nenhuma alteração necessária.
- [x] **203** — Tratar erro nas mutações do perfil de cliente ideal — onda 5 — Média — achados: G5-2 · **FECHADO 2026-11-25** — `useICPConfig.ts`: `onError` com motivo em ativar e remover; antes uma falha deixava o perfil como estava sem explicar o motivo.
- [x] **204** — Mostrar o motivo da falha ao excluir empresa — onda 5 — Média — achados: G5-2 · **FECHADO 2026-11-25** — `CompaniesView.tsx:188-205`: o `catch` do `handleSingleDelete` passou de `catch {}` para `catch (err)` e o toast mostra `err.message` (fallback `"Motivo desconhecido."`); antes só dizia "Erro ao remover".
- [ ] **205** — Invalidar os indicadores do painel após exclusão em lote — onda 5 — Baixa — achados: G5-3
- [ ] **206** — Passar as leituras de modelos de e-mail pelo wrapper de organização — onda 5 — Alta — achados: G1-3
- [ ] **207** — Passar as leituras de chaves de API pelo wrapper — onda 5 — Alta — achados: G1-3
- [ ] **208** — Passar as leituras de lembretes de tarefa pelo wrapper — onda 5 — Média — achados: G1-3
- [ ] **209** — Passar as leituras da fila de raspagem pelo wrapper — onda 5 — Média — achados: G1-3
- [ ] **210** — Passar as escritas de pesquisa de satisfação e metas pelo wrapper — onda 5 — Média — achados: G1-3
- [ ] **211** — Eliminar a invalidação dupla na troca de organização — onda 5 — Média — achados: G1-2 (A4 da camada de hooks)
- [ ] **212** — Fazer o canal em tempo real de automações acompanhar a troca de organização — onda 5 — Média — achados: G1-2 (A9 da camada de hooks)
- [ ] **213** — Corrigir a reinstalação do escutador de filtros persistidos a cada desenho — onda 5 — Baixa — achados: G1-2 (A11 da camada de hooks)
- [ ] **214** — Dar tempo de vida curto às consultas de papel e permissão — onda 5 — Média — achados: G1-5
- [ ] **215** — Tratar erro ao ligar e desligar fluxo automatizado — onda 5 — Média — achados: G27-2
- [ ] **216** — Tratar erro nas demais mutações de interface sem aviso — onda 5 — Média — achados: G27-2
- [ ] **217** — Distinguir "sem dados" de "falha ao carregar" no painel de auditoria — onda 5 — Média — achados: G27-1
- [ ] **218** — Tratar carregamento e erro no gráfico de tendência de SLA — onda 5 — Média — achados: G27-1
- [ ] **219** — Tratar carregamento e erro no painel de resiliência de filas — onda 5 — Média — achados: G27-1
- [ ] **220** — Tratar carregamento e erro no histórico de QA — onda 5 — Baixa — achados: G27-1
- [ ] **221** — Tratar carregamento e erro nos painéis de conformidade e histórico de SLA — onda 5 — Média — achados: G27-1
- [ ] **222** — Tratar carregamento e erro no simulador de falhas e no detalhe de tarefa — onda 5 — Baixa — achados: G27-1
- [ ] **223** — Tratar carregamento e erro no funil de enriquecimento — onda 5 — Média — achados: G27-1
- [ ] **224** — Tratar erro nas cinco consultas do painel de rastreio de campanha — onda 5 — Média — achados: G27-1
- [ ] **225** — Tratar erro na paleta de comandos e na navegação — onda 5 — Baixa — achados: G27-1
- [ ] **226** — Tratar carregamento e erro na página de monitoramento — onda 5 — Alta — achados: G27-1
- [ ] **227** — Aplicar o envoltório de estado ao segundo grupo de painéis de monitoramento — onda 5 — Média — achados: G27-1
- [ ] **228** — Aplicar o envoltório de estado ao terceiro grupo de painéis de monitoramento — onda 5 — Média — achados: G27-1
- [ ] **229** — Aplicar o envoltório de estado aos painéis restantes de monitoramento — onda 5 — Média — achados: G27-1
- [ ] **230** — Desfazer a atualização otimista das permissões quando a gravação falha — onda 5 — Baixa — achados: G5-2
- [ ] **231** — Fazer o limite de requisições da Lusha falhar fechado — onda 5 — Média · **APROV** — achados: G18-2
- [ ] **232** — Criar limite de requisições nas cinco funções pagas que não têm nenhum — onda 5 — Alta · **APROV** — achados: G18-2

## Onda 6 — Performance

- [ ] **233** — Paginar a lista de empresas no servidor — onda 6 — Alta — achados: G19-1
- [ ] **234** — Definir o teto de linhas por resposta na configuração do banco — onda 6 — Alta · **APROV** — achados: G19-1
- [ ] **235** — Paginar a lista de contatos no servidor — onda 6 — Média — achados: G19-1
- [ ] **236** — Parar de trazer o bloco de dados brutos para o mapa — onda 6 — Alta — achados: G19-1
- [ ] **237** — Varrer as consultas que selecionam todas as colunas sem necessidade — onda 6 — Média — achados: G19-1
- [ ] **238** — Remover os índices duplicados dos registros de execução de automação — onda 6 — Baixa · **APROV** — achados: G19-2
- [ ] **239** — Remover os cinco índices recriados com nome duplicado — onda 6 — Baixa · **APROV** — achados: G19-2
- [ ] **240** — Varrer e remover os demais índices duplicados — onda 6 — Baixa · **APROV** — achados: G19-2
- [ ] **241** — Criar índices na tabela de chaves de idempotência — onda 6 — Média · **APROV** — achados: G19-2
- [ ] **242** — Criar índices liderados pela organização nas oito tabelas que faltam — onda 6 — Média · **APROV** — achados: G19-2
- [ ] **243** — Medir as consultas mais lentas em produção — onda 6 — Média — achados: G19-1, G19-2
- [ ] **244** — Corrigir a consulta mais lenta apontada pela medição — onda 6 — Média · **APROV** — achados: G19-1
- [ ] **245** — Corrigir a segunda consulta mais lenta apontada pela medição — onda 6 — Média · **APROV** — achados: G19-1
- [ ] **246** — Criar índice de busca por texto para a lista de empresas — onda 6 — Média · **APROV** — achados: G19-1
- [ ] **247** — Reduzir o volume de dados do painel inicial — onda 6 — Média — achados: G19-1
- [ ] **248** — Evitar consultas em cascata na lista de empresas — onda 6 — Média — achados: G19-1
- [ ] **249** — Medir o tamanho do pacote do site e reduzir o maior item — onda 6 — Baixa — achados: G19-1
- [ ] **250** — Medir e registrar o tamanho das maiores tabelas — onda 6 — Média — achados: G19-2

## Onda 7 — Experiência de uso e consistência

- [x] **251** — Corrigir o texto corrompido da página de monitoramento — onda 7 — Alta — achados: G3-1 · **FECHADO 2026-11-25** — os textos estavam duplamente codificados (UTF-8 lido como cp1252): 37 linhas corrigidas em `src/pages/Monitoring.tsx` (28: título, abas, botões, toasts, períodos, paginação), `LoginCard.tsx:69,77` (comentário e aria-label), `auth-context.ts:9-10` e `WarmupPanel.tsx:26`; varredura de `src/`, `e2e/` e `scripts/` passou de 33 para **0** ocorrências
- [ ] **252** — Corrigir o rótulo acessível corrompido na tela de login — onda 7 — Média — achados: G3-1, G26-1
- [ ] **253** — Corrigir os comentários corrompidos do contexto de autenticação e criar verificação automática — onda 7 — Baixa · **APROV** — achados: G3-1
- [ ] **254** — Dar rótulo acessível aos controles da lista de automações — onda 7 — Baixa — achados: G26-1
- [ ] **255** — Dar rótulo acessível ao botão que apaga todas as notificações — onda 7 — Média — achados: G26-1
- [ ] **256** — Dar rótulo acessível aos demais botões só com ícone — onda 7 — Baixa — achados: G26-1
- [ ] **257** — Reduzir o escopo do anúncio automático de mudança de tela — onda 7 — Baixa — achados: G26-1
- [ ] **258** — Dar aviso claro quando a organização ainda não carregou — onda 7 — Média — achados: G1-1, G1-4
- [ ] **259** — Esconder o menu de administração até o papel ser conhecido — onda 7 — Média — achados: G1-4
- [ ] **260** — Validar as variáveis de ambiente do site na inicialização — onda 7 — Média — achados: G34-2
- [ ] **261** — Unificar a classificação de empresa por nota numa única fonte — onda 7 — Média — achados: G28-2
- [ ] **262** — Mostrar o estado de carregamento em todas as ações que chamam serviço pago — onda 7 — Média — achados: G16-6, G18-2
- [ ] **263** — Pedir confirmação nas ações destrutivas em lote — onda 7 — Média — achados: G5-3
- [ ] **264** — Padronizar as mensagens de aviso ao usuário — onda 7 — Baixa — achados: G27-2
- [ ] **265** — Remover ou concluir o aviso "em desenvolvimento" do mapa no painel de status — onda 7 — Baixa — achados: G16-4
- [ ] **266** — Varrer a interface por outros textos de obra e marcações de pendência — onda 7 — Baixa — achados: G16-4, G16-6
- [ ] **267** — Mostrar na interface quando um webhook foi desativado por endereço inválido — onda 7 — Média — achados: G17-5
- [ ] **268** — Mostrar a contagem total ao lado do que está sendo exibido nas listas — onda 7 — Média — achados: G19-1
- [ ] **269** — Mostrar o progresso das tarefas de raspagem enfileiradas — onda 7 — Média — achados: G16-1
- [ ] **270** — Mostrar o motivo quando uma empresa não pôde ser enriquecida — onda 7 — Média — achados: G20-1
- [ ] **271** — Revisar o comportamento das telas em tela de celular — onda 7 — Média — achados: G16-6
- [ ] **272** — Cobrir com teste de interface as telas de celular — onda 7 — Baixa — achados: G16-6
- [ ] **273** — Atualizar o documento de estado atual com os achados desta auditoria — onda 7 — Média · **APROV** — achados: G24-1
- [ ] **274** — Corrigir a referência errada ao projeto do banco nas instruções — onda 7 — Média · **APROV** — achados: G24-1, G23-2
- [ ] **275** — Documentar o procedimento de volta atrás do deploy — onda 7 — Alta · **APROV** — achados: G22-3
- [ ] **276** — Zerar os 22 erros de lint herdados — onda 7 — Média — achados: G2-2
- [ ] **277** — Corrigir os quatro avisos de lint restantes — onda 7 — Baixa — achados: G2-2

## Onda 8 — Higiene: código morto, CI, observabilidade

- [ ] **278** — Regerar o pacote da função MCP com as dependências atuais — onda 8 — Alta · **APROV** — achados: G8-1
- [ ] **279** — Criar verificação que impeça o pacote gerado de divergir do gerador — onda 8 — Média · **APROV** — achados: G8-1
- [ ] **280** — Trocar a instalação de dependências do CI por instalação fiel ao arquivo de trava — onda 8 — Média · **APROV** — achados: G8-2
- [ ] **281** — Decidir qual gerenciador de pacotes o projeto usa — onda 8 — Média · **APROV** — achados: G23-7
- [ ] **282** — Resolver a configuração duplicada e quebrada do verificador de mensagem de commit — onda 8 — Média · **APROV** — achados: G23-3
- [ ] **283** — Fazer o CI cobrar o limite de cobertura que o projeto declara — onda 8 — Média · **APROV** — achados: G2-2 (B2 da camada de infraestrutura)
- [ ] **284** — Colocar os testes de interface em algum workflow — onda 8 — Alta · **APROV** — achados: G2-3
- [ ] **285** — Incluir a suíte de garantias de acesso no CI — onda 8 — Alta · **APROV** — achados: G2-1
- [ ] **286** — Fazer o CI avisar quando falhar — onda 8 — Alta · **APROV** — achados: G22-2
- [ ] **287** — Ligar o teste de fumaça de produção ao deploy — onda 8 — Alta · **APROV** — achados: G22-2
- [ ] **288** — Reavaliar a permissividade da revisão de dependências — onda 8 — Média · **APROV** — achados: G10-1 (B3 da camada de infraestrutura)
- [ ] **289** — Incluir a verificação de integridade das instruções de agente num portão — onda 8 — Baixa · **APROV** — achados: G24-1
- [ ] **290** — Remover a tolerância a falha na geração do PDF de auditoria — onda 8 — Baixa — achados: G8-2
- [ ] **291** — Instalar monitoramento de erro no site — onda 8 — Alta · **APROV** — achados: G22-1
- [ ] **292** — Criar alerta para falha de rotina agendada — onda 8 — Alta · **APROV** — achados: G22-2
- [ ] **293** — Remover os dois módulos de hook sem nenhum importador — onda 8 — Baixa — achados: G9-1
- [ ] **294** — Remover os quatro componentes sem referência — onda 8 — Baixa — achados: G25-1
- [ ] **295** — Remover os doze componentes de interface do modelo que nunca foram usados — onda 8 — Baixa — achados: G25-1
- [ ] **296** — Remover as importações não usadas que o lint não pega — onda 8 — Baixa — achados: G25-1
- [ ] **297** — Regerar o inventário de funções de backend — onda 8 — Baixa — achados: G24-2
- [ ] **298** — Fechar ou concluir as oito pull requests abertas — onda 8 — Média · **APROV** — achados: G34-3
- [ ] **299** — Rodar os guardas de banco e registrar o que eles apontarem — onda 8 — Alta — achados: G13-1
- [ ] **300** — Criar regra automática que obrigue o uso do wrapper de organização — onda 8 — Alta · **APROV** — achados: G1-3

---

## Achados novos (anotados durante a execução)

> Regra 4 do plano: problema encontrado no caminho **não é corrigido na hora**. Registre aqui, com arquivo e linha, e volte à etapa.

| Data | Etapa em curso | Arquivo:linha | O que foi encontrado | Severidade estimada |
| ---- | -------------- | ------------- | -------------------- | ------------------- |
| 2026-11-26 | 047 | `src/integrations/supabase/types.ts` (blocos `Row` de `email_suppressions`, `email_accounts`, `api_keys`, `webhooks`) | Os tipos gerados não listam a coluna `deleted_at` nessas quatro tabelas, mas a produção tem (`information_schema.columns`, projeto `pttzwlbidamibjssqiqb`). O banco está à frente do arquivo de tipos: quem se guiar por `types.ts` conclui que essas tabelas não têm exclusão reversível e escreve o código errado — foi o que produziu o G31-1. | Média |
| 2026-11-26 | 123–127 | 35 chamadas `supabase.from(...)` cruas em 168 totais do `src/` (ex.: `AIAgentView.tsx:99`, `ScrapeResultsView.tsx:167`, `SettingsView.tsx` em `profiles` ×4, `useDeals.ts` ×2, `useDashboardLayout.ts` ×2, `lib/orgErrorHandler.ts:479`) | A varredura mostrou que ainda existem 35 leituras/escritas cruas de tabelas com escopo de organização fora das que este lote corrigiu — o defeito do G31-4 é maior que as cinco etapas. Não caberia consertar aqui (regra 4). | Média |
| 2026-11-25 | 063–067 | `tsconfig.json` (raiz, `"files": []` + `references`) | `npx tsc --noEmit` **sem** `-p` sai 0 sempre, porque o tsconfig raiz nao inclui arquivo nenhum: e so um indice de projetos. O verde local era falso - a CI (`-p tsconfig.app.json`) pegou um `TS2588` que o comando sem `-p` nao viu. Para qualquer agente, o typecheck real e `npx tsc --noEmit -p tsconfig.app.json`. | Alta |
| 2026-11-25 | 067 | `src/App.tsx:221-230` (`/monitoring`, sob `ProtectedRoute`) | A rota `/monitoring` nao tem portao de administrador - so exige login. A tela lista contagens de `scrape_queue`, `web_scrape_queue` e das DLQs, tabelas classificadas em `ORG_UNSCOPED_TABLES` (`withOrg.ts:203-216`), ou seja, sem filtro de organizacao no cliente: qualquer usuario autenticado que digite a URL ve numeros operacionais de todas as organizacoes. Antes isso era invisivel porque nenhum link levava a tela; a etapa 067 passou a divulga-la no menu (para administrador). Falta o portao no banco (policy) para a rota nao depender da interface. | Alta |
| 2026-11-25 | 110–111 | `create_default_deal_stages` (banco, `pg_get_functiondef` em produção) | A função é `SECURITY DEFINER` e o `EXISTS` que evita duplicar estágios filtra só `user_id` (sem organização), enquanto o `INSERT` não informa `organization_id` e por isso herda `default_org_for_current_user()` — ou seja, os estágios padrão de um usuário novo nascem sempre na organização mais antiga dele. Mesma classe do G29-3, agora do lado do banco: `useDeals.ts:62` chama a rpc e não tem como corrigir no front. Correção exige migration (regra 8). | Alta |
| 2026-11-25 | 195–199 | `src/hooks/useOnboardingState.ts:55-65` | `markCompleted` grava em `profiles` sem ler `error`: se o update falhar, o cache local fica `true` e o passo a passo nunca mais aparece para quem *não* concluiu | Media |
| 2026-11-25 | 199 | `src/hooks/useDeals.ts` (`createDeal`) | O `onError` mostra o motivo real como descricao, mas o titulo e so "Erro" — inconsistente com as outras mutacoes do mesmo hook ("Erro ao criar estagio", "Nao foi possivel remover o negocio") | Baixa |
| 2026-11-25 | 204 | `src/components/lux/CompaniesView.tsx:219` (`handleBulkDelete`) | A exclusão em lote continua mostrando só "Erro ao remover" sem o motivo (`catch { toast(...) }`), diferente da exclusão individual corrigida agora — mesma classe de defeito, fica para a etapa 205 que já mexe nesse handler |

---

## Registro de divergências

> Regra 2 do plano: se o código já não corresponde à evidência descrita na etapa, pare, registre aqui e siga para a próxima etapa independente.

| Etapa | O que a etapa descrevia | O que foi encontrado | Decisão |
| ----- | ----------------------- | -------------------- | ------- |
| 123–127 | A etapa 123 está marcada como "depende de 122" (migration dos 13 contadores) na tabela de execução | As cinco etapas são alterações de front em sete arquivos de tela/hook, sem nenhum ponto de contato com a migration da etapa 122 (que só mexe em funções SQL de contagem). A dependência era temática (mesma origem G31-4 e a mesma varredura de leitura crua), não técnica. | Executadas 123–127 agora, em lote único com `tsc` 0 / `eslint` 0 / 61 arquivos e 534 testes verdes; a etapa 122 continua aguardando aprovação por ser migration em produção, sem bloquear nada destas cinco |
| 080 | O teste `src/__tests__/botoes-com-manipulador.test.ts` varre os componentes em busca de botões sem manipulador | Na suíte completa ele falhou 1 vez (1097 passaram / 1 falhou) e passou isolado (2/2) e na segunda execução completa (105 arquivos / 1098 testes, tudo verde). É instabilidade da varredura em paralelo, não regressão de código. | Etapa segue fechada pelo resultado isolado; o teste fica anotado como instável quando a suíte inteira roda em paralelo (candidato a ajuste de tempo limite, fora deste lote) |

---

## Levantamentos entregues

> As etapas de levantamento (024, 055, 057, 102–105, 147, 243, 250, 298, 299) não alteram código: o resultado delas vive aqui.

| Etapa | Levantamento | Resultado resumido | Link da PR |
| ----- | ------------ | ------------------ | ---------- |
|       |              |                    |            |
