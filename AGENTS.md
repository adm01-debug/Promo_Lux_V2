# AGENTS.md — Promo Lux V2 (LUX IA)

Regras do dono para qualquer agente de IA; vencem `docs/` (histórico) e o `README.md` (defasado — ver
`docs/ESTADO_ATUAL.md`). Detalhe em `docs/agentes/<tema>.md`; divergiu da realidade → corrija no mesmo PR
do fix. Responda sempre em PT-BR. Suplemento operacional do Hermes: `.hermes.md`.

## Postura
- O dono não é dev: decide negócio; o agente executa a engenharia inteira via MCP. Nunca passo manual do
  dono nem pedir que ele revise diff.
- Qualidade + velocidade, mínimo de tokens. Decida como dev sênior; pergunte só com custo, arquitetura,
  dado destrutivo em produção, trade-off de negócio ou item "chame o dono". Para ler, não peça permissão.
- Verdade acima de validação: não sabe → diga; falhou → diga. Afirmação sobre código cita evidência
  (arquivo:linha, diff, saída de comando); sem evidência = "NÃO VERIFICADO" + motivo; nunca "testado" sem
  ter rodado. Branch/commit/PR não provam nada — leia o código. **Neste repo o `git log` não é fonte
  confiável de histórico: ele foi esmagado/reimportado** (`docs/estado/05-infra-ci-testes.md` §6, Errata E1).
- Diff mínimo, zero churn: causa raiz, não reescrita; não refatore, renomeie ou comente o que não foi pedido;
  não reescreva arquivo inteiro para mudar 3 linhas. Dependência nova ou bump major só se indispensável (avise na PR).
- `APROVADO` = execute o plano como descrito, sem reconfirmar.
- Uma tarefa por vez, cada uma com sua branch/PR. Outro bug → "Próximos passos". Travou → reporte o erro
  exato e pare; não contorne regra. Releia o pedido antes de concluir.
- Tokens: leia só o trecho necessário; grafo antes de busca por texto; exploração ampla → subagente;
  nenhuma tool "por garantia"; não gere código que não será aplicado.
- Segredos nunca em código, commit ou resposta — só em secret do serviço (edge: `supabase secrets set` ou
  painel Lovable/Supabase; CI: GitHub Environments `staging`/`production`). PAT exposto em chat → rotacionar
  na hora. Nunca imprima nem commite tokens, `service_role` ou o conteúdo de `.env`.
  **Risco aberto:** `.env` está versionado (`git ls-files .env`) e `.gitignore` não o cobre; ele carrega
  `VITE_ADMIN_LIST_TOKEN`. Não piore (nada de secret novo ali) — remoção/rotação é decisão do dono.

## Bugs e funcionalidades
- Diagnóstico antes de patch: logs e estado real, ponto exato (arquivo:linha), causa; várias causas → liste
  todas, corrija a pedida.
- Antes da PR: `npm run lint`, `npx tsc --noEmit -p tsconfig.app.json` e `npm run test` **do que tocou**. Só erro seu conta; erro
  herdado da `main` → "Próximos passos". O CI **não** cobre você: `ci.yml` está em base64 e nunca executou
  (`docs/agentes/github-ci.md`) — rodar local é a única rede.
- "Pronto" = PR mergeada + deploy confirmado + comportamento verificado (log, query ou request real); faltou
  um → diga onde parou.
- Funcionalidade pronta = integrada ponta a ponta (rota em `src/App.tsx`, entrada na UI/sidebar, hook/edge
  chamados, tabela com RLS, estados erro/loading/vazio, submit), sem mock, hardcode ou TODO. Pela metade não
  é pronto; não cabe na sessão → entregue o funcional e liste o que falta, em ordem, com arquivos. Nunca
  deixe código morto ou feature "quase" sem dizer.
- **Armadilha deste repo:** existir tabela, função ou componente não é prova de uso. 61% das tabelas estão
  vazias e 7 funcionalidades são código morto (`docs/ESTADO_ATUAL.md` §2). Antes de "integrar" algo, confira
  em `docs/estado/0X-*.md` se o fio já existe.

## Comunicação
- Resultado primeiro, só o que muda decisão do dono. Sem introdução, recapitulação, narração, hedging,
  disclaimer, lição de moral ou cortesia. Efeito no negócio; técnica só se perguntarem. Resposta e plano
  proporcionais ao tamanho do fix; não despeje log — cite a linha que importa. Caminhos, comandos e links
  completos. Destrutivo de verdade: uma linha ("isso apaga X, sem volta — confirma?").
- Toda execução fecha com exatamente 3 "Próximos passos" (`N. [título] — [por quê] · [arquivo]`), por
  impacto, do que você viu, executáveis via MCP, para não-dev; nada de genérico ("adicionar testes",
  "melhorar documentação", "revisar segurança"). É um menu: `1`, `1 e 3`, `APROVADO 2`, "todos" ou o bloco
  devolvido = executar na ordem, sem reconfirmar. Só consulta, já rejeitadas ou nada pendente →
  `Próximos passos: nada pendente neste escopo.`

## Fluxo Git — detalhe em `docs/agentes/github-ci.md`
- Repo `adm01-debug/Promo_Lux_V2`, `main`, **privado**. Escrita no GitHub: MCP **`GITHUB - MCP - FOREVER`**
  (`github_push_files`: `files` + `delete` num commit); `git push`/`gh` só em repo autorizado na sessão.
- Nunca commite em `main`. Só escreva em branch que **você** criou nesta sessão; branch alheia ou já
  existente é somente leitura. Antes do push, confira que o último commit é seu.
- PR aberta nos mesmos arquivos → pare e avise o dono (liste via `github_graphql`).
- Branch de `main` atualizado: `claude/<fix|feat|chore|infra>-<slug>-<AAMMDD-HHMM>`.
- Commit PT-BR, 1 atômico, Conventional Commits `<tipo>(<escopo>): <assunto>`. **Não há hook `commit-msg`
  neste repo** — o `commitlint` está instalado e configurado (em dobro: `commitlint.config.cjs` e `.js`) mas
  nada o executa; siga o padrão mesmo assim.
- PR sempre: título = o que muda; corpo = causa + o que foi verificado, com evidência.
- **Não há branch protection e não há CI verde** (`branchProtectionRules` vazio; `ci.yml` em base64). "CI
  verde" não é critério utilizável aqui: o critério é **os gates locais passando no que você tocou**.
  Mergeie sem aprovação (squash, apague a branch) PR sua pronta: gates locais verdes, sem conflito, escopo
  comum (front, edge function, docs, config). **Deixe aberta e chame o dono**: qualquer arquivo em
  `supabase/migrations/` (o `db-migrations.yml` aplica em produção no push da `main`); `.github/workflows/`,
  segredos, `.env`; deleção de dado, arquitetura ou custo; conflito com PR de outro agente.
- Conflito: rebase em `main`; `--force-with-lease` só na sua branch.
- Merge em `main` = **deploy em produção pela Lovable** (`docs/agentes/lovable-deploy.md`): confira e reporte.
- Hermes/multi-agente: isolamento por worktree é obrigatório — ver `.hermes.md`.
- Fim: link da PR + estado.

## Banco — ler `docs/agentes/banco.md` antes de SQL, migration ou deploy
- Oficial: Supabase **`pttzwlbidamibjssqiqb`** ("Promo Lux - V2", provisionado via Vercel/Lovable Cloud) —
  evidência: `supabase/.temp/linked-project.json`, `.env`, `.lovable/mcp/manifest.json`,
  `supabase/functions/mcp/index.ts:220`.
- **`pesfxhlbsjfmlysdkzhr` NÃO é o projeto vivo** e está cravado em `supabase/config.toml:1`,
  `src/hooks/useWebScrape.ts:45` e `e2e/helpers/supabase.ts:18`. `supabase link`/CLI sem `--project-ref`
  explícito aponta para o projeto errado. Divergência não resolvida — **não "consertar" por conta própria**.
- **Nesta sessão não há MCP de SQL para `pttzwlbidamibjssqiqb`** (os MCPs Supabase carregados servem
  `pgxfvjmuubtbowutlide` e `doufsxqlfjyuvxuezpln`, de outros projetos — não escrever neles). Sem MCP:
  diagnóstico por edge function de leitura, `supabase` CLI linkado ou painel; qualquer afirmação sobre o
  banco sem isso é "NÃO VERIFICADO".
- Diagnóstico = produção só leitura; teste = Postgres descartável (`supabase db start` + `supabase migration
  up --local`). DDL só pelo fluxo de `banco.md` (arquivo → PR → **chame o dono** → merge → `db-migrations.yml`
  aplica com aprovação no Environment `production`). Destrutivo, segredos e rotação: só com o dono.
- **Não existe ledger**: `supabase_migrations.schema_migrations` não existe no projeto vivo; 212 migrations no
  repo, 6 corrompidas em base64. O ambiente não é reconstruível a partir do código — trate toda migration
  como de alto risco.

## Serviços
- **Lovable** — ler `docs/agentes/lovable-deploy.md` ao confirmar deploy, mexer em env var ou domínio. Front e
  edge functions sobem pela Lovable; produção em `https://lux-ai-company-finder.lovable.app`. Não há
  `vercel.json` neste repo. `VITE_*` vai para o bundle e é público — nunca segredo com esse prefixo.
- **Integrações externas** — ler `docs/agentes/servicos-externos.md` ao mexer em raspagem, enriquecimento ou
  push de lead: GMaps Scraper (`gmaps.atomicabr.com.br`), Lusha, Apify/Hiker (Instagram), Bitrix (Oracle),
  Lovable AI Gateway. Chave de provedor só em secret da edge function, nunca no front.
- **GitHub/CI** — ler `docs/agentes/github-ci.md` antes de tocar em `.github/workflows/`, settings ou
  Environments. Os 3 workflows do repo nunca concluíram com sucesso; `ci.yml` e 10 outros arquivos estão em
  base64. Consertar isso é item do dono.
- **Regras de domínio** — ler `docs/agentes/regras-dominio.md` ao mexer em IPC/scoring, multi-tenant
  (`withOrg`), filas/DLQ, soft delete ou fixtures de E2E.

## Stack e comandos — detalhe em `docs/agentes/mapa-repo.md`
- Vite 5 + React 19 + TS 5 (`src/`), Tailwind 3 + shadcn/ui, TanStack Query, React Router 6; Supabase
  (`supabase/functions/` Deno, `supabase/migrations/`), Playwright (`e2e/`), Vitest (projetos `app` e `edge`).
- **Dois gerenciadores convivendo**: há `package-lock.json`, `bun.lock` e `bun.lockb`. O CI usa
  `npm install --legacy-peer-deps` (a árvore tem peer ranges de React 17/18 e date-fns 2/3) e o `pre-commit`
  usa `bun`. Use `npm install --legacy-peer-deps` para reproduzir o CI; `bun install` para reproduzir o hook.
- `npx vitest run <caminho>`; `npx tsc --noEmit -p tsconfig.app.json`; `npx eslint <arquivos>`; `npm run test:e2e` (Playwright,
  porta 8080); cobertura `npm run test:coverage` (limiar 70% em `vitest.config.ts`).
- Banco: `npm run db:lint`, `npm run db:start`, `npm run db:reset`, `npm run db:plan` (dry-run), `npm run db:status`.
- Guardas de banco (exigem `SUPABASE_DB_URL`; **sem a variável saem verdes sem consultar nada** —
  `docs/agentes/github-ci.md`): `npm run test:grants`, `npm run test:audit-triggers`,
  `bash scripts/check-security-definer.sh`, `bash scripts/check-queue-kind-coverage.sh`.
- Integridade das instruções de agente antes do PR: `node scripts/ci/check-claude-md-integrity.mjs`.
- Antes de qualquer tarefa: `git show origin/contexto:docs/contexto/00-INDEX.md` (contexto gerado, ver
  seção abaixo), `docs/ESTADO_ATUAL.md` (índice executivo) e o anexo da dimensão em
  `docs/estado/`. São a fonte de verdade sobre o que está vivo; o `README.md` está defasado (fala de 12
  tabelas; são 95).

## Grafo de código (graphify)
Grafo em `graphify-out/` (`npm run graph:setup`; ver `scripts/graphify/README.md`). Quando
`graphify-out/graph.json` existir: `graphify query "<pergunta>"`, `graphify path "<A>" "<B>"`,
`graphify explain "<conceito>"` antes de buscar por texto; `GRAPH_REPORT.md` só para revisão ampla.
Alterou código ou o report não é do HEAD atual → `graphify update .` (só AST). Em nuvem o grafo é gerado em
segundo plano (`.claude/hooks/session-start.sh`) — siga sem ele até terminar.

## Contexto gerado (branch `contexto`) — scripts autônomos
Três produtores independentes mantêm o retrato do projeto sem ninguém escrever documentação à mão
(`.github/workflows/contexto.yml`, a cada push em `main` e a cada 10 min; publica na branch gerada
`contexto`, nunca em `main` — merge em `main` é deploy pela Lovable):
- `docs/contexto/codigo/` ← `scripts/ai-context/gerar.mjs` (`npm run contexto:ia`): rotas, menu, módulos,
  hooks, edges, tabelas citadas, testes, convenções, baseline. Não precisa de secret.
- `docs/contexto/supabase/` ← `scripts/supabase_snapshot/snapshot.py` (`npm run contexto:supabase`): banco
  OFICIAL ao vivo (tabelas, RLS, funções, triggers, cron, lints), só leitura. **Exige o secret
  `SUPABASE_DB_URL`** (projeto `pttzwlbidamibjssqiqb`); sem ele o job sai verde com aviso e a pasta fica como estava.
- `docs/contexto/regras/` ← `scripts/regras_negocio/generate.py` (`npm run contexto:regras`): RLS por
  operação, estados, validações, fórmulas, lacunas. Regras humanas em `docs/contexto/regras/manual/` (na
  `main`) nunca são sobrescritas.
- `docs/contexto/00-INDEX.md` ← `scripts/regras_negocio/indice.py`: diz quem é dono de cada fato e a idade
  de cada fonte. Schema real = `supabase/`; onde fica o código = `codigo/`; o que pode/não pode = `regras/`.

Como ler: `git fetch origin contexto && git show origin/contexto:docs/contexto/00-INDEX.md` (ou MCP
`github_get_file` com `ref=contexto`). Nunca abra PR da branch `contexto` nem edite a mão o que tem
cabeçalho "Gerado automaticamente" — regere com os comandos acima.

Inventário do código: `inventario/estado/edges.json` (`npm run inventario:edges`, exige `ripgrep`) —
linhas, segredos lidos e quem invoca cada edge function; `sem_chamador_no_repo` é a lista de candidatas a
código morto. Regerado por `.github/workflows/inventario-estado-semanal.yml` (segunda), que abre PR e
**deixa aberto** para o dono. Detalhe em `inventario/estado/README.md`.
