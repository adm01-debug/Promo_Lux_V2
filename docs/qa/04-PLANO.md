# 04 — PLANO DE CORREÇÃO EM 300 ETAPAS

> Derivado de `03-ACHADOS.md` (**105 achados**: 10 Críticas, 45 Altas, 40 Médias, 10 Baixas), mais 1 registro informativo positivo.
> **Commit de referência da auditoria:** `9b85ca6` · **Data:** 2026-11-22/23.
> Progresso em `05-PROGRESSO.md`.

---

## Instruções para o agente executor

Você não participou da auditoria e não tem acesso a quem a fez. Tudo o que precisa está escrito aqui e em `03-ACHADOS.md`. Siga estas regras sem exceção.

1. **Uma etapa por vez, na ordem, respeitando o campo "Depende de".** Cada etapa vira sua própria branch e sua própria pull request. Nome da branch: `claude/<fix|feat|chore|infra>-<slug>-<AAMMDD-HHMM>`, conforme `AGENTS.md`. Nunca comite na `main`. Só escreva em branch que **você** criou nesta sessão.
2. **Antes de mudar qualquer coisa, releia a evidência da etapa no código atual.** Abra o arquivo, confira a linha citada. Se o código já não corresponde ao descrito — porque alguém corrigiu, ou porque o arquivo mudou —, **pare**: registre em `05-PROGRESSO.md` na linha da etapa (`[~] NNN — divergente: <o que encontrou>`) e passe para a próxima etapa que não dependa dela. Não adivinhe a intenção.
3. **Corrija a causa raiz com a menor mudança possível.** Não refatore, não renomeie, não "melhore" e não comente o que a etapa não pediu. Não reescreva arquivo inteiro para mudar três linhas. Dependência nova ou mudança de versão maior só se for indispensável — e avise no corpo da pull request.
4. **Problema novo encontrado no caminho não é corrigido na hora.** Anote no fim de `05-PROGRESSO.md`, na seção "Achados novos", com arquivo e linha. Volte à etapa.
5. **Etapa marcada com "Precisa de aprovação humana: sim" fica com a pull request aberta, aguardando o dono.** Não faça merge, não force, não contorne. Escreva no corpo da PR exatamente o que será alterado em produção.
6. **Uma etapa só é concluída com a verificação do campo "Como verificar" executada e a evidência anotada** em `05-PROGRESSO.md` (saída do comando, resultado da consulta ou retorno da requisição). "Deveria funcionar" não conclui etapa.
7. **Portões locais antes de cada pull request**, somente sobre os arquivos que você tocou: `npx tsc --noEmit -p tsconfig.app.json`, `npx eslint <arquivos tocados>`, `npx vitest run <testes relacionados>`. Atenção: na data da auditoria `npm run lint` **já falhava** com 22 erros herdados (achado G2-2, etapa 276). Só conta erro que **você** introduziu; erro herdado vai para "Achados novos" se ainda não tiver etapa própria.
8. **Nunca escreva segredo em código, commit, comentário ou pull request.** Segredos vão para o cofre do serviço (`supabase secrets set`, painel da Vercel, GitHub Environments). Se encontrar segredo em código, registre o local e o tipo — nunca o valor.
9. **Não confie em nome de arquivo, comentário ou documento como prova.** Vários comentários deste repositório estão errados (achado G24-1). Leia o código que roda.
10. **Antes de começar, confirme que não há pull request aberta tocando os mesmos arquivos.** Na data da auditoria havia 8 abertas (#148 a #158). Se houver conflito, pare e avise o dono.

### Três avisos de contexto que valem para o plano inteiro

- **Não existe acesso SQL ao banco de produção nesta sessão nem na auditoria.** Todo achado de banco foi verificado sobre as 241 migrations versionadas. Antes de aplicar qualquer migration, confirme o estado real da tabela ou da política no painel do Supabase do projeto `pttzwlbidamibjssqiqb`. Se o estado real divergir, pare e registre (regra 2).
- **Juntar na `main` publica produção**: o site vai para a Vercel automaticamente e `.github/workflows/db-migrations.yml` aplica migrations. Por isso toda etapa com migration exige aprovação humana.
- **O portão "Database Guards" do CI está desarmado** (achado G13-1, etapa 001). Até a etapa 001 ser concluída, nenhum selo verde do CI prova nada sobre banco.

### Dependências que apontam para uma etapa de número maior

Onze etapas dependem de outra com número **maior**. Não é erro de numeração: a correção precisa daquela outra pronta antes, mas a outra pertence a uma onda posterior por natureza do tema. Quando chegar a uma destas, **execute antes a dependência indicada** (fora da ordem) e marque as duas no progresso:

| Etapa | Depende de                   | Por quê                                                                                                     |
| ----- | ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 010   | 011, 012, 013, 014, 015, 016 | Só é seguro fazer a leitura falhar fechada depois que nenhuma consulta rodar antes de a organização existir |
| 076   | 110                          | Criar negócio a partir da empresa só faz sentido depois que a criação usa a organização certa               |
| 082   | 251                          | O teste só volta a passar depois que o texto corrompido da tela for corrigido                               |
| 116   | 117                          | A restrição de formato falha se ainda houver dado fora do padrão                                            |
| 145   | 146                          | Agendar a limpeza antes de corrigir a autenticação da rotina faria o agendamento falhar                     |
| 226   | 251                          | Mexer na página de monitoramento antes de corrigir o texto corrompido dela multiplicaria o conflito         |

**Não há ciclo de dependência no plano** (verificado automaticamente sobre os 300 campos "Depende de").

### Ordem das ondas

| Onda | Tema                                       | Etapas  |
| ---- | ------------------------------------------ | ------- |
| 1    | Segurança e risco de perda de dado         | 001–046 |
| 2    | Fluxos principais quebrados                | 047–092 |
| 3    | Integridade de dados e regras de negócio   | 093–142 |
| 4    | Funcionalidades incompletas                | 143–180 |
| 5    | Robustez: erros, estados, concorrência     | 181–232 |
| 6    | Performance                                | 233–250 |
| 7    | Experiência de uso e consistência          | 251–277 |
| 8    | Higiene: código morto, CI, observabilidade | 278–300 |

### Ações imediatas, antes da etapa 001

Estas três não são etapas de código: são decisões do dono, e cada minuto conta. O executor deve avisar o dono e **não** prosseguir com a Onda 1 antes de ter resposta sobre elas.

- **Apagar a função `migrate-helper` em produção** (achado G10-2). Enquanto ela existir, qualquer pessoa que leia o repositório público obtém a chave mestra do banco.
- **Rotacionar a chave `service_role` e a senha do banco** do projeto `pttzwlbidamibjssqiqb`. Rotacionar sem apagar a função não resolve: ela devolve sempre o valor atual.
- **Tornar o repositório privado** e ligar a varredura de segredos do GitHub (achado G10-1).

---

## ONDA 1 — Segurança e risco de perda de dado (001–046)

### Etapa 001 — Fazer os guardas de banco do CI falharem quando não houver conexão com o banco

**Onda / Severidade / Camada:** 1 / Crítica / Infraestrutura · CI
**Achados resolvidos:** G13-1
**Problema hoje:** os cinco scripts obrigatórios do job "Database Guards" saem com sucesso sem consultar nada quando falta a variável `SUPABASE_DB_URL` — `scripts/check-function-grants.sh:15-19`, `scripts/check-audit-triggers.sh:15-19`, `scripts/check-security-definer.sh:16-19`, `scripts/check-queue-kind-coverage.sh:9-12`, `scripts/check-anon-grants-view.sh:17-21`. A variável não existe nos segredos do repositório, e o job é um check obrigatório da `main`. O próprio `scripts/check-anon-grants-view.sh:9-10` promete em comentário "Em push sem `SUPABASE_DB_URL`: FALHA (obrigatório)" e faz o contrário.
**Causa raiz:** a saída antecipada foi escrita para não travar quem roda local, e virou o comportamento padrão do CI.
**Caminho recomendado:** em cada um dos cinco scripts, troque a saída antecipada por uma decisão baseada no contexto: se a variável `CI` estiver definida, `echo` a mensagem e `exit 1`; fora do CI, mantenha o aviso e `exit 0`. Use `scripts/check-migrations.sh` como referência de script que falha de verdade. Aproveite a variável `EVENT` já lida em `scripts/check-anon-grants-view.sh:15`, hoje inútil. **Não** adicione o segredo nesta etapa — é a etapa 002, que precisa do dono. O atalho tentador é marcar o job como `continue-on-error` para "não quebrar a `main`": isso recria o problema com outro nome.
**Arquivos e objetos a tocar:** os cinco scripts citados.
**Não tocar / armadilhas:** não altere `.github/workflows/ci.yml` nesta etapa; não mexa em `scripts/check-migrations.sh`, `check-migration-target.sh` nem `check-edge-fn-target.sh` — esses já falham corretamente. Efeito colateral esperado e desejado: a `main` fica com o check vermelho até a etapa 002 ser concluída. Avise o dono disso na pull request.
**Depende de:** — · **Libera:** 002, 003, 004, 005, 006
**Risco e como reverter:** risco baixo no código; o impacto é o CI ficar vermelho. Reverter = `git revert` da pull request.
**Precisa de aprovação humana antes do merge:** sim (altera comportamento de CI e vai deixar a `main` vermelha até 002).
**Como verificar:** `unset SUPABASE_DB_URL; CI=true bash scripts/check-function-grants.sh; echo $?` → deve imprimir a mensagem de erro e `1`. Repita para os cinco. Depois `unset CI; bash scripts/check-function-grants.sh; echo $?` → `0` com aviso.
**Checklist de conclusão:**

- [ ] mudança aplicada só nos arquivos listados
- [ ] typecheck, lint e testes dos arquivos tocados passam
- [ ] verificação acima executada, com a evidência registrada
- [ ] deploy confirmado, quando se aplica
- [ ] etapa marcada no arquivo de progresso

### Etapa 002 — Cadastrar o segredo de conexão de leitura do banco para o CI

**Onda / Severidade / Camada:** 1 / Crítica / Infraestrutura · segredos
**Achados resolvidos:** G13-1, G13-3
**Problema hoje:** `SUPABASE_DB_URL` não está entre os 6 segredos do repositório (medido pela API do GitHub), então os guardas de banco (etapa 001) e o gerador do retrato do banco (`.github/workflows/contexto.yml:95,238,241-247`) nunca têm com o que trabalhar.
**Causa raiz:** o segredo nunca foi cadastrado depois de os workflows terem sido escritos contando com ele.
**Caminho recomendado:** peça ao dono a string de conexão de **leitura** do projeto `pttzwlbidamibjssqiqb` e cadastre-a como segredo de repositório `SUPABASE_DB_URL`. Use um papel com permissão apenas de leitura, não a conexão de superusuário. **Nunca** escreva o valor em arquivo, commit, comentário ou corpo de pull request. O atalho tentador é usar a conexão completa de administrador porque "é mais fácil": os guardas só fazem `SELECT`, e uma conexão de administrador em segredo de CI de repositório público é o mesmo erro de G10-2 em outra roupa.
**Arquivos e objetos a tocar:** nenhum arquivo; apenas o segredo de Actions.
**Não tocar / armadilhas:** não cadastre no ambiente `staging` (que está sem proteção — achado G23-6, etapa 041); cadastre no nível do repositório ou no ambiente `production`.
**Depende de:** 001 · **Libera:** 003, 004, 005, 006, 034
**Risco e como reverter:** se a string estiver errada, o CI fica vermelho com erro de conexão. Reverter = apagar o segredo.
**Precisa de aprovação humana antes do merge:** sim (segredo e infraestrutura).
**Como verificar:** dispare o workflow `CI Pipeline` em uma branch de teste e confirme que o job "Database Guards" executa consultas e conclui — e que o workflow `contexto` passa a gerar `docs/contexto/supabase/` na branch `contexto`.
**Checklist de conclusão:**

- [ ] mudança aplicada só nos arquivos listados
- [ ] typecheck, lint e testes dos arquivos tocados passam
- [ ] verificação acima executada, com a evidência registrada
- [ ] deploy confirmado, quando se aplica
- [ ] etapa marcada no arquivo de progresso

### Etapa 003 — Remover a função `migrate-helper` do repositório

**Onda / Severidade / Camada:** 1 / Crítica / Backend
**Achados resolvidos:** G10-2
**Problema hoje:** `supabase/functions/migrate-helper/index.ts:5` tem uma chave de acesso de 48 caracteres em texto; `:24-29` devolve `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_DB_URL` no corpo da resposta; `:7` libera qualquer origem; `supabase/config.toml:14-15` define `verify_jwt = false`. As linhas 1-3 do arquivo pedem a própria remoção. `docs/prod-readiness.md:77` lista a função em produção e `.github/workflows/edge-functions-deploy.yml:137` publica todas as pastas.
**Causa raiz:** função de uso único que nunca foi removida.
**Caminho recomendado:** apague a pasta `supabase/functions/migrate-helper/` inteira e o bloco `[functions.migrate-helper]` de `supabase/config.toml`. **Antes** de fazer merge, confirme com o dono que a função já foi apagada no painel do Supabase e que a chave `service_role` já foi rotacionada — remover do repositório **não** remove de produção, porque o deploy não usa `--prune` (`edge-functions-deploy.yml:136`). O atalho tentador é "só trocar a chave do código por uma variável de ambiente": o problema não é onde a senha mora, é o endpoint existir.
**Arquivos e objetos a tocar:** `supabase/functions/migrate-helper/` (remover), `supabase/config.toml` (remover o bloco), `docs/prod-readiness.md:77` (remover do inventário).
**Não tocar / armadilhas:** não toque nos outros blocos de `config.toml`. Não publique o valor da chave em nenhum lugar, nem no corpo da PR.
**Depende de:** — · **Libera:** 004
**Risco e como reverter:** nenhum uso legítimo conhecido. Se algum processo manual dependia dela, o dono dirá; nesse caso, reverter = `git revert`.
**Precisa de aprovação humana antes do merge:** sim (remoção em produção e rotação de segredo).
**Como verificar:** depois do deploy, `curl -s -o /dev/null -w "%{http_code}" https://pttzwlbidamibjssqiqb.supabase.co/functions/v1/migrate-helper?action=ping` → esperado **404**. Enviar a chave antiga deve devolver 404 também.
**Checklist de conclusão:**

- [ ] mudança aplicada só nos arquivos listados
- [ ] typecheck, lint e testes dos arquivos tocados passam
- [ ] verificação acima executada, com a evidência registrada
- [ ] deploy confirmado, quando se aplica
- [ ] etapa marcada no arquivo de progresso

### Etapa 004 — Adicionar ao deploy de edge functions uma trava que recusa função que devolva segredo

**Onda / Severidade / Camada:** 1 / Crítica / Infraestrutura · CI
**Achados resolvidos:** G10-2, G13-2
**Problema hoje:** nada impede que uma função volte a devolver `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_DB_URL` no corpo de uma resposta; a varredura de segredos do CI (`.github/workflows/ci.yml:77-93`) procura só padrões da Amazon e do Stripe.
**Causa raiz:** o portão de segurança foi escrito para chaves de terceiros, não para as chaves do próprio projeto.
**Caminho recomendado:** crie `scripts/check-no-secret-echo.sh` que falhe se encontrar, em `supabase/functions/**`, qualquer ocorrência de `SERVICE_ROLE_KEY` ou `SUPABASE_DB_URL` dentro de uma construção de resposta (`JSON.stringify`, `new Response`, `body:`). Chame-o no job `security-scan` de `.github/workflows/ci.yml` e no `edge-functions-deploy.yml` antes do passo de deploy. Siga o formato dos scripts existentes em `scripts/` (mesma estrutura de mensagem e código de saída de `scripts/check-migration-target.sh`). O atalho tentador é só grepar o nome da variável em qualquer linha: isso quebra as 53 funções que legitimamente leem a chave para criar o cliente.
**Arquivos e objetos a tocar:** `scripts/check-no-secret-echo.sh` (novo), `.github/workflows/ci.yml`, `.github/workflows/edge-functions-deploy.yml`.
**Não tocar / armadilhas:** não altere o uso legítimo em `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` dentro de `createClient`.
**Depende de:** 003 · **Libera:** 005
**Risco e como reverter:** falso positivo pode travar o deploy. Reverter = `git revert`.
**Precisa de aprovação humana antes do merge:** sim (altera CI e deploy).
**Como verificar:** `bash scripts/check-no-secret-echo.sh; echo $?` → `0` no estado atual (após a etapa 003). Crie um arquivo temporário fora do controle de versão com `return new Response(JSON.stringify({ k: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") }))` em `supabase/functions/` e confirme que o script devolve `1`; apague o arquivo em seguida.
**Checklist de conclusão:**

- [ ] mudança aplicada só nos arquivos listados
- [ ] typecheck, lint e testes dos arquivos tocados passam
- [ ] verificação acima executada, com a evidência registrada
- [ ] deploy confirmado, quando se aplica
- [ ] etapa marcada no arquivo de progresso

### Etapa 005 — Ampliar a varredura de segredos do CI para chaves de banco, JWT e tokens

**Onda / Severidade / Camada:** 1 / Alta / Infraestrutura · CI
**Achados resolvidos:** G13-2
**Problema hoje:** `.github/workflows/ci.yml:77-93` cobre apenas `AKIA...` e `sk_live_...`, e apenas em `src/` e `supabase/functions/`. Por isso `e2e/helpers/supabase.ts:18-20` (JWT em texto) e a chave de `migrate-helper` passaram.
**Causa raiz:** lista de padrões mínima e escopo de pastas restrito.
**Caminho recomendado:** no mesmo passo, inclua os padrões `eyJ[A-Za-z0-9_-]{20,}\.` (JWT), `postgres(ql)?://[^ "']+`, `sb_secret_`, `ghp_`/`github_pat_`, `service_role` em atribuição literal, e amplie o escopo para `src/ supabase/ e2e/ scripts/ .github/`, excluindo `node_modules`, `dist`, `graphify-out` e `package-lock.json`. Mantenha o passo falhando (não use `|| true`). O atalho tentador é instalar uma ferramenta nova de varredura: resolve, mas adiciona dependência e tempo de CI; o `grep` já existente cobre o caso com cinco padrões.
**Arquivos e objetos a tocar:** `.github/workflows/ci.yml`.
**Não tocar / armadilhas:** a chave publicável (`VITE_SUPABASE_PUBLISHABLE_KEY`) é pública por projeto e aparece legitimamente em `.env.test` com valor de exemplo — garanta que o padrão de JWT não acuse o arquivo `.env.test` nem a documentação; se acusar `e2e/helpers/supabase.ts`, está certo: é a etapa 006.
**Depende de:** 004 · **Libera:** 006
**Risco e como reverter:** falso positivo trava o CI. Reverter = `git revert`.
**Precisa de aprovação humana antes do merge:** sim (altera CI).
**Como verificar:** rode o passo localmente com os mesmos padrões; confirme que ele acusa `e2e/helpers/supabase.ts:19-20` antes da etapa 006 e deixa de acusar depois.
**Checklist de conclusão:**

- [ ] mudança aplicada só nos arquivos listados
- [ ] typecheck, lint e testes dos arquivos tocados passam
- [ ] verificação acima executada, com a evidência registrada
- [ ] deploy confirmado, quando se aplica
- [ ] etapa marcada no arquivo de progresso

### Etapa 006 — Remover endereço e chave cravados da suíte de garantias de acesso

**Onda / Severidade / Camada:** 1 / Alta / Testes · segurança
**Achados resolvidos:** G2-1, G13-2
**Problema hoje:** `e2e/helpers/supabase.ts:18-20` define `FALLBACK_URL = "https://pesfxhlbsjfmlysdkzhr.supabase.co"` e uma chave publicável em texto; `:22-28` usa esses valores quando as variáveis de ambiente não existem. `AGENTS.md` §Banco afirma que esse projeto **não** é o do sistema. Com isso, a suíte pode estar testando outro banco.
**Causa raiz:** valor padrão criado para "nunca falhar", que mascara ausência de configuração.
**Caminho recomendado:** apague as duas constantes e faça `SUPABASE_URL` e `SUPABASE_ANON_KEY` lançarem erro claro quando nenhuma variável estiver definida (`throw new Error("[e2e] defina E2E_SUPABASE_URL ou VITE_SUPABASE_URL")`). O atalho tentador é trocar o endereço cravado pelo do projeto oficial: mantém o problema de a suíte rodar com chave errada sem avisar, e coloca um identificador de produção no repositório público.
**Arquivos e objetos a tocar:** `e2e/helpers/supabase.ts`.
**Não tocar / armadilhas:** não altere `e2e/rls-guarantees.spec.ts` nesta etapa (é a etapa 007). O teste `e2e/rls-guarantees.spec.ts:82` ("URL e chave estão definidas") passará a falhar quando as variáveis não existirem — é o comportamento desejado.
**Depende de:** 005 · **Libera:** 007
**Risco e como reverter:** quem rodar a suíte sem configurar verá erro em vez de verde falso. Reverter = `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `unset E2E_SUPABASE_URL VITE_SUPABASE_URL; npx playwright test rls-guarantees.spec.ts` → deve falhar com a mensagem nova, não passar verde.
**Checklist de conclusão:**

- [ ] mudança aplicada só nos arquivos listados
- [ ] typecheck, lint e testes dos arquivos tocados passam
- [ ] verificação acima executada, com a evidência registrada
- [ ] deploy confirmado, quando se aplica
- [ ] etapa marcada no arquivo de progresso

### Etapa 007 — Fazer a suíte de garantias de acesso distinguir "bloqueado" de "não consegui falar com o banco"

**Onda / Severidade / Camada:** 1 / Alta / Testes · segurança
**Achados resolvidos:** G2-1
**Problema hoje:** `e2e/helpers/supabase.ts:70-73` — `if (result.error) return true;` trata qualquer erro como "a regra de acesso bloqueou". Prova executada na auditoria: com endereço de projeto inexistente e chave inválida, a suíte devolveu **77 casos verdes em 2,5 segundos**, com casos de 1 a 5 ms — nenhuma ida à rede.
**Causa raiz:** erro de infraestrutura e negativa de permissão foram tratados como o mesmo resultado.
**Caminho recomendado:** reescreva `isReadBlocked` para aceitar como "bloqueado" **apenas** os sinais de permissão: código `42501`, códigos `PGRST301`/`PGRST302`, status HTTP 401 ou 403, ou lista vazia **com** resposta bem-formada. Qualquer outro erro (rede, DNS, 404, 5xx) deve **lançar**, fazendo o caso falhar. O repositório já distingue esses códigos em `src/App.tsx:63-68` — use a mesma lista como referência. O atalho tentador é só verificar `result.error.message.includes("permission")`: a mensagem muda entre versões do PostgREST.
**Arquivos e objetos a tocar:** `e2e/helpers/supabase.ts`.
**Não tocar / armadilhas:** não mude a lista de tabelas de `src/lib/rlsRegistry.ts` nesta etapa (é a etapa 008).
**Depende de:** 006 · **Libera:** 008, 009
**Risco e como reverter:** se produção estiver inacessível do CI, a suíte falha — o que é o objetivo. Reverter = `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `E2E_SUPABASE_URL="https://projeto-que-nao-existe-qa.supabase.co" E2E_SUPABASE_ANON_KEY="invalida" npx playwright test rls-guarantees.spec.ts` → **deve falhar**. Com as variáveis corretas, deve passar e cada caso levar mais de 50 ms (prova de ida à rede).
**Checklist de conclusão:**

- [ ] mudança aplicada só nos arquivos listados
- [ ] typecheck, lint e testes dos arquivos tocados passam
- [ ] verificação acima executada, com a evidência registrada
- [ ] deploy confirmado, quando se aplica
- [ ] etapa marcada no arquivo de progresso

### Etapa 008 — Fazer o teste de classificação de tabelas comparar com o banco, não com uma lista escrita à mão

**Onda / Severidade / Camada:** 1 / Alta / Testes · segurança
**Achados resolvidos:** G30-2, G1-3
**Problema hoje:** `src/integrations/supabase/__tests__/withOrg.registry.test.ts:34-42` compara a classificação de `withOrg.ts` com `org-scoped-tables.fixture.json`. Esse arquivo não inclui `role_permissions`, `scheduled_reports`, `bulk_imports` nem `changelog_entries`, todas com coluna de organização (`supabase/migrations/20261121230000_*.sql:15,87,118`). O teste fica verde exatamente sobre o buraco que deveria apontar.
**Causa raiz:** a fonte de verdade do teste é um arquivo mantido à mão.
**Caminho recomendado:** gere o arquivo de referência a partir das migrations, não à mão: crie `scripts/ci/gerar-org-scoped-fixture.mjs` que varre `supabase/migrations/*.sql` procurando `CREATE TABLE` com coluna `organization_id` (descontando tabelas depois removidas) e grava o JSON; chame-o em um teste que falha se o arquivo estiver desatualizado, no mesmo espírito de `scripts/ci/lint-ratchet.mjs`. O atalho tentador é só acrescentar as quatro tabelas faltantes ao arquivo: resolve hoje e volta a divergir na próxima tabela criada.
**Arquivos e objetos a tocar:** `scripts/ci/gerar-org-scoped-fixture.mjs` (novo), `src/integrations/supabase/__tests__/org-scoped-tables.fixture.json`, `src/integrations/supabase/__tests__/withOrg.registry.test.ts`.
**Não tocar / armadilhas:** **não** classifique as tabelas em `withOrg.ts` nesta etapa — o teste vai ficar vermelho apontando as quatro, e isso é o resultado esperado; a classificação é a etapa 009. Avise no corpo da PR que o teste fica vermelho até a 009.
**Depende de:** 007 · **Libera:** 009
**Risco e como reverter:** o gerador pode interpretar mal alguma migration; confira a lista gerada contra `supabase/migrations/` antes de aceitar. Reverter = `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `node scripts/ci/gerar-org-scoped-fixture.mjs && npx vitest run src/integrations/supabase/__tests__/withOrg.registry.test.ts` → o teste deve apontar as 4 tabelas não classificadas pelo nome.
**Checklist de conclusão:**

- [ ] mudança aplicada só nos arquivos listados
- [ ] typecheck, lint e testes dos arquivos tocados passam
- [ ] verificação acima executada, com a evidência registrada
- [ ] deploy confirmado, quando se aplica
- [ ] etapa marcada no arquivo de progresso

### Etapa 009 — Classificar as quatro tabelas de organização que faltam no wrapper

**Onda / Severidade / Camada:** 1 / Alta / Dados · multi-organização
**Achados resolvidos:** G30-1, G1-3
**Problema hoje:** `scheduled_reports`, `scheduled_report_runs`, `role_permissions`, `bulk_imports` e `changelog_entries` não estão em nenhum dos três conjuntos de `src/integrations/supabase/withOrg.ts:87-139`. O wrapper nega por padrão (`:302-306`), então as seis chamadas de `src/hooks/useScheduledReports.ts:53,67,79,92,104,114` lançam erro — a aba existe na interface (`src/components/lux/AnalyticsView.tsx:162`) e nunca funcionou.
**Causa raiz:** tabelas criadas depois do wrapper, sem atualizar a classificação.
**Caminho recomendado:** acrescente as tabelas ao conjunto correto em `withOrg.ts`. Confira na migration de cada uma se o escopo é organização (`supabase/migrations/20261121230000_*.sql:15,87,118`) e siga exatamente o formato das entradas já existentes em `:87-126`. `scheduled_report_runs` pode não ter coluna de organização própria — nesse caso classifique conforme o conjunto apropriado do wrapper, não force a coluna. O atalho tentador é trocar `supabase.from` cru no hook para contornar o wrapper: isso remove a trava de isolamento justamente onde ela é necessária.
**Arquivos e objetos a tocar:** `src/integrations/supabase/withOrg.ts`.
**Não tocar / armadilhas:** não altere `src/hooks/useScheduledReports.ts` nesta etapa (é a etapa 143, que trata a funcionalidade em si). Confirme no painel do Supabase se as tabelas têm política de acesso para o papel do usuário antes de declarar a aba funcional.
**Depende de:** 008 · **Libera:** 143
**Risco e como reverter:** classificação errada pode bloquear leitura legítima. Reverter = `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `npx vitest run src/integrations/supabase/__tests__/withOrg.registry.test.ts` → verde. Com sessão real, abrir a aba de relatórios agendados não deve mais lançar "não possui classificação de escopo definida".
**Checklist de conclusão:**

- [ ] mudança aplicada só nos arquivos listados
- [ ] typecheck, lint e testes dos arquivos tocados passam
- [ ] verificação acima executada, com a evidência registrada
- [ ] deploy confirmado, quando se aplica
- [ ] etapa marcada no arquivo de progresso

### Etapa 010 — Fazer a leitura sem organização ativa falhar fechada no wrapper

**Onda / Severidade / Camada:** 1 / Crítica / Dados · multi-organização
**Achados resolvidos:** G1-1
**Problema hoje:** `src/integrations/supabase/withOrg.ts:358-363` — sem organização ativa, o `select` apenas registra um aviso e devolve a consulta **sem** `.eq("organization_id", …)` e **sem** `.is("deleted_at", null)`. As operações de escrita, nas linhas 317, 328 e 346, lançam `MissingOrgContextError`. Na auditoria, o aviso foi observado no console do navegador para `companies`, `workflows`, `intent_signals` e `notifications` em todo carregamento de tela.
**Causa raiz:** escolha deliberada de não interromper o carregamento inicial, que transformou o guarda de leitura em opcional.
**Caminho recomendado:** faça o `select` lançar `MissingOrgContextError` como as escritas já fazem (`:317`), reaproveitando a função `raise` que já existe no arquivo. O carregamento inicial deixa de disparar consultas sem escopo e passa a disparar o erro tratado pelo escutador global (`src/lib/orgErrorHandler.ts`, ligado em `src/App.tsx:85`). Isso **exige** que as etapas 011 a 016 tenham desligado as consultas que rodam antes da organização existir — por isso elas vêm antes no campo "Depende de". O atalho tentador é manter o aviso e "corrigir só os hooks": o próximo hook escrito volta a cair no buraco.
**Arquivos e objetos a tocar:** `src/integrations/supabase/withOrg.ts`.
**Não tocar / armadilhas:** não mexa no trecho de escrita (já correto); não remova o `console.warn` sem colocar o lançamento no lugar. Em modo demonstração não há organização real — confirme que o caminho de demonstração não passa pelo wrapper (`src/lib/demoData.ts` alimenta as telas antes da consulta).
**Depende de:** 011, 012, 013, 014, 015, 016 · **Libera:** 017
**Risco e como reverter:** se alguma consulta legítima ainda rodar sem organização, a tela mostra erro em vez de dado. Reverter = `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `npx vitest run src/integrations/supabase` → verde. No navegador, com sessão real: abrir o sistema e confirmar que **não** aparece mais `[withOrg] Tentativa de select ... sem org ativa` no console, e que nenhuma tela fica em erro.
**Checklist de conclusão:**

- [ ] mudança aplicada só nos arquivos listados
- [ ] typecheck, lint e testes dos arquivos tocados passam
- [ ] verificação acima executada, com a evidência registrada
- [ ] deploy confirmado, quando se aplica
- [ ] etapa marcada no arquivo de progresso

> **Nota de formato:** da etapa 011 em diante o checklist de conclusão aparece em linha única com as mesmas cinco caixas. O conteúdo é idêntico ao das etapas 001–010.

### Etapa 011 — Condicionar as consultas do painel inicial à existência da organização ativa

**Onda / Severidade / Camada:** 1 / Crítica / Hooks
**Achados resolvidos:** G1-1
**Problema hoje:** `src/hooks/useDashboardData.ts:142-156` e `:172-187` disparam sem `enabled`, antes de a organização ativa existir, e caem no caminho sem filtro de `withOrg.ts:358-363`.
**Causa raiz:** consulta sem condição de habilitação.
**Caminho recomendado:** leia a organização ativa com `useActiveOrganization()` e acrescente `enabled: !!activeOrgId` às duas consultas, no formato já usado em `src/hooks/useSalesGoals.ts:50` (que também inclui a organização na chave). Não mexa na chave nesta etapa — isso é a etapa 017. O atalho tentador é usar `getActiveOrgId()` direto: é leitura instantânea e não reavalia quando a organização chega.
**Arquivos e objetos a tocar:** `src/hooks/useDashboardData.ts`.
**Não tocar / armadilhas:** o painel deve mostrar o estado de carregamento enquanto `enabled` é falso — confirme que o componente trata `isPending` (não só `isLoading`).
**Depende de:** — · **Libera:** 010, 017
**Risco e como reverter:** se a organização nunca chegar, o painel fica carregando; `src/components/lux/OrgErrorBanner.tsx` já cobre esse aviso. Reverter = `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `npx vitest run src/hooks` → verde. No navegador, console sem o aviso `[withOrg] Tentativa de select em "companies" sem org ativa`.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 012 — Condicionar a contagem de notificações à organização ativa

**Onda / Severidade / Camada:** 1 / Alta / Hooks
**Achados resolvidos:** G1-1
**Problema hoje:** `src/hooks/useNotificationCount.ts:9-25` consulta sem `enabled`; o aviso de leitura sem escopo para `notifications` foi observado no navegador na auditoria.
**Causa raiz:** idem etapa 011.
**Caminho recomendado:** mesmo padrão da etapa 011, referência `src/hooks/useDlqItems.ts:23`.
**Arquivos e objetos a tocar:** `src/hooks/useNotificationCount.ts`.
**Não tocar / armadilhas:** o contador aparece no cabeçalho; sem organização ele deve mostrar vazio, não zero (zero afirma que não há notificação).
**Depende de:** — · **Libera:** 010, 017
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `npx vitest run src/hooks/__tests__` e console do navegador sem o aviso para `notifications`.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 013 — Condicionar a lista virtualizada de empresas à organização ativa

**Onda / Severidade / Camada:** 1 / Alta / Hooks
**Achados resolvidos:** G1-1
**Problema hoje:** `src/hooks/useVirtualCompanies.ts:9-25` dispara sem `enabled`.
**Causa raiz:** idem etapa 011.
**Caminho recomendado:** mesmo padrão; referência `src/hooks/useLeaderboard.ts:30`.
**Arquivos e objetos a tocar:** `src/hooks/useVirtualCompanies.ts`.
**Não tocar / armadilhas:** não altere a lógica de virtualização nem o tamanho de página (a paginação no servidor é a etapa 233).
**Depende de:** — · **Libera:** 010, 017
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** console do navegador sem o aviso para `companies` ao abrir a lista.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 014 — Condicionar a leitura do perfil de cliente ideal à organização ativa

**Onda / Severidade / Camada:** 1 / Alta / Hooks
**Achados resolvidos:** G1-1
**Problema hoje:** `src/hooks/useICPConfig.ts:39-57` consulta sem `enabled` e com chave `["ipc-configs"]` sem organização.
**Causa raiz:** idem etapa 011.
**Caminho recomendado:** acrescente `enabled: !!activeOrgId`. A correção da chave é a etapa 017; a do formato dos critérios é a etapa 093.
**Arquivos e objetos a tocar:** `src/hooks/useICPConfig.ts`.
**Não tocar / armadilhas:** não toque na forma do objeto `criteria` nesta etapa.
**Depende de:** — · **Libera:** 010, 017, 093
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `npx vitest run src/hooks` e console sem aviso ao abrir a tela de perfil ideal.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 015 — Condicionar a trilha de auditoria à organização ativa

**Onda / Severidade / Camada:** 1 / Alta / Hooks
**Achados resolvidos:** G1-1
**Problema hoje:** `src/hooks/useAuditTrail.ts:134-166` consulta sem `enabled`; é a tabela mais sensível do sistema (ver etapa 018).
**Causa raiz:** idem etapa 011.
**Caminho recomendado:** mesmo padrão; referência `src/hooks/usePiiRules.ts:50`.
**Arquivos e objetos a tocar:** `src/hooks/useAuditTrail.ts`.
**Não tocar / armadilhas:** não altere a paginação do histórico.
**Depende de:** — · **Libera:** 010, 017
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** console sem aviso ao abrir o painel de auditoria.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 016 — Varrer os hooks restantes em busca de consulta sem condição de organização

**Onda / Severidade / Camada:** 1 / Alta / Hooks
**Achados resolvidos:** G1-1
**Problema hoje:** as etapas 011–015 cobrem os seis casos encontrados na auditoria; o repositório tem 102 hooks e a varredura não foi exaustiva.
**Causa raiz:** ausência de regra automática.
**Caminho recomendado:** rode `grep -rn "useQuery" src/hooks src/components | wc -l` e, para cada consulta a tabela de organização, confirme a presença de `enabled`. Corrija só o que faltar, no mesmo padrão. Não crie regra de lint nesta etapa (é a etapa 300).
**Arquivos e objetos a tocar:** apenas os hooks que a varredura apontar.
**Não tocar / armadilhas:** consultas a tabelas globais (`feature_flags`, `health_checks`, `changelog_entries`) não precisam de condição de organização — não force.
**Depende de:** 011, 012, 013, 014, 015 · **Libera:** 010
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** no navegador, navegar pelas 23 telas e confirmar zero avisos `[withOrg] Tentativa de select` no console.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 017 — Incluir a organização na chave de cache das famílias de consulta que a ignoram

**Onda / Severidade / Camada:** 1 / Alta / Hooks · cache
**Achados resolvidos:** G1-2
**Problema hoje:** pelo menos 20 famílias de chave usam `user?.id` ou nada como escopo: `src/hooks/useDeals.ts:117,43,272`; `useEmailTemplates.ts:72,87`; `useICPConfig.ts:40`; `useVirtualCompanies.ts:10`; `useDashboardData.ts:143,173`; `useWeeklyPerformance.ts:18`; `useAutomationsMonitor.ts:42,60,77,94`; `useAuditTrail.ts:136,152`; `useApiKeys.ts:36`; `useWebhooks.ts:48`; `useEmailSuppressions.ts:40`; `useNotificationCount.ts:10`; `useScrapeQueue.ts:38,54`; `useFeatureFlags.ts:15`; `useResilienceComparison.ts:12`; `useWebScrape.ts:83`; `useOracleV2.ts:35`; `useApiLatency.ts:51,81`.
**Causa raiz:** o escopo do dado é a organização, e `user?.id` foi usado como se fosse.
**Caminho recomendado:** acrescente `activeOrgId` como segundo elemento de cada chave, seguindo o padrão já existente em `src/hooks/useSatisfaction.ts:32`, `usePiiRules.ts:50`, `useSalesGoals.ts:50`, `useDlqItems.ts:23`, `useLeaderboard.ts:30`, `useRolePermissions.ts:35`. Faça em um commit por arquivo se precisar, mas numa única pull request — são mudanças de uma linha cada. Confira se existe `invalidateQueries` citando a chave antiga em outro arquivo e atualize junto. O atalho tentador é confiar no `invalidateQueries()` geral da troca de organização (`ActiveOrgContext.tsx:62`): ele refaz, mas o cache antigo é exibido enquanto isso.
**Arquivos e objetos a tocar:** os 20 arquivos de hook citados.
**Não tocar / armadilhas:** `useFeatureFlags` lê tabela global — avalie caso a caso; se a flag é por organização na migration, inclua; se não, deixe. Toda invalidação correspondente precisa ser atualizada ou a tela para de se atualizar após gravar.
**Depende de:** 011, 012, 013, 014, 015 · **Libera:** 018
**Risco e como reverter:** chave errada faz a tela não atualizar após gravação. Verifique cada fluxo de gravação afetado. Reverter = `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `npx vitest run src/hooks` → verde. Com duas organizações na mesma conta: trocar de organização e confirmar que nenhum número da organização anterior aparece, nem por um instante.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 018 — Remover a política global que dá acesso à auditoria de todas as organizações

**Onda / Severidade / Camada:** 1 / Crítica / Banco · RLS
**Achados resolvidos:** G14-1
**Problema hoje:** a tabela `audit_logs` tem duas políticas de leitura: `"Admins view org audit logs"` (escopada, `supabase/migrations/20260422204526_*.sql:415`) e `"Admins view audit logs"` (global, `supabase/migrations/20260513140617_*.sql:54`, `USING (public.has_role(auth.uid(),'admin'))`). Políticas de leitura se somam, então a global amplia: um administrador de uma organização lê a auditoria de todas. `has_role` é global porque `user_roles` não tem coluna de organização (`20260513140617_*.sql:10-15`).
**Causa raiz:** política antiga mantida depois de a versão escopada ter sido criada.
**Caminho recomendado:** crie uma migration que faça `DROP POLICY IF EXISTS "Admins view audit logs" ON public.audit_logs;`. **Antes**, confirme no painel do Supabase que a política escopada existe de fato em produção e cobre o caso de uso (um administrador precisa ler a auditoria da própria organização) — se não existir, crie-a na mesma migration usando `public.has_org_role(organization_id, auth.uid(), 'admin')`, exatamente como em `retry_policy_advisories` (`20260721204338_*.sql:38-43`). Siga o formato de `scripts/check-migrations.sh` quanto a nomenclatura de arquivo. O atalho tentador é "endurecer `has_role`": ela é usada em outros lugares e a mudança teria alcance imprevisível.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** não altere `public.has_role` nem a tabela `user_roles`. Não remova a política escopada. Depois desta etapa, um administrador que dependia da visão global perde acesso — confirme com o dono se existe esse uso (por exemplo, suporte interno).
**Depende de:** 017 · **Libera:** 019, 020
**Risco e como reverter:** se a política escopada não cobrir o caso, administradores perdem acesso à auditoria da própria organização. Reverter = migration inversa recriando a política (guarde o texto exato no corpo da PR).
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** com sessão de administrador da organização A, consultar `audit_logs` e confirmar que só vêm registros de A; com a mesma sessão, consultar explicitamente um registro de B por identificador e confirmar que não retorna.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 019 — Escopar por organização a exclusão de registros de execução de automação

**Onda / Severidade / Camada:** 1 / Alta / Banco · RLS
**Achados resolvidos:** G14-1
**Problema hoje:** mesma causa da etapa 018 na política de exclusão de `automation_execution_logs` (`supabase/migrations/20260712185444_*.sql:59`): a verificação de papel é global.
**Causa raiz:** idem etapa 018.
**Caminho recomendado:** migration que substitui a política por uma versão com `public.has_org_role(organization_id, auth.uid(), 'admin')`. Mesmo modelo da etapa 018.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** confirme no painel que a coluna de organização existe nessa tabela antes de escrever a política.
**Depende de:** 018 · **Libera:** 020
**Risco e como reverter:** migration inversa com o texto original.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** administrador de A tentar excluir registro de execução de B → negado.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 020 — Varrer as políticas em busca de outras verificações de papel sem escopo de organização

**Onda / Severidade / Camada:** 1 / Alta / Banco · RLS
**Achados resolvidos:** G14-1
**Problema hoje:** as etapas 018 e 019 tratam os dois casos encontrados; a auditoria não varreu as 241 migrations para esse padrão específico em todas as tabelas.
**Causa raiz:** `has_role` (global) e `has_org_role` (escopada) têm nomes parecidos e foram usadas sem critério.
**Caminho recomendado:** rode `grep -rn "has_role(" supabase/migrations/*.sql` e liste cada política que usa a versão global em tabela que tenha coluna de organização. Para cada uma, confirme no painel se ainda existe e proponha a troca por `has_org_role`. Entregue a lista no corpo da pull request **antes** de escrever migration, e peça ao dono para confirmar quais são intencionais (suporte interno pode precisar de visão global).
**Arquivos e objetos a tocar:** nova migration (apenas os casos aprovados), e o relatório no corpo da PR.
**Não tocar / armadilhas:** tabelas de monitoramento sem dado de cliente podem legitimamente usar verificação global — não troque por reflexo.
**Depende de:** 018, 019 · **Libera:** 021
**Risco e como reverter:** migration inversa.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** a lista no corpo da PR com cada política classificada como "escopar" ou "manter global, motivo".
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 021 — Escopar por organização o cache de pesquisa da Apollo

**Onda / Severidade / Camada:** 1 / Alta / Banco · RLS
**Achados resolvidos:** G14-2
**Problema hoje:** `supabase/migrations/20260726202430_*.sql:18` dá `USING (true)` para qualquer usuário autenticado em `apollo_search_cache` — a lista de empresas que um cliente pesquisou fica visível a usuários de outros clientes.
**Causa raiz:** política de cache escrita como se o cache fosse global, quando o conteúdo revela estratégia comercial.
**Caminho recomendado:** verifique no painel se a tabela tem coluna de organização. Se tiver, migration substituindo a política por `public.is_org_member(organization_id, auth.uid())` no formato já usado nas políticas escopadas de `20260422204526_*.sql`. Se **não** tiver, a etapa correta é 022 (acrescentar a coluna antes) — pare e registre. O atalho tentador é revogar a leitura e deixar só a chave `service_role` ler: isso quebra qualquer tela que consulte o cache direto; confira antes com `grep -rn "apollo_search_cache" src/`.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** não apague o cache; a etapa é sobre quem pode ler.
**Depende de:** 020 · **Libera:** 023
**Risco e como reverter:** migration inversa.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** sessão da organização A consultando `apollo_search_cache` → só linhas de A.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 022 — Escopar por organização o cache de enriquecimento de CNPJ

**Onda / Severidade / Camada:** 1 / Alta / Banco · RLS
**Achados resolvidos:** G14-2
**Problema hoje:** `supabase/migrations/20260723163333_*.sql:15` dá `USING (true)` para autenticado em `cnpj_enrich_cache`.
**Causa raiz:** idem etapa 021.
**Caminho recomendado:** mesmo caminho da etapa 021. Atenção: há um argumento legítimo de que o cache de CNPJ é dado público da Receita e poderia ser compartilhado para economizar consultas pagas. Se o dono preferir manter o compartilhamento, a correção é **restringir as colunas legíveis** (criar uma view com `security_invoker` expondo só os campos cadastrais e revogar a leitura direta da tabela), não manter `USING (true)` sobre a tabela inteira — porque hoje a tabela também revela **quais** CNPJs cada cliente pesquisou. Decida com o dono e registre a decisão na PR.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** não altere as restrições de formato `cnpj ~ '^[0-9]{14}$'` (linhas 4 e 36) — são corretas e viram referência na etapa 093.
**Depende de:** 021 · **Libera:** 023
**Risco e como reverter:** migration inversa.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção e decisão de negócio).
**Como verificar:** sessão da organização A não deve enxergar o histórico de consultas de B.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 023 — Varrer o restante das políticas com liberação total

**Onda / Severidade / Camada:** 1 / Média / Banco · RLS
**Achados resolvidos:** G14-2
**Problema hoje:** além dos dois caches, há 13 ocorrências de `USING (true)` em tabelas de monitoramento. A auditoria classificou-as como sem dado de cliente, mas por amostragem.
**Causa raiz:** padrão copiado entre migrations.
**Caminho recomendado:** `grep -rn "USING (true)" supabase/migrations/*.sql`, excluindo as do tipo `FOR ALL TO service_role` (padrão correto, 44 casos). Para cada uma das restantes, diga na PR se a tabela contém dado de cliente. Corrija só as que contiverem.
**Arquivos e objetos a tocar:** nova migration (só os casos confirmados) e o relatório na PR.
**Não tocar / armadilhas:** não mexa nas `FOR ALL TO service_role USING (true)`.
**Depende de:** 021, 022 · **Libera:** 024
**Risco e como reverter:** migration inversa.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** lista na PR com cada tabela classificada.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 024 — Conferir no banco real as 11 políticas criadas com guarda por nome

**Onda / Severidade / Camada:** 1 / Média / Banco · RLS
**Achados resolvidos:** G14-3
**Problema hoje:** 11 políticas foram criadas dentro de blocos `DO $$ ... IF NOT EXISTS (… policyname = …)`. A guarda é por **nome**: se o banco já tinha política com aquele nome e regra diferente, a migration passou em silêncio. Afeta `lusha_contacts` e `lusha_search_sessions`, em arquivos cujo nome termina em `_redeclara`.
**Causa raiz:** guarda de idempotência por nome em vez de comparação de definição.
**Caminho recomendado:** **esta etapa é só de verificação, não altere nada.** No painel do Supabase, para cada uma das 11 políticas, compare a definição real (`pg_policies.qual` e `with_check`) com o texto da migration. Entregue a comparação como tabela no corpo da pull request (que só altera `docs/qa/05-PROGRESSO.md`). Onde divergir, abra anotação em "Achados novos" com o texto real. O atalho tentador é "rodar a migration de novo": o bloco vai pular outra vez.
**Arquivos e objetos a tocar:** `docs/qa/05-PROGRESSO.md` (registro da comparação).
**Não tocar / armadilhas:** nenhuma alteração em banco nesta etapa.
**Depende de:** 023 · **Libera:** 025
**Risco e como reverter:** nenhum (somente leitura).
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** a tabela comparativa das 11 políticas no corpo da PR, com "igual" ou "divergente: <texto real>".
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 025 — Trocar a guarda por nome das políticas por comparação de definição

**Onda / Severidade / Camada:** 1 / Média / Banco · RLS
**Achados resolvidos:** G14-3
**Problema hoje:** o padrão descrito na etapa 024 continua no repositório e será copiado na próxima migration.
**Causa raiz:** idem.
**Caminho recomendado:** adote `DROP POLICY IF EXISTS <nome>; CREATE POLICY <nome> ...` em vez do bloco condicional — é idempotente e garante a definição. Aplique **apenas** nas políticas que a etapa 024 apontou como divergentes, numa migration só. Acrescente a regra em `scripts/check-migrations.sh` para recusar novas migrations com `IF NOT EXISTS` sobre `policyname`.
**Arquivos e objetos a tocar:** nova migration (casos divergentes), `scripts/check-migrations.sh`.
**Não tocar / armadilhas:** `DROP`+`CREATE` tem uma janela de milissegundos sem política — rode fora do horário de pico e nunca em tabela com leitura pública.
**Depende de:** 024 · **Libera:** 026
**Risco e como reverter:** migration inversa.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** `bash scripts/check-migrations.sh` → recusa um arquivo de teste com o padrão antigo; definição real das políticas igual à da migration.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 026 — Trocar o portão do canal de consulta MCP por autenticação com papel

**Onda / Severidade / Camada:** 1 / Crítica / Backend
**Achados resolvidos:** G11-1
**Problema hoje:** `supabase/functions/mcp-query/index.ts:38` compara o cabeçalho `x-mcp-secret` com um segredo fixo, sem expiração e sem vínculo com usuário; `supabase/config.toml:45-46` tem `verify_jwt = false`; `:11` libera qualquer origem. Quem obtiver o texto executa SQL com a chave mestra.
**Causa raiz:** autenticação por texto compartilhado, escolhida porque o chamador é um serviço.
**Caminho recomendado:** substitua por validação de sessão com papel de administrador, no formato já usado em `supabase/functions/rls-tests/index.ts:105-146` (valida JWT, consulta papel em `organization_members`, audita a negativa). Para o uso automatizado legítimo, aceite também `isCronAuthorized` de `supabase/functions/_shared/cron-auth.ts` (comparação de tempo constante). Mantenha o segredo apenas como camada adicional, nunca como única. Troque `verify_jwt = false` por `true` no `config.toml` depois que a validação estiver no código. O atalho tentador é só tornar a comparação de tempo constante: continua sendo um texto que, vazado, dá SQL livre.
**Arquivos e objetos a tocar:** `supabase/functions/mcp-query/index.ts`, `supabase/config.toml`.
**Não tocar / armadilhas:** confirme com o dono quem consome esse canal hoje — trocar o portão pode cortar uma automação em uso. O modo `admin` (`:49-66`) é tratado na etapa 028.
**Depende de:** 003 · **Libera:** 027, 028
**Risco e como reverter:** pode interromper integração existente. Reverter = `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (mudança de autenticação em produção).
**Como verificar:** chamada sem sessão → 401; com sessão de `viewer` → 403; com sessão de `admin` → 200.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 027 — Restringir o canal de consulta MCP a comandos de leitura

**Onda / Severidade / Camada:** 1 / Crítica / Backend
**Achados resolvidos:** G11-1
**Problema hoje:** `supabase/functions/mcp-query/index.ts:76` só barra `DROP`, `TRUNCATE`, `ALTER SYSTEM` e `RESET ALL`. Passam `DELETE`, `UPDATE`, `INSERT`, `GRANT`, `CREATE ROLE` e `COPY`.
**Causa raiz:** lista de proibições em vez de lista de permissões.
**Caminho recomendado:** inverta a lógica: aceite **apenas** comandos que começam com `SELECT`, `WITH ... SELECT` ou `EXPLAIN`, recusando todo o resto, e recuse comando com mais de uma instrução (`;` seguido de conteúdo). Lista de permissões é a única abordagem defensável aqui, porque comentários SQL e maiúsculas/minúsculas derrotam qualquer lista de proibições. O atalho tentador é acrescentar `DELETE|UPDATE|INSERT` à lista existente: `/*x*/DELETE` passa.
**Arquivos e objetos a tocar:** `supabase/functions/mcp-query/index.ts`.
**Não tocar / armadilhas:** se alguma automação do dono usava esse canal para gravar, ela vai parar — levante isso antes com ele.
**Depende de:** 026 · **Libera:** 028
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (altera comportamento em produção).
**Como verificar:** com sessão de administrador, enviar `DELETE FROM companies WHERE false` → recusado; `SELECT 1` → aceito; `/*c*/DELETE FROM companies` → recusado.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 028 — Restringir as rotas que o modo administrador do canal MCP repassa

**Onda / Severidade / Camada:** 1 / Alta / Backend
**Achados resolvidos:** G11-1
**Problema hoje:** `supabase/functions/mcp-query/index.ts:49-66` repassa chamadas para `auth/v1/*` e `storage/v1/*` sem restrição de rota, com a chave mestra.
**Causa raiz:** repasse genérico por prefixo.
**Caminho recomendado:** troque por uma lista explícita de rotas permitidas (por exemplo, apenas as de listagem que o painel usa de fato — confirme com `grep -rn "mcp-query" src/`). Qualquer rota fora da lista → 403. O atalho tentador é bloquear só os métodos de escrita: `GET /auth/v1/admin/users` já expõe a base de usuários.
**Arquivos e objetos a tocar:** `supabase/functions/mcp-query/index.ts`.
**Não tocar / armadilhas:** não remova o modo inteiro sem conferir quem usa.
**Depende de:** 027 · **Libera:** 029
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** chamada a rota fora da lista → 403; rota da lista → 200.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 029 — Remover de vez a função de execução de SQL arbitrário do banco

**Onda / Severidade / Camada:** 1 / Crítica / Banco
**Achados resolvidos:** G11-1
**Problema hoje:** `supabase/migrations/20261113185209_*.sql:2-5` descreve `exec_sql` como "RCE em produção (comprovado)" e afirma não haver chamador; a migration só executa `REVOKE` de `anon` e `authenticated` (`:12`), **não** `DROP`, e `REVOKE` não afeta a chave mestra. A afirmação "sem chamador" está falsa: `supabase/functions/mcp-query/index.ts:81` a chama.
**Causa raiz:** remoção adiada por existir um consumidor.
**Caminho recomendado:** só execute esta etapa **depois** da 027, que deixa o canal MCP restrito a leitura. Então: troque a chamada de `supabase/functions/mcp-query/index.ts:81` por uma função nova `public.run_readonly_query(text)` com `SECURITY DEFINER`, `SET search_path` e `SET TRANSACTION READ ONLY`, e crie migration com `DROP FUNCTION IF EXISTS public.exec_sql(text);`. Siga o formato das funções `SECURITY DEFINER` corretas (147 das 148 do repositório já fixam `search_path`). O atalho tentador é manter `exec_sql` "porque só a chave mestra usa": é exatamente a chave que G10-2 entregava.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`, `supabase/functions/mcp-query/index.ts`.
**Não tocar / armadilhas:** procure outros chamadores antes (`grep -rn "exec_sql" src/ supabase/ scripts/`); se houver script de manutenção do dono usando-a, levante antes.
**Depende de:** 027 · **Libera:** 030
**Risco e como reverter:** se algum processo oculto usar `exec_sql`, ele para. Reverter = migration recriando a função (guarde a definição exata na PR).
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção e remoção de função).
**Como verificar:** no painel, `SELECT has_function_privilege('authenticated','public.exec_sql(text)','EXECUTE')` → erro de função inexistente; o canal MCP continua respondendo a `SELECT 1`.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 030 — Corrigir o comentário da migration que afirma não haver chamador de `exec_sql`

**Onda / Severidade / Camada:** 1 / Baixa / Banco · documentação
**Achados resolvidos:** G11-1, G24-1
**Problema hoje:** `supabase/migrations/20261113185209_*.sql:2-5` afirma "Nenhum chamador em `src/` ou `supabase/functions/`", o que levou a auditoria anterior a considerar o risco fechado.
**Causa raiz:** afirmação verdadeira quando escrita, nunca revisada.
**Caminho recomendado:** **não edite a migration já aplicada** — migrations são histórico. Registre a correção em `docs/qa/05-PROGRESSO.md` e em `docs/ESTADO_ATUAL.md`, na seção que trata do assunto, dizendo que o risco só foi fechado na etapa 029.
**Arquivos e objetos a tocar:** `docs/ESTADO_ATUAL.md`, `docs/qa/05-PROGRESSO.md`.
**Não tocar / armadilhas:** nunca altere arquivo de migration já aplicado.
**Depende de:** 029 · **Libera:** 031
**Risco e como reverter:** nenhum.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** o texto novo citando a etapa 029 presente em `docs/ESTADO_ATUAL.md`.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 031 — Exigir pertencimento à organização no disparo de campanhas

**Onda / Severidade / Camada:** 1 / Alta / Backend
**Achados resolvidos:** G12-1
**Problema hoje:** `supabase/functions/campaign-dispatch/index.ts:124-134` encerra a verificação em "existe JWT"; `:152-156` consulta campanhas ativas sem filtro de organização; `:145` aceita identificador de campanha de qualquer organização.
**Causa raiz:** autenticação confundida com autorização.
**Caminho recomendado:** depois de validar a sessão, obtenha as organizações do usuário como `supabase/functions/oracle-push-bitrix/index.ts:151` faz com `getUserOrgIds`, e restrinja tanto a consulta (`:152-156`) quanto a validação do identificador recebido (`:145`). Mantenha o caminho de agendamento funcionando via `isCronAuthorized` — quando a chamada vem do agendamento, não há usuário e o escopo é "todas as organizações", o que é correto; separe os dois caminhos de forma explícita no código. O atalho tentador é filtrar só a consulta e esquecer o identificador do corpo.
**Arquivos e objetos a tocar:** `supabase/functions/campaign-dispatch/index.ts`.
**Não tocar / armadilhas:** não altere o fluxo de envio nesta etapa (é a etapa 047, de idempotência).
**Depende de:** — · **Libera:** 047
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; envio de e-mail).
**Como verificar:** com sessão da organização A, chamar com identificador de campanha de B → 403; chamada do agendamento continua disparando as campanhas ativas.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 032 — Exigir pertencimento à organização na consulta de envios de webhook

**Onda / Severidade / Camada:** 1 / Alta / Backend
**Achados resolvidos:** G12-2
**Problema hoje:** `supabase/functions/webhook-dispatcher/index.ts:42-60` aceita qualquer sessão; `:69-81` usa o identificador recebido sem confrontar a organização, e a consulta roda com a chave mestra.
**Causa raiz:** idem etapa 031.
**Caminho recomendado:** mesmo padrão: `getUserOrgIds` e filtro no `.eq("organization_id", ...)` da consulta de `:69-81`. Separe o caminho de agendamento do caminho de usuário.
**Arquivos e objetos a tocar:** `supabase/functions/webhook-dispatcher/index.ts`.
**Não tocar / armadilhas:** não altere a reserva atômica de `:99-104` nem a revalidação de destino de `:130-146` — são padrões corretos e viram referência em outras etapas.
**Depende de:** — · **Libera:** 033
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** sessão de A pedindo envio de B → 403.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 033 — Filtrar os proxies de rede pela organização do usuário

**Onda / Severidade / Camada:** 1 / Alta / Backend
**Achados resolvidos:** G12-3
**Problema hoje:** `supabase/functions/gmaps-proxy/index.ts:385-391` lê `org_proxies` com a chave mestra sem `.eq("organization_id", userOrgId)`, embora `userOrgId` exista em `:242`. Endereços de proxy costumam carregar usuário e senha.
**Causa raiz:** consulta escrita antes de a variável de organização existir na função, nunca revista.
**Caminho recomendado:** acrescente o filtro usando a variável já disponível em `:242`. Confirme que a tabela tem a coluna; se um proxy compartilhado for intencional, a solução é uma coluna explícita de "compartilhado" com valor padrão falso, não a ausência de filtro.
**Arquivos e objetos a tocar:** `supabase/functions/gmaps-proxy/index.ts`.
**Não tocar / armadilhas:** não registre valor de proxy em log — contém credencial.
**Depende de:** 032 · **Libera:** 034
**Risco e como reverter:** organizações sem proxy próprio perdem o proxy que vinham usando por acidente; avise o dono. Reverter = `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** com sessão de A, solicitar raspagem e conferir no log da função que o proxy escolhido pertence a A.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 034 — Fechar o trabalhador de Instagram atrás de autenticação de agendamento

**Onda / Severidade / Camada:** 1 / Alta / Backend
**Achados resolvidos:** G12-4
**Problema hoje:** `supabase/functions/instagram-worker/index.ts:53-62` vai direto do tratamento de origem para o cliente com chave mestra e para a reserva de tarefa, sem nenhuma verificação. Não está em `supabase/config.toml`, logo herda `verify_jwt = true` — que não é autenticação de pessoa, porque a chave publicável é um JWT válido e está no pacote público do site (o próprio repositório documenta isso em `supabase/functions/cnpj-enrich-worker/index.ts:96-99`). A função consome crédito pago.
**Causa raiz:** worker escrito presumindo que só o agendamento o chamaria.
**Caminho recomendado:** use `isCronAuthorized` de `supabase/functions/_shared/cron-auth.ts`, como as 20 funções que já fazem isso, e recuse o resto com 401. Siga `supabase/functions/scrape-queue-worker/index.ts` como referência de worker correto.
**Arquivos e objetos a tocar:** `supabase/functions/instagram-worker/index.ts`.
**Não tocar / armadilhas:** o agendamento do Instagram pode não existir ainda (ver pull request #120 citada em `docs/ESTADO_ATUAL.md`); confirme com o dono antes, ou a fila para de ser consumida.
**Depende de:** 002 · **Libera:** 035
**Risco e como reverter:** se o agendamento usar outro cabeçalho, a fila para. Teste antes em uma chamada manual autorizada. Reverter = `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (produção; pode parar fila).
**Como verificar:** chamada anônima → 401; chamada com o cabeçalho de agendamento correto → processa.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 035 — Fechar a verificação de saúde atrás de autenticação e parar de gravar a cada chamada

**Onda / Severidade / Camada:** 1 / Alta / Backend
**Achados resolvidos:** G12-4
**Problema hoje:** `supabase/functions/health/index.ts:29` não verifica nada; `:121` grava um registro a cada chamada; `:88-94` faz consulta **paga** ao Google Places; `:84` revela quais segredos estão ausentes.
**Causa raiz:** endpoint de diagnóstico tratado como público.
**Caminho recomendado:** divida em dois comportamentos no mesmo arquivo: sem autenticação, responda apenas `{ status: "ok" }` sem consultar nada e sem gravar; com `isCronAuthorized` ou sessão de administrador, execute as verificações completas, grave o registro e informe os segredos ausentes. Mantenha os tempos-limite de `:70,88,108`, que já são corretos.
**Arquivos e objetos a tocar:** `supabase/functions/health/index.ts`.
**Não tocar / armadilhas:** confirme se algum monitor externo (ou a página `/status`) chama esse endpoint esperando o corpo completo — `grep -rn "functions/v1/health" src/`.
**Depende de:** 034 · **Libera:** 036
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** chamada anônima → 200 com corpo mínimo e **sem** novo registro em `health_checks`; chamada autenticada → corpo completo.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 036 — Fechar o controle de tentativas de login atrás de autenticação de serviço

**Onda / Severidade / Camada:** 1 / Alta / Backend
**Achados resolvidos:** G12-4, G12-5
**Problema hoje:** `supabase/functions/auth-rate-limit/index.ts:33` não verifica nada; qualquer anônimo pode chamar e inflar a tabela.
**Causa raiz:** idem etapa 034.
**Caminho recomendado:** como a função participa do fluxo de login (quando ainda não há sessão), não use JWT de usuário: exija um segredo de serviço comparado em tempo constante, no formato de `supabase/functions/_shared/cron-auth.ts`, e passe a chamá-la só de onde o login a usa. Confirme quem chama com `grep -rn "auth-rate-limit" src/ supabase/`.
**Arquivos e objetos a tocar:** `supabase/functions/auth-rate-limit/index.ts`, mais o chamador identificado.
**Não tocar / armadilhas:** se o chamador for o navegador, o segredo iria para o pacote público — nesse caso a solução é mover a contagem para dentro de uma função do banco chamada pelo fluxo de autenticação, e não expor a função. Levante com o dono antes de escolher.
**Depende de:** 035 · **Libera:** 037
**Risco e como reverter:** se errar, o login pode parar; teste em preview. Reverter = `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (produção; caminho de login).
**Como verificar:** chamada anônima → 401; o fluxo de login continua bloqueando na 5ª tentativa.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 037 — Tornar atômica a contagem de tentativas de login

**Onda / Severidade / Camada:** 1 / Alta / Backend · banco
**Achados resolvidos:** G12-5
**Problema hoje:** `supabase/functions/auth-rate-limit/index.ts:70-113` lê, calcula e grava em duas idas separadas ao banco, então requisições simultâneas furam o teto de 5.
**Causa raiz:** leitura e escrita separadas em vez de incremento no banco.
**Caminho recomendado:** crie uma função de banco que incremente e devolva o total em uma única instrução (`INSERT ... ON CONFLICT ... DO UPDATE SET count = count + 1 RETURNING count`), como `supabase/functions/public-api/index.ts:136` já faz com a sua própria função atômica. Chame-a da edge function. Precisa de migration, logo aprovação do dono.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`, `supabase/functions/auth-rate-limit/index.ts`.
**Não tocar / armadilhas:** não mude a chave de contagem nesta etapa (`email|IP`, `:62`); avaliar a chave é discussão própria e não melhora a atomicidade.
**Depende de:** 036 · **Libera:** 038
**Risco e como reverter:** migration inversa + `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** dispare 20 requisições simultâneas com o mesmo e-mail e confirme que o bloqueio ocorre na 5ª, não na 20ª.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 038 — Fazer o limite de uso da API pública falhar fechado

**Onda / Severidade / Camada:** 1 / Alta / Backend
**Achados resolvidos:** G12-6
**Problema hoje:** `supabase/functions/_shared/api-rate-limit.ts:11-13` declara liberar em caso de falha e `supabase/functions/public-api/index.ts:136` descarta o erro da função de contagem: se a contagem falhar, o teto de 600 requisições por hora desaparece sem aviso.
**Causa raiz:** decisão explícita de priorizar disponibilidade sobre controle.
**Caminho recomendado:** inverta: ao falhar a contagem, responda 503 com mensagem clara e registre o erro. Para não derrubar clientes por uma falha momentânea, permita no máximo uma janela curta de tolerância (por exemplo, falhar aberto só se a última contagem bem-sucedida foi há menos de 60 segundos), implementada em memória na própria função. O atalho tentador é deixar como está "porque cliente bravo é pior": sem teto, uma integração em laço derruba o banco de todos os clientes.
**Arquivos e objetos a tocar:** `supabase/functions/_shared/api-rate-limit.ts`, `supabase/functions/public-api/index.ts`.
**Não tocar / armadilhas:** a lista de colunas graváveis de `public-api:39-69` está correta — não mexa.
**Depende de:** 037 · **Libera:** 039
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; afeta clientes externos).
**Como verificar:** simule falha da função de contagem (nome inexistente em ambiente de teste) e confirme 503 em vez de 200.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 039 — Contar o limite da API pública por organização, não por usuário

**Onda / Severidade / Camada:** 1 / Média / Backend
**Achados resolvidos:** G12-6
**Problema hoje:** `supabase/functions/public-api/index.ts:221,236,246` contam por `user_id`, embora a chave de API pertença à organização (`:161` já tem a organização, usada só para registro).
**Causa raiz:** escopo de contagem herdado de um modelo anterior sem organizações.
**Caminho recomendado:** troque o escopo da contagem para a organização da chave, usando o valor já disponível em `:161`. Precisa alinhar com a função de banco da etapa 037 (ou com a função de contagem da API, se for outra) para que a chave de contagem inclua a organização.
**Arquivos e objetos a tocar:** `supabase/functions/public-api/index.ts`, possivelmente a função de contagem.
**Não tocar / armadilhas:** o teto de 600/hora passa a valer para a conta inteira — confirme o número com o dono, porque é mudança de contrato comercial.
**Depende de:** 038 · **Libera:** 040
**Risco e como reverter:** clientes com vários usuários podem bater no teto antes. Reverter = `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (produção e contrato com clientes).
**Como verificar:** duas chaves da mesma organização somando 601 requisições → a última é recusada.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 040 — Apagar o segredo de painel administrativo que já vazou

**Onda / Severidade / Camada:** 1 / Média / Infraestrutura · segredos
**Achados resolvidos:** G23-5
**Problema hoje:** o segredo `VITE_ADMIN_LIST_TOKEN` continua cadastrado nos segredos de Actions, com data de atualização igual à de criação (07/09), embora o código já exija sessão e papel de administrador (`supabase/functions/admin-list-companies/index.ts:30-35`). `.gitignore:52` registra que esse token e chaves de produção já vazaram em um `.env` versionado.
**Causa raiz:** segredo órfão depois da correção do código.
**Caminho recomendado:** confirme com `grep -rn "VITE_ADMIN_LIST_TOKEN" src/ supabase/ .github/` que nada o lê; depois apague o segredo no GitHub e, se existir, na Vercel. Como ele vazou, **não** basta apagar: se o valor ainda for aceito em algum lugar, invalide-o no serviço de origem.
**Arquivos e objetos a tocar:** nenhum arquivo; segredos do GitHub e da Vercel.
**Não tocar / armadilhas:** não remova a função `admin-list-companies`, que está correta.
**Depende de:** — · **Libera:** 041
**Risco e como reverter:** se algo oculto usar o token, para de funcionar. Reverter = recadastrar (mas o certo é corrigir o consumidor).
**Precisa de aprovação humana antes do merge:** **sim** (segredos).
**Como verificar:** o segredo não aparece mais na lista; a rota `/admin/companies` continua funcionando para administrador e recusando `viewer`.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 041 — Proteger o ambiente `staging` que recebe credenciais em qualquer pull request

**Onda / Severidade / Camada:** 1 / Média / Infraestrutura · CI
**Achados resolvidos:** G23-6
**Problema hoje:** o ambiente `staging` tem `protection_rules: []` e `deployment_branch_policy: null`, e recebe `SUPABASE_ACCESS_TOKEN` e `DB_PASSWORD` no passo de planejamento de qualquer pull request — num repositório público (G10-1).
**Causa raiz:** ambiente criado sem regra de proteção.
**Caminho recomendado:** configure uma política de branch limitando o ambiente às branches internas e, se o fluxo permitir, exija revisor. Alternativa melhor para o passo de planejamento: usar uma conexão somente-leitura em vez do token de acesso completo. Decida com o dono.
**Arquivos e objetos a tocar:** configuração do ambiente no GitHub; possivelmente `.github/workflows/db-migrations.yml`.
**Não tocar / armadilhas:** não remova o ambiente `Production` nem seu revisor obrigatório.
**Depende de:** 040 · **Libera:** 042
**Risco e como reverter:** o passo de planejamento pode parar em pull requests externas — o que é o objetivo. Reverter = reverter a configuração.
**Precisa de aprovação humana antes do merge:** **sim** (infraestrutura e segredos).
**Como verificar:** abrir uma pull request de uma branch não autorizada e confirmar que o passo que usa o ambiente não executa.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 042 — Confirmar a correspondência exata do nome do ambiente de produção nos workflows

**Onda / Severidade / Camada:** 1 / Alta / Infraestrutura · CI
**Achados resolvidos:** G13-1, G22-3
**Problema hoje:** os workflows pedem o ambiente `production` (minúsculo) e existe `Production` (com revisor obrigatório). Se o GitHub não casar os dois, cria um ambiente novo **sem revisor** e a migration é aplicada em produção sem aprovação. A auditoria não conseguiu confirmar (faltou o registro de execução de um job de aplicação real).
**Causa raiz:** nome do ambiente escrito com grafia diferente da cadastrada.
**Caminho recomendado:** abra o registro de execução do último job de aplicação de migration e confirme qual ambiente foi usado e se houve espera por aprovação. Se não casar, padronize a grafia no workflow para a exata do ambiente cadastrado e apague o ambiente criado por engano, se existir. Esta etapa é de verificação e, se necessário, uma correção de uma linha.
**Arquivos e objetos a tocar:** `.github/workflows/db-migrations.yml`, `.github/workflows/edge-functions-deploy.yml` (só se divergirem).
**Não tocar / armadilhas:** não apague o ambiente `Production` nem suas regras.
**Depende de:** 041 · **Libera:** 043
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (infraestrutura).
**Como verificar:** lista de ambientes com apenas os esperados; o job de aplicação de migration aparece como "esperando aprovação" numa execução de teste.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 043 — Fixar por identificador de commit as ações de terceiro nos workflows que tocam produção

**Onda / Severidade / Camada:** 1 / Média / Infraestrutura · CI
**Achados resolvidos:** G23-6
**Problema hoje:** `actions/checkout@v7` e `supabase/setup-cli@v1` são referenciadas por marca móvel justamente nos workflows que aplicam migrations e publicam funções, no mesmo job onde ficam os tokens. Quatro workflows mais novos já fixam por identificador de commit.
**Causa raiz:** marca móvel permite que o conteúdo da ação mude sem alteração no repositório.
**Caminho recomendado:** substitua pelas versões fixadas por identificador completo de commit, com o número da versão em comentário ao lado, seguindo o padrão dos quatro workflows que já fazem isso.
**Arquivos e objetos a tocar:** `.github/workflows/db-migrations.yml`, `.github/workflows/edge-functions-deploy.yml` e os demais que usem marca móvel nesses jobs.
**Não tocar / armadilhas:** confira que o identificador corresponde à versão desejada antes de fixar.
**Depende de:** 042 · **Libera:** 044
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (CI).
**Como verificar:** `grep -n "uses:" .github/workflows/db-migrations.yml` → todas as referências com identificador de 40 caracteres.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 044 — Parar de aceitar exclusão física pela API pública

**Onda / Severidade / Camada:** 1 / Crítica / Backend
**Achados resolvidos:** G31-3
**Problema hoje:** `supabase/functions/public-api/index.ts:265` executa exclusão física com a chave mestra (`:123-126`), passando por cima da política "só administrador exclui"; e `:217-220` lista sem filtrar excluídos nem organização.
**Causa raiz:** a função usa a chave mestra para tudo e replicou a semântica de exclusão do banco em vez da do produto.
**Caminho recomendado:** troque a exclusão física por atualização de `deleted_at`, exatamente como `src/integrations/supabase/withOrg.ts:344-353` faz, e acrescente o filtro de organização e de excluídos na listagem de `:217-220`. Use `supabase/functions/mcp/index.ts:46` como referência de função que já faz isso certo. O atalho tentador é só acrescentar o filtro na listagem e deixar a exclusão como está: é a exclusão que destrói dado sem volta.
**Arquivos e objetos a tocar:** `supabase/functions/public-api/index.ts`.
**Não tocar / armadilhas:** o filtro por `user_id` dessa função é tratado na etapa 128 — não misture as duas mudanças.
**Depende de:** — · **Libera:** 045, 128
**Risco e como reverter:** integrações que esperavam remoção definitiva passam a ver o registro na lixeira. Avise na PR. Reverter = `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (produção; muda contrato de API e comportamento de exclusão).
**Como verificar:** excluir uma empresa pela API e confirmar que ela aparece na lixeira e não é mais listada pela API.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 045 — Exigir papel de administrador para reprocessar fila morta

**Onda / Severidade / Camada:** 1 / Média / Backend
**Achados resolvidos:** G32-4
**Problema hoje:** `supabase/functions/web-dlq-replay/index.ts:51-63` valida que o usuário pertence à organização, mas não valida o papel; e `src/components/lux/monitoring/DLQReplayPanel.tsx:176` não tem portão de permissão. Um usuário somente-leitura reprocessa a fila e gera custo externo.
**Causa raiz:** validação de pertencimento confundida com validação de papel.
**Caminho recomendado:** acrescente a verificação de papel de administrador no formato de `supabase/functions/rls-tests/index.ts:105-146`, e envolva o botão em `PermissionGate` como `src/components/lux/DealsView.tsx` já faz. Faça o mesmo em `supabase/functions/instagram-dlq-replay/index.ts`, que tem a mesma estrutura.
**Arquivos e objetos a tocar:** `supabase/functions/web-dlq-replay/index.ts`, `supabase/functions/instagram-dlq-replay/index.ts`, `src/components/lux/monitoring/DLQReplayPanel.tsx`.
**Não tocar / armadilhas:** as configurações de alerta de fila morta já são restritas a administrador nas duas pontas — não mexa.
**Depende de:** 044 · **Libera:** 046
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** sessão `viewer` chamando o reprocessamento → 403; botão ausente na tela.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 046 — Corrigir o emissor de autenticação gravado no pacote da função MCP

**Onda / Severidade / Camada:** 1 / Alta / Backend
**Achados resolvidos:** G23-2
**Problema hoje:** `supabase/functions/mcp/index.ts:220` traz `var projectRef = "local-e2e"`, o que produz um emissor de autenticação `https://local-e2e.supabase.co/auth/v1` — projeto inexistente — combinado com `verify_jwt = false` em `supabase/config.toml:37-38`. Ou seja, o canal não valida credencial contra projeto nenhum.
**Causa raiz:** o arquivo é **gerado** a partir de `src/lib/mcp/` e foi gerado numa execução em que a variável de ambiente do projeto apontava para o ambiente de teste.
**Caminho recomendado:** não edite o arquivo gerado à mão. Descubra de onde o gerador lê o identificador do projeto (procure em `src/lib/mcp/` e em `scripts/patch-mcp-plugin.mjs`), garanta que a variável de ambiente correta esteja definida, regenere com `npm run patch:mcp-plugin` seguido do passo de geração e comite o resultado. Atenção: a regeração também vai atualizar as versões de dependência do pacote (etapa 278) — faça as duas na mesma pull request se isso ocorrer, explicando no corpo. O atalho tentador é trocar a linha 220 na mão: a próxima geração desfaz.
**Arquivos e objetos a tocar:** `supabase/functions/mcp/index.ts` (gerado), possivelmente `src/lib/mcp/`.
**Não tocar / armadilhas:** `eslint.config.js:9` exclui esse arquivo da análise, então o lint não vai avisar de nada. Confirme o conteúdo gerado lendo o diff.
**Depende de:** 045 · **Libera:** 278
**Risco e como reverter:** se o emissor ficar errado, o canal MCP para de autenticar. Reverter = `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; autenticação).
**Como verificar:** `grep -n "projectRef" supabase/functions/mcp/index.ts` → identificador do projeto oficial; autenticação pelo canal MCP funciona com token real.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

---

## ONDA 2 — Fluxos principais quebrados (047–092)

> As etapas 047–050 tratam de perda de dado e por isso vêm antes de tudo nesta onda, embora o tema seja o fluxo e não a segurança.

### Etapa 047 — Incluir as quatro tabelas que faltam na lista de exclusão reversível do wrapper

**Onda / Severidade / Camada:** 2 / Alta / Dados
**Achados resolvidos:** G31-1
**Problema hoje:** `src/integrations/supabase/withOrg.ts:129-139` lista **4** tabelas para exclusão reversível, enquanto o tipo `SoftDeleteTable` (`:379-387`) e a função de limpeza `purge_soft_deleted()` (`supabase/migrations/20261121083400_*.sql:6-9,31-39`) listam **8**. Por isso `src/hooks/useWebhooks.ts:78`, `src/hooks/useApiKeys.ts:79` e `src/hooks/useEmailSuppressions.ts:76` apagam **definitivamente**, e quatro abas de `src/components/lux/RecycleBinView.tsx:19-28` ficam sempre vazias.
**Causa raiz:** duas listas da mesma verdade, mantidas à mão, que divergiram.
**Caminho recomendado:** acrescente `email_suppressions`, `email_accounts`, `api_keys` e `webhooks` ao conjunto de `:129-139`, igualando-o ao tipo `SoftDeleteTable` de `:379-387`. Antes, confirme no painel que as quatro tabelas têm a coluna `deleted_at` (as migrations dizem que sim). Para impedir nova divergência, derive um dos dois do outro no mesmo arquivo em vez de manter duas listas. O atalho tentador é "apagar mesmo é mais limpo": a lista de descadastros de e-mail apagada faz o sistema voltar a enviar para quem pediu para sair, o que é infração de LGPD.
**Arquivos e objetos a tocar:** `src/integrations/supabase/withOrg.ts`.
**Não tocar / armadilhas:** depois desta etapa as quatro abas da lixeira passam a listar — confirme que `TRASH_LABEL_COLUMN` (`:393-402`) tem a coluna certa para cada uma (`email` para as duas de e-mail), senão a aba dá erro como em G31-2.
**Depende de:** — · **Libera:** 048, 049, 050
**Risco e como reverter:** registros que seriam apagados passam a ocupar espaço até a limpeza periódica. Reverter = `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** excluir um descadastro de e-mail e conferir: continua na tabela com `deleted_at` preenchido, aparece na aba da lixeira e **não** aparece na lista principal.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 048 — Garantir que a lista de descadastros de e-mail nunca seja consultada sem o filtro de excluídos

**Onda / Severidade / Camada:** 2 / Alta / Regras de negócio
**Achados resolvidos:** G31-1
**Problema hoje:** depois da etapa 047 os descadastros passam a ser marcados em vez de apagados; se algum caminho de envio consultar a tabela sem filtrar `deleted_at`, passa a considerar um descadastro apagado como ativo (ou o contrário).
**Causa raiz:** mudança de semântica de exclusão exige revisar todos os leitores.
**Caminho recomendado:** liste os leitores com `grep -rn "email_suppressions" src/ supabase/functions/` e garanta que o caminho de envio (`supabase/functions/campaign-dispatch/index.ts`) considere **ativo** apenas o descadastro com `deleted_at IS NULL`. Trate como regra de negócio explícita, com comentário de uma linha no ponto da consulta.
**Arquivos e objetos a tocar:** os leitores apontados pela varredura, provavelmente `supabase/functions/campaign-dispatch/index.ts` e `src/hooks/useEmailSuppressions.ts`.
**Não tocar / armadilhas:** o caso perigoso é o inverso do intuitivo: descadastro na lixeira **não** deve bloquear envio, mas descadastro ativo deve. Confirme a regra com o dono antes de codificar.
**Depende de:** 047 · **Libera:** 049
**Risco e como reverter:** erro aqui gera envio para quem descadastrou. Teste com um registro de teste antes. Reverter = `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (produção; envio de e-mail e LGPD).
**Como verificar:** destinatário com descadastro ativo não recebe; o mesmo descadastro restaurado da lixeira continua bloqueando.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 049 — Corrigir a coluna de rótulo da aba Negócios na lixeira

**Onda / Severidade / Camada:** 2 / Média / Interface
**Achados resolvidos:** G31-2
**Problema hoje:** `src/integrations/supabase/withOrg.ts:393` define `TRASH_LABEL_COLUMN.deals = "name"` e `src/components/lux/RecycleBinView.tsx:42-45` monta `select("id, name, deleted_at")`; a tabela `deals` tem a coluna `title`, não `name`. A aba dá erro sempre e o negócio excluído não pode ser restaurado.
**Causa raiz:** nome de coluna presumido.
**Caminho recomendado:** troque para `"title"` no mapa de `:393`. Confirme antes no painel ou em `src/integrations/supabase/types.ts` qual é o nome real. Verifique as outras sete entradas do mapa pela mesma régua, já que o erro é de uma família.
**Arquivos e objetos a tocar:** `src/integrations/supabase/withOrg.ts`.
**Não tocar / armadilhas:** `RecycleBinView` monta a consulta a partir do mapa — não precisa alterar o componente.
**Depende de:** 047 · **Libera:** 050
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** excluir um negócio, abrir a lixeira na aba Negócios: o item aparece com o título e o botão de restaurar funciona.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 050 — Criar um teste que compare o mapa de rótulos da lixeira com o schema

**Onda / Severidade / Camada:** 2 / Baixa / Testes
**Achados resolvidos:** G31-2
**Problema hoje:** nada impediu que uma coluna inexistente ficasse no mapa, e nada impede que volte.
**Causa raiz:** mapa escrito à mão sem verificação.
**Caminho recomendado:** teste em `src/integrations/supabase/__tests__/` que, para cada entrada de `TRASH_LABEL_COLUMN`, confirme que a coluna existe no tipo gerado `src/integrations/supabase/types.ts`. É verificação de tipo em tempo de teste, sem precisar de banco. Siga o estilo de `withOrg.registry.test.ts`.
**Arquivos e objetos a tocar:** novo arquivo de teste em `src/integrations/supabase/__tests__/`.
**Não tocar / armadilhas:** não gere o arquivo de tipos nesta etapa.
**Depende de:** 049 · **Libera:** —
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `npx vitest run src/integrations/supabase/__tests__` → verde; alterando `deals` para `"name"` de propósito, o teste fica vermelho.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 051 — Gravar os resultados obtidos no caminho de contingência da raspagem

**Onda / Severidade / Camada:** 2 / Crítica / Backend
**Achados resolvidos:** G16-1
**Problema hoje:** `supabase/functions/scrape-queue-worker/index.ts:106-144` — a função de contingência consulta o Google Places (serviço **pago**) em `:118`, obtém as linhas e, de `:122` a `:132`, marca a tarefa como concluída com `results_count: rows.length` **sem gravar nenhuma linha** em `scrape_results` ou `companies`. O cliente vê "20 empresas, concluído" e recebe zero empresas. `docs/agentes/servicos-externos.md` registra `scrape_results = 0`.
**Causa raiz:** a gravação dos resultados vive em outra função (`supabase/functions/gmaps-proxy/index.ts:712-731`, ação `sync-results`), que não roda para tarefa já concluída.
**Caminho recomendado:** extraia a gravação de `gmaps-proxy/index.ts:712-731` para um módulo compartilhado em `supabase/functions/_shared/` e chame-o em `completeWithPlacesFallback` **antes** de marcar como concluído, dentro do mesmo fluxo. Grave primeiro, marque depois — se a gravação falhar, a tarefa não deve ser marcada como concluída. O atalho tentador é chamar `gmaps-proxy?action=sync-results` por HTTP de dentro do worker: cria dependência entre funções, refaz a consulta paga (`gmaps-proxy:601-610`) e some com o rastro de erro.
**Arquivos e objetos a tocar:** `supabase/functions/_shared/` (novo módulo), `supabase/functions/scrape-queue-worker/index.ts`, `supabase/functions/gmaps-proxy/index.ts` (passar a usar o módulo).
**Não tocar / armadilhas:** não altere a lógica de disjuntor nem a classificação de erro de `scrape-queue-worker:90-95` — são referência de bom padrão. Garanta que a gravação respeite a organização da tarefa (`task.organization_id`), não o usuário.
**Depende de:** — · **Libera:** 052, 053
**Risco e como reverter:** gravação duplicada se o módulo não tratar conflito; use o padrão de `web-scrape-enqueue:113-123` (inserção com tratamento de conflito). Reverter = `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; grava dados).
**Como verificar:** force o caminho de contingência num ambiente de teste (provedor externo indisponível) e confirme que as linhas aparecem em `scrape_results` e na lista de empresas, com a contagem igual ao `results_count` da tarefa.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 052 — Gravar os resultados no segundo caminho de contingência, dentro do proxy de raspagem

**Onda / Severidade / Camada:** 2 / Alta / Backend
**Achados resolvidos:** G16-1
**Problema hoje:** `supabase/functions/gmaps-proxy/index.ts:506-525` repete o padrão da etapa 051: obtém resultados e marca como concluído sem gravar.
**Causa raiz:** idem.
**Caminho recomendado:** chame o mesmo módulo compartilhado criado na etapa 051.
**Arquivos e objetos a tocar:** `supabase/functions/gmaps-proxy/index.ts`.
**Não tocar / armadilhas:** depois desta etapa, `sync-results` (`:601-610`) não deve mais refazer a consulta paga para tarefas já gravadas — trate na etapa 053.
**Depende de:** 051 · **Libera:** 053
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** mesma verificação da etapa 051, pelo caminho do proxy.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 053 — Parar de pagar duas vezes pela mesma busca na sincronização de resultados

**Onda / Severidade / Camada:** 2 / Alta / Backend · custo
**Achados resolvidos:** G16-1
**Problema hoje:** `supabase/functions/gmaps-proxy/index.ts:601-610` refaz a consulta paga para sincronizar resultados que já foram obtidos.
**Causa raiz:** a sincronização foi escrita como "buscar de novo" em vez de "ler o que já tenho".
**Caminho recomendado:** antes de consultar o provedor, verifique se já existem resultados gravados para a tarefa e, se existirem, apenas reconcilie. Use a chave de idempotência que a função já conhece (`:528-535`) como critério.
**Arquivos e objetos a tocar:** `supabase/functions/gmaps-proxy/index.ts`.
**Não tocar / armadilhas:** o cliente pode querer forçar nova busca — se houver esse caso, exija um parâmetro explícito, não o comportamento padrão.
**Depende de:** 052 · **Libera:** 054
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; afeta custo).
**Como verificar:** chamar a sincronização duas vezes para a mesma tarefa e confirmar, no log, uma única consulta ao provedor.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 054 — Parar de importar jobs de outros clientes do raspador compartilhado

**Onda / Severidade / Camada:** 2 / Alta / Backend · integrações
**Achados resolvidos:** G16-3
**Problema hoje:** `supabase/functions/gmaps-proxy/index.ts:275-303` chama a listagem de jobs do fornecedor **sem credencial** e insere cada job devolvido como se fosse do usuário que pediu, com `user_id` e `organization_id` dele. O cliente passa a ver nome e configuração de buscas de outros clientes do fornecedor.
**Causa raiz:** o endpoint do fornecedor é compartilhado e o código presumiu que a resposta já vinha filtrada.
**Caminho recomendado:** pare de importar em massa. Importe **apenas** os jobs cujo identificador externo já está associado à organização na base local (`scrape_jobs.external_id`), e use a listagem do fornecedor somente para atualizar o estado desses. Se o fornecedor oferecer filtro por cliente ou chave de API, peça a credencial ao dono e use-a (`docs/agentes/servicos-externos.md` tem o contato). O atalho tentador é filtrar pelo nome do job: nomes colidem entre clientes.
**Arquivos e objetos a tocar:** `supabase/functions/gmaps-proxy/index.ts`.
**Não tocar / armadilhas:** jobs criados por essa importação indevida já estão na base dos clientes. Levante com o dono se é preciso limpá-los; **não** apague dado por iniciativa própria — se for preciso, é etapa nova com aprovação.
**Depende de:** 053 · **Libera:** 055
**Risco e como reverter:** clientes podem "perder" jobs que viam (e que não eram deles). Avise na PR. Reverter = `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (produção; dado de cliente).
**Como verificar:** abrir o painel de raspagem com sessão de A e confirmar que só aparecem jobs com identificador externo associado a A.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 055 — Registrar e relatar os jobs importados indevidamente

**Onda / Severidade / Camada:** 2 / Média / Dados
**Achados resolvidos:** G16-3
**Problema hoje:** não se sabe quantos registros entraram nas bases dos clientes pelo caminho da etapa 054.
**Causa raiz:** importação sem marca de origem.
**Caminho recomendado:** **etapa de levantamento, não de alteração.** Monte uma consulta de leitura que conte, por organização, os `scrape_jobs` com `external_id` não nulo cujo padrão indique origem na listagem compartilhada, e entregue o resultado no corpo da pull request (que só altera `05-PROGRESSO.md`). O dono decide o que fazer com eles.
**Arquivos e objetos a tocar:** `docs/qa/05-PROGRESSO.md`.
**Não tocar / armadilhas:** nenhuma escrita em banco.
**Depende de:** 054 · **Libera:** 056
**Risco e como reverter:** nenhum.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** a contagem por organização no corpo da PR.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 056 — Agendar o entregador de webhooks

**Onda / Severidade / Camada:** 2 / Alta / Banco · integrações
**Achados resolvidos:** G16-2
**Problema hoje:** o gatilho de banco enfileira entregas com estado "pendente" (`supabase/migrations/20260422203255_*.sql:113`, gatilhos em `:119-124`), mas nenhuma migration agenda `webhook-dispatcher` — a busca por esse nome em `supabase/migrations/` devolve apenas comentários (`20260718140500_*.sql:2,17`, `20260711192630_*.sql:5`). O único chamador no repositório é o botão de reenvio da interface (`src/hooks/useWebhooks.ts:125`).
**Causa raiz:** o consumidor existe, o agendamento nunca foi criado — ou existe só no banco, sem versionamento.
**Caminho recomendado:** **primeiro confirme no painel** se há agendamento ativo em `cron.job` apontando para `webhook-dispatcher`. Se houver, a correção é só versionar o agendamento existente numa migration, para não se perder. Se não houver, crie o agendamento seguindo exatamente o formato dos 18 já versionados (por exemplo o de `web-scrape-worker-30s`), com intervalo compatível com a espera entre tentativas de `webhook-dispatcher:28-32`. O atalho tentador é chamar o entregador do próprio gatilho de banco: gatilho que faz chamada de rede trava a transação de escrita do cliente.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** o entregador reserva a entrega de forma atômica (`:99-104`), então intervalo curto é seguro — mas confirme antes a etapa 058 (itens travados em "enviando").
**Depende de:** 032 · **Libera:** 057, 058
**Risco e como reverter:** se houver muitas entregas pendentes acumuladas, o primeiro ciclo dispara todas de uma vez. Verifique o volume pendente antes e avise o dono. Reverter = migration que remove o agendamento.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção; dispara envios reais).
**Como verificar:** gerar um evento, não clicar em nada, e confirmar que a entrega sai sozinha dentro de um ciclo do agendamento; conferir o estado final em `webhook_deliveries`.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 057 — Avaliar e comunicar as entregas de webhook acumuladas

**Onda / Severidade / Camada:** 2 / Média / Dados
**Achados resolvidos:** G16-2
**Problema hoje:** se o entregador nunca rodou sozinho, existe um acúmulo de entregas pendentes que a etapa 056 vai disparar de uma vez — potencialmente avisos antigos chegando aos clientes.
**Causa raiz:** fila sem consumidor por tempo indeterminado.
**Caminho recomendado:** **etapa de levantamento.** Conte as entregas por estado e por idade, entregue no corpo da pull request e pergunte ao dono se as antigas devem ser descartadas antes de ligar o agendamento. Execute esta etapa **antes** do merge da 056.
**Arquivos e objetos a tocar:** `docs/qa/05-PROGRESSO.md`.
**Não tocar / armadilhas:** nenhuma escrita.
**Depende de:** — · **Libera:** 056
**Risco e como reverter:** nenhum.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** a contagem por estado e idade no corpo da PR.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 058 — Destravar entregas de webhook presas em "enviando"

**Onda / Severidade / Camada:** 2 / Alta / Banco
**Achados resolvidos:** G17-3
**Problema hoje:** `supabase/functions/webhook-dispatcher/index.ts:99-104` tranca a entrega passando-a para "enviando", e `:74-81` só volta a buscar as em "pendente" e "retentando". Se o processo cair no meio, o item fica preso para sempre. A função que destrava filas (`reap_stuck_queue_tasks`, `supabase/migrations/20260723134028_*.sql`) não cobre essa tabela.
**Causa raiz:** cobertura da função de destrave feita tabela por tabela, à mão.
**Caminho recomendado:** migration que acrescente `webhook_deliveries` à função de destrave, devolvendo ao estado "retentando" os itens em "enviando" há mais de N minutos (use o mesmo N das filas já cobertas). Reaproveite a estrutura existente em vez de criar função nova.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** o prazo precisa ser maior que o tempo-limite da chamada de entrega (`:149-162`), senão o destrave compete com a entrega em curso e gera envio duplicado.
**Depende de:** 056 · **Libera:** 059
**Risco e como reverter:** prazo curto demais duplica envio. Reverter = migration inversa.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** marcar manualmente uma entrega de teste como "enviando" com data antiga e confirmar que o destrave a devolve para "retentando" no ciclo seguinte.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 059 — Destravar itens da fila de enriquecimento de CNPJ presos em "processando"

**Onda / Severidade / Camada:** 2 / Alta / Banco
**Achados resolvidos:** G17-3
**Problema hoje:** `cnpj_enrich_queue` em "processando" não é coberta pela função de destrave (`supabase/migrations/20260723163333_*.sql:118-124` define o estado; a função de destrave não o trata).
**Causa raiz:** idem etapa 058.
**Caminho recomendado:** mesma abordagem da etapa 058, na mesma função.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** o trabalhador de CNPJ tem limite de frequência reservado e espera com variação aleatória (padrão correto) — o prazo de destrave precisa ser maior que o maior tempo de espera possível.
**Depende de:** 058 · **Libera:** 060
**Risco e como reverter:** migration inversa.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** mesmo método da etapa 058, na fila de CNPJ.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 060 — Destravar contatos presos no envio para o Bitrix

**Onda / Severidade / Camada:** 2 / Alta / Banco
**Achados resolvidos:** G17-3
**Problema hoje:** `supabase/functions/oracle-push-bitrix/index.ts:182` coloca o registro em `enrichment_status = 'pushing_bitrix'`, e a expressão `pushing_bitrix` não aparece em nenhuma migration — nada o devolve ao estado anterior se o envio falhar no meio.
**Causa raiz:** estado de trabalho criado no código sem o destrave correspondente no banco.
**Caminho recomendado:** migration que acrescente esse caso à função de destrave, devolvendo ao estado anterior após N minutos. Confirme no painel quantos registros estão nesse estado hoje e informe no corpo da PR.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** o estado anterior precisa ser o correto para o fluxo retomar — leia `oracle-push-bitrix/index.ts` para descobrir qual é, não presuma.
**Depende de:** 059 · **Libera:** 061
**Risco e como reverter:** migration inversa.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** registro de teste nesse estado com data antiga volta ao estado anterior no ciclo seguinte.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 061 — Reservar o destinatário antes de enviar o e-mail da campanha

**Onda / Severidade / Camada:** 2 / Alta / Backend
**Achados resolvidos:** G17-1
**Problema hoje:** `supabase/functions/campaign-dispatch/index.ts:10-11` afirma em comentário que o envio é idempotente pelos estados "pendente"/"enfileirado"; a consulta real de `:209-218` **não** filtra por esses estados e **não reserva nada**. O envio ocorre em `:362-365` e só depois, em `:369`, há a gravação em `campaign_messages`, cujo índice único (`supabase/migrations/20260711164350_*.sql:14-15`) impede o registro duplicado, não o envio. Com o agendamento a cada 10 minutos e execuções sobrepostas, o mesmo destinatário recebe duas vezes.
**Causa raiz:** ordem invertida — envia e depois registra.
**Caminho recomendado:** inverta para reservar-primeiro, exatamente como `supabase/functions/send-scheduled-reports/index.ts:369-382` já faz: insira o registro em `campaign_messages` com estado "enviando" **antes** de chamar o provedor; se o índice único recusar a inserção, significa que outra execução já pegou aquele destinatário, então pule. Depois do envio, atualize o estado. Corrija também o comentário de `:10-11` para descrever o que o código faz.
**Arquivos e objetos a tocar:** `supabase/functions/campaign-dispatch/index.ts`.
**Não tocar / armadilhas:** se o provedor falhar depois da reserva, o registro fica em "enviando" — precisa de destrave, que é a etapa 062. Não altere a assinatura dos links de rastreio (`:349`), que está correta.
**Depende de:** 031 · **Libera:** 062
**Risco e como reverter:** uma falha de implementação aqui pode **impedir** envios legítimos. Teste com uma campanha de teste e dois destinatários antes do merge. Reverter = `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; envio de e-mail).
**Como verificar:** dispare a mesma campanha duas vezes em paralelo num ambiente de teste e confirme um único envio por destinatário no registro do provedor.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 062 — Destravar mensagens de campanha presas em "enviando"

**Onda / Severidade / Camada:** 2 / Alta / Banco
**Achados resolvidos:** G17-1, G17-3
**Problema hoje:** com a reserva da etapa 061, uma falha no meio do envio deixa o registro preso.
**Causa raiz:** novo estado de trabalho exige destrave.
**Caminho recomendado:** acrescente `campaign_messages` à função de destrave, com prazo maior que o tempo-limite de envio. Importante: para e-mail, destravar significa **possivelmente reenviar** — portanto o destrave deve devolver ao estado de pendente **apenas** se não houver confirmação do provedor; se houver dúvida, marque para revisão humana em vez de reenviar. Discuta o critério com o dono e registre na PR.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** reenviar e-mail por engano é pior do que deixar preso. Prefira o estado de revisão.
**Depende de:** 061 · **Libera:** 063
**Risco e como reverter:** migration inversa.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção; envio de e-mail).
**Como verificar:** registro de teste preso com data antiga vai para revisão, não para reenvio automático.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 063 — Ligar o painel de monitoramento real a uma entrada na interface

**Onda / Severidade / Camada:** 2 / Alta / Interface
**Achados resolvidos:** G16-4, G16-5
**Problema hoje:** `src/pages/Monitoring.tsx` tem 736 linhas e cerca de 40 painéis reais (SLA, fila morta, disjuntores, incidentes) na rota `/monitoring`, e **nenhum lugar do sistema tem link para ela** — a busca por `navigate()`, `to=`, `href=` e `window.location.href` em `src/` devolve apenas `/`, `/login` e `/?view=lusha`.
**Causa raiz:** a tela foi criada como rota enquanto o restante do sistema usa views dentro de `/`.
**Caminho recomendado:** acrescente um item de menu apontando para `/monitoring` em `src/components/lux/layout/nav-items.ts`, seguindo o formato dos itens existentes, e restrinja-o a administrador (ver etapa 253). Não transforme a página em view do registry nesta etapa — seria mudança de arquitetura; a rota já existe e funciona.
**Arquivos e objetos a tocar:** `src/components/lux/layout/nav-items.ts`, possivelmente `src/components/lux/layout/Sidebar.tsx` se o menu precisar distinguir rota de view.
**Não tocar / armadilhas:** a página tem texto corrompido (etapa 251) e nenhum portão de permissão (etapa 253) — ao torná-la visível, essas duas etapas ficam urgentes. Faça as três na mesma onda e nesta ordem: 063 → 251 → 253, ou inverta para 253 primeiro se preferir não expor antes de proteger.
**Depende de:** — · **Libera:** 064, 251, 253
**Risco e como reverter:** expor uma tela sem portão de permissão; por isso avalie fazer a 253 antes. Reverter = `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** entrar como administrador, clicar no novo item e chegar em `/monitoring` com os painéis carregando.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 064 — Trocar os indicadores fictícios da tela "Status do Sistema" por dados reais

**Onda / Severidade / Camada:** 2 / Alta / Interface
**Achados resolvidos:** G16-4
**Problema hoje:** `src/components/lux/monitoring/MonitoringView.tsx` — a tela que o item de menu abre — tem `:31-33` `// for now mock success → return { status: "healthy" }`, `:51` `// Simulated metrics for demonstration`, valores fixos em `:84,95,106,117` (124 ms, 99,98%, 0,02%, 100%) e quatro funções com estado "online" escrito à mão em `:188-191`. O selo verde "Sistemas Operacionais" de `:70` deriva disso e **nunca** fica vermelho.
**Causa raiz:** tela entregue com dados de demonstração e nunca ligada às fontes reais.
**Caminho recomendado:** as fontes reais já existem e estão em uso em `src/pages/Monitoring.tsx`: reaproveite os mesmos hooks (procure por `useApiLatency`, `useAutomationsMonitor`, `useDlqItems` e os painéis de SLA naquele arquivo) em vez de criar consultas novas. Comece pelo selo de `:70`: faça-o derivar do pior estado entre as fontes reais. Enquanto uma fonte não existir, mostre "sem dados" — **nunca** verde por omissão. O atalho tentador é apagar a tela e mandar todo mundo para `/monitoring`: é mudança de arquitetura, não cabe numa etapa; se o dono quiser isso, vira decisão dele.
**Arquivos e objetos a tocar:** `src/components/lux/monitoring/MonitoringView.tsx`.
**Não tocar / armadilhas:** não toque em `src/pages/Monitoring.tsx` nesta etapa. A frase "Visualização de mapa em desenvolvimento" de `:202` é tratada na etapa 265.
**Depende de:** 063 · **Libera:** 065, 265
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** desligue uma das fontes num ambiente de teste e confirme que o selo deixa de ficar verde.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 065 — Remover o estado "online" escrito à mão das quatro funções no painel de status

**Onda / Severidade / Camada:** 2 / Média / Interface
**Achados resolvidos:** G16-4
**Problema hoje:** `src/components/lux/monitoring/MonitoringView.tsx:188-191` lista quatro funções com estado fixo "online".
**Causa raiz:** idem etapa 064.
**Caminho recomendado:** ou consulte o estado real (a função `health`, depois da etapa 035, responde o corpo completo para administrador), ou **remova a seção**. Mostrar quatro nomes sempre verdes é pior do que não mostrar nada.
**Arquivos e objetos a tocar:** `src/components/lux/monitoring/MonitoringView.tsx`.
**Não tocar / armadilhas:** se consultar a função `health`, respeite o portão de permissão criado na etapa 035.
**Depende de:** 064, 035 · **Libera:** 066
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** com uma das funções indisponível, o painel não mostra "online".
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 066 — Criar entrada de menu para as configurações de CNPJ

**Onda / Severidade / Camada:** 2 / Alta / Interface
**Achados resolvidos:** G16-5
**Problema hoje:** `src/App.tsx:232` declara `/settings/cnpj`, que guarda a credencial da CNPJá e o interruptor que **controla custo de enriquecimento**, e nada no sistema leva até lá.
**Causa raiz:** rota criada sem ponto de entrada.
**Caminho recomendado:** acrescente o acesso dentro da tela de configurações existente (`src/components/lux/SettingsView.tsx`), como item ou aba, em vez de um item novo no menu principal — é onde o usuário procura. Restrinja a administrador.
**Arquivos e objetos a tocar:** `src/components/lux/SettingsView.tsx`.
**Não tocar / armadilhas:** a página em si (`src/pages/CnpjSettingsPage.tsx`) não precisa mudar.
**Depende de:** 063 · **Libera:** 067
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** administrador chega em `/settings/cnpj` pela interface, sem digitar o endereço.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 067 — Criar entrada de menu para a administração de empresas

**Onda / Severidade / Camada:** 2 / Média / Interface
**Achados resolvidos:** G16-5
**Problema hoje:** `src/App.tsx:242` declara `/admin/companies`, que lista empresas de **todas** as organizações, e não há caminho até ela.
**Causa raiz:** idem.
**Caminho recomendado:** item de menu visível apenas para quem tem papel de administrador — use `useCan` / `PermissionGate` como `src/components/lux/DealsView.tsx` já faz. A página já valida o papel no backend (`supabase/functions/admin-list-companies/index.ts:30-35`), então a restrição na interface é só para não prometer o que o usuário não pode.
**Arquivos e objetos a tocar:** `src/components/lux/layout/nav-items.ts`, `src/components/lux/layout/Sidebar.tsx`.
**Não tocar / armadilhas:** não remova a validação do backend.
**Depende de:** 066 · **Libera:** 068
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** administrador vê o item; `viewer` e `sdr` não.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 068 — Decidir e aplicar o destino da página pública de status

**Onda / Severidade / Camada:** 2 / Baixa / Interface
**Achados resolvidos:** G16-5
**Problema hoje:** `src/App.tsx:260` declara `/status`, pública, sem link em lugar nenhum.
**Causa raiz:** página criada para ser divulgada externamente e nunca divulgada.
**Caminho recomendado:** pergunte ao dono se a página deve ser pública (então o link vai no rodapé da tela de login, e a etapa é de uma linha) ou se deve deixar de existir (então vira remoção, e aí é a etapa 296, de código morto). Não decida sozinho: é escolha de produto.
**Arquivos e objetos a tocar:** `src/components/lux/auth/LoginCard.tsx` (se for divulgar) ou nada (se for remover; vai para a etapa 296).
**Não tocar / armadilhas:** a página consulta dados de saúde — confirme que não expõe nada interno antes de divulgá-la.
**Depende de:** 067 · **Libera:** 296
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (decisão de produto; expõe página pública).
**Como verificar:** decisão registrada na PR e aplicada.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 069 — Ligar o botão "Nova" da lista de automações do painel inicial

**Onda / Severidade / Camada:** 2 / Alta / Interface
**Achados resolvidos:** G16-6
**Problema hoje:** `src/components/lux/AutomationsList.tsx` — usado no painel inicial (`src/components/lux/DashboardView.tsx:235`) — não tem nenhuma ocorrência de `onClick`, `onSubmit` ou `handle` no arquivo. O botão "Nova" de `:86` não faz nada.
**Causa raiz:** componente entregue só com a parte visual.
**Caminho recomendado:** receba uma função de navegação por propriedade, como `DashboardView` já faz com `onNavigate`, e aponte para a view de fluxos (`?view=workflows`). Não abra formulário dentro do painel: a tela de fluxos já tem o fluxo de criação.
**Arquivos e objetos a tocar:** `src/components/lux/AutomationsList.tsx`, `src/components/lux/DashboardView.tsx`.
**Não tocar / armadilhas:** `src/components/lux/__tests__/DashboardView.test.tsx:81` substitui esse componente por um dublê — por isso nenhum dos 987 testes cobre o botão. Ajuste o dublê ou crie teste próprio (etapa 073).
**Depende de:** — · **Libera:** 070, 073
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** clicar em "Nova" no painel leva à tela de fluxos.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 070 — Ligar ou remover os controles de pausar e recarregar da lista de automações

**Onda / Severidade / Camada:** 2 / Alta / Interface
**Achados resolvidos:** G16-6
**Problema hoje:** `src/components/lux/AutomationsList.tsx:162` (pausar/retomar), `:165` (recarregar) e `:128` (linha com cursor de clique) não têm ação.
**Causa raiz:** idem etapa 069.
**Caminho recomendado:** para pausar/retomar, reutilize a mutação que já existe em `src/components/lux/WorkflowsView.tsx:95-104` em vez de escrever outra — e, ao reutilizar, lembre que ela não trata erro (etapa 215). Para recarregar, chame `refetch` da própria consulta. Para a linha, navegue para a tela de fluxos com o item selecionado. Se o dono preferir painel só de leitura, **remova** os três controles — botão que não faz nada é pior que botão ausente.
**Arquivos e objetos a tocar:** `src/components/lux/AutomationsList.tsx`.
**Não tocar / armadilhas:** em modo demonstração os dados são fictícios; esconda as ações como `src/components/lux/CampaignsView.tsx:406` faz com `!isDemoMode`.
**Depende de:** 069 · **Libera:** 071, 073
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** pausar um fluxo pelo painel e conferir o estado novo após recarregar a página.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 071 — Fazer aparecer o botão "Criar Workflow" para quem ainda não tem nenhum

**Onda / Severidade / Camada:** 2 / Alta / Interface
**Achados resolvidos:** G16-6
**Problema hoje:** `src/components/lux/AutomationsList.tsx:105-110` passa `actionLabel="Criar Workflow"` **sem** `onAction`; pelo contrato de `src/components/lux/EmptyState.tsx:40-44`, o botão não é renderizado. Um cliente novo não tem caminho nenhum para criar o primeiro fluxo.
**Causa raiz:** contrato do componente de estado vazio exige as duas propriedades, e só uma foi passada.
**Caminho recomendado:** passe `onAction` reaproveitando a navegação da etapa 069. Considere também tornar o contrato explícito em `EmptyState.tsx` (tipo que exija as duas juntas), para o erro não se repetir — é mudança pequena no mesmo tema.
**Arquivos e objetos a tocar:** `src/components/lux/AutomationsList.tsx`, opcionalmente `src/components/lux/EmptyState.tsx`.
**Não tocar / armadilhas:** procure outros usos de `actionLabel` sem `onAction` (`grep -rn "actionLabel" src/`) — podem existir mais casos do mesmo defeito.
**Depende de:** 069 · **Libera:** 072
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** com conta sem nenhum fluxo, o botão aparece no painel e leva à criação.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 072 — Varrer o repositório por outros estados vazios sem ação

**Onda / Severidade / Camada:** 2 / Média / Interface
**Achados resolvidos:** G16-6
**Problema hoje:** o defeito da etapa 071 é silencioso por natureza — nada avisa.
**Causa raiz:** idem.
**Caminho recomendado:** `grep -rn "actionLabel" src/` e conferir caso a caso. Corrija só os que estiverem sem `onAction`.
**Arquivos e objetos a tocar:** os componentes apontados.
**Não tocar / armadilhas:** estado vazio que legitimamente não oferece ação deve deixar de passar `actionLabel`, não ganhar uma ação inventada.
**Depende de:** 071 · **Libera:** 073
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** lista dos casos encontrados e o que foi feito em cada um, no corpo da PR.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 073 — Cobrir a lista de automações do painel com teste de verdade

**Onda / Severidade / Camada:** 2 / Média / Testes
**Achados resolvidos:** G16-6
**Problema hoje:** `src/components/lux/__tests__/DashboardView.test.tsx:81` substitui `AutomationsList` por um dublê, então os botões mortos passaram por 987 testes.
**Causa raiz:** dublê usado para simplificar o teste do painel, escondendo o componente real.
**Caminho recomendado:** crie um teste próprio para `AutomationsList` que renderize o componente de verdade e verifique que cada controle visível dispara a ação esperada. Não remova o dublê do teste do painel — ele existe por um motivo (isolar a unidade).
**Arquivos e objetos a tocar:** novo arquivo em `src/components/lux/__tests__/`.
**Não tocar / armadilhas:** o componente consulta dados; use o padrão de dublê de consulta já adotado nos testes vizinhos.
**Depende de:** 069, 070, 071 · **Libera:** —
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `npx vitest run src/components/lux/__tests__` → verde; removendo a ação de um botão de propósito, o teste fica vermelho.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 074 — Ligar a ação "Visitar Site" no detalhe da empresa

**Onda / Severidade / Camada:** 2 / Média / Interface
**Achados resolvidos:** G16-6
**Problema hoje:** `src/components/lux/CompanyDetailModal.tsx:430-447` tem cinco ações sem efeito; "Visitar Site" nem abre `company.website`.
**Causa raiz:** bloco de ações entregue como maquete.
**Caminho recomendado:** comece pela mais simples e sem dependência: abra `company.website` em nova aba, validando o endereço (aceite só `http`/`https`, use `rel="noopener noreferrer"`). Se o campo estiver vazio, desabilite o botão com explicação.
**Arquivos e objetos a tocar:** `src/components/lux/CompanyDetailModal.tsx`.
**Não tocar / armadilhas:** o campo pode vir sem esquema (`www.exemplo.com`) — normalize antes de abrir, nunca concatene sem validar.
**Depende de:** — · **Libera:** 075, 076, 077, 078
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** empresa com site abre em nova aba; empresa sem site mostra o botão desabilitado.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 075 — Ligar a ação "Enriquecer" no detalhe da empresa

**Onda / Severidade / Camada:** 2 / Média / Interface
**Achados resolvidos:** G16-6
**Problema hoje:** o botão "Enriquecer" de `src/components/lux/CompanyDetailModal.tsx:430-447` não tem ação, embora o enriquecimento exista e funcione na lista (`src/components/lux/CompaniesView.tsx`, ação em lote).
**Causa raiz:** idem etapa 074.
**Caminho recomendado:** reutilize o hook de enriquecimento já usado na lista (`useCnpjEnrich`), com estados de carregando e erro, em vez de chamar a função diretamente.
**Arquivos e objetos a tocar:** `src/components/lux/CompanyDetailModal.tsx`.
**Não tocar / armadilhas:** o enriquecimento custa dinheiro; confirme que o botão não dispara em duplo clique (desabilite durante a chamada).
**Depende de:** 074 · **Libera:** 076
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** clicar em "Enriquecer" preenche os dados da empresa e mostra o estado de carregando.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 076 — Ligar ou remover a ação "Adicionar ao CRM" no detalhe da empresa

**Onda / Severidade / Camada:** 2 / Média / Interface
**Achados resolvidos:** G16-6
**Problema hoje:** botão sem ação em `src/components/lux/CompanyDetailModal.tsx:430-447`.
**Causa raiz:** idem.
**Caminho recomendado:** o equivalente existente no sistema é criar um negócio a partir da empresa. Se for isso, reutilize `useDeals` (atenção: a criação tem o defeito de organização da etapa 110 — faça depois dela). Se "CRM" significa Bitrix, a função existe (`supabase/functions/oracle-push-bitrix`) e o caminho é outro: confirme com o dono qual dos dois antes de implementar. Se nenhum fizer sentido, **remova o botão**.
**Arquivos e objetos a tocar:** `src/components/lux/CompanyDetailModal.tsx`.
**Não tocar / armadilhas:** não invente um terceiro caminho.
**Depende de:** 075, 110 · **Libera:** 077
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (decisão de produto).
**Como verificar:** a ação escolhida funciona de ponta a ponta, ou o botão não existe mais.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 077 — Ligar ou remover a ação "Enviar Email" no detalhe da empresa

**Onda / Severidade / Camada:** 2 / Média / Interface
**Achados resolvidos:** G16-6
**Problema hoje:** botão sem ação em `src/components/lux/CompanyDetailModal.tsx:430-447`.
**Causa raiz:** idem.
**Caminho recomendado:** a opção simples e honesta é abrir o cliente de e-mail do usuário (`mailto:`) com o endereço da empresa; a opção completa é abrir o fluxo de campanha com a empresa já selecionada. Escolha a simples se o fluxo de campanha exigir seleção de sequência — prometer menos e entregar é melhor. Se a empresa não tem e-mail, desabilite com explicação.
**Arquivos e objetos a tocar:** `src/components/lux/CompanyDetailModal.tsx`.
**Não tocar / armadilhas:** não dispare envio direto pelo sistema sem passar pelo fluxo de campanha — isso contorna descadastro e rastreio.
**Depende de:** 076 · **Libera:** 078
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** o botão abre o caminho escolhido; empresa sem e-mail mostra o botão desabilitado.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 078 — Ligar ou remover a ação "Iniciar Sequência" no detalhe da empresa

**Onda / Severidade / Camada:** 2 / Média / Interface
**Achados resolvidos:** G16-6
**Problema hoje:** botão sem ação em `src/components/lux/CompanyDetailModal.tsx:430-447`.
**Causa raiz:** idem.
**Caminho recomendado:** se houver sequência de campanha configurada, abra a tela de campanhas com a empresa pré-selecionada; caso contrário, remova. Última das cinco ações — depois dela, nenhum botão morto deve restar no detalhe da empresa.
**Arquivos e objetos a tocar:** `src/components/lux/CompanyDetailModal.tsx`.
**Não tocar / armadilhas:** confirme com `grep` que nenhum outro botão do arquivo ficou sem ação.
**Depende de:** 077 · **Libera:** 079
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** nenhum botão do detalhe da empresa fica sem resposta ao clique.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 079 — Fazer o ícone "Ver detalhes" funcionar na versão de computador da lista

**Onda / Severidade / Camada:** 2 / Média / Interface
**Achados resolvidos:** G16-6
**Problema hoje:** `src/components/lux/CompanyTableRow.tsx:141` — o ícone de olho não tem `onClick` na versão de computador, e a célula em `:139` bloqueia a propagação do clique da linha. A versão de celular (`:163`) funciona.
**Causa raiz:** o bloqueio de propagação foi colocado para a célula de ações e engoliu o único caminho do ícone.
**Caminho recomendado:** dê ao ícone o mesmo manipulador que a versão de celular usa em `:163`. Mantenha o bloqueio de propagação da célula (ele existe para os outros botões).
**Arquivos e objetos a tocar:** `src/components/lux/CompanyTableRow.tsx`.
**Não tocar / armadilhas:** não remova o bloqueio de propagação; isso faria todos os botões da célula abrirem o detalhe junto.
**Depende de:** 078 · **Libera:** 080
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** clicar no olho em tela larga abre o detalhe; os outros botões da linha continuam funcionando sem abrir o detalhe.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 080 — Varrer o repositório por botões sem manipulador

**Onda / Severidade / Camada:** 2 / Média / Interface
**Achados resolvidos:** G16-6
**Problema hoje:** a auditoria confirmou nove, conferidos linha a linha, mas a varredura automática produz muitos falsos positivos (botão que recebe ação por componente acionador, botão de envio de formulário).
**Causa raiz:** ausência de verificação.
**Caminho recomendado:** varra `<Button` sem `onClick`, `type="submit"` e sem estar dentro de `DialogTrigger`/`PopoverTrigger`/`SheetTrigger`/`DropdownMenuTrigger` com `asChild`. Confirme cada candidato lendo o código antes de afirmar — a auditoria descartou cerca de 20 falsos positivos exatamente assim. Entregue a lista na PR e corrija só os confirmados.
**Arquivos e objetos a tocar:** os componentes confirmados.
**Não tocar / armadilhas:** não acrescente ação inventada a botão decorativo; se for decorativo, deve virar texto, não botão.
**Depende de:** 079 · **Libera:** 081
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** lista na PR separando confirmados de falsos positivos, com o motivo de cada descarte.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 081 — Corrigir o teste de interface que quebra por rótulo ambíguo

**Onda / Severidade / Camada:** 2 / Média / Testes
**Achados resolvidos:** G2-3
**Problema hoje:** `e2e/navigation.spec.ts:22` usa `getByText('Criar Conta')`, que casa com dois elementos (a aba e o botão de envio) e viola o modo estrito do Playwright. Medido na auditoria: o caso falha.
**Causa raiz:** seletor por texto em tela que repete o mesmo texto em papéis diferentes.
**Caminho recomendado:** troque por seletor com papel: `getByRole("tab", { name: "Criar Conta" })` para a aba, como a própria linha 23 já faz para "Entrar".
**Arquivos e objetos a tocar:** `e2e/navigation.spec.ts`.
**Não tocar / armadilhas:** não altere a tela de login para "resolver" o teste — o produto está certo, o teste é que está frágil.
**Depende de:** — · **Libera:** 082
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `npx playwright test navigation.spec.ts` → o caso passa.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 082 — Confirmar que o teste do painel de monitoramento volta a passar

**Onda / Severidade / Camada:** 2 / Baixa / Testes
**Achados resolvidos:** G2-3, G3-1
**Problema hoje:** `e2e/monitoring-navigation.spec.ts:21` procura o título "Monitoramento de Automações" e não encontra, porque o texto renderizado está corrompido (etapa 251).
**Causa raiz:** o teste está certo; o produto é que mostra texto quebrado.
**Caminho recomendado:** **não altere o teste.** Esta etapa é a confirmação após a etapa 251: rode a suíte e registre o resultado. Se ainda falhar, a correção de encoding não pegou todas as ocorrências.
**Arquivos e objetos a tocar:** nenhum (só `05-PROGRESSO.md`).
**Não tocar / armadilhas:** o impulso de "ajustar o seletor para o texto corrompido" seria congelar o defeito.
**Depende de:** 251 · **Libera:** —
**Risco e como reverter:** nenhum.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `npx playwright test monitoring-navigation.spec.ts` → passa.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 083 — Incluir o estado de demonstração na chave de cache das campanhas

**Onda / Severidade / Camada:** 2 / Alta / Hooks · cache
**Achados resolvidos:** G4-1
**Problema hoje:** `src/components/lux/CampaignsView.tsx:101` usa a chave `["campaigns"]` enquanto `:102` ramifica a busca em `isDemoMode`. Quem explorou a demonstração e entrou na conta na mesma aba pode ver campanhas de exemplo como se fossem suas.
**Causa raiz:** o estado de demonstração influencia o resultado e não faz parte da identidade do cache.
**Caminho recomendado:** acrescente `isDemoMode` à chave, como `src/components/lux/AutomationsList.tsx:54` e `src/components/lux/EnrichmentFunnel.tsx:35` já fazem. Atualize as invalidações correspondentes (`:137`, `:161`).
**Arquivos e objetos a tocar:** `src/components/lux/CampaignsView.tsx`.
**Não tocar / armadilhas:** esquecer de atualizar a invalidação faz a lista parar de se atualizar após criar campanha.
**Depende de:** — · **Libera:** 084, 085, 086, 087, 088, 089
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** entrar na demonstração, sair, entrar na conta na mesma aba e confirmar que nenhuma campanha de exemplo aparece.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 084 — Incluir o estado de demonstração na chave de cache da lista de empresas

**Onda / Severidade / Camada:** 2 / Alta / Hooks · cache
**Achados resolvidos:** G4-1
**Problema hoje:** `src/components/lux/CompaniesView.tsx:76` usa `["companies-list"]` com busca que ramifica em `:77`.
**Causa raiz:** idem etapa 083.
**Caminho recomendado:** idem; atualize as invalidações de `:192-193` e `:207`.
**Arquivos e objetos a tocar:** `src/components/lux/CompaniesView.tsx`.
**Não tocar / armadilhas:** esta é a lista mais usada do sistema — confirme que criar, editar e excluir continuam atualizando a tela.
**Depende de:** 083 · **Libera:** 085
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** mesma verificação da etapa 083, na lista de empresas.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 085 — Incluir o estado de demonstração na chave dos sinais de intenção

**Onda / Severidade / Camada:** 2 / Média / Hooks · cache
**Achados resolvidos:** G4-1
**Problema hoje:** `src/components/lux/IntentSignalsView.tsx:58` usa `["intent-signals"]`, busca ramifica em `:59`.
**Causa raiz:** idem.
**Caminho recomendado:** idem; invalidações em `:87` e `:108`.
**Arquivos e objetos a tocar:** `src/components/lux/IntentSignalsView.tsx`.
**Não tocar / armadilhas:** —
**Depende de:** 084 · **Libera:** 086
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** idem etapa 083, nesta tela.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 086 — Incluir o estado de demonstração na chave dos fluxos automatizados

**Onda / Severidade / Camada:** 2 / Média / Hooks · cache
**Achados resolvidos:** G4-1
**Problema hoje:** `src/components/lux/WorkflowsView.tsx:61` usa `["workflows"]`, busca ramifica em `:62`.
**Causa raiz:** idem.
**Caminho recomendado:** idem; invalidações em `:85` e `:91`.
**Arquivos e objetos a tocar:** `src/components/lux/WorkflowsView.tsx`.
**Não tocar / armadilhas:** não altere as mutações nesta etapa (tratamento de erro é a etapa 215).
**Depende de:** 085 · **Libera:** 087
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** idem etapa 083, nesta tela.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 087 — Incluir o estado de demonstração na chave dos contatos

**Onda / Severidade / Camada:** 2 / Média / Hooks · cache
**Achados resolvidos:** G4-1
**Problema hoje:** `src/components/lux/StakeholderFinderView.tsx:64` usa `["stakeholders"]`, busca ramifica em `:65`.
**Causa raiz:** idem.
**Caminho recomendado:** idem.
**Arquivos e objetos a tocar:** `src/components/lux/StakeholderFinderView.tsx`.
**Não tocar / armadilhas:** —
**Depende de:** 086 · **Libera:** 088
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** idem etapa 083, nesta tela.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 088 — Incluir o estado de demonstração na chave das notificações

**Onda / Severidade / Camada:** 2 / Média / Hooks · cache
**Achados resolvidos:** G4-1
**Problema hoje:** `src/components/lux/NotificationsPanel.tsx:66` usa a constante `NOTIFICATIONS_KEY`, busca ramifica em `:67`.
**Causa raiz:** idem.
**Caminho recomendado:** transforme a constante em função que recebe o estado de demonstração, para não quebrar as invalidações de `:95-96` que a referenciam.
**Arquivos e objetos a tocar:** `src/components/lux/NotificationsPanel.tsx` e quem mais importar a constante (`grep -rn "NOTIFICATIONS_KEY" src/`).
**Não tocar / armadilhas:** o contador de notificações (`src/hooks/useNotificationCount.ts`) usa chave própria — ajuste junto se compartilhar a identidade.
**Depende de:** 087 · **Libera:** 089
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** idem etapa 083, no painel de notificações.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 089 — Limpar o cache ao entrar e ao sair do modo demonstração

**Onda / Severidade / Camada:** 2 / Alta / Estado
**Achados resolvidos:** G4-1
**Problema hoje:** `src/pages/Login.tsx:17-20` entra na demonstração e navega sem recarregar; `src/components/lux/DashboardView.tsx:269-272` sai e navega para `/login`, também sem recarregar e **sem** limpar o cache. As etapas 083–088 cobrem as seis telas conhecidas; esta fecha a classe inteira.
**Causa raiz:** troca de contexto de dados sem limpar o cache.
**Caminho recomendado:** chame `queryClient.clear()` dentro de `enterDemo` e `exitDemo`, em `src/contexts/DemoContext.tsx`, usando o cliente já registrado em `src/lib/orgErrorHandler.ts` (`registerQueryClient`, chamado em `src/App.tsx:84`) — assim o contexto não precisa importar o cliente direto. Mesmo com as chaves corrigidas, limpar é a rede de segurança para a próxima tela que esquecer.
**Arquivos e objetos a tocar:** `src/contexts/DemoContext.tsx`, possivelmente `src/lib/orgErrorHandler.ts` para expor o acesso.
**Não tocar / armadilhas:** limpar o cache durante a navegação pode causar um instante de carregamento — aceitável nesse ponto.
**Depende de:** 083, 084, 085, 086, 087, 088 · **Libera:** 090
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** entrar na demonstração, navegar por várias telas, sair, entrar na conta: nenhuma tela mostra dado de exemplo em momento algum.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 090 — Dar estado de demonstração às telas que não têm

**Onda / Severidade / Camada:** 2 / Média / Interface
**Achados resolvidos:** G6-2, G4-2
**Problema hoje:** apenas 9 arquivos tratam o modo demonstração; 14 views não têm dados de exemplo (perfil ideal, agente de IA, análises, configurações, raspador, resultados, mapa, organizações, negócios, integrações, violações, lixeira, descadastros, Lusha), e `/monitoring` também não. O visitante encontra telas vazias sem explicação.
**Causa raiz:** modo demonstração implementado tela a tela.
**Caminho recomendado:** não crie dados de exemplo para 15 telas — é trabalho grande e de pouco valor. Em vez disso, crie **um** componente de aviso ("esta área não está disponível na demonstração; crie uma conta para usá-la") e mostre-o nessas telas quando o modo estiver ativo. Siga o padrão visual de `src/components/lux/EmptyState.tsx`. Se o dono preferir dados de exemplo em alguma tela específica, isso vira etapa própria.
**Arquivos e objetos a tocar:** novo componente em `src/components/lux/`, mais as 15 telas (uma linha cada).
**Não tocar / armadilhas:** não bloqueie a navegação; o visitante deve conseguir ver que a área existe.
**Depende de:** 089 · **Libera:** 091
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** na demonstração, cada uma das 15 telas mostra o aviso em vez de tela vazia.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 091 — Mostrar o aviso e o botão de sair da demonstração em todas as telas

**Onda / Severidade / Camada:** 2 / Baixa / Interface
**Achados resolvidos:** G4-2
**Problema hoje:** o aviso de modo demonstração e o botão de sair existem **só** no painel inicial (`src/components/lux/DashboardView.tsx:270,277`). Em qualquer outra tela o visitante não sabe que está na demonstração nem como sair.
**Causa raiz:** aviso colocado na tela, não no layout.
**Caminho recomendado:** mova o aviso para o layout que envolve todas as views (`src/pages/Index.tsx` ou o componente de cabeçalho), junto de `OrgErrorBanner`, que já é global em `src/App.tsx:311`.
**Arquivos e objetos a tocar:** `src/pages/Index.tsx` ou o cabeçalho, `src/components/lux/DashboardView.tsx` (remover a duplicata).
**Não tocar / armadilhas:** não deixe o aviso duplicado no painel.
**Depende de:** 090 · **Libera:** 092
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** o aviso aparece em todas as 23 telas durante a demonstração, com o botão de sair funcionando.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 092 — Decidir com o dono se a demonstração deve continuar liberando as rotas protegidas

**Onda / Severidade / Camada:** 2 / Média / Interface · segurança
**Achados resolvidos:** G4-2
**Problema hoje:** `src/App.tsx:145` — `if (isDemoMode) return <>{children}</>;` vem antes de qualquer checagem de sessão, e o modo é ligado por uma chave no navegador (`src/contexts/DemoContext.tsx:5-12`). Isso libera `/admin/companies`, `/monitoring` e `/settings/cnpj` sem conta.
**Causa raiz:** o estado de demonstração tem precedência sobre o guarda de rota.
**Caminho recomendado:** a correção mínima é manter a demonstração apenas para a rota `/` e suas views, exigindo sessão nas demais: troque a liberação geral por uma lista das rotas que a demonstração cobre. **Não** remova a demonstração — é recurso de vendas e os testes de interface dependem dela (`e2e/helpers/auth.ts:7`). Leve as duas opções ao dono antes de escrever código.
**Arquivos e objetos a tocar:** `src/App.tsx`.
**Não tocar / armadilhas:** mudar isso quebra os testes de interface que navegam para `/monitoring` em modo demonstração (`e2e/monitoring-navigation.spec.ts`) — ajuste-os na mesma pull request.
**Depende de:** 091 · **Libera:** —
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (decisão de produto e de segurança).
**Como verificar:** com o modo ligado pelo navegador, `/admin/companies` redireciona para `/login`; `/` continua funcionando na demonstração.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

---

## ONDA 3 — Integridade de dados e regras de negócio (093–142)

### Etapa 093 — Fazer o cálculo de pontuação ler o formato que a tela de perfil ideal grava

**Onda / Severidade / Camada:** 3 / Crítica / Regras de negócio
**Achados resolvidos:** G28-1
**Problema hoje:** a tela grava os critérios como **lista** de objetos com identificador, valor e peso (`src/hooks/useICPConfig.ts:10-16,27-32`), e o cálculo lê um **objeto** com as chaves `sectors` e `locations` (`supabase/functions/_shared/domain/ipc/scoring.ts:14-17,24-37`). Como a lista é um valor "verdadeiro", nem o caminho alternativo `else { score = 50 }` de `:39-42` executa: setor e local somam **zero** e o teto real da pontuação é 50. Como os limites de "qualificado" usados no sistema são 60, 70 e 75, **nenhuma empresa raspada é qualificada**.
**Causa raiz:** dois formatos para a mesma informação, sem contrato comum nem validação.
**Caminho recomendado:** crie uma função de tradução única — por exemplo `normalizarCriterios(raw): IPCHittingCriteria` — em `supabase/functions/_shared/domain/ipc/`, que aceite **os dois** formatos (lista nova e objeto antigo) e devolva sempre o objeto que o cálculo espera, extraindo `sectors` do critério de identificador `sector` e `locations` do de identificador `location`. Chame-a nos dois pontos de entrada: `scoring.ts` (antes de usar `criteria`) e `supabase/functions/workflow-engine/index.ts:505-506`. Aceitar os dois formatos é obrigatório porque pode haver registro gravado em cada um deles em produção — **não** faça migração de dados nesta etapa. O atalho tentador é mudar a tela para gravar o formato antigo: isso descarta os pesos e as faixas que o usuário já configurou.
**Arquivos e objetos a tocar:** novo módulo em `supabase/functions/_shared/domain/ipc/`, `supabase/functions/_shared/domain/ipc/scoring.ts`, `supabase/functions/workflow-engine/index.ts`.
**Não tocar / armadilhas:** **não** mude os pesos nem acrescente critérios novos ao cálculo nesta etapa (isso é 095 e 096). Esta etapa só faz setor e local voltarem a pontuar. Confirme antes, no painel, em que formato os registros de `ipc_config.criteria` estão hoje — se estiverem todos no formato de lista, registre isso na PR.
**Depende de:** 014 · **Libera:** 094, 095, 096, 097
**Risco e como reverter:** as pontuações passam a mudar; empresas que estavam em 50 podem ir a 100. Avise o dono de que os números do painel vão se mover. Reverter = `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; altera pontuação de todas as empresas novas).
**Como verificar:** teste de unidade novo em `supabase/functions/_shared/domain/ipc/__tests__/` alimentando a função com o formato de lista real (copie `DEFAULT_CRITERIA` de `src/hooks/useICPConfig.ts:27-32`) e conferindo que uma empresa de setor correspondente recebe os 30 pontos.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 094 — Cobrir o cálculo de pontuação com teste no formato real da tela

**Onda / Severidade / Camada:** 3 / Alta / Testes
**Achados resolvidos:** G28-1
**Problema hoje:** `supabase/functions/_shared/domain/ipc/__tests__/scoring.test.ts:12-94` exercita somente o formato de objeto — o que a tela **não** produz. Por isso o defeito da etapa 093 sobreviveu a 987 testes.
**Causa raiz:** teste escrito a partir da assinatura da função, não do dado real.
**Caminho recomendado:** acrescente casos usando exatamente a estrutura de `DEFAULT_CRITERIA` (`src/hooks/useICPConfig.ts:27-32`). Mantenha os casos existentes: os dois formatos precisam continuar funcionando.
**Arquivos e objetos a tocar:** `supabase/functions/_shared/domain/ipc/__tests__/scoring.test.ts`.
**Não tocar / armadilhas:** não apague os casos antigos.
**Depende de:** 093 · **Libera:** 095
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `npx vitest run supabase/functions/_shared/domain/ipc` → verde, com os novos casos presentes.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 095 — Unificar a fórmula de pontuação entre os dois caminhos

**Onda / Severidade / Camada:** 3 / Alta / Regras de negócio
**Achados resolvidos:** G28-1
**Problema hoje:** duas fórmulas divergentes para a mesma pontuação: `supabase/functions/_shared/domain/ipc/scoring.ts:24-37` dá setor +30 / sem correspondência +0 / local +20 / sem correspondência +0; `supabase/functions/workflow-engine/index.ts:517-545` dá setor +30 / +5, sem critério +15, local +25 / +5, sem critério +10, mais avaliações acima de 50 +5. A mesma empresa recebe notas diferentes dependendo do caminho.
**Causa raiz:** a lógica foi copiada e evoluiu em um dos lados.
**Caminho recomendado:** faça `workflow-engine` chamar `calculateIPCScore` do módulo compartilhado em vez de ter cópia própria — o módulo já existe e já é usado por `supabase/functions/gmaps-proxy/index.ts:655`. Antes de apagar a cópia, confirme com o dono qual das duas fórmulas é a correta do negócio; implemente essa no módulo compartilhado e remova a outra. O atalho tentador é "deixar as duas e documentar": o dono continua com dois números para a mesma empresa.
**Arquivos e objetos a tocar:** `supabase/functions/workflow-engine/index.ts`, `supabase/functions/_shared/domain/ipc/scoring.ts`.
**Não tocar / armadilhas:** a cópia do motor de fluxos usa campos diferentes (`company.sector`, `company.location`, `raw_data.rating`, `raw_data.reviews_count`) do módulo compartilhado (`company.category`, `company.address`, `company.rating`). Mapeie os campos ao unificar, ou a pontuação zera.
**Depende de:** 094 · **Libera:** 096
**Risco e como reverter:** pontuações mudam de novo. Reverter = `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; decisão de negócio sobre a fórmula).
**Como verificar:** rode a mesma empresa de teste pelos dois caminhos e confirme nota idêntica.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 096 — Fazer os pesos configurados pelo usuário influenciarem a pontuação

**Onda / Severidade / Camada:** 3 / Alta / Regras de negócio
**Achados resolvidos:** G28-1
**Problema hoje:** a tela deixa o usuário ajustar pesos (90, 70, 60, 85, 40 em `src/hooks/useICPConfig.ts:27-32`) e **nenhum** dos cálculos os lê. Ajustar o peso não muda nada.
**Causa raiz:** interface de configuração entregue antes de o cálculo suportar pesos.
**Caminho recomendado:** no módulo unificado da etapa 095, troque as somas fixas por somas proporcionais ao peso de cada critério, normalizando para a faixa de 0 a 100. Mantenha compatibilidade: se o registro não tiver peso (formato antigo), use os valores atuais como padrão. Combine a fórmula com o dono antes de codificar — é regra de negócio, não detalhe técnico.
**Arquivos e objetos a tocar:** `supabase/functions/_shared/domain/ipc/scoring.ts`, testes correspondentes.
**Não tocar / armadilhas:** não deixe a nota passar de 100 nem ficar negativa; teste os extremos (todos os pesos em zero, todos no máximo).
**Depende de:** 095 · **Libera:** 097
**Risco e como reverter:** todas as notas mudam. Reverter = `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; regra de negócio).
**Como verificar:** teste de unidade: a mesma empresa com peso de setor 90 e com peso 10 recebe notas diferentes, na direção esperada.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 097 — Avaliar os critérios de funcionários, faturamento e presença online

**Onda / Severidade / Camada:** 3 / Média / Regras de negócio
**Achados resolvidos:** G28-1
**Problema hoje:** os critérios `employees`, `revenue` e `online_presence` existem na tela (`src/hooks/useICPConfig.ts:27-32`) e **nenhum cálculo os avalia**.
**Causa raiz:** critérios adicionados à tela sem o lado do cálculo.
**Caminho recomendado:** antes de implementar, confirme se os dados existem: `companies` tem colunas de número de funcionários e faturamento? Se não tiver, a etapa correta é **remover os critérios da tela** (prometer menos) ou criar as colunas, e isso é decisão do dono, com migration. Verifique no painel e registre na PR. Só implemente a avaliação dos critérios cujos dados existirem.
**Arquivos e objetos a tocar:** `supabase/functions/_shared/domain/ipc/scoring.ts` e/ou `src/components/lux/ICPConfigView.tsx`.
**Não tocar / armadilhas:** não invente estimativa de faturamento a partir de outro campo.
**Depende de:** 096 · **Libera:** 098
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (decisão de produto; pode exigir migration).
**Como verificar:** a relação dos três critérios com a disponibilidade de dados, no corpo da PR, e a decisão aplicada.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 098 — Permitir recálculo de pontuação de empresas já pontuadas

**Onda / Severidade / Camada:** 3 / Alta / Regras de negócio
**Achados resolvidos:** G28-1
**Problema hoje:** `supabase/functions/workflow-engine/index.ts:511` só pontua empresa com `ipc_score = 0`, ou seja, **nunca recalcula**. Depois das etapas 093 a 096, a base inteira continuaria com as notas antigas, erradas.
**Causa raiz:** filtro criado para não repetir trabalho, que impede correção.
**Caminho recomendado:** acrescente um parâmetro explícito de recálculo (padrão: não recalcular), e uma ação na tela de perfil ideal que dispare o recálculo da organização ativa, com confirmação. Processe em lotes com o limite que já existe em `:510`. O atalho tentador é remover o filtro: o motor passaria a reprocessar 500 empresas em cada execução agendada.
**Arquivos e objetos a tocar:** `supabase/functions/workflow-engine/index.ts`, `src/components/lux/ICPConfigView.tsx`.
**Não tocar / armadilhas:** o filtro por `user_id` de `:512` está errado (deveria ser organização) — isso é a etapa 112; não misture.
**Depende de:** 096 · **Libera:** 099, 112
**Risco e como reverter:** recálculo em massa muda muitos registros. Faça em uma organização pequena primeiro. Reverter = `git revert`; as notas recalculadas ficam (não há histórico).
**Precisa de aprovação humana antes do merge:** **sim** (produção; altera dados em massa).
**Como verificar:** disparar o recálculo numa organização de teste e conferir que as notas mudaram de acordo com a fórmula nova.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 099 — Definir um único limite de "lead qualificado" e colocá-lo num só lugar

**Onda / Severidade / Camada:** 3 / Alta / Regras de negócio
**Achados resolvidos:** G28-2
**Problema hoje:** quatro definições: `>= 60` em `src/hooks/useWeeklyPerformance.ts:48`, `src/components/lux/map/MarkerClusterLayer.tsx:60` e `supabase/migrations/20260721225534_*.sql:11`; `>= 70` em `supabase/functions/workflow-engine/index.ts:579`; `>= 75` em `supabase/migrations/20260522142002_*.sql:32`, `20260721225534_*.sql:12` e `src/components/lux/automations/CompanyAutomationTable.tsx:67`; faixas 90/75/60 em `src/lib/company-filters-utils.ts:9-14`.
**Causa raiz:** o limite foi escrito em cada lugar onde fez falta.
**Caminho recomendado:** pergunte ao dono qual é o número. Depois: declare-o uma única vez no lado do código (`src/lib/company-filters-utils.ts` é o lugar natural, já que as faixas moram lá) e importe nos dois arquivos de front; para o lado do banco, crie uma função de banco `public.ipc_qualified_threshold()` e use-a nas funções SQL, em vez de repetir o número. As faixas de classificação (90/75/60) podem continuar existindo como níveis — só o limite de "qualificado" precisa ser único.
**Arquivos e objetos a tocar:** `src/lib/company-filters-utils.ts`, `src/hooks/useWeeklyPerformance.ts`, `src/components/lux/map/MarkerClusterLayer.tsx`, `src/components/lux/automations/CompanyAutomationTable.tsx`, `supabase/functions/workflow-engine/index.ts`, nova migration para a função e as funções SQL afetadas.
**Não tocar / armadilhas:** mexer nas funções SQL muda os números do painel — avise. Faça o lado do código primeiro, numa pull request, e o lado do banco em outra (migration exige aprovação).
**Depende de:** 098 · **Libera:** 100
**Risco e como reverter:** os indicadores mudam. Reverter = `git revert` + migration inversa.
**Precisa de aprovação humana antes do merge:** **sim** (migration e regra de negócio).
**Como verificar:** com uma empresa de nota exatamente igual ao limite, o painel, o mapa, a automação e o relatório concordam.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 100 — Gravar a data de fechamento quando o negócio entra em etapa de ganho ou perda

**Onda / Severidade / Camada:** 3 / Crítica / Banco · regras de negócio
**Achados resolvidos:** G29-1
**Problema hoje:** o campo `closed_at` de `deals` **nunca é gravado**. Busca exaustiva (executada na auditoria) encontra 15 ocorrências: a criação da coluna (`supabase/migrations/20260422202642_*.sql:33`), quatro declarações de tipo, a lista de campos graváveis da API (`supabase/functions/public-api/index.ts:54`), um comentário que **promete** a automação (`supabase/migrations/20261122160000_deal_lost_reasons.sql:1`) e **seis leituras**: ranking (`20261122180000_org_leaderboard.sql:7,9,44,45`), metas (`20261122170000_sales_goals.sql:95,96`), próxima melhor ação (`20261122270000_next_best_action.sql:187`) e previsão (`20261121193000_*.sql:288`). As quatro funcionalidades mostram zero para sempre.
**Causa raiz:** a automação prometida no comentário nunca foi escrita.
**Caminho recomendado:** gatilho de banco em `public.deals`, acionado em `UPDATE` de `stage_id`: se a nova etapa tem `deal_stages.type` de ganho ou perda e `closed_at` está vazio, grave `now()`; se o negócio voltar para etapa aberta, limpe `closed_at`. No banco, e não no front, porque a API pública e o motor de fluxos também movem negócios — um gatilho cobre todos os caminhos de uma vez. Siga o formato dos gatilhos existentes (há 113 no repositório; use um de `deals` como modelo). O atalho tentador é gravar `closed_at` no `onSuccess` do front (`src/hooks/useDeals.ts`): deixa de fora todos os outros caminhos.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** confirme no painel os valores de `deal_stages.type` que representam ganho e perda — não presuma os nomes. Negócios já fechados antes desta etapa continuam sem data: isso é a etapa 101.
**Depende de:** — · **Libera:** 101, 102, 103, 104, 105
**Risco e como reverter:** gatilho errado pode gravar data em negócio aberto. Teste em banco local (`npm run db:start` + `npm run db:reset`) antes. Reverter = migration que remove o gatilho.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** em banco local, mover um negócio para etapa de ganho e conferir `closed_at` preenchido; voltar para etapa aberta e conferir o campo limpo.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 101 — Preencher a data de fechamento dos negócios já fechados

**Onda / Severidade / Camada:** 3 / Alta / Dados
**Achados resolvidos:** G29-1
**Problema hoje:** depois da etapa 100, só negócios **novos** ganham data. Todo o histórico continua invisível para ranking, metas, previsão e próxima ação.
**Causa raiz:** o campo nunca foi preenchido.
**Caminho recomendado:** **primeiro levante**: conte quantos negócios estão em etapa de ganho ou perda com `closed_at` vazio, e qual é a data mais confiável disponível para cada um (`updated_at` é a candidata natural). Apresente ao dono: preencher com `updated_at` é uma aproximação, e ele precisa saber disso antes de o ranking começar a mostrar números. Só então escreva a migration de preenchimento, em lotes, com registro do que foi alterado. O atalho tentador é usar `created_at`: colocaria o fechamento antes da negociação.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** é alteração de dado histórico, não reversível por `git revert`. Guarde no corpo da PR a consulta de contagem anterior.
**Depende de:** 100 · **Libera:** 102
**Risco e como reverter:** não há volta automática. Garanta cópia de segurança antes (o dono precisa confirmar que existe).
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção; alteração de dado histórico).
**Como verificar:** contagem de negócios fechados sem data antes e depois; ranking e metas passam a mostrar números coerentes com o histórico conhecido.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 102 — Confirmar que o ranking de vendedores passou a mostrar dados

**Onda / Severidade / Camada:** 3 / Média / Regras de negócio
**Achados resolvidos:** G29-1
**Problema hoje:** a função do ranking (`supabase/migrations/20261122180000_org_leaderboard.sql:7-9,44-45`) filtra por `closed_at IS NOT NULL` e sempre devolveu vazio.
**Causa raiz:** dependência do campo da etapa 100.
**Caminho recomendado:** etapa de verificação. Após 100 e 101, abra a tela de ranking e confirme números. Se ainda estiver vazia, o problema é outro (provavelmente escopo de organização ou soft delete) — registre em "Achados novos" com a consulta que você usou.
**Arquivos e objetos a tocar:** `docs/qa/05-PROGRESSO.md`.
**Não tocar / armadilhas:** não "conserte" a função do ranking sem antes confirmar que a causa é ela.
**Depende de:** 101 · **Libera:** 103
**Risco e como reverter:** nenhum.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** tela de ranking com pelo menos um vendedor e valores conferidos contra uma consulta manual.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 103 — Confirmar que o acompanhamento de metas passou a mostrar progresso

**Onda / Severidade / Camada:** 3 / Média / Regras de negócio
**Achados resolvidos:** G29-1
**Problema hoje:** `supabase/migrations/20261122170000_sales_goals.sql:95-96` depende de `closed_at`.
**Causa raiz:** idem.
**Caminho recomendado:** etapa de verificação, igual à 102.
**Arquivos e objetos a tocar:** `docs/qa/05-PROGRESSO.md`.
**Não tocar / armadilhas:** a soma de valores dessa função mistura moedas (etapa 118) — ao conferir, use uma organização com uma única moeda para não confundir os dois defeitos.
**Depende de:** 102 · **Libera:** 104
**Risco e como reverter:** nenhum.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** meta com progresso diferente de zero, conferido contra consulta manual.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 104 — Confirmar que a sugestão de próxima ação passou a aparecer

**Onda / Severidade / Camada:** 3 / Média / Regras de negócio
**Achados resolvidos:** G29-1
**Problema hoje:** `supabase/migrations/20261122270000_next_best_action.sql:187` filtra por `closed_at IS NULL` — este caso específico pode ter funcionado antes (campo vazio em todo mundo), mas passa a funcionar de verdade só depois de 100 e 101.
**Causa raiz:** idem.
**Caminho recomendado:** verificação. Atenção à inversão: aqui o filtro é "ainda não fechado", então antes das etapas 100 e 101 a função **incluía** negócios já fechados. Confirme que as sugestões deixaram de citar negócios fechados.
**Arquivos e objetos a tocar:** `docs/qa/05-PROGRESSO.md`.
**Não tocar / armadilhas:** —
**Depende de:** 103 · **Libera:** 105
**Risco e como reverter:** nenhum.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** nenhuma sugestão aponta para negócio fechado.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 105 — Confirmar que a previsão de fechamento passou a funcionar

**Onda / Severidade / Camada:** 3 / Média / Regras de negócio
**Achados resolvidos:** G29-1
**Problema hoje:** `supabase/migrations/20261121193000_*.sql:288` depende de `closed_at` (o comentário na própria linha diz "deals fechados usam `closed_at`").
**Causa raiz:** idem.
**Caminho recomendado:** verificação, igual à 102.
**Arquivos e objetos a tocar:** `docs/qa/05-PROGRESSO.md`.
**Não tocar / armadilhas:** —
**Depende de:** 104 · **Libera:** 106
**Risco e como reverter:** nenhum.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** previsão com valor diferente de zero, conferida contra consulta manual.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 106 — Impedir transição inválida entre etapas do funil

**Onda / Severidade / Camada:** 3 / Alta / Regras de negócio
**Achados resolvidos:** G29-2
**Problema hoje:** `src/components/lux/DealsView.tsx:70-74` move o negócio de qualquer etapa para qualquer outra, sem consultar `deal_stages.type`. Negócio ganho volta para "contato inicial", o que corrompe qualquer medida de conversão.
**Causa raiz:** o funil foi implementado como lista reordenável, sem máquina de estados.
**Caminho recomendado:** defina as transições permitidas num único lugar do código (por exemplo `src/lib/deal-stages.ts`), com base em `deal_stages.type` e na ordem das etapas, e valide no momento de mover, mostrando mensagem clara quando recusar. Valide **também** no banco, no gatilho da etapa 100 ou em gatilho próprio, porque a API pública e o motor de fluxos também movem negócios. Combine as regras com o dono: voltar uma etapa pode ser legítimo; pular de "contato" para "ganho" talvez não.
**Arquivos e objetos a tocar:** novo arquivo em `src/lib/`, `src/components/lux/DealsView.tsx`, nova migration para a validação no banco.
**Não tocar / armadilhas:** não bloqueie a reordenação visual das etapas (que é outra coisa). Regras rígidas demais travam o uso diário — comece permissivo e proíba apenas o que o dono apontar como inválido.
**Depende de:** 100 · **Libera:** 107
**Risco e como reverter:** pode travar movimentação legítima. Reverter = `git revert` + migration inversa.
**Precisa de aprovação humana antes do merge:** **sim** (migration e regra de negócio).
**Como verificar:** tentar mover de ganho para a primeira etapa → recusado com mensagem; movimentação normal continua funcionando.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 107 — Exigir o motivo da perda ao mover negócio para etapa de perdido

**Onda / Severidade / Camada:** 3 / Alta / Regras de negócio
**Achados resolvidos:** G29-2
**Problema hoje:** nada exige `lost_reason_id` ao entrar em etapa de perda, e o relatório `deal_lost_reason_stats` (`supabase/migrations/20261122160000_*.sql:81-85`) depende desse campo — por isso fica vazio.
**Causa raiz:** campo criado com o relatório, sem o ponto de captura na interface.
**Caminho recomendado:** no front, ao soltar o negócio numa etapa de perda, abra o diálogo de motivo que já existe (`src/components/lux/deals/LostReasonsDialog.tsx`) e só conclua a movimentação depois da escolha. No banco, acrescente validação no gatilho: etapa de perda exige `lost_reason_id` preenchido. Faça o front primeiro; o banco depois, em pull request separada com aprovação.
**Arquivos e objetos a tocar:** `src/components/lux/DealsView.tsx`, nova migration.
**Não tocar / armadilhas:** negócios já perdidos sem motivo vão falhar em qualquer atualização futura se a validação do banco for rígida — use validação só na transição, não em todo `UPDATE`.
**Depende de:** 106 · **Libera:** 108
**Risco e como reverter:** `git revert` + migration inversa.
**Precisa de aprovação humana antes do merge:** **sim** (migration e regra de negócio).
**Como verificar:** mover para perdido sem escolher motivo → bloqueado; depois de escolher, o relatório de motivos mostra o registro.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 108 — Impedir que campanha concluída volte a "ativa" por um clique

**Onda / Severidade / Camada:** 3 / Alta / Regras de negócio
**Achados resolvidos:** G29-2
**Problema hoje:** `src/components/lux/CampaignsView.tsx:171-175` transforma qualquer estado diferente de "ativa" em "ativa" — então rascunho vira ativa e **concluída volta a disparar**.
**Causa raiz:** o botão foi escrito como alternância de dois estados numa entidade com vários.
**Caminho recomendado:** defina as transições permitidas de campanha num único lugar e valide antes de gravar: rascunho → ativa (se houver sequência e conta de e-mail), ativa → pausada, pausada → ativa, ativa → concluída. De concluída, nenhuma — para redisparar, o caminho é duplicar a campanha. Valide também no disparo (`supabase/functions/campaign-dispatch/index.ts:157-158`, que hoje dispara sem checar sequência nem conta de e-mail).
**Arquivos e objetos a tocar:** `src/components/lux/CampaignsView.tsx`, `supabase/functions/campaign-dispatch/index.ts`, novo arquivo de regras em `src/lib/` se fizer sentido.
**Não tocar / armadilhas:** não altere o estado de campanhas existentes.
**Depende de:** 107 · **Libera:** 109
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; envio de e-mail).
**Como verificar:** campanha concluída não pode ser reativada pela interface; campanha sem sequência não ativa e mostra o motivo.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 109 — Restringir os valores aceitos nas colunas de situação mais usadas

**Onda / Severidade / Camada:** 3 / Média / Banco
**Achados resolvidos:** G20-2, G29-2
**Problema hoje:** `campaigns.status` (`supabase/migrations/20260403110857_*.sql:4`), `workflows.status` (`20260329204931_*.sql:7`) e `scrape_jobs.status` (`20260329204544_*.sql:34`) são texto livre sem restrição. Um erro de digitação cria uma situação que nenhuma tela entende, e o registro desaparece dos filtros sem erro. As tabelas mais novas (`webhook_deliveries`, `data_subject_requests`) já acertam.
**Causa raiz:** restrição deixada para depois nas tabelas antigas.
**Caminho recomendado:** **primeiro** levante os valores que existem hoje em cada coluna (`SELECT status, count(*) GROUP BY status`) e inclua o resultado na PR — pode haver valores legados que a restrição quebraria. Depois, migration com `CHECK` listando os valores válidos, incluindo os legados que o dono quiser manter. Uma coluna por pull request, começando por `campaigns.status`, que é a de maior impacto.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** `CHECK` em tabela com valor inválido existente faz a migration falhar e pode travar a aplicação do lote inteiro. Levante antes, sempre.
**Depende de:** 108 · **Libera:** 110
**Risco e como reverter:** migration inversa removendo a restrição.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** tentar gravar valor inválido → recusado pelo banco; os valores existentes continuam aceitos.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 110 — Criar o negócio na organização ativa, não na mais antiga do usuário

**Onda / Severidade / Camada:** 3 / Crítica / Regras de negócio · multi-organização
**Achados resolvidos:** G29-3
**Problema hoje:** `src/hooks/useDeals.ts:131` cria o negócio **sem informar** a organização; o valor padrão da coluna vem de `default_org_for_current_user()`, que devolve a **organização mais antiga** do usuário (`supabase/migrations/20260422204609_*.sql:2-9,15`). Quem atende duas empresas cria o negócio na errada.
**Causa raiz:** valor padrão do banco usado como se fosse o contexto da tela.
**Caminho recomendado:** passe a criação pelo wrapper (`db.from("deals").insert(...)` em vez de `supabase.from`), que injeta a organização ativa e já valida divergência (`src/integrations/supabase/withOrg.ts:314-323`). Confirme que `deals` está classificada em `ORG_SCOPED_TABLES` (está, em `:87-126`). O atalho tentador é informar a organização na mão no objeto: funciona, mas deixa o próximo lugar sem proteção; o wrapper existe exatamente para isso.
**Arquivos e objetos a tocar:** `src/hooks/useDeals.ts`.
**Não tocar / armadilhas:** o valor padrão do banco continua existindo e vai agir em qualquer caminho que não informe a organização (inclusive a API pública) — considere, numa etapa futura, remover o valor padrão; é mudança de schema e precisa de aprovação.
**Depende de:** 017 · **Libera:** 111, 076
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** com usuário de duas organizações, criar negócio com a segunda ativa e conferir que `organization_id` é a da segunda.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 111 — Passar as leituras e escritas de negócios pelo wrapper de organização

**Onda / Severidade / Camada:** 3 / Alta / Dados · multi-organização
**Achados resolvidos:** G1-3, G29-3, G31-4
**Problema hoje:** `src/hooks/useDeals.ts:120-122` lista negócios sem filtro de organização e sem filtro de excluídos; `:46-48` e `:68` fazem o mesmo com as etapas; `:224` e `:303-306` atualizam filtrando só por identificador. A regra de leitura do banco só exige ser membro (`supabase/migrations/20260422204526_*.sql:120`), então os dois funis aparecem misturados.
**Causa raiz:** uso de `supabase.from` cru em tabela de organização.
**Caminho recomendado:** troque `supabase.from("deals")` por `db.from("deals")` (o wrapper) nos seis pontos. O wrapper acrescenta o filtro de organização e o de excluídos, e nas atualizações acrescenta a condição de organização. Faça um ponto por commit para poder isolar regressão. Confira a tela depois de cada troca: a lista pode encurtar, e isso é o comportamento correto.
**Arquivos e objetos a tocar:** `src/hooks/useDeals.ts`.
**Não tocar / armadilhas:** o controle de versão otimista de `:160-172` depende do comportamento de `update` do wrapper (`withOrg.ts:330-338`) — ao trocar, confirme que continua funcionando; é um dos pontos que a auditoria registrou como corretos.
**Depende de:** 110 · **Libera:** 112
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `npx vitest run src/hooks` → verde; com usuário de duas organizações, o funil mostra só os negócios da ativa.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 112 — Trocar o filtro por usuário pelo filtro por organização no motor de fluxos

**Onda / Severidade / Camada:** 3 / Alta / Backend · multi-organização
**Achados resolvidos:** G29-3, G28-1
**Problema hoje:** `supabase/functions/workflow-engine/index.ts:512` e `:548` filtram e atualizam empresas por `user_id`, não por organização. Empresa cadastrada por um colega não é pontuada; e o escopo correto do dado é a organização.
**Causa raiz:** filtro herdado de um modelo anterior sem organizações.
**Caminho recomendado:** troque por `organization_id`, obtendo a organização do fluxo que está sendo executado (o registro de `workflows` tem a coluna). Confirme a origem antes de assumir que é a do usuário que disparou.
**Arquivos e objetos a tocar:** `supabase/functions/workflow-engine/index.ts`.
**Não tocar / armadilhas:** depois desta etapa o motor passa a pontuar mais empresas do que antes — some com o recálculo da etapa 098 e o volume pode ser grande. Respeite o limite de lote de `:510`.
**Depende de:** 098, 111 · **Libera:** 113
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; altera dados em massa).
**Como verificar:** empresa cadastrada pelo usuário A é pontuada por fluxo disparado pelo usuário B da mesma organização.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 113 — Resolver a organização pela ativa, não pela primeira associação, no enfileiramento de raspagem web

**Onda / Severidade / Camada:** 3 / Alta / Backend · multi-organização
**Achados resolvidos:** G29-3
**Problema hoje:** `supabase/functions/web-scrape-enqueue/index.ts:78-84` resolve a organização pela primeira associação do usuário, ignorando qual está ativa na tela. A raspagem é cobrada da conta errada.
**Causa raiz:** o backend não recebe a organização ativa e a adivinha.
**Caminho recomendado:** passe a organização ativa explicitamente do front no corpo da requisição e valide, no backend, que o usuário pertence a ela (padrão de `supabase/functions/oracle-push-bitrix/index.ts:151`). Nunca aceite a organização sem validar o pertencimento. O atalho tentador é usar o cabeçalho de organização do PostgREST: ele não chega às edge functions.
**Arquivos e objetos a tocar:** `supabase/functions/web-scrape-enqueue/index.ts` e o chamador no front (`src/hooks/useWebScrape.ts`).
**Não tocar / armadilhas:** não quebre o caminho de chamada por agendamento, se existir.
**Depende de:** 112 · **Libera:** 114
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; afeta cobrança).
**Como verificar:** usuário de duas organizações enfileira com a segunda ativa; o registro fica na segunda.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 114 — Resolver a organização ativa no enfileiramento do Instagram

**Onda / Severidade / Camada:** 3 / Alta / Backend · multi-organização
**Achados resolvidos:** G29-3
**Problema hoje:** `supabase/functions/instagram-enqueue/index.ts:93-100` repete o padrão da etapa 113.
**Causa raiz:** idem.
**Caminho recomendado:** mesmo caminho da etapa 113.
**Arquivos e objetos a tocar:** `supabase/functions/instagram-enqueue/index.ts` e o chamador no front.
**Não tocar / armadilhas:** não misture com a correção de duplicidade e de parâmetro (etapas 189 e 190).
**Depende de:** 113 · **Libera:** 115
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; afeta cobrança).
**Como verificar:** idem etapa 113, na fila do Instagram.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 115 — Resolver a configuração de perfil ideal pela organização no proxy de raspagem

**Onda / Severidade / Camada:** 3 / Média / Backend · multi-organização
**Achados resolvidos:** G28-1, G29-3
**Problema hoje:** `supabase/functions/gmaps-proxy/index.ts:644-648` lê a configuração de perfil ideal por `user_id` e grava a empresa com `job.organization_id` — ou seja, pontua com o critério de uma pessoa e guarda na conta de outra.
**Causa raiz:** duas fontes de escopo no mesmo trecho.
**Caminho recomendado:** leia a configuração pela organização do job (`job.organization_id`), que já está disponível no mesmo trecho.
**Arquivos e objetos a tocar:** `supabase/functions/gmaps-proxy/index.ts`.
**Não tocar / armadilhas:** depende de a configuração ter coluna de organização — confirme antes.
**Depende de:** 114, 093 · **Libera:** 116
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** empresa raspada por um job da organização A é pontuada com o perfil ideal de A.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 116 — Reativar a restrição de formato de CNPJ na tabela de empresas

**Onda / Severidade / Camada:** 3 / Alta / Banco
**Achados resolvidos:** G20-1
**Problema hoje:** `src/schemas/company.ts:5-16` valida CNPJ com dígitos verificadores, mas a restrição equivalente no banco está **comentada** em `supabase/migrations/20260514211631_*.sql:16-18`, com o texto `-- Actually, let's keep it flexible for now.`, e nenhuma das 241 migrations cria restrição de CNPJ em `public.companies`. As tabelas de cache **exigem** o formato (`20260723163333_*.sql:4,36`), então empresa com CNPJ em formato livre **nunca** casa com o cache e o cliente paga a consulta de novo.
**Causa raiz:** validação só na borda do formulário.
**Caminho recomendado:** **primeiro levante** quantas empresas têm CNPJ fora do padrão de 14 dígitos (`SELECT count(*) WHERE cnpj IS NOT NULL AND cnpj !~ '^[0-9]{14}$'`) e inclua o número na pull request. Se houver registros fora do padrão, a etapa 117 (normalização) vem primeiro. Depois, migration com `CHECK (cnpj IS NULL OR cnpj ~ '^[0-9]{14}$')`, igual à das tabelas de cache. Não tente validar dígito verificador no banco — formato é suficiente para fazer o cache casar; o dígito continua sendo validado no formulário.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** restrição em tabela com dado inválido faz a migration falhar; a ordem 117 → 116 é obrigatória se o levantamento mostrar registros fora do padrão.
**Depende de:** 117 · **Libera:** 118
**Risco e como reverter:** migration inversa.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** inserir empresa com CNPJ `12.345.678/0001-90` (com pontuação) → recusado; com 14 dígitos → aceito.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 117 — Normalizar os CNPJ já gravados fora do padrão

**Onda / Severidade / Camada:** 3 / Alta / Dados
**Achados resolvidos:** G20-1
**Problema hoje:** registros gravados por raspagem, importação ou API podem ter CNPJ com pontuação, espaços ou tamanho errado — e esses nunca casam com o cache de enriquecimento.
**Causa raiz:** ausência da restrição da etapa 116.
**Caminho recomendado:** migration que remova tudo que não é dígito (`regexp_replace(cnpj, '\D', '', 'g')`) e deixe **nulo** o que não resultar em 14 dígitos — nunca invente dígito. Registre na PR a contagem antes e depois, separando "normalizados" de "anulados por tamanho inválido". Depois desta etapa, as empresas afetadas passam a casar com o cache.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** alteração de dado, não reversível por `git revert`. Guarde na PR a consulta que lista os identificadores alterados.
**Depende de:** — · **Libera:** 116
**Risco e como reverter:** sem volta automática; exige cópia de segurança.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção; altera dados).
**Como verificar:** contagem de CNPJ fora do padrão vai a zero; uma empresa que antes não casava agora encontra o cache.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 118 — Validar o CNPJ também na API pública

**Onda / Severidade / Camada:** 3 / Alta / Backend
**Achados resolvidos:** G20-1
**Problema hoje:** `supabase/functions/public-api/index.ts:63-69` copia os campos recebidos sem validar o CNPJ, apesar da lista de colunas graváveis de `:48-52`.
**Causa raiz:** validação existe só no formulário.
**Caminho recomendado:** valide o formato antes de gravar, devolvendo 400 com mensagem clara. Reaproveite a função já existente `src/lib/cnpj.ts:22-38` em vez de escrever outra — há uma segunda cópia em `supabase/functions/cnpj-enrich/index.ts:36-48`; esta etapa é boa oportunidade para passar as duas a usar um módulo compartilhado em `supabase/functions/_shared/`, resolvendo também a duplicação apontada no achado.
**Arquivos e objetos a tocar:** `supabase/functions/public-api/index.ts`, novo módulo em `supabase/functions/_shared/`, `supabase/functions/cnpj-enrich/index.ts`.
**Não tocar / armadilhas:** a versão da função em `cnpj-enrich` **não normaliza a entrada**; ao unificar, mantenha a normalização da versão do front, que é a mais completa.
**Depende de:** 116 · **Libera:** 119
**Risco e como reverter:** integrações que enviavam CNPJ com pontuação passam a receber erro — avise na PR. Reverter = `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (produção; muda contrato de API).
**Como verificar:** enviar CNPJ com pontuação pela API → 400 com mensagem; enviar 14 dígitos → aceito.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 119 — Validar e-mail, site, LinkedIn e Instagram no lado do servidor

**Onda / Severidade / Camada:** 3 / Média / Backend
**Achados resolvidos:** G20-1
**Problema hoje:** `src/schemas/company.ts:6-26` valida e-mail, endereço de site e nome obrigatório; nada disso existe no banco nem na API pública.
**Causa raiz:** idem.
**Caminho recomendado:** valide na API pública (mesmo ponto da etapa 118) reaproveitando o esquema do front — se possível, mova o esquema para um módulo que as duas camadas possam importar; se não for possível por limitação do ambiente Deno, replique só as regras simples (formato de e-mail, esquema de URL, nome não vazio) e marque no comentário onde está a fonte original. Para o banco, uma restrição de "nome não vazio" é segura e vale a pena; formato de e-mail no banco é exagero.
**Arquivos e objetos a tocar:** `supabase/functions/public-api/index.ts`, possivelmente nova migration para `name` não vazio.
**Não tocar / armadilhas:** não bloqueie campos vazios que hoje são opcionais.
**Depende de:** 118 · **Libera:** 120
**Risco e como reverter:** `git revert` + migration inversa.
**Precisa de aprovação humana antes do merge:** **sim** (migration e contrato de API).
**Como verificar:** enviar e-mail inválido pela API → 400; empresa sem nome → recusada.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 120 — Somar valores de negócio respeitando a moeda

**Onda / Severidade / Camada:** 3 / Média / Regras de negócio
**Achados resolvidos:** G29-4
**Problema hoje:** `currency text NOT NULL DEFAULT 'BRL'` sem restrição (`supabase/migrations/20260422202642_*.sql:28-29`). `src/components/lux/deals/DealCard.tsx:47-48` respeita a moeda do registro, mas `src/components/lux/DealsView.tsx:48,87`, `src/components/lux/deals/DealColumn.tsx:20,31` e `src/components/lux/deals/LostReasonsDialog.tsx:14` somam tudo e rotulam como real — e o mesmo acontece no `SUM(d.value)` das metas e do ranking.
**Causa raiz:** o total foi escrito supondo moeda única.
**Caminho recomendado:** no front, agrupe o total por moeda e mostre uma linha por moeda (o caminho honesto e mais simples). Conversão com taxa de câmbio exige fonte de cotação e decisão de negócio — não faça por iniciativa própria. Para as funções do banco, a mesma regra: agrupar por moeda, ou restringir a função a uma moeda informada. Comece pelo front, que é reversível, e leve o lado do banco ao dono.
**Arquivos e objetos a tocar:** `src/components/lux/DealsView.tsx`, `src/components/lux/deals/DealColumn.tsx`, `src/components/lux/deals/LostReasonsDialog.tsx`.
**Não tocar / armadilhas:** `DealCard.tsx:47-48` já está correto — não mexa.
**Depende de:** 119 · **Libera:** 121
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** funil com um negócio em real e um em dólar mostra dois totais rotulados, nunca um só.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 121 — Restringir os valores aceitos na coluna de moeda

**Onda / Severidade / Camada:** 3 / Baixa / Banco
**Achados resolvidos:** G29-4
**Problema hoje:** a coluna de moeda aceita qualquer texto, então um valor digitado errado cria uma "moeda" nova e some dos agrupamentos.
**Causa raiz:** idem etapa 109.
**Caminho recomendado:** levante os valores existentes e crie `CHECK` com a lista das moedas realmente usadas, mais as que o dono quiser suportar.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** idem etapa 109 — levante antes.
**Depende de:** 120 · **Libera:** 122
**Risco e como reverter:** migration inversa.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** gravar moeda inválida → recusado.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 122 — Filtrar os registros excluídos nos contadores do painel

**Onda / Severidade / Camada:** 3 / Alta / Banco
**Achados resolvidos:** G31-4
**Problema hoje:** `get_dashboard_stats` (`supabase/migrations/20260522142002_*.sql:28-41`, única definição no repositório) tem 13 contadores e **nenhum** filtra `deleted_at`. O painel conta empresas e negócios que o cliente já jogou na lixeira.
**Causa raiz:** função escrita antes de existir exclusão reversível.
**Caminho recomendado:** migration substituindo a função, acrescentando `AND deleted_at IS NULL` em cada contador cuja tabela tenha a coluna. Confirme coluna por coluna — nem todas as 13 tabelas têm exclusão reversível. Aproveite para corrigir o fuso (etapa 141) na **mesma** migration, já que é a mesma função e substituir função duas vezes é desperdício; cite as duas etapas na PR.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** os números do painel vão **cair** depois desta etapa — avise o dono, senão parece regressão.
**Depende de:** 121 · **Libera:** 123, 141
**Risco e como reverter:** migration inversa com a definição anterior (guarde o texto na PR).
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** excluir uma empresa e conferir que o contador do painel diminui em um.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 123 — Filtrar excluídos na leitura do mapa de empresas

**Onda / Severidade / Camada:** 3 / Média / Interface · dados
**Achados resolvidos:** G31-4, G19-1
**Problema hoje:** `src/components/lux/CompaniesMapView.tsx:27-37` consulta sem filtro de excluídos (e traz a coluna `raw_data`, um bloco JSON bruto — tratado na etapa 236).
**Causa raiz:** consulta crua fora do wrapper.
**Caminho recomendado:** troque por `db.from("companies")`, que aplica os dois filtros. Não mexa nas colunas selecionadas nesta etapa.
**Arquivos e objetos a tocar:** `src/components/lux/CompaniesMapView.tsx`.
**Não tocar / armadilhas:** —
**Depende de:** 122 · **Libera:** 124
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** empresa excluída desaparece do mapa.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 124 — Filtrar excluídos no detalhe da empresa

**Onda / Severidade / Camada:** 3 / Média / Interface · dados
**Achados resolvidos:** G31-4
**Problema hoje:** `src/components/lux/CompanyDetailModal.tsx:124` consulta sem o filtro.
**Causa raiz:** idem.
**Caminho recomendado:** idem etapa 123.
**Arquivos e objetos a tocar:** `src/components/lux/CompanyDetailModal.tsx`.
**Não tocar / armadilhas:** se a tela precisar abrir um registro da lixeira (para restaurar), use o acesso específico `db.trash(...)` que já existe em `withOrg.ts:408-418`, não a ausência de filtro.
**Depende de:** 123 · **Libera:** 125
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** abrir detalhe de empresa excluída por endereço direto → não encontrada.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 125 — Filtrar excluídos na lista de campanhas

**Onda / Severidade / Camada:** 3 / Média / Interface · dados
**Achados resolvidos:** G31-4
**Problema hoje:** `src/components/lux/CampaignsView.tsx:105` consulta sem o filtro.
**Causa raiz:** idem.
**Caminho recomendado:** idem.
**Arquivos e objetos a tocar:** `src/components/lux/CampaignsView.tsx`.
**Não tocar / armadilhas:** não altere a chave de cache aqui (feito na etapa 083).
**Depende de:** 124 · **Libera:** 126
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** campanha excluída desaparece da lista.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 126 — Filtrar excluídos no painel de rastreio de campanha

**Onda / Severidade / Camada:** 3 / Média / Interface · dados
**Achados resolvidos:** G31-4
**Problema hoje:** `src/components/lux/campaigns/CampaignTrackingDrawer.tsx:134` consulta sem o filtro.
**Causa raiz:** idem.
**Caminho recomendado:** idem.
**Arquivos e objetos a tocar:** `src/components/lux/campaigns/CampaignTrackingDrawer.tsx`.
**Não tocar / armadilhas:** este painel tem cinco consultas sem tratamento de erro (etapa 213) — não misture as duas correções.
**Depende de:** 125 · **Libera:** 127
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** campanha excluída não aparece no rastreio.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 127 — Filtrar excluídos na lista de automações e no desempenho semanal

**Onda / Severidade / Camada:** 3 / Média / Interface · dados
**Achados resolvidos:** G31-4, G5-1
**Problema hoje:** `src/components/lux/AutomationsList.tsx:57` e `src/hooks/useWeeklyPerformance.ts:27-31` consultam sem o filtro — e o segundo também **descarta o erro** da consulta, desenhando zero como se não houvesse atividade.
**Causa raiz:** idem, somada a erro silenciado.
**Caminho recomendado:** troque pelo wrapper nos dois e, em `useWeeklyPerformance.ts:27`, passe a propagar o erro para a consulta (deixe o TanStack Query lançar em vez de capturar) — assim o gráfico mostra "não foi possível carregar" em vez de zero. Esta é a única etapa desta sequência que junta as duas correções, porque estão na mesma linha.
**Arquivos e objetos a tocar:** `src/components/lux/AutomationsList.tsx`, `src/hooks/useWeeklyPerformance.ts`.
**Não tocar / armadilhas:** o componente que desenha o gráfico precisa tratar o estado de erro; confirme em `src/components/lux/DashboardView.tsx:69`.
**Depende de:** 126 · **Libera:** 128
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** com a consulta falhando de propósito, o gráfico mostra erro; com empresa excluída, o número cai.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 128 — Trocar o filtro por usuário pelo filtro por organização na API pública

**Onda / Severidade / Camada:** 3 / Alta / Backend
**Achados resolvidos:** G32-3
**Problema hoje:** `supabase/functions/public-api/index.ts:217-220,246,253-254,265` filtra por `user_id`, mas a chave de API pertence à organização (`api_keys.organization_id`, com acesso restrito a administrador). O integrador só vê o que o administrador dono da chave criou; o que os operadores cadastraram simplesmente não existe para a integração, sem erro nenhum.
**Causa raiz:** escopo herdado de um modelo anterior sem organizações.
**Caminho recomendado:** troque para `organization_id` usando o valor que a função já resolve a partir da chave em `:161`. Confirme na PR, com uma consulta de contagem, quantos registros passam a ser visíveis — a mudança pode ser grande e o integrador precisa ser avisado.
**Arquivos e objetos a tocar:** `supabase/functions/public-api/index.ts`.
**Não tocar / armadilhas:** faça junto da etapa 044 (exclusão reversível) se ambas forem para o mesmo arquivo na mesma janela, mas em commits separados; a lista de colunas graváveis de `:39-69` não deve mudar.
**Depende de:** 044 · **Libera:** 129
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; muda o que a API devolve aos clientes).
**Como verificar:** com chave da organização A, listar empresas e conferir que inclui as cadastradas por outros usuários de A.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 129 — Fazer as regras de acesso do banco respeitarem a exclusão reversível

**Onda / Severidade / Camada:** 3 / Alta / Banco · RLS
**Achados resolvidos:** G32-2, G20-4
**Problema hoje:** as regras do banco permitem atualização a partir do perfil operacional e restringem exclusão a administrador (`supabase/migrations/20260422204526_*.sql:83-88`), mas o wrapper converte exclusão em **atualização** de `deleted_at` (`src/integrations/supabase/withOrg.ts:344-353`), e nenhuma regra dessas quatro tabelas menciona `deleted_at`. Resultado: um operador comercial pode mandar a carteira inteira para a lixeira, contra o que `src/lib/permissions.ts:35-39` declara.
**Causa raiz:** a exclusão reversível foi implementada no cliente, sem refletir no modelo de permissões do banco.
**Caminho recomendado:** migration que acrescente, nas políticas de atualização de `companies`, `deals`, `campaigns` e `workflows`, a condição de que **só administrador** pode mudar `deleted_at` de nulo para preenchido. A forma usual é separar em duas políticas de atualização: uma para o operador, com `WITH CHECK (deleted_at IS NULL)`, e outra para administrador, sem essa condição. Decida com o dono se o operador pode **restaurar** (de preenchido para nulo). O atalho tentador é bloquear no front: a API pública e qualquer chamada direta continuariam passando.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** erro aqui bloqueia **toda** atualização dessas quatro tabelas. Teste em banco local com os três papéis antes de propor o merge.
**Depende de:** 128 · **Libera:** 130
**Risco e como reverter:** migration inversa com as políticas originais (guarde o texto na PR).
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção; modelo de permissões).
**Como verificar:** em banco local, sessão com perfil operacional tentando excluir empresa → negado; administrador → permitido; edição normal continua funcionando para os dois.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 130 — Fazer as políticas de leitura esconderem registros excluídos nas nove tabelas afetadas

**Onda / Severidade / Camada:** 3 / Alta / Banco · RLS
**Achados resolvidos:** G20-4, G1-1
**Problema hoje:** de 12 tabelas com `deleted_at`, nove têm política de leitura que **não** filtra os excluídos: `companies`, `deals`, `campaigns`, `workflows`, `api_keys`, `webhooks`, `email_accounts`, `email_suppressions`, `organization_members`. Hoje o filtro existe só no wrapper do navegador — por isso o item excluído reaparece quando o wrapper falha (achado G1-1) ou quando a consulta não passa por ele.
**Causa raiz:** exclusão reversível implementada no cliente.
**Caminho recomendado:** **não** acrescente o filtro na política de leitura principal — isso impediria a própria tela de lixeira de funcionar. O padrão correto já existe no repositório em `scheduled_reports`: veja como ela separa o acesso e replique. Em geral: política principal com `deleted_at IS NULL` e política adicional, restrita a administrador, para ver os excluídos; o acesso `db.trash(...)` do wrapper (`withOrg.ts:408-418`) passa a depender dessa segunda política. Faça **uma tabela por pull request**, começando por `companies`, e teste a lixeira depois de cada uma.
**Arquivos e objetos a tocar:** nova migration por tabela, em `supabase/migrations/`.
**Não tocar / armadilhas:** se fizer as nove de uma vez e a lixeira quebrar, você não sabe qual tabela causou. Uma por vez.
**Depende de:** 129, 047 · **Libera:** 131
**Risco e como reverter:** migration inversa por tabela.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** por tabela: registro excluído não aparece na listagem nem por consulta direta sem filtro; aparece na lixeira para administrador.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 131 — Decidir o que fazer com os contatos de empresa excluída

**Onda / Severidade / Camada:** 3 / Média / Banco · LGPD
**Achados resolvidos:** G31-5
**Problema hoje:** a tabela `stakeholders` (nome, e-mail e telefone de pessoas) **não tem** coluna de exclusão reversível, então os contatos de uma empresa excluída continuam pesquisáveis em `src/components/lux/StakeholderFinderView.tsx` e em `src/components/lux/command-palette/CommandPalette.tsx`. É dado pessoal que deveria sair com a empresa.
**Causa raiz:** exclusão em cascata não prevista para dados pessoais.
**Caminho recomendado:** duas opções, e a escolha é do dono: (a) acrescentar `deleted_at` a `stakeholders` e marcá-los junto com a empresa, por gatilho; (b) excluir os contatos de fato quando a empresa é excluída, por chave estrangeira com exclusão em cascata. A (a) é reversível e preserva histórico; a (b) é melhor sob a ótica de LGPD. Apresente as duas com uma frase cada e implemente a escolhida.
**Arquivos e objetos a tocar:** nova migration; possivelmente as duas telas citadas.
**Não tocar / armadilhas:** a opção (b) é destrutiva e irreversível — exige confirmação explícita do dono.
**Depende de:** 130 · **Libera:** 132
**Risco e como reverter:** se escolher (b), não há volta. Reverter da (a) = migration inversa.
**Precisa de aprovação humana antes do merge:** **sim** (migration, decisão de LGPD e possível perda de dado).
**Como verificar:** excluir empresa e confirmar que seus contatos não aparecem mais na busca nem na paleta de comandos.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 132 — Criar as chaves estrangeiras de organização que faltam

**Onda / Severidade / Camada:** 3 / Média / Banco
**Achados resolvidos:** G20-3
**Problema hoje:** apenas 50 das 65 tabelas com `organization_id` declaram a chave estrangeira correspondente. Sem o vínculo, remover uma organização deixa registros apontando para ela — dado órfão que continua aparecendo em contagem e relatório.
**Causa raiz:** vínculo omitido na criação das tabelas mais novas.
**Caminho recomendado:** **primeiro levante** se existe registro órfão em cada uma das 15 tabelas (`organization_id` que não existe em `organizations`); a criação da chave falha se houver. Reporte na PR. Depois, migration por grupo de tabelas, com `ON DELETE` escolhido conscientemente: `CASCADE` para dado derivado, `RESTRICT` para dado que o dono não pode perder por acidente. Comece pelas tabelas de maior volume.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** `CASCADE` numa tabela errada apaga dado em massa quando uma organização é removida. Em dúvida, use `RESTRICT`.
**Depende de:** 131 · **Libera:** 133
**Risco e como reverter:** migration inversa removendo as chaves.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção; comportamento de exclusão).
**Como verificar:** tentar inserir registro com organização inexistente → recusado pelo banco.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 133 — Acrescentar gatilho de auditoria às tabelas de permissão

**Onda / Severidade / Camada:** 3 / Alta / Banco · segurança
**Achados resolvidos:** G20-5
**Problema hoje:** o gatilho de auditoria existe em 8 tabelas e **não** nas 15 de permissão e configuração, incluindo `user_roles`, `role_permissions`, `api_keys`, `ip_allowlist` e `organizations`. Se alguém se promover a administrador ou criar uma chave de API, não fica rastro.
**Causa raiz:** cobertura de auditoria feita tabela por tabela.
**Caminho recomendado:** migration acrescentando o gatilho existente (não escreva outro) às tabelas de permissão, começando por `user_roles` e `role_permissions`, que são as de maior consequência. Use `scripts/check-audit-triggers.sh` — depois da etapa 001, ele passa a cobrar isso de verdade — para descobrir a lista exata que ele espera.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** gatilho de auditoria em tabela de alta escrita gera volume; as de permissão são de baixa escrita, então é seguro. Não acrescente em tabela de fila.
**Depende de:** 001, 132 · **Libera:** 134
**Risco e como reverter:** migration inversa.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** alterar um papel e confirmar o registro correspondente em `audit_logs`; `bash scripts/check-audit-triggers.sh` passa a cobrir as novas tabelas.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 134 — Permitir que o registro de violação de organização seja gravado

**Onda / Severidade / Camada:** 3 / Média / Banco · RLS
**Achados resolvidos:** G15-1
**Problema hoje:** `src/lib/orgErrorHandler.ts:479-488` insere em `audit_logs` a partir do navegador e o erro é engolido em `:489`, porque não existe política de inserção para usuário autenticado. Existe até um índice criado só para esse dado (`supabase/migrations/20260711194801_*.sql:3-5`, `WHERE table_name='__org_violation'`) que nunca recebe nada.
**Causa raiz:** gravação desenhada para o cliente numa tabela que só aceita escrita privilegiada — e com razão, porque auditoria não deve ser escrita pelo navegador.
**Caminho recomendado:** **não** abra `audit_logs` para escrita do navegador. Em vez disso, crie uma função de banco `SECURITY DEFINER` com `SET search_path` que registre a violação (validando que o usuário é quem diz ser, via `auth.uid()`), e chame-a do cliente por RPC. Esse é o padrão que o repositório já usa em outras funções privilegiadas. Depois, remova o tratamento que engole o erro em `:489`.
**Arquivos e objetos a tocar:** nova migration (função), `src/lib/orgErrorHandler.ts`.
**Não tocar / armadilhas:** a função não deve aceitar o identificador de usuário por parâmetro — use `auth.uid()` dentro dela, ou qualquer um registra violação no nome de outro.
**Depende de:** 133 · **Libera:** 135
**Risco e como reverter:** migration inversa + `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** provocar uma violação de organização na interface e confirmar o registro com `table_name='__org_violation'` em `audit_logs`.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 135 — Fazer o botão "dispensar recomendação" usar a chamada certa

**Onda / Severidade / Camada:** 3 / Alta / Interface · dados
**Achados resolvidos:** G15-1
**Problema hoje:** `src/components/lux/monitoring/RetryPolicyAdvisoriesPanel.tsx:87-91` atualiza a tabela direto, mas `supabase/migrations/20260721204338_*.sql:35-36` **removeu de propósito** a política de atualização ("só via funções `SECURITY DEFINER`"). Uma atualização sem política afeta zero linhas **sem erro**, então o front mostra "Recomendação dispensada" e ela reaparece sempre. O mesmo arquivo usa a chamada correta nas linhas 72 e 104 — só o "dispensar" ficou de fora.
**Causa raiz:** um caminho esquecido quando a escrita direta foi fechada.
**Caminho recomendado:** troque a atualização direta pela chamada da função correspondente, no mesmo formato das linhas 72 e 104 do próprio arquivo. Se não existir função para "dispensar", crie-a seguindo o padrão das que já existem — a migration que fechou a escrita provavelmente já criou as demais; confira.
**Arquivos e objetos a tocar:** `src/components/lux/monitoring/RetryPolicyAdvisoriesPanel.tsx`, possivelmente nova migration.
**Não tocar / armadilhas:** não reabra a política de atualização da tabela — foi fechada deliberadamente.
**Depende de:** 134 · **Libera:** 136
**Risco e como reverter:** `git revert` (+ migration inversa, se criar função).
**Precisa de aprovação humana antes do merge:** **sim**, se criar função (migration em produção); não, se a função já existir.
**Como verificar:** dispensar uma recomendação, recarregar a página e confirmar que ela não volta.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 136 — Fazer o interruptor da API do Google Places gravar de verdade

**Onda / Severidade / Camada:** 3 / Alta / Banco · custo
**Achados resolvidos:** G15-1
**Problema hoje:** `src/components/lux/settings/PlacesApiNewToggle.tsx:37-48` insere e atualiza `feature_flags`, que só tem política de leitura para usuário autenticado (`supabase/migrations/20260513143000_*.sql:45-50`). É um controle de **custo de API** que parece mudar e não muda.
**Causa raiz:** interruptor escrito contra uma tabela de leitura.
**Caminho recomendado:** decida onde a preferência deve morar. Se é por organização, o lugar certo não é `feature_flags` (global) e sim uma tabela de configuração da organização — confira se já existe uma (`grep -rn "org_settings\|organization_settings" supabase/migrations/`). Se é global e só administrador muda, crie política de escrita restrita a administrador em `feature_flags`. Leve as duas opções ao dono: a primeira é mais correta e dá mais trabalho.
**Arquivos e objetos a tocar:** nova migration, `src/components/lux/settings/PlacesApiNewToggle.tsx`.
**Não tocar / armadilhas:** `feature_flags` é lida por várias telas; abrir escrita indiscriminada deixaria qualquer usuário ligar e desligar recursos de todos.
**Depende de:** 135 · **Libera:** 137
**Risco e como reverter:** migration inversa + `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção; controla custo).
**Como verificar:** mudar o interruptor, recarregar e confirmar que o estado persistiu; conferir que o caminho de consulta respeita a preferência.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 137 — Varrer o repositório por outras gravações que o banco recusa em silêncio

**Onda / Severidade / Camada:** 3 / Alta / Dados
**Achados resolvidos:** G15-1
**Problema hoje:** as etapas 134 a 136 cobrem os três casos encontrados. A classe inteira é perigosa porque uma atualização sem política **não devolve erro**: afeta zero linhas e o front entra no caminho de sucesso.
**Causa raiz:** o comportamento padrão do banco é silencioso nesse caso.
**Caminho recomendado:** liste todas as chamadas de atualização e inserção do front (`grep -rnE "\.update\(|\.insert\(|\.upsert\(" src/`) e, para cada tabela, confirme no painel se existe política de escrita para o papel do usuário. Entregue a tabela comparativa na PR. Corrija só os casos confirmados, e aproveite para propor um padrão: toda atualização do front deve conferir a contagem de linhas afetadas e tratar zero como erro — comece aplicando isso nos casos encontrados.
**Arquivos e objetos a tocar:** os componentes e hooks confirmados.
**Não tocar / armadilhas:** zero linhas afetadas também acontece legitimamente (registro já estava no estado desejado) — trate como erro só onde a ausência de mudança é anômala.
**Depende de:** 136 · **Libera:** 138
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** a tabela comparativa na PR, com cada caso classificado.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 138 — Fazer a matriz de permissões ser aplicada no banco, não só na interface

**Onda / Severidade / Camada:** 3 / Alta / Banco · permissões
**Achados resolvidos:** G32-1
**Problema hoje:** a tabela `role_permissions` (`supabase/migrations/20261121230000_*.sql:116-128`) é lida apenas por `src/hooks/usePermissions.ts:44-49` e `src/hooks/useRolePermissions.ts:42`. **Nenhuma** política do banco e **nenhuma** função de backend a consulta — todas usam papel fixo. O próprio `src/components/lux/permissions/PermissionGate.tsx:13-15` declara ser só "sugestão visual". Desmarcar uma permissão esconde o botão e não bloqueia nada.
**Causa raiz:** a matriz foi construída como recurso de interface.
**Caminho recomendado:** isto é grande e precisa ser decidido com o dono antes de qualquer código. Duas saídas honestas: (a) **tornar a matriz real**: criar uma função de banco `public.has_permission(_org, _user, _permission)` que leia `role_permissions`, e passar as políticas a usá-la em vez do papel fixo — mudança profunda, feita tabela por tabela, em várias etapas; (b) **tornar a matriz honesta**: deixar claro na interface que ela controla apenas o que aparece no menu, e remover a promessa de controle de acesso. Apresente as duas com o esforço de cada uma. Esta etapa entrega a decisão e a função de banco, se a escolha for (a); a aplicação por tabela vira etapas novas.
**Arquivos e objetos a tocar:** nova migration (função), ou `src/components/lux/permissions/PermissionGate.tsx` e a tela da matriz, conforme a decisão.
**Não tocar / armadilhas:** não comece a trocar políticas antes de a função existir e estar testada; metade da migração deixaria o sistema com dois modelos de permissão ao mesmo tempo.
**Depende de:** 137 · **Libera:** 139
**Risco e como reverter:** migration inversa.
**Precisa de aprovação humana antes do merge:** **sim** (mudança de arquitetura de permissões).
**Como verificar:** conforme a decisão: na opção (a), a função devolve o resultado esperado para os três papéis em teste local; na (b), a interface deixa de prometer controle de acesso.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 139 — Corrigir a leitura de auditoria que não passa pelo wrapper

**Onda / Severidade / Camada:** 3 / Média / Interface · dados
**Achados resolvidos:** G21-1, G1-3
**Problema hoje:** `src/components/lux/monitoring/MonitoringView.tsx:41` lê `audit_logs` com `supabase.from` **direto**, fora do wrapper de organização — exceção entre as views do registro (só `LushaIntelligenceView` e `AutomationStatusPanel` fazem igual).
**Causa raiz:** consulta crua.
**Caminho recomendado:** troque pelo wrapper. Confirme antes se `audit_logs` está classificada em `withOrg.ts` — se não estiver, classifique (padrão da etapa 009).
**Arquivos e objetos a tocar:** `src/components/lux/monitoring/MonitoringView.tsx`.
**Não tocar / armadilhas:** depois da etapa 018, a leitura passa a ser escopada no banco também; confirme que a tela continua mostrando os registros da organização.
**Depende de:** 018, 138 · **Libera:** 140
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** a tela mostra apenas registros da organização ativa.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 140 — Corrigir as outras duas leituras cruas das views do registro

**Onda / Severidade / Camada:** 3 / Média / Interface · dados
**Achados resolvidos:** G1-3
**Problema hoje:** `src/components/lux/LushaIntelligenceView.tsx` e `src/components/lux/automations/AutomationStatusPanel.tsx` também usam `supabase.from` direto em tabela de organização.
**Causa raiz:** idem.
**Caminho recomendado:** idem etapa 139, uma por commit.
**Arquivos e objetos a tocar:** os dois componentes citados.
**Não tocar / armadilhas:** `LushaIntelligenceView` usa um recurso controlado por liberação (`useFeatureFlags`) — não mexa nisso.
**Depende de:** 139 · **Libera:** 141
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** as duas telas mostram apenas dados da organização ativa.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 141 — Corrigir o fuso horário do "hoje" nos indicadores do painel

**Onda / Severidade / Camada:** 3 / Média / Banco
**Achados resolvidos:** G33-1
**Problema hoje:** `get_dashboard_stats` usa `v_today := CURRENT_DATE` em UTC (`supabase/migrations/20260522142002_*.sql:17,34`). No horário de Brasília, entre 21h e a meia-noite o painel mostra zero raspagens "de hoje", mesmo tendo rodado.
**Causa raiz:** data calculada no fuso do servidor.
**Caminho recomendado:** calcule o dia no fuso do negócio: `(now() AT TIME ZONE 'America/Sao_Paulo')::date`. Se o sistema atender clientes em fusos diferentes, o fuso deve vir da organização — confirme com o dono; se hoje é só Brasil, fixe o fuso e deixe um comentário dizendo que é premissa. Faça na **mesma** migration da etapa 122, que já substitui essa função.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/` (a mesma da etapa 122).
**Não tocar / armadilhas:** procure outras funções com `CURRENT_DATE` (`grep -rn "CURRENT_DATE" supabase/migrations/*.sql`) — pode haver mais casos; liste-os na PR mesmo que não corrija agora.
**Depende de:** 122 · **Libera:** 142
**Risco e como reverter:** migration inversa.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** às 22h do horário de Brasília, o painel conta as raspagens do dia corrente.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 142 — Mostrar corretamente o atraso dos pedidos de titular de dados

**Onda / Severidade / Camada:** 3 / Média / Interface · LGPD
**Achados resolvidos:** G33-2
**Problema hoje:** `supabase/migrations/20261122250000_dsar_lgpd.sql:417` limita `days_remaining` com `GREATEST(..., 0)`, e `src/components/lux/settings/DsarPanel.tsx:155-157` aplica `Math.abs(r.days_remaining)` supondo valor negativo. Resultado: pedido vencido há duas semanas aparece como "Vencido há 0 dia(s)" — justamente no prazo legal.
**Causa raiz:** o banco corta o valor negativo e o front espera que ele exista.
**Caminho recomendado:** corrija no banco, que é a fonte: remova o `GREATEST` para que o valor fique negativo quando vencido, e ajuste a view/função correspondente. No front, troque `Math.abs` por uma leitura explícita do sinal. Alternativa sem migration: calcular o atraso no front a partir de `due_at`, que já vem no registro — é mais rápido e não exige aprovação; escolha essa se o dono preferir evitar migration agora.
**Arquivos e objetos a tocar:** `src/components/lux/settings/DsarPanel.tsx` (e nova migration, se escolher corrigir no banco).
**Não tocar / armadilhas:** não altere o cálculo do prazo legal em si, que está correto.
**Depende de:** 141 · **Libera:** —
**Risco e como reverter:** `git revert` (+ migration inversa).
**Precisa de aprovação humana antes do merge:** **sim**, se mexer no banco; não, se corrigir só no front.
**Como verificar:** pedido com prazo vencido há 15 dias mostra "Vencido há 15 dia(s)".
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

---

## ONDA 4 — Funcionalidades incompletas (143–180)

### Etapa 143 — Fazer a aba de relatórios agendados funcionar de ponta a ponta

**Onda / Severidade / Camada:** 4 / Alta / Funcionalidade
**Achados resolvidos:** G30-1
**Problema hoje:** depois da classificação da etapa 009, as seis chamadas de `src/hooks/useScheduledReports.ts:53,67,79,92,104,114` param de lançar erro — mas a funcionalidade nunca rodou, então nada além disso foi verificado. A aba está montada em `src/components/lux/AnalyticsView.tsx:162` e a função de envio existe (`supabase/functions/send-scheduled-reports/`).
**Causa raiz:** funcionalidade entregue sem nunca ter sido exercida.
**Caminho recomendado:** percorra o fluxo inteiro com uma conta real: criar, listar, editar, excluir e disparar um relatório. Corrija o que aparecer, uma coisa por commit, registrando cada defeito na PR. Confirme que as tabelas têm política de acesso para o papel do usuário (`scheduled_reports` e `scheduled_report_runs`) — se faltar política, vira etapa de migration com aprovação. Verifique também se há agendamento versionado para `send-scheduled-reports` (a função usa reserva antes do envio, `:369-382`, que é o padrão correto).
**Arquivos e objetos a tocar:** `src/hooks/useScheduledReports.ts`, `src/components/lux/AnalyticsView.tsx` e o que o percurso apontar.
**Não tocar / armadilhas:** não reescreva a função de envio — ela é referência de bom padrão no repositório.
**Depende de:** 009 · **Libera:** 144
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não (a menos que apareça necessidade de migration)
**Como verificar:** criar um relatório agendado, dispará-lo manualmente e confirmar o recebimento do e-mail e o registro da execução.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 144 — Agendar o envio dos relatórios agendados

**Onda / Severidade / Camada:** 4 / Alta / Banco
**Achados resolvidos:** G30-1
**Problema hoje:** não há agendamento versionado para `send-scheduled-reports` entre os 18 existentes — então, mesmo com a aba funcionando, o relatório "agendado" não sai sozinho.
**Causa raiz:** idem etapa 056.
**Caminho recomendado:** confirme no painel se existe agendamento ativo; se existir, versione-o; se não, crie seguindo o formato dos demais, com frequência compatível com a granularidade dos horários que a tela permite escolher.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** verifique se há relatórios antigos com horário no passado que disparariam todos de uma vez no primeiro ciclo.
**Depende de:** 143 · **Libera:** 145
**Risco e como reverter:** migration que remove o agendamento.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção; dispara e-mails reais).
**Como verificar:** relatório agendado para dentro de uma hora chega sem intervenção.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 145 — Agendar a limpeza dos registros de auditoria com mais de 90 dias

**Onda / Severidade / Camada:** 4 / Média / Banco · LGPD
**Achados resolvidos:** G7-4
**Problema hoje:** `supabase/functions/audit-logs-prune/index.ts:20` define retenção de 90 dias, coerente com a promessa de `docs/LGPD.md:39`, mas **não há agendamento versionado** para essa função entre os 18 existentes (verificado na auditoria).
**Causa raiz:** idem.
**Caminho recomendado:** confirme no painel se o agendamento existe. Se existir, versione. Se não existir, crie — diário, em horário de baixo uso, como `purge-soft-deleted-daily` faz. Atenção: a função usa a comparação de segredo que o próprio repositório diz estar errada (etapa 146); faça a 146 antes, ou o agendamento vai falhar com erro de autorização.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** a primeira execução pode apagar um volume grande de uma vez — confirme o volume antes e, se for grande, apague em lotes (o padrão existe na retenção aplicada em `cron.job_run_details`, descrita em `docs/ESTADO_ATUAL.md` §R2).
**Depende de:** 146 · **Libera:** 147
**Risco e como reverter:** migration que remove o agendamento. A exclusão dos registros não volta.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção; apaga dados).
**Como verificar:** depois do primeiro ciclo, o registro de auditoria mais antigo tem menos de 90 dias.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 146 — Padronizar a autenticação de agendamento nas três funções que usam o modelo antigo

**Onda / Severidade / Camada:** 4 / Alta / Backend
**Achados resolvidos:** G22-5
**Problema hoje:** `supabase/functions/_shared/cron-auth.ts:3-7` registra por escrito que "o valor em tempo de execução de `SUPABASE_SERVICE_ROLE_KEY` NÃO corresponde a nenhuma chave listável do projeto… quebrava todos os crons". Mesmo assim, três funções continuam fazendo essa comparação: `supabase/functions/api-latency-alerts/index.ts:60`, `supabase/functions/audit-logs-prune/index.ts:11`, `supabase/functions/instagram-worker-health/index.ts:35`. Consequência provável: a limpeza de auditoria e os alertas de latência não rodam.
**Causa raiz:** três gerações de autenticação de agendamento convivendo (20 funções já usam a correta).
**Caminho recomendado:** troque as três para `isCronAuthorized` de `supabase/functions/_shared/cron-auth.ts`, que compara em tempo constante e é o padrão das outras 20. Esta etapa não precisa de migration, só de deploy das funções.
**Arquivos e objetos a tocar:** as três funções citadas.
**Não tocar / armadilhas:** se o agendamento em produção estiver enviando o cabeçalho antigo, trocar a verificação sem trocar o agendamento quebra a chamada. Confirme no painel qual cabeçalho os agendamentos enviam **antes** de trocar; se enviarem o antigo, a troca precisa ser simultânea nos dois lados.
**Depende de:** — · **Libera:** 145, 147
**Risco e como reverter:** se errar, três rotinas param — mas duas delas provavelmente já estão paradas. Reverter = `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** chamada com o cabeçalho correto → 200; sem cabeçalho → 401; no registro de execução do agendamento, resultado bem-sucedido no ciclo seguinte.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 147 — Verificar quais rotinas agendadas estão de fato rodando

**Onda / Severidade / Camada:** 4 / Alta / Infraestrutura
**Achados resolvidos:** G22-5, G7-4, G16-2
**Problema hoje:** a auditoria encontrou 18 agendamentos versionados, mas não pôde consultar o banco: quais estão ativos e com que resultado é **NÃO VERIFICADO**. Três funções importantes podem estar paradas há meses.
**Causa raiz:** os agendamentos vivem no banco, fora do repositório.
**Caminho recomendado:** **etapa de levantamento.** Com acesso ao painel, liste `cron.job` e `cron.job_run_details` dos últimos 30 dias, e monte uma tabela: nome do agendamento, ativo, última execução, resultado, função de destino, existe no repositório. Entregue no corpo da pull request (que só altera `05-PROGRESSO.md`). Esse levantamento é pré-requisito honesto para as etapas 056, 144 e 145, que criam agendamentos — sem ele, há risco de duplicar agendamento existente.
**Arquivos e objetos a tocar:** `docs/qa/05-PROGRESSO.md`.
**Não tocar / armadilhas:** nenhuma escrita. Se encontrar agendamento ativo apontando para função que não existe mais, registre — é achado novo.
**Depende de:** 002 · **Libera:** 056, 144, 145, 148
**Risco e como reverter:** nenhum.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** a tabela completa no corpo da PR.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 148 — Versionar os agendamentos que existem no banco e não no repositório

**Onda / Severidade / Camada:** 4 / Média / Banco
**Achados resolvidos:** G22-5
**Problema hoje:** a documentação do repositório afirma que há 30 agendamentos ativos em produção (`docs/ESTADO_ATUAL.md` §2) e o repositório versiona 18 — ou seja, cerca de uma dúzia só existe no banco e desaparece se o banco for reconstruído.
**Causa raiz:** agendamentos criados pelo painel, sem migration.
**Caminho recomendado:** com a lista da etapa 147, escreva uma migration que declare os agendamentos faltantes **de forma idempotente** (verificando existência antes de criar), para que reconstruir o banco reproduza o estado real. Não altere horário nem frequência do que já roda.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** criar agendamento duplicado faz a rotina rodar duas vezes — a verificação de existência é obrigatória.
**Depende de:** 147 · **Libera:** 149
**Risco e como reverter:** migration inversa.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** `npm run db:reset` em banco local reproduz a mesma lista de agendamentos do painel.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 149 — Implementar o registro de consumo de crédito da Lusha

**Onda / Severidade / Camada:** 4 / Alta / Backend · custo
**Achados resolvidos:** G18-2
**Problema hoje:** a tabela `lusha_credit_usage_log` está declarada como somente-inclusão em `src/integrations/supabase/withOrg.ts:177`, mas **nenhuma função grava nela**, e o custo devolvido pela API é descartado em `supabase/functions/lusha-reveal/index.ts:302`. Não há como saber quanto cada cliente consumiu.
**Causa raiz:** tabela criada antes do código que a alimentaria.
**Caminho recomendado:** grave uma linha por revelação em `lusha-reveal`, com organização, usuário, identificador do contato, custo informado pela API e data. Grave **depois** da resposta bem-sucedida, e não deixe a falha da gravação derrubar a revelação (o cliente já pagou) — registre o erro. Faça o mesmo em `lusha-decision-makers` se ela também consumir crédito.
**Arquivos e objetos a tocar:** `supabase/functions/lusha-reveal/index.ts`, possivelmente `supabase/functions/lusha-decision-makers/index.ts`.
**Não tocar / armadilhas:** confirme as colunas da tabela antes; não invente campo.
**Depende de:** — · **Libera:** 150
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** revelar um contato e conferir a linha nova na tabela, com o custo preenchido.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 150 — Mostrar ao dono o consumo de crédito por organização

**Onda / Severidade / Camada:** 4 / Média / Interface
**Achados resolvidos:** G18-2
**Problema hoje:** mesmo depois da etapa 149, o dado fica só na tabela.
**Causa raiz:** falta a visualização.
**Caminho recomendado:** acrescente um painel simples na tela de integrações ou de análises: consumo do mês por organização e por usuário, com total. Reaproveite os componentes de cartão e tabela já usados nas outras telas; não crie biblioteca de gráficos nova.
**Arquivos e objetos a tocar:** novo componente em `src/components/lux/`, mais a tela escolhida.
**Não tocar / armadilhas:** restrinja a administrador — é informação de custo.
**Depende de:** 149 · **Libera:** 151
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** o painel mostra o consumo registrado na etapa 149.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 151 — Criar teto de gasto por organização nas integrações pagas

**Onda / Severidade / Camada:** 4 / Alta / Backend · custo
**Achados resolvidos:** G18-2
**Problema hoje:** não há teto algum. Sem limite de frequência: `ai-agent`, `web-scrape-extract`, `gmaps-places-search`, `instagram-enqueue`, `web-scrape-enqueue`. As duas verificações existentes liberam em caso de falha (`supabase/functions/lusha-search/index.ts:298-299`, `supabase/functions/_shared/api-rate-limit.ts:11-13`). Um laço de repetição gera fatura inesperada.
**Causa raiz:** controle de custo nunca implementado.
**Caminho recomendado:** com o registro da etapa 149 funcionando, crie um teto configurável por organização (tabela de configuração) e verifique-o antes de cada chamada paga, usando a mesma função atômica do limite de requisições (etapa 037) como modelo. Comece pela Lusha, que já tem registro de consumo; as outras integrações entram depois, uma por etapa. Defina com o dono o valor padrão e o comportamento ao atingir o teto (bloquear ou avisar).
**Arquivos e objetos a tocar:** nova migration (tabela de teto), `supabase/functions/lusha-reveal/index.ts`, módulo compartilhado em `supabase/functions/_shared/`.
**Não tocar / armadilhas:** teto que falha abrindo não é teto; se a verificação falhar, recuse a chamada paga.
**Depende de:** 150, 037 · **Libera:** 152
**Risco e como reverter:** teto baixo demais bloqueia uso legítimo. Comece com valor alto. Reverter = migration inversa + `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (migration e decisão de custo).
**Como verificar:** com teto de teste baixo, a chamada seguinte é recusada com mensagem clara.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 152 — Decidir e implementar o direito de eliminação prometido no documento de LGPD

**Onda / Severidade / Camada:** 4 / Alta / Funcionalidade · LGPD
**Achados resolvidos:** G7-1
**Problema hoje:** `docs/LGPD.md:21` afirma: _"**Anonimização/Eliminação**: Função 'Excluir Conta' que remove permanentemente os dados (soft-delete por 30 dias para segurança, seguido de hard-delete)."_ A busca por `"Excluir Conta"`, `delete-account` e `deleteAccount` em `src/` e `supabase/functions/` devolve **zero ocorrências** (executada na auditoria). O que existe é o registro manual de pedidos em `src/components/lux/settings/DsarPanel.tsx` com `src/hooks/useDsar.ts`, tratado por uma pessoa.
**Causa raiz:** documento de conformidade escrito à frente do produto.
**Caminho recomendado:** duas saídas, e a escolha é do dono: (a) **implementar** a exclusão de conta de ponta a ponta, reaproveitando o fluxo DSAR que já existe e está bem construído (restrições, prazo no banco, anonimização preservando auditoria) — o botão registraria um pedido de eliminação e dispararia o processamento automático; (b) **corrigir o documento** para descrever o processo real (pedido pelo painel, atendido pela equipe no prazo legal). A (b) é honesta e imediata; a (a) é o que o documento promete. Esta etapa entrega a decisão registrada e, se for (b), o texto corrigido.
**Arquivos e objetos a tocar:** `docs/LGPD.md` e, na opção (a), novo fluxo em `src/components/lux/settings/` e função de backend.
**Não tocar / armadilhas:** não implemente exclusão permanente sem confirmação dupla e sem preservar o que a lei exige manter (a anonimização do fluxo DSAR já trata isso — reaproveite, não reinvente).
**Depende de:** — · **Libera:** 153, 154
**Risco e como reverter:** na opção (a), exclusão permanente é irreversível por definição. Reverter = `git revert` do código, nunca dos dados.
**Precisa de aprovação humana antes do merge:** **sim** (decisão de produto e de conformidade; possível exclusão de dado).
**Como verificar:** na opção (b), o documento descreve o processo real; na (a), um pedido de teste é processado de ponta a ponta.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 153 — Decidir e implementar a obrigatoriedade de segundo fator para administradores

**Onda / Severidade / Camada:** 4 / Alta / Segurança
**Achados resolvidos:** G7-2
**Problema hoje:** `docs/LGPD.md:33` afirma "Autenticação de dois fatores **obrigatória** para administradores". `src/contexts/AuthContext.tsx:13-21` só exige o segundo fator de quem **já cadastrou** um: `return nextLevel === "aal2" && currentLevel !== "aal2";`. Não há nenhuma consulta ao papel do usuário nesse cálculo e nada obriga um administrador a cadastrar. Um administrador sem segundo fator entra apenas com senha.
**Causa raiz:** o cálculo foi escrito a partir do estado da sessão, não da política de segurança.
**Caminho recomendado:** opção honesta e de baixo risco: ao entrar, se o usuário tem papel de administrador em alguma organização e **não** tem fator cadastrado, direcione-o para uma tela de cadastro obrigatório antes de liberar o sistema — sem bloquear quem já está dentro no meio do trabalho. Implemente consultando o papel depois da sessão estabelecida, e tenha um caminho de recuperação para o caso de o administrador perder o dispositivo (senão a conta fica inacessível). Se o dono não quiser a obrigatoriedade, a etapa é corrigir o documento. Decida antes de codificar.
**Arquivos e objetos a tocar:** `src/contexts/AuthContext.tsx`, nova tela em `src/components/lux/auth/`, ou `docs/LGPD.md`.
**Não tocar / armadilhas:** o risco real aqui é trancar o dono fora do próprio sistema. Garanta o caminho de recuperação **antes** de ligar a obrigatoriedade, e teste com uma conta secundária.
**Depende de:** 152 · **Libera:** 154
**Risco e como reverter:** `git revert` — mas se alguém tiver sido trancado fora, a recuperação é manual no painel do Supabase.
**Precisa de aprovação humana antes do merge:** **sim** (decisão de produto e de segurança; risco de perder acesso).
**Como verificar:** conta de administrador de teste sem fator é direcionada ao cadastro; depois de cadastrar, entra normalmente.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 154 — Preencher o encarregado de dados no documento de LGPD

**Onda / Severidade / Camada:** 4 / Média / Documentação · LGPD
**Achados resolvidos:** G7-3
**Problema hoje:** `docs/LGPD.md:7` traz _"**DPO (Encarregado)**: [NOME DO DPO/CONTATO] - `dpo@lux-ia.com.br`"_ — um campo não preenchido num documento de conformidade. A LGPD exige encarregado identificado.
**Causa raiz:** modelo de documento publicado sem preenchimento.
**Caminho recomendado:** pergunte ao dono quem é o encarregado e preencha nome e contato. Confirme também se o endereço de e-mail citado existe e é monitorado — se não existir, o documento promete um canal inexistente. Se o dono ainda não definiu encarregado, registre isso explicitamente no documento em vez de deixar o espaço em branco.
**Arquivos e objetos a tocar:** `docs/LGPD.md`.
**Não tocar / armadilhas:** não invente um nome.
**Depende de:** 153 · **Libera:** 155
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (informação institucional).
**Como verificar:** o documento traz nome e contato reais, e o e-mail recebe mensagem de teste.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 155 — Conferir o documento de LGPD inteiro contra o sistema

**Onda / Severidade / Camada:** 4 / Média / Documentação · LGPD
**Achados resolvidos:** G7-1, G7-2, G7-3, G7-4
**Problema hoje:** a auditoria conferiu quatro afirmações do documento e **três estavam erradas**. As demais afirmações (criptografia em repouso, isolamento garantido por regras de acesso, portabilidade por exportação, bases legais) não foram verificadas.
**Causa raiz:** documento nunca conferido contra o código.
**Caminho recomendado:** percorra o documento afirmação por afirmação e classifique cada uma como "verdadeira (evidência)", "falsa (corrigir documento)" ou "falsa (corrigir sistema)". Entregue a tabela na PR. Atenção especial à afirmação de que as regras de acesso garantem que uma organização nunca acessa dados de outra — os achados G14-1 e G14-2 mostram o contrário, e isso precisa constar.
**Arquivos e objetos a tocar:** `docs/LGPD.md`.
**Não tocar / armadilhas:** não remova afirmação verdadeira só porque não encontrou a evidência de imediato; marque como "não verificado" e diga o que faltou.
**Depende de:** 154 · **Libera:** 156
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (documento institucional).
**Como verificar:** a tabela de classificação na PR e o documento corrigido.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 156 — Restringir o painel de trilha de auditoria a administradores

**Onda / Severidade / Camada:** 4 / Média / Interface · permissões
**Achados resolvidos:** G21-1
**Problema hoje:** `src/lib/permissions.ts:45` declara `audit_logs.view: ADMIN_ONLY`, e o painel `AuditTrailPanel` não tem nenhum portão de permissão.
**Causa raiz:** matriz declarada, interface não aplicada.
**Caminho recomendado:** envolva o painel em `PermissionGate`, como `src/components/lux/DealsView.tsx` já faz. O portão real é a regra do banco (que a etapa 018 corrige), mas a interface não deve oferecer o que será recusado.
**Arquivos e objetos a tocar:** o arquivo do `AuditTrailPanel` e/ou onde ele é montado (`src/pages/Monitoring.tsx:635`).
**Não tocar / armadilhas:** não dependa só da interface — a etapa 018 é que fecha o acesso de verdade.
**Depende de:** 018 · **Libera:** 157
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `viewer` não vê o painel; administrador vê.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 157 — Restringir o painel de cofre de cookies a administradores

**Onda / Severidade / Camada:** 4 / Média / Interface · permissões
**Achados resolvidos:** G21-1
**Problema hoje:** `VaultCookiesPanel` não tem portão de permissão e lida com credenciais de sessão de integrações.
**Causa raiz:** idem.
**Caminho recomendado:** idem etapa 156. Confirme também que a função de backend correspondente valida papel — se não validar, registre como achado novo e abra etapa.
**Arquivos e objetos a tocar:** o arquivo do painel e onde ele é montado.
**Não tocar / armadilhas:** este painel pode exibir dados sensíveis de sessão; confirme que não mostra o valor do cookie em tela.
**Depende de:** 156 · **Libera:** 158
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `viewer` e `sdr` não veem o painel.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 158 — Restringir o simulador de falhas a administradores

**Onda / Severidade / Camada:** 4 / Alta / Interface · permissões
**Achados resolvidos:** G21-1
**Problema hoje:** `ChaosEngineeringPanel` não tem portão de permissão — é uma ferramenta que **provoca falhas de propósito** no sistema.
**Causa raiz:** idem.
**Caminho recomendado:** envolva em `PermissionGate` e, mais importante, confirme que a função de backend que executa a simulação valida papel de administrador. Se não validar, a correção do backend é prioritária e vira etapa própria com aprovação.
**Arquivos e objetos a tocar:** o arquivo do painel; possivelmente a função de backend.
**Não tocar / armadilhas:** não deixe essa ferramenta acessível em produção para perfil não administrativo em nenhuma hipótese.
**Depende de:** 157 · **Libera:** 159
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** se mexer no backend; não, se for só interface.
**Como verificar:** `viewer` e `sdr` não veem nem conseguem acionar a simulação.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 159 — Restringir a tela de descoberta de regras de acesso a administradores

**Onda / Severidade / Camada:** 4 / Média / Interface · permissões
**Achados resolvidos:** G21-1
**Problema hoje:** `src/components/lux/settings/RLSDiscoveryView.tsx` não tem portão — expõe a estrutura de regras de acesso do banco.
**Causa raiz:** idem.
**Caminho recomendado:** idem etapa 156.
**Arquivos e objetos a tocar:** `src/components/lux/settings/RLSDiscoveryView.tsx` e o item de menu correspondente.
**Não tocar / armadilhas:** —
**Depende de:** 158 · **Libera:** 160
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** apenas administrador acessa.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 160 — Filtrar o menu pelo papel do usuário

**Onda / Severidade / Camada:** 4 / Média / Interface · permissões
**Achados resolvidos:** G21-1
**Problema hoje:** `src/components/lux/layout/Sidebar.tsx:116-142` renderiza os 23 itens de menu **sem nenhum filtro de papel**. Um `viewer` vê telas de auditoria e infraestrutura; ao clicar, recebe erro ou tela vazia.
**Causa raiz:** menu construído antes do modelo de permissões.
**Caminho recomendado:** acrescente a cada item do registro (`src/components/lux/layout/nav-items.ts`) o papel mínimo necessário, e filtre na barra lateral usando `useCan`. Faça a lista de papel mínimo item por item com o dono — é decisão de produto, não técnica. Trate também `src/components/lux/layout/MobileBottomNav.tsx` e a paleta de comandos, que listam as mesmas views.
**Arquivos e objetos a tocar:** `src/components/lux/layout/nav-items.ts`, `src/components/lux/layout/Sidebar.tsx`, `src/components/lux/layout/MobileBottomNav.tsx`, `src/components/lux/command-palette/CommandPalette.tsx`.
**Não tocar / armadilhas:** esconder item de menu **não** protege a view — o portão real é a regra do banco. Não use isso como substituto das etapas 156 a 159.
**Depende de:** 159 · **Libera:** 161
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (decisão de produto sobre o que cada papel vê).
**Como verificar:** com os três papéis, o menu mostra conjuntos diferentes e nenhum item leva a erro de permissão.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 161 — Remover o identificador e o nome de organização real do código do site

**Onda / Severidade / Camada:** 4 / Baixa / Interface
**Achados resolvidos:** G21-2
**Problema hoje:** `src/pages/AdminCompanies.tsx:28-37` tem um mapa `ORG_LABELS` com um identificador real associado ao nome `"Promo Brindes"`, mais 8 identificadores de teste; organização fora da lista cai em `id.slice(0,8)` (`:41`). Isso vai para o pacote público do site.
**Causa raiz:** lista escrita à mão para dar nome legível aos identificadores.
**Caminho recomendado:** busque o nome da organização no banco (a tabela `organizations` já tem), em vez de manter a lista no código. A tela é restrita a administrador e a função de backend já valida o papel, então a consulta é legítima. Se o backend não devolver o nome, acrescente-o à resposta de `supabase/functions/admin-list-companies/index.ts` — é mais simples que uma segunda consulta.
**Arquivos e objetos a tocar:** `src/pages/AdminCompanies.tsx`, possivelmente `supabase/functions/admin-list-companies/index.ts`.
**Não tocar / armadilhas:** não remova a validação de papel do backend.
**Depende de:** 160 · **Libera:** 162
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** a tela mostra os nomes corretos e `grep -n "Promo Brindes" src/` não devolve nada.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 162 — Dar prazo de validade ao token de resposta de pesquisa

**Onda / Severidade / Camada:** 4 / Média / Banco · segurança
**Achados resolvidos:** G34-1
**Problema hoje:** as funções públicas de pesquisa (`get_survey_by_token`, `submit_survey_response`) são bem construídas — escopadas por token, sem expor a organização, com revogação antes da concessão — mas o token **não tem prazo de validade nem limite de tentativas**. Um link de pesquisa vazado funciona para sempre.
**Causa raiz:** token permanente por simplicidade.
**Caminho recomendado:** acrescente coluna de validade à tabela de convites de pesquisa (se ainda não existir) e valide dentro das duas funções. Defina o prazo com o dono (30 dias é um começo razoável). Acrescente também um teto de tentativas por token para evitar varredura.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** links já enviados deixam de funcionar quando o prazo retroage — aplique a validade só a tokens novos, ou dê prazo generoso aos existentes.
**Depende de:** 161 · **Libera:** 163
**Risco e como reverter:** migration inversa.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção; afeta links já distribuídos).
**Como verificar:** token com validade expirada → recusado; token novo → aceito.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 163 — Dar prazo de validade e uso único à assinatura dos links de rastreio

**Onda / Severidade / Camada:** 4 / Média / Backend
**Achados resolvidos:** G17-6
**Problema hoje:** `supabase/functions/_shared/tracking-signature.ts:17-19` assina apenas o par (destinatário, URL) — sem prazo e sem número de uso único; `supabase/functions/track-open/index.ts:57` e `track-click/index.ts:56` gravam a cada chamada válida, sem limite de frequência. Aberturas e cliques podem ser inflados por repetição.
**Causa raiz:** assinatura desenhada só para autenticidade, não para unicidade.
**Caminho recomendado:** inclua a data de envio na mensagem assinada e recuse assinatura além de um prazo (por exemplo 90 dias). Para evitar contagem repetida, registre a primeira abertura e as subsequentes de forma distinta (coluna de primeira ocorrência), em vez de bloquear — bloquear quebraria o comportamento normal de cliente de e-mail que recarrega imagem. Para clique, aplique limite de frequência por assinatura.
**Arquivos e objetos a tocar:** `supabase/functions/_shared/tracking-signature.ts`, `supabase/functions/track-open/index.ts`, `supabase/functions/track-click/index.ts`, possivelmente migration para a coluna de primeira ocorrência.
**Não tocar / armadilhas:** **não** altere o mecanismo de assinatura em si (HMAC com comparação de tempo constante) nem o fechamento do redirecionamento aberto — a auditoria confirmou que estão corretos. Links já enviados não terão a data na mensagem; aceite os dois formatos durante uma janela de transição.
**Depende de:** 162 · **Libera:** 164
**Risco e como reverter:** se recusar assinatura antiga, o rastreio dos e-mails já enviados para de funcionar. A janela de transição é obrigatória. Reverter = `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; afeta métricas e e-mails já enviados).
**Como verificar:** abrir o mesmo e-mail 10 vezes conta 1 abertura única e 10 totais; assinatura com data antiga é recusada.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 164 — Guardar e validar o valor de uso único do fluxo de conexão de e-mail

**Onda / Severidade / Camada:** 4 / Média / Backend · segurança
**Achados resolvidos:** G18-4
**Problema hoje:** o valor de uso único é gerado em `supabase/functions/email-oauth-connect/index.ts:79` e **nunca é guardado**; `supabase/functions/email-oauth-callback/index.ts:28-36` apenas compara `stateParts[0] === userId`. A proteção contra induzir a vítima a conectar a caixa errada não está de pé.
**Causa raiz:** valor gerado e não persistido.
**Caminho recomendado:** guarde o valor com o identificador do usuário e um prazo curto (10 minutos) numa tabela de estado temporário — ou reaproveite `idempotency_keys`, que já existe e é usada em `supabase/functions/gmaps-proxy/index.ts:528-535`. No retorno, exija que o valor exista, pertença ao usuário e esteja no prazo; apague-o em seguida (uso único de verdade).
**Arquivos e objetos a tocar:** as duas funções citadas, possivelmente nova migration.
**Não tocar / armadilhas:** `idempotency_keys` não tem índice nenhum (achado G19-2) — se usar essa tabela, acrescente índice na mesma migration ou a validação fica lenta.
**Depende de:** 163 · **Libera:** 165
**Risco e como reverter:** se errar, a conexão de caixa de e-mail para de funcionar. Teste o fluxo inteiro. Reverter = `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; fluxo de autenticação com terceiro).
**Como verificar:** conectar uma caixa de e-mail funciona; repetir o mesmo retorno duas vezes falha na segunda.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 165 — Acrescentar chave de idempotência nas gravações da API pública

**Onda / Severidade / Camada:** 4 / Média / Backend
**Achados resolvidos:** G31-3
**Problema hoje:** `supabase/functions/public-api/index.ts` grava sem chave de idempotência, então o reenvio de uma requisição duplica o registro — embora a tabela `idempotency_keys` já exista e seja usada corretamente em `supabase/functions/gmaps-proxy/index.ts:528-535`.
**Causa raiz:** recurso disponível e não aplicado.
**Caminho recomendado:** aceite o cabeçalho `Idempotency-Key` nas operações de gravação e use o mesmo padrão de `gmaps-proxy:352-369` e `:528-535`. Quando o cabeçalho não vier, mantenha o comportamento atual (não quebre integrações existentes), mas documente o cabeçalho na documentação da API.
**Arquivos e objetos a tocar:** `supabase/functions/public-api/index.ts`, documentação da API em `docs/`.
**Não tocar / armadilhas:** idem etapa 164 sobre o índice da tabela.
**Depende de:** 164 · **Libera:** 166
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; contrato de API).
**Como verificar:** enviar a mesma gravação duas vezes com a mesma chave → um registro; com chaves diferentes → dois.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 166 — Acrescentar chave de idempotência na ingestão de resultados de QA

**Onda / Severidade / Camada:** 4 / Baixa / Backend
**Achados resolvidos:** G22-6 (C-11 da camada de backend)
**Problema hoje:** `supabase/functions/qa-ingest-run/index.ts:96` grava sem chave de idempotência, então uma nova tentativa do CI duplica o registro; e `:99` devolve a mensagem de erro crua do banco ao cliente.
**Causa raiz:** idem.
**Caminho recomendado:** use o identificador da execução do workflow como chave natural (inserção com tratamento de conflito, padrão de `web-scrape-enqueue:113-123`) e troque a mensagem de erro por texto genérico, registrando o detalhe no log.
**Arquivos e objetos a tocar:** `supabase/functions/qa-ingest-run/index.ts`.
**Não tocar / armadilhas:** a função tem `verify_jwt = false` (`supabase/config.toml:9-10`) e usa um token próprio — não altere a autenticação nesta etapa.
**Depende de:** 165 · **Libera:** 167
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** reenviar a mesma execução → um registro; erro provocado → mensagem genérica.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 167 — Documentar a justificativa das duas funções sem verificação de token

**Onda / Severidade / Camada:** 4 / Baixa / Configuração
**Achados resolvidos:** G12-4 (H2 da camada de infraestrutura)
**Problema hoje:** `supabase/config.toml:8-11` define `verify_jwt = false` para `admin-list-companies` e `qa-ingest-run` **sem comentário** — é o único bloco do arquivo sem justificativa, enquanto todos os outros explicam o motivo. Nos dois casos o portão existe no código e está correto, mas quem ler o arquivo não sabe disso.
**Causa raiz:** omissão de comentário.
**Caminho recomendado:** acrescente duas linhas de comentário, no formato das demais entradas do arquivo, dizendo qual é o portão real de cada uma (`admin-list-companies`: sessão + papel de administrador, `index.ts:30-35`; `qa-ingest-run`: token próprio do CI). É mudança de documentação, mas evita que alguém "conserte" a configuração e quebre o acesso.
**Arquivos e objetos a tocar:** `supabase/config.toml`.
**Não tocar / armadilhas:** não altere os valores, só acrescente comentário.
**Depende de:** 166 · **Libera:** 168
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** o arquivo não tem mais bloco sem justificativa.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 168 — Validar a entrada do enfileiramento do Instagram com esquema

**Onda / Severidade / Camada:** 4 / Média / Backend
**Achados resolvidos:** G17-2
**Problema hoje:** `supabase/functions/instagram-enqueue/index.ts:118` monta `params: { limit, ...params }`, deixando o corpo bruto da requisição sobrescrever o `limit` que havia sido validado em `:66`. A validação é manual, sem esquema.
**Causa raiz:** espalhamento do objeto recebido depois do valor validado.
**Caminho recomendado:** inverta a ordem (`{ ...params, limit }`) **e**, principalmente, valide o corpo com esquema antes de usá-lo, como `supabase/functions/web-dlq-replay/index.ts:36-65` já faz. Inverter a ordem resolve o sintoma; o esquema resolve a classe.
**Arquivos e objetos a tocar:** `supabase/functions/instagram-enqueue/index.ts`.
**Não tocar / armadilhas:** não quebre os campos legítimos que o front envia — leia o chamador antes de restringir o esquema.
**Depende de:** 114 · **Libera:** 169
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** enviar `limit` fora da faixa no corpo → recusado ou ignorado; enfileiramento normal continua funcionando.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 169 — Tornar atômica a verificação de duplicidade no enfileiramento do Instagram

**Onda / Severidade / Camada:** 4 / Média / Backend
**Achados resolvidos:** G17-2
**Problema hoje:** `supabase/functions/instagram-enqueue/index.ts:108-112` verifica se já existe e depois insere, em duas operações — então duas requisições simultâneas enfileiram a mesma tarefa paga duas vezes.
**Causa raiz:** verificar-então-inserir.
**Caminho recomendado:** troque por inserção com tratamento de conflito, usando um índice único sobre a combinação que define duplicidade. O padrão exato está em `supabase/functions/web-scrape-enqueue/index.ts:113-123` (inserção + tratamento do código de conflito `23505`). Se o índice único não existir, crie-o na mesma pull request (migration, aprovação necessária).
**Arquivos e objetos a tocar:** `supabase/functions/instagram-enqueue/index.ts`, possivelmente nova migration.
**Não tocar / armadilhas:** o índice único precisa refletir a regra real de duplicidade — confirme com o dono se "mesmo perfil no mesmo dia" conta como duplicado.
**Depende de:** 168 · **Libera:** 170
**Risco e como reverter:** migration inversa + `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** duas requisições simultâneas idênticas → uma tarefa.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 170 — Dar teto de tentativas às tarefas do Instagram

**Onda / Severidade / Camada:** 4 / Alta / Backend
**Achados resolvidos:** G17-4
**Problema hoje:** `supabase/functions/instagram-worker/index.ts:134-151` devolve o contador de tentativas em caso de erro de rede ou tempo esgotado, em vez de incrementá-lo — a tarefa nunca "morre" e fica chamando a API paga em círculo.
**Causa raiz:** erro de rede tratado como "não foi tentativa".
**Caminho recomendado:** incremente o contador em **toda** falha e envie para a fila morta ao atingir o teto, como `supabase/functions/scrape-queue-worker/index.ts` faz. Esse worker é a referência completa no repositório: reserva, prazo de posse, disjuntor, classificação de erro e fila morta — siga-o de perto.
**Arquivos e objetos a tocar:** `supabase/functions/instagram-worker/index.ts`.
**Não tocar / armadilhas:** o cliente da integração dorme até 600 segundos dentro da mesma invocação (`supabase/functions/_shared/hiker-client.ts:133,211-218`) — isso é etapa 171 e agrava o problema; trate as duas em sequência.
**Depende de:** 169, 034 · **Libera:** 171
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; afeta custo).
**Como verificar:** tarefa que falha sempre vai para a fila morta depois do teto, e para de consumir a API.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 171 — Reduzir a espera do cliente de integração do Instagram dentro da invocação

**Onda / Severidade / Camada:** 4 / Média / Backend
**Achados resolvidos:** G17-4
**Problema hoje:** `supabase/functions/_shared/hiker-client.ts:133,211-218` dorme até 600 segundos dentro da mesma invocação, o que estoura o tempo da plataforma e faz a tarefa parecer travada.
**Causa raiz:** espera por resultado assíncrono implementada como espera síncrona.
**Caminho recomendado:** troque a espera longa por devolução de estado "ainda processando", deixando que o próximo ciclo do agendamento retome — é o modelo que as filas do repositório já usam. Limite a espera total dentro de uma invocação a algo bem abaixo do tempo da plataforma.
**Arquivos e objetos a tocar:** `supabase/functions/_shared/hiker-client.ts`, `supabase/functions/instagram-worker/index.ts`.
**Não tocar / armadilhas:** a mudança exige que a tarefa saiba retomar de onde parou; confirme que o registro guarda o identificador da execução no provedor.
**Depende de:** 170 · **Libera:** 172
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** tarefa longa termina ao longo de vários ciclos, sem invocação estourando tempo.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 172 — Incluir a fila morta do Instagram no alerta

**Onda / Severidade / Camada:** 4 / Média / Backend · observabilidade
**Achados resolvidos:** G17-4
**Problema hoje:** `supabase/functions/dlq-alerts/index.ts:16` cobre apenas os tipos `"scrape"` e `"web"` — a fila morta do Instagram não gera alerta nenhum.
**Causa raiz:** lista de tipos escrita à mão.
**Caminho recomendado:** acrescente o tipo do Instagram à lista. Melhor ainda: derive a lista dos tipos existentes na tabela em vez de mantê-la no código, para a próxima fila entrar automaticamente — e veja `scripts/check-queue-kind-coverage.sh`, que existe exatamente para cobrar essa cobertura e hoje sai verde sem verificar (etapa 001).
**Arquivos e objetos a tocar:** `supabase/functions/dlq-alerts/index.ts`.
**Não tocar / armadilhas:** depois da etapa 001, o script de cobertura passa a cobrar de verdade; rode-o localmente com a variável de conexão definida para conferir.
**Depende de:** 171, 001 · **Libera:** 173
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** item na fila morta do Instagram gera alerta no ciclo seguinte; `bash scripts/check-queue-kind-coverage.sh` passa.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 173 — Classificar os erros que não devem gerar nova tentativa de webhook

**Onda / Severidade / Camada:** 4 / Média / Backend
**Achados resolvidos:** G17-5
**Problema hoje:** `supabase/functions/webhook-dispatcher/index.ts:164-183` repete qualquer resposta diferente de 2xx, incluindo 400, 401 e 404 — um endereço digitado errado gera tentativas por horas. A classificação correta de erro existe no repositório e não é usada: `supabase/functions/scrape-queue-worker/index.ts:90-95`.
**Causa raiz:** todas as falhas tratadas como temporárias.
**Caminho recomendado:** reutilize a função de classificação de `scrape-queue-worker:90-95` (ou extraia-a para `_shared/`): 4xx que indica erro do cliente vai direto para a fila morta com o motivo; 5xx e tempo esgotado continuam gerando nova tentativa. Avise o cliente na interface quando o webhook for desativado por endereço inválido.
**Arquivos e objetos a tocar:** `supabase/functions/webhook-dispatcher/index.ts`, possivelmente novo módulo em `supabase/functions/_shared/`.
**Não tocar / armadilhas:** 429 (limite do destino) **deve** gerar nova tentativa, com espera maior — não classifique todo 4xx como definitivo.
**Depende de:** 056 · **Libera:** 174
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** webhook apontando para endereço inexistente vai para a fila morta na primeira falha; destino com erro temporário continua sendo tentado.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 174 — Criar disjuntor por destino de webhook

**Onda / Severidade / Camada:** 4 / Média / Backend
**Achados resolvidos:** G17-5
**Problema hoje:** não há disjuntor por destino: um cliente com endpoint fora do ar consome tentativas e tempo das entregas de todos os outros.
**Causa raiz:** o entregador trata a fila sem considerar a saúde de cada destino.
**Caminho recomendado:** o repositório já tem o conceito implementado (tabelas `circuit_breakers` e `circuit_breaker_snapshots`, usadas pelos workers de raspagem). Reutilize-o por destino de webhook, em vez de criar outro mecanismo.
**Arquivos e objetos a tocar:** `supabase/functions/webhook-dispatcher/index.ts`, possivelmente migration para a chave de identificação do destino.
**Não tocar / armadilhas:** não deixe o disjuntor aberto para sempre; respeite o tempo de recuperação do padrão existente.
**Depende de:** 173 · **Libera:** 175
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** destino com falhas repetidas é pausado e volta a ser tentado após o tempo de recuperação; outros destinos seguem normais.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 175 — Alinhar a espera entre tentativas de webhook com o que a documentação promete

**Onda / Severidade / Camada:** 4 / Baixa / Backend · documentação
**Achados resolvidos:** G17-5
**Problema hoje:** a espera real é 30 s / 2 min / 8 min / 30 min (`supabase/functions/webhook-dispatcher/index.ts:28-32`), e `docs/webhooks.md` promete 1 min / 5 min / 15 min / 1 h / 6 h.
**Causa raiz:** documento e código divergiram.
**Caminho recomendado:** pergunte ao dono qual é a política correta. O mais provável é que o documento esteja certo como intenção e o código como realidade — nesse caso, decida qual vale e alinhe o outro. Se alinhar o código, confirme que o agendamento do entregador (etapa 056) tem frequência compatível com o menor intervalo.
**Arquivos e objetos a tocar:** `supabase/functions/webhook-dispatcher/index.ts` ou `docs/webhooks.md`.
**Não tocar / armadilhas:** aumentar a espera aumenta o tempo até a entrega; diminuir aumenta a carga no destino.
**Depende de:** 174 · **Libera:** 176
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (contrato com clientes).
**Como verificar:** os intervalos observados correspondem ao documento.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 176 — Validar as respostas dos provedores externos antes de usá-las

**Onda / Severidade / Camada:** 4 / Média / Backend
**Achados resolvidos:** G18-3
**Problema hoje:** `supabase/functions/_shared/apify-gateway.ts:287,318` converte o resultado sem validar (`payload.data as ApifyRun`); `supabase/functions/_shared/bitrix-client.ts:108` faz o mesmo; `supabase/functions/gmaps-proxy/index.ts:331,489` usa `data?.id ?? data?.ID ?? null`, o que faz o código cair no caminho **pago** alternativo em silêncio quando o formato muda.
**Causa raiz:** conversão de tipo usada como se fosse validação.
**Caminho recomendado:** valide a forma da resposta com esquema (o repositório já usa esse recurso em `web-dlq-replay:36-65`) e falhe explicitamente quando não casar, registrando a resposta recebida. Para o caso de `gmaps-proxy`, exija um dos dois campos e falhe se nenhum vier, em vez de seguir com nulo.
**Arquivos e objetos a tocar:** os três arquivos citados.
**Não tocar / armadilhas:** falhar explicitamente vai expor incompatibilidades que hoje passam silenciosas — é o objetivo, mas pode gerar alarme no primeiro dia. Avise o dono.
**Depende de:** 175 · **Libera:** 177
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** alimentar a função com resposta de formato inesperado (em teste) → erro claro no log, sem seguir pelo caminho pago.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 177 — Corrigir o domínio padrão da lista de origens permitidas

**Onda / Severidade / Camada:** 4 / Alta / Backend · configuração
**Achados resolvidos:** G23-1
**Problema hoje:** as 9 funções com lista de origens caem no padrão `ALLOWED_ORIGINS[0] = "https://lux-ai-company-finder.lovable.app"` — o endereço que `AGENTS.md` declara morto — em vez de `https://promo-lux-v2.vercel.app`, que é a produção real.
**Causa raiz:** o padrão ficou no endereço da plataforma antiga.
**Caminho recomendado:** troque o padrão pelo domínio de produção atual e, de preferência, leia a lista de uma variável de ambiente para não precisar de deploy quando o domínio mudar. `supabase/functions/ai-agent/index.ts:11-19` é o exemplo correto de verificação por nome de host exato.
**Arquivos e objetos a tocar:** as 9 funções com lista de origens (localize com `grep -rn "ALLOWED_ORIGINS" supabase/functions/`).
**Não tocar / armadilhas:** remover o domínio antigo pode cortar algum uso legítimo residual; confirme antes nos registros de acesso, se disponíveis.
**Depende de:** 176 · **Libera:** 178
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** requisição do domínio de produção é aceita; de domínio desconhecido, recusada.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 178 — Fixar a versão do caminho de importação compartilhado pelas edge functions

**Onda / Severidade / Camada:** 4 / Média / Backend
**Achados resolvidos:** G23-4
**Problema hoje:** 16 funções importam `npm:@supabase/supabase-js@2/cors` — versão presa só na linha principal. O comentário em `supabase/functions/purge-soft-deleted/index.ts:10-11` afirma que esse caminho "nem existe como subpath — a função nunca carregava"; hoje ele **existe** (a versão 2.101.1 declara `"./cors"`). Se uma publicação futura remover esse caminho, as 16 funções param de iniciar ao mesmo tempo.
**Causa raiz:** versão flutuante num caminho de importação não essencial.
**Caminho recomendado:** fixe a versão exata (`@2.101.1`) nas 16 funções, ou substitua o uso desse caminho pelo cabeçalho de origem escrito à mão, que é trivial e elimina a dependência. A segunda opção é mais robusta, e o repositório já tem funções que montam o cabeçalho sem a biblioteca. Corrija também o comentário enganoso de `purge-soft-deleted:10-11`.
**Arquivos e objetos a tocar:** as 16 funções (localize com `grep -rln "supabase-js@2/cors" supabase/functions/`).
**Não tocar / armadilhas:** teste **cada** função depois da mudança — falha de importação só aparece no momento de iniciar, não no typecheck.
**Depende de:** 177 · **Libera:** 179
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; afeta 16 funções).
**Como verificar:** cada uma das 16 funções responde depois do deploy.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 179 — Padronizar o formato das respostas de erro das funções

**Onda / Severidade / Camada:** 4 / Média / Backend
**Achados resolvidos:** G22-7
**Problema hoje:** três contratos de erro convivem em produção: `{error}`, `{ok, error}` e **texto puro** (`supabase/functions/audit-logs-prune/index.ts:12`, `purge-soft-deleted/index.ts:19`, `track-click/index.ts:28,32,43,46`). Quem integra precisa tratar os três, e a interface não sempre consegue mostrar a mensagem.
**Causa raiz:** cada função definiu o seu.
**Caminho recomendado:** escolha **um** formato (o mais usado hoje) e crie um auxiliar em `supabase/functions/_shared/` que monte a resposta de erro. Converta primeiro as três que devolvem texto puro, que são as que mais quebram o cliente; as demais, aos poucos. **Atenção:** `track-click` é chamada pelo navegador do destinatário do e-mail — mudar a resposta dela pode afetar o redirecionamento; trate-a por último e com cuidado.
**Arquivos e objetos a tocar:** novo auxiliar em `supabase/functions/_shared/`, mais as funções convertidas.
**Não tocar / armadilhas:** mudar o formato de erro é mudança de contrato para quem consome a API pública — avise.
**Depende de:** 178 · **Libera:** 180
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; contrato de API).
**Como verificar:** provocar erro em cada função convertida e conferir o formato único.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 180 — Parar de devolver detalhe interno de erro ao cliente

**Onda / Severidade / Camada:** 4 / Média / Backend · segurança
**Achados resolvidos:** G22-6
**Problema hoje:** 47 pontos devolvem detalhe interno. Os mais graves: `supabase/functions/public-api/index.ts:229,237,248,260,266,272` (API consumida por clientes externos) e `supabase/functions/mcp-query/index.ts:92` (erro cru do Postgres). Rastro de execução vai ao cliente em `supabase/functions/lusha-decision-makers/index.ts:752` e `supabase/functions/workflow-engine/index.ts:344,486,568`.
**Causa raiz:** mensagem do banco repassada para facilitar diagnóstico.
**Caminho recomendado:** no auxiliar criado na etapa 179, devolva mensagem genérica com um identificador de correlação, e registre o detalhe no log com esse mesmo identificador — assim o diagnóstico continua possível sem expor estrutura interna. Converta primeiro a API pública e o canal de consulta, que são os expostos.
**Arquivos e objetos a tocar:** `supabase/functions/public-api/index.ts`, `supabase/functions/mcp-query/index.ts`, `supabase/functions/lusha-decision-makers/index.ts`, `supabase/functions/workflow-engine/index.ts`.
**Não tocar / armadilhas:** não remova o log — sem ele, você troca um problema por outro.
**Depende de:** 179 · **Libera:** —
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** provocar erro de banco pela API pública → mensagem genérica com identificador; o log contém o detalhe e o mesmo identificador.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

---

## ONDA 5 — Robustez: erros, estados e concorrência (181–232)

> As etapas 181–190 aplicam tempo-limite às chamadas externas. São repetitivas de propósito: cada uma é um arquivo, para que uma regressão possa ser isolada. O padrão a seguir é sempre o mesmo: `AbortController` com prazo, como em `supabase/functions/webhook-dispatcher/index.ts:149-162` e `supabase/functions/health/index.ts:70,88,108`.

### Etapa 181 — Aplicar tempo-limite às chamadas externas do disparo de campanhas

**Onda / Severidade / Camada:** 5 / Alta / Backend
**Achados resolvidos:** G18-1
**Problema hoje:** `supabase/functions/campaign-dispatch/index.ts:564,660,685,700` chamam serviços externos sem tempo-limite. Quando o provedor de e-mail fica lento, a função trava até o limite da plataforma, o ciclo seguinte do agendamento se sobrepõe e a fila para.
**Causa raiz:** `fetch` escrito direto na função, sem o prazo que os clientes compartilhados já aplicam.
**Caminho recomendado:** envolva cada chamada com `AbortController` e prazo, seguindo `supabase/functions/webhook-dispatcher/index.ts:149-162`. Melhor: crie um auxiliar `fetchComPrazo` em `supabase/functions/_shared/` e use-o nas quatro chamadas — as etapas 182 a 190 vão reaproveitá-lo. Prazo sugerido: 20 segundos para envio de e-mail; confirme com o dono se algum provedor exige mais.
**Arquivos e objetos a tocar:** novo auxiliar em `supabase/functions/_shared/`, `supabase/functions/campaign-dispatch/index.ts`.
**Não tocar / armadilhas:** tempo-limite curto demais faz a campanha falhar em envio que teria dado certo. Comece folgado e aperte depois, com base no log.
**Depende de:** 061 · **Libera:** 182, 183, 184, 185, 186, 187, 188, 189, 190
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; envio de e-mail).
**Como verificar:** simule provedor lento em teste e confirme que a função desiste no prazo e registra o motivo, em vez de travar.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 182 — Aplicar tempo-limite às chamadas da leitura de respostas de e-mail

**Onda / Severidade / Camada:** 5 / Alta / Backend
**Achados resolvidos:** G18-1
**Problema hoje:** `supabase/functions/email-poll-replies/index.ts:250,283,292,328` sem tempo-limite.
**Causa raiz:** idem.
**Caminho recomendado:** use o auxiliar da etapa 181.
**Arquivos e objetos a tocar:** `supabase/functions/email-poll-replies/index.ts`.
**Não tocar / armadilhas:** a função é idempotente por chave única de mensagem do provedor — não mexa nisso, é padrão correto.
**Depende de:** 181 · **Libera:** 183
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** idem etapa 181.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 183 — Aplicar tempo-limite às chamadas do envio de relatórios agendados

**Onda / Severidade / Camada:** 5 / Alta / Backend
**Achados resolvidos:** G18-1
**Problema hoje:** `supabase/functions/send-scheduled-reports/index.ts:258,313,326` sem tempo-limite.
**Causa raiz:** idem.
**Caminho recomendado:** use o auxiliar da etapa 181.
**Arquivos e objetos a tocar:** `supabase/functions/send-scheduled-reports/index.ts`.
**Não tocar / armadilhas:** a reserva antes do envio (`:369-382`) é referência de bom padrão — não altere.
**Depende de:** 182 · **Libera:** 184
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** idem etapa 181.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 184 — Aplicar tempo-limite às chamadas do retorno de conexão de e-mail

**Onda / Severidade / Camada:** 5 / Média / Backend
**Achados resolvidos:** G18-1
**Problema hoje:** `supabase/functions/email-oauth-callback/index.ts:65,73,82,90` sem tempo-limite.
**Causa raiz:** idem.
**Caminho recomendado:** use o auxiliar da etapa 181.
**Arquivos e objetos a tocar:** `supabase/functions/email-oauth-callback/index.ts`.
**Não tocar / armadilhas:** esta função está no caminho de conexão de conta — teste o fluxo inteiro depois.
**Depende de:** 183 · **Libera:** 185
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** conectar uma caixa de e-mail continua funcionando.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 185 — Aplicar tempo-limite às chamadas do portal de automação externa

**Onda / Severidade / Camada:** 5 / Alta / Backend
**Achados resolvidos:** G18-1
**Problema hoje:** `supabase/functions/_shared/apify-gateway.ts:277,314,367` sem tempo-limite.
**Causa raiz:** idem.
**Caminho recomendado:** use o auxiliar da etapa 181. Como é módulo compartilhado, a correção atinge todos os consumidores de uma vez — teste cada um.
**Arquivos e objetos a tocar:** `supabase/functions/_shared/apify-gateway.ts`.
**Não tocar / armadilhas:** chamadas de automação externa podem ser legitimamente longas; use prazo maior e confirme nos registros qual é a duração típica.
**Depende de:** 184 · **Libera:** 186
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** idem etapa 181, em cada consumidor.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 186 — Aplicar tempo-limite à chamada do agente de IA

**Onda / Severidade / Camada:** 5 / Média / Backend
**Achados resolvidos:** G18-1
**Problema hoje:** `supabase/functions/ai-agent/index.ts:161` sem tempo-limite.
**Causa raiz:** idem.
**Caminho recomendado:** use o auxiliar da etapa 181, com prazo compatível com geração de texto (mais longo que os demais).
**Arquivos e objetos a tocar:** `supabase/functions/ai-agent/index.ts`.
**Não tocar / armadilhas:** a verificação de origem por nome de host exato desta função (`:11-19`) é referência de bom padrão — não altere.
**Depende de:** 185 · **Libera:** 187
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** idem etapa 181.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 187 — Aplicar tempo-limite à extração de conteúdo web

**Onda / Severidade / Camada:** 5 / Média / Backend
**Achados resolvidos:** G18-1
**Problema hoje:** `supabase/functions/web-scrape-extract/index.ts:70` sem tempo-limite.
**Causa raiz:** idem.
**Caminho recomendado:** use o auxiliar da etapa 181. Aqui o prazo é importante porque o destino é um site de terceiro arbitrário, que pode nunca responder.
**Arquivos e objetos a tocar:** `supabase/functions/web-scrape-extract/index.ts`.
**Não tocar / armadilhas:** —
**Depende de:** 186 · **Libera:** 188
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** apontar para um endereço que não responde → desiste no prazo.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 188 — Aplicar tempo-limite às chamadas de enriquecimento de contato

**Onda / Severidade / Camada:** 5 / Média / Backend
**Achados resolvidos:** G18-1
**Problema hoje:** `supabase/functions/lusha-reveal/index.ts:222` e `supabase/functions/lusha-decision-makers/index.ts:440` sem tempo-limite.
**Causa raiz:** idem.
**Caminho recomendado:** use o auxiliar da etapa 181.
**Arquivos e objetos a tocar:** as duas funções citadas.
**Não tocar / armadilhas:** essas chamadas custam crédito; ao desistir por prazo, registre a tentativa para o controle de custo da etapa 149 não perder o evento.
**Depende de:** 187, 149 · **Libera:** 189
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; custo).
**Como verificar:** idem etapa 181.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 189 — Aplicar tempo-limite à busca de lugares

**Onda / Severidade / Camada:** 5 / Média / Backend
**Achados resolvidos:** G18-1
**Problema hoje:** `supabase/functions/gmaps-places-search/index.ts:74` sem tempo-limite.
**Causa raiz:** idem.
**Caminho recomendado:** use o auxiliar da etapa 181.
**Arquivos e objetos a tocar:** `supabase/functions/gmaps-places-search/index.ts`.
**Não tocar / armadilhas:** é chamada paga; registre a desistência.
**Depende de:** 188 · **Libera:** 190
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; custo).
**Como verificar:** idem etapa 181.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 190 — Aplicar tempo-limite às chamadas do canal de consulta

**Onda / Severidade / Camada:** 5 / Média / Backend
**Achados resolvidos:** G18-1
**Problema hoje:** `supabase/functions/mcp-query/index.ts:54,81` sem tempo-limite — uma consulta pesada pode travar a função indefinidamente.
**Causa raiz:** idem.
**Caminho recomendado:** use o auxiliar da etapa 181 e, na consulta ao banco, aplique também um prazo de instrução (`SET LOCAL statement_timeout`) na função de leitura criada na etapa 029 — o prazo da requisição não cancela a consulta no banco.
**Arquivos e objetos a tocar:** `supabase/functions/mcp-query/index.ts`, possivelmente a função de banco da etapa 029.
**Não tocar / armadilhas:** sem o prazo no banco, a consulta continua rodando e consumindo recurso mesmo depois de a função desistir.
**Depende de:** 189, 029 · **Libera:** 191
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** consulta artificialmente lenta é cancelada no prazo, nos dois lados.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 191 — Fazer a verificação de saúde da integração devolver código de erro

**Onda / Severidade / Camada:** 5 / Média / Backend · observabilidade
**Achados resolvidos:** G22-4
**Problema hoje:** `supabase/functions/lusha-cookie-health/index.ts:162-171` captura a falha e devolve **HTTP 200** com `{status:"error"}` no corpo; o painel lê o código HTTP e marca verde. A integração pode estar fora do ar com o indicador verde.
**Causa raiz:** erro transformado em resposta bem-sucedida.
**Caminho recomendado:** devolva 500 com o corpo de erro, como `supabase/functions/dlq-alerts/index.ts:121-125` já faz. Confirme que o painel trata o código — se ele só lê o corpo, ajuste o painel na mesma pull request.
**Arquivos e objetos a tocar:** `supabase/functions/lusha-cookie-health/index.ts`, possivelmente o painel que o consome.
**Não tocar / armadilhas:** se algum monitor externo considerar 500 como "serviço caído" e disparar alarme, avise antes.
**Depende de:** 190 · **Libera:** 192
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** com a integração indisponível, o indicador fica vermelho.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 192 — Varrer as funções por erro devolvido como sucesso

**Onda / Severidade / Camada:** 5 / Média / Backend
**Achados resolvidos:** G22-4
**Problema hoje:** o padrão da etapa 191 pode existir em outras funções e é especialmente perigoso, porque esconde falha de quem está monitorando.
**Causa raiz:** idem.
**Caminho recomendado:** `grep -rn -B3 "status: 200" supabase/functions/` procurando blocos de captura que devolvem 200. Confirme caso a caso e corrija os confirmados. Entregue a lista na PR.
**Arquivos e objetos a tocar:** as funções confirmadas.
**Não tocar / armadilhas:** há casos legítimos (por exemplo, um endpoint de rastreio que nunca deve falhar para o destinatário do e-mail) — identifique-os e deixe como estão, explicando na PR.
**Depende de:** 191 · **Libera:** 193
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção).
**Como verificar:** a lista classificada na PR.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 193 — Tratar o erro da leitura de desempenho semanal

**Onda / Severidade / Camada:** 5 / Alta / Hooks
**Achados resolvidos:** G5-1
**Problema hoje:** `src/hooks/useWeeklyPerformance.ts:27` descarta o erro da consulta — o gráfico desenha zero como se não houvesse atividade nenhuma. (A etapa 127 já trata a mesma linha para o filtro de excluídos; esta trata o erro, caso 127 ainda não tenha sido feita.)
**Causa raiz:** erro descartado na desestruturação do resultado.
**Caminho recomendado:** propague o erro (lance-o dentro da função de consulta) para o TanStack Query tratar, e garanta que o componente que desenha o gráfico mostre o estado de erro.
**Arquivos e objetos a tocar:** `src/hooks/useWeeklyPerformance.ts`, o componente consumidor.
**Não tocar / armadilhas:** se a etapa 127 já foi concluída, confirme que esta parte já está feita e registre como "já resolvida" no progresso — não duplique.
**Depende de:** — · **Libera:** 194
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** com a consulta falhando, o painel mostra erro em vez de gráfico zerado.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 194 — Garantir que apenas um perfil de cliente ideal fique ativo

**Onda / Severidade / Camada:** 5 / Alta / Regras de negócio
**Achados resolvidos:** G5-1
**Problema hoje:** `src/hooks/useICPConfig.ts:88` executa `.neq("id", id)` para desativar os outros perfis **sem conferir o erro** antes de ativar o novo. Se a desativação falhar, o sistema fica com **dois perfis ativos** e a pontuação passa a depender de qual for lido primeiro.
**Causa raiz:** duas operações sem garantia de conjunto.
**Caminho recomendado:** a correção robusta é no banco: índice único parcial garantindo um só ativo por organização (`CREATE UNIQUE INDEX ... WHERE is_active`), mais uma função que troque o ativo em uma única transação. No front, chame a função. A correção mínima, se o dono quiser algo imediato, é conferir o erro da desativação antes de ativar — mas não resolve concorrência.
**Arquivos e objetos a tocar:** nova migration (índice + função), `src/hooks/useICPConfig.ts`.
**Não tocar / armadilhas:** se já existirem dois ativos em produção, o índice único falha na criação; levante antes e corrija os dados na mesma migration.
**Depende de:** 193, 093 · **Libera:** 195
**Risco e como reverter:** migration inversa + `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** tentar ativar dois perfis simultaneamente → só um fica ativo; a pontuação usa o esperado.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 195 — Tratar o erro da chamada de função na leitura de negócios

**Onda / Severidade / Camada:** 5 / Média / Hooks
**Achados resolvidos:** G5-1
**Problema hoje:** `src/hooks/useDeals.ts:60-61` chama uma função do banco sem conferir o erro.
**Causa raiz:** erro ignorado.
**Caminho recomendado:** confira e propague. Atenção: essa chamada faz parte do auto-preenchimento de etapas do funil, que tem risco de laço (etapa 196) — leia as duas etapas antes de mexer.
**Arquivos e objetos a tocar:** `src/hooks/useDeals.ts`.
**Não tocar / armadilhas:** —
**Depende de:** 194 · **Libera:** 196
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** com a função do banco indisponível, a tela mostra erro em vez de funil vazio.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 196 — Eliminar o risco de laço no auto-preenchimento das etapas do funil

**Onda / Severidade / Camada:** 5 / Média / Hooks
**Achados resolvidos:** G5-1 (A8 da camada de hooks)
**Problema hoje:** `src/hooks/useDeals.ts:55-64` — o efeito depende do resultado da consulta e dispara uma invalidação que gera novo resultado. Hoje não entra em laço porque a biblioteca preserva a referência da lista vazia; se a função do banco falhar, variar, ou se esse comportamento da biblioteca mudar numa atualização, vira laço de chamadas.
**Causa raiz:** efeito que depende do próprio dado que ele invalida.
**Caminho recomendado:** proteja com uma marca de "já tentei nesta sessão" (`useRef`) para o efeito rodar no máximo uma vez por montagem, e só invalide se a função do banco tiver efetivamente criado etapas. Não dependa do comportamento de identidade de referência da biblioteca.
**Arquivos e objetos a tocar:** `src/hooks/useDeals.ts`.
**Não tocar / armadilhas:** não remova o auto-preenchimento — organizações novas precisam das etapas padrão.
**Depende de:** 195 · **Libera:** 197
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** abrir o funil numa organização sem etapas cria as etapas uma vez; o painel de rede mostra uma única chamada.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 197 — Corrigir a leitura de estado do passo a passo de boas-vindas

**Onda / Severidade / Camada:** 5 / Média / Hooks
**Achados resolvidos:** G5-1
**Problema hoje:** `src/hooks/useOnboardingState.ts:32-46` usa `try/catch` onde o cliente do banco devolve o erro no resultado em vez de lançar — então o bloco de captura nunca executa e o erro nunca é lido. O passo a passo pode reaparecer para quem já concluiu.
**Causa raiz:** modelo de erro da biblioteca entendido como exceção.
**Caminho recomendado:** leia o campo de erro do resultado e trate-o explicitamente. Mantenha o comportamento seguro: em caso de erro, **não** mostre o passo a passo de novo (é menos ruim do que incomodar quem já concluiu).
**Arquivos e objetos a tocar:** `src/hooks/useOnboardingState.ts`.
**Não tocar / armadilhas:** o mesmo mal-entendido pode estar em outros hooks — anote os que encontrar, sem corrigir aqui (etapa 198).
**Depende de:** 196 · **Libera:** 198
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** com a consulta falhando, o passo a passo não reaparece para conta que já concluiu.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 198 — Varrer os hooks por erro ignorado na desestruturação

**Onda / Severidade / Camada:** 5 / Média / Hooks
**Achados resolvidos:** G5-1
**Problema hoje:** o padrão `const { data } = await supabase...` (sem ler o erro) aparece nos casos das etapas 193 a 197 e provavelmente em outros dos 102 hooks.
**Causa raiz:** o cliente devolve `{ data, error }` e é fácil esquecer o segundo.
**Caminho recomendado:** varra `grep -rnE "const \{ data \} = await" src/` e corrija cada caso lendo e propagando o erro. Onde o erro for legitimamente ignorável, deixe um comentário de uma linha dizendo por quê — sem comentário, o próximo leitor não sabe se é descuido.
**Arquivos e objetos a tocar:** os hooks apontados pela varredura.
**Não tocar / armadilhas:** propagar erro em consulta secundária pode quebrar tela que hoje funciona parcialmente; avalie caso a caso se o erro deve derrubar a tela ou aparecer como aviso.
**Depende de:** 197 · **Libera:** 199
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** a lista de casos e o tratamento de cada um, no corpo da PR.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 199 — Tratar erro nas mutações de negócios

**Onda / Severidade / Camada:** 5 / Média / Hooks
**Achados resolvidos:** G5-2
**Problema hoje:** `src/hooks/useDeals.ts:89-96,192-200,283-297,301-309,312-320` — cinco mutações sem tratamento de erro. Quando salvar falha, o usuário não sabe.
**Causa raiz:** ausência de `onError`.
**Caminho recomendado:** acrescente `onError` em cada uma, exibindo mensagem com o motivo, no formato que `src/hooks/useRolePermissions.ts:67-84` usa (que também tem desfazimento de atualização otimista). O escutador global de `src/App.tsx:85` **não** cobre erro de mutação — não conte com ele.
**Arquivos e objetos a tocar:** `src/hooks/useDeals.ts`.
**Não tocar / armadilhas:** a mutação de `:174-189` já tem desfazimento correto — não altere.
**Depende de:** 198 · **Libera:** 200
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** provocar falha em cada operação e confirmar mensagem com motivo.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 200 — Tratar erro nas mutações de modelos de e-mail

**Onda / Severidade / Camada:** 5 / Média / Hooks
**Achados resolvidos:** G5-2
**Problema hoje:** `src/hooks/useEmailTemplates.ts:98-127` sem tratamento de erro.
**Causa raiz:** idem.
**Caminho recomendado:** idem etapa 199.
**Arquivos e objetos a tocar:** `src/hooks/useEmailTemplates.ts`.
**Não tocar / armadilhas:** este hook também tem leituras fora do wrapper (etapa 206) — não misture.
**Depende de:** 199 · **Libera:** 201
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** idem etapa 199.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 201 — Tratar erro nas mutações de chaves de API

**Onda / Severidade / Camada:** 5 / Média / Hooks
**Achados resolvidos:** G5-2
**Problema hoje:** `src/hooks/useApiKeys.ts:66-86` sem tratamento de erro — e chave de API é operação sensível, onde silêncio é pior.
**Causa raiz:** idem.
**Caminho recomendado:** idem etapa 199.
**Arquivos e objetos a tocar:** `src/hooks/useApiKeys.ts`.
**Não tocar / armadilhas:** nunca registre o valor da chave na mensagem de erro.
**Depende de:** 200 · **Libera:** 202
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** idem etapa 199.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 202 — Tratar erro nas mutações da fila de raspagem

**Onda / Severidade / Camada:** 5 / Média / Hooks
**Achados resolvidos:** G5-2
**Problema hoje:** `src/hooks/useScrapeQueue.ts:68-101` sem tratamento de erro.
**Causa raiz:** idem.
**Caminho recomendado:** idem etapa 199.
**Arquivos e objetos a tocar:** `src/hooks/useScrapeQueue.ts`.
**Não tocar / armadilhas:** —
**Depende de:** 201 · **Libera:** 203
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** idem etapa 199.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 203 — Tratar erro nas mutações do perfil de cliente ideal

**Onda / Severidade / Camada:** 5 / Média / Hooks
**Achados resolvidos:** G5-2
**Problema hoje:** `src/hooks/useICPConfig.ts:85-110` sem tratamento de erro.
**Causa raiz:** idem.
**Caminho recomendado:** idem etapa 199. Combine com a etapa 194, que reescreve a troca de perfil ativo — se a 194 já foi feita, confirme que o tratamento de erro entrou junto.
**Arquivos e objetos a tocar:** `src/hooks/useICPConfig.ts`.
**Não tocar / armadilhas:** —
**Depende de:** 202, 194 · **Libera:** 204
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** idem etapa 199.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 204 — Mostrar o motivo da falha ao excluir empresa

**Onda / Severidade / Camada:** 5 / Média / Interface
**Achados resolvidos:** G5-2
**Problema hoje:** `src/components/lux/CompaniesView.tsx:194` e `:209` — `catch { toast({ title: "Erro ao remover", variant: "destructive" }); }` sem registrar nem exibir o motivo. O suporte não tem rastro para investigar.
**Causa raiz:** bloco de captura sem parâmetro.
**Caminho recomendado:** capture o erro, exiba uma descrição curta ao usuário e registre o detalhe no console (até existir monitoramento de erro, etapa 291). Não exponha mensagem técnica do banco na tela — resuma.
**Arquivos e objetos a tocar:** `src/components/lux/CompaniesView.tsx`.
**Não tocar / armadilhas:** —
**Depende de:** 203 · **Libera:** 205
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** provocar falha de exclusão e conferir que o aviso diz o que aconteceu.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 205 — Invalidar os indicadores do painel após exclusão em lote

**Onda / Severidade / Camada:** 5 / Baixa / Interface
**Achados resolvidos:** G5-3
**Problema hoje:** `src/components/lux/CompaniesView.tsx:192-193` (exclusão de uma) invalida `["companies-list"]` **e** `["dashboard-stats"]`; `:207` (exclusão em lote) invalida apenas a primeira. Depois de apagar várias empresas, os indicadores continuam contando as apagadas.
**Causa raiz:** invalidação copiada parcialmente.
**Caminho recomendado:** acrescente a segunda invalidação no caminho de lote. Se as etapas 083/084 já mudaram as chaves, use as novas.
**Arquivos e objetos a tocar:** `src/components/lux/CompaniesView.tsx`.
**Não tocar / armadilhas:** —
**Depende de:** 204, 084 · **Libera:** 206
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** excluir 3 empresas de uma vez e conferir que o indicador do painel cai 3.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 206 — Passar as leituras de modelos de e-mail pelo wrapper de organização

**Onda / Severidade / Camada:** 5 / Alta / Dados
**Achados resolvidos:** G1-3
**Problema hoje:** `src/hooks/useEmailTemplates.ts:74-78,111,115-119,135-137` usa `supabase.from` cru em tabela de organização.
**Causa raiz:** consulta crua.
**Caminho recomendado:** troque por `db.from(...)`, um ponto por commit, conferindo a tela depois de cada troca.
**Arquivos e objetos a tocar:** `src/hooks/useEmailTemplates.ts`.
**Não tocar / armadilhas:** a lista pode encurtar — é o comportamento correto.
**Depende de:** 205 · **Libera:** 207
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** com usuário de duas organizações, a lista mostra só os modelos da ativa.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 207 — Passar as leituras de chaves de API pelo wrapper

**Onda / Severidade / Camada:** 5 / Alta / Dados
**Achados resolvidos:** G1-3
**Problema hoje:** `src/hooks/useApiKeys.ts:39-42` consulta cru.
**Causa raiz:** idem.
**Caminho recomendado:** idem etapa 206.
**Arquivos e objetos a tocar:** `src/hooks/useApiKeys.ts`.
**Não tocar / armadilhas:** esta tabela passou a ter exclusão reversível na etapa 047 — confirme que a lista não mostra chaves da lixeira.
**Depende de:** 206, 047 · **Libera:** 208
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** chaves de outra organização não aparecem; chave excluída não aparece.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 208 — Passar as leituras de lembretes de tarefa pelo wrapper

**Onda / Severidade / Camada:** 5 / Média / Dados
**Achados resolvidos:** G1-3
**Problema hoje:** `src/hooks/useTaskReminders.ts:25-32` consulta cru.
**Causa raiz:** idem.
**Caminho recomendado:** idem etapa 206.
**Arquivos e objetos a tocar:** `src/hooks/useTaskReminders.ts`.
**Não tocar / armadilhas:** —
**Depende de:** 207 · **Libera:** 209
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** lembretes de outra organização não aparecem.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 209 — Passar as leituras da fila de raspagem pelo wrapper

**Onda / Severidade / Camada:** 5 / Média / Dados
**Achados resolvidos:** G1-3
**Problema hoje:** `src/hooks/useScrapeQueue.ts:40-44,56-60` consulta cru.
**Causa raiz:** idem.
**Caminho recomendado:** idem etapa 206.
**Arquivos e objetos a tocar:** `src/hooks/useScrapeQueue.ts`.
**Não tocar / armadilhas:** —
**Depende de:** 208 · **Libera:** 210
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** itens de outra organização não aparecem.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 210 — Passar as escritas de pesquisa de satisfação e metas pelo wrapper

**Onda / Severidade / Camada:** 5 / Média / Dados
**Achados resolvidos:** G1-3
**Problema hoje:** `src/hooks/useSatisfaction.ts:76,88` e `src/hooks/useSalesGoals.ts:104,119` gravam com `supabase.from` cru em tabela de organização.
**Causa raiz:** idem.
**Caminho recomendado:** idem etapa 206. Atenção: nestes dois hooks as **leituras** já usam a chave com organização corretamente (`useSatisfaction.ts:32`, `useSalesGoals.ts:50`) — são referência; só as escritas ficaram fora.
**Arquivos e objetos a tocar:** os dois hooks citados.
**Não tocar / armadilhas:** o wrapper injeta a organização na gravação e recusa divergência (`withOrg.ts:314-323`); se alguma gravação informava a organização na mão, remova a duplicação.
**Depende de:** 209 · **Libera:** 211
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** criar meta e responder pesquisa continuam funcionando, com a organização correta gravada.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 211 — Eliminar a invalidação dupla na troca de organização

**Onda / Severidade / Camada:** 5 / Média / Estado
**Achados resolvidos:** G1-2 (A4 da camada de hooks)
**Problema hoje:** `src/contexts/ActiveOrgContext.tsx:62` invalida o cache e `:67-70` dispara um evento de armazenamento que o escutador da **própria aba** (`:46-51`) recebe e invalida de novo. Cada troca de organização recarrega tudo em dobro.
**Causa raiz:** o evento foi criado para sincronizar outras abas e volta para a que o disparou.
**Caminho recomendado:** marque a origem do evento (por exemplo, um identificador de aba guardado em memória) e ignore no escutador os eventos que a própria aba disparou. Ou remova a invalidação explícita de `:62` e deixe só o caminho do evento — mas confirme que o evento chega de forma sincrônica na mesma aba antes de escolher esse caminho.
**Arquivos e objetos a tocar:** `src/contexts/ActiveOrgContext.tsx`.
**Não tocar / armadilhas:** não remova a sincronização entre abas; trocar de organização numa aba **deve** atualizar as outras.
**Depende de:** 210 · **Libera:** 212
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** no painel de rede, trocar de organização dispara uma rodada de consultas, não duas; com duas abas abertas, as duas atualizam.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 212 — Fazer o canal em tempo real de automações acompanhar a troca de organização

**Onda / Severidade / Camada:** 5 / Média / Hooks
**Achados resolvidos:** G1-2 (A9 da camada de hooks)
**Problema hoje:** `src/hooks/useAutomationsMonitor.ts:114` lê a organização com `getActiveOrgId()`, que é uma leitura instantânea — o canal pode continuar filtrando a organização anterior depois da troca. O repositório já corrigiu esse mesmo padrão em `src/hooks/useRealtimeCompanies.ts:18-22`.
**Causa raiz:** valor lido uma vez, sem reagir à mudança.
**Caminho recomendado:** siga exatamente `useRealtimeCompanies.ts:18-22`: leia a organização pelo contexto e inclua-a nas dependências do efeito, para o canal ser recriado na troca.
**Arquivos e objetos a tocar:** `src/hooks/useAutomationsMonitor.ts`.
**Não tocar / armadilhas:** garanta que o canal antigo é removido antes de criar o novo (o hook de referência já faz isso).
**Depende de:** 211 · **Libera:** 213
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** trocar de organização com o painel de automações aberto: os eventos passam a ser da organização nova.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 213 — Corrigir a reinstalação do escutador de filtros persistidos a cada desenho

**Onda / Severidade / Camada:** 5 / Baixa / Hooks
**Achados resolvidos:** G1-2 (A11 da camada de hooks)
**Problema hoje:** `src/hooks/usePersistedFilters.ts:27-41` reinstala o escutador de armazenamento em cada desenho, porque a dependência `defaultState` é criada inline a cada chamada.
**Causa raiz:** objeto literal como dependência de efeito.
**Caminho recomendado:** estabilize a referência (`useRef` para o valor inicial, ou comparação por conteúdo) e mantenha o escutador instalado uma vez. O vazamento não ocorre porque a remoção existe, mas o trabalho repetido é desnecessário.
**Arquivos e objetos a tocar:** `src/hooks/usePersistedFilters.ts`.
**Não tocar / armadilhas:** não quebre a sincronização de filtros entre abas.
**Depende de:** 212 · **Libera:** 214
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** o efeito executa uma vez por montagem (comprove com um registro temporário, removido antes do commit).
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 214 — Dar tempo de vida curto às consultas de papel e permissão

**Onda / Severidade / Camada:** 5 / Média / Hooks · segurança
**Achados resolvidos:** G1-5
**Problema hoje:** `src/hooks/useRolePermissions.ts:37-49` e `src/hooks/useOrganizations.ts:56-66` não definem tempo de vida próprio; herdam 2 minutos (`src/App.tsx:51`) com nova busca ao focar a janela desligada (`:73`). Tirar o acesso de alguém leva até 2 minutos para refletir na tela.
**Causa raiz:** configuração global aplicada a dado de segurança.
**Caminho recomendado:** defina tempo de vida curto (por exemplo 15 segundos) e ligue a nova busca ao focar a janela **apenas nessas duas consultas**. Não mude o padrão global: 2 minutos é adequado para dado de negócio e mexer nele aumentaria muito o tráfego.
**Arquivos e objetos a tocar:** `src/hooks/useRolePermissions.ts`, `src/hooks/useOrganizations.ts`.
**Não tocar / armadilhas:** o portão real continua sendo a regra do banco — isso é sobre a interface não prometer o que não pode.
**Depende de:** 213 · **Libera:** 215
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** rebaixar um usuário em outra sessão e confirmar que a interface dele reflete a mudança em segundos.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 215 — Tratar erro ao ligar e desligar fluxo automatizado

**Onda / Severidade / Camada:** 5 / Média / Interface
**Achados resolvidos:** G27-2
**Problema hoje:** `src/components/lux/WorkflowsView.tsx:95-104` não tem tratamento de erro, e o estado de erro não é exibido em lugar nenhum — o botão volta sozinho ao estado anterior sem explicação. `:106-114` avisa o sucesso da exclusão, não a falha.
**Causa raiz:** mutações sem tratamento de erro.
**Caminho recomendado:** acrescente `onError` nas duas, com mensagem; e exiba o estado de erro da consulta na tela, não só o da mutação.
**Arquivos e objetos a tocar:** `src/components/lux/WorkflowsView.tsx`.
**Não tocar / armadilhas:** se a etapa 070 passou a reutilizar essa mutação no painel inicial, o tratamento de erro vale para os dois lugares — confirme.
**Depende de:** 214, 070 · **Libera:** 216
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** provocar falha ao pausar e confirmar a mensagem.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 216 — Tratar erro nas demais mutações de interface sem aviso

**Onda / Severidade / Camada:** 5 / Média / Interface
**Achados resolvidos:** G27-2
**Problema hoje:** além de `WorkflowsView`, ficam sem tratamento: `src/components/lux/CampaignsView.tsx:185`; `src/components/lux/IntentSignalsView.tsx:117`; `src/components/lux/monitoring/ChaosEngineeringPanel.tsx:47`; `src/components/lux/campaigns/DeliverabilityCheckDialog.tsx:72` e `src/components/lux/campaigns/EmailVerifyBadge.tsx:47` (estes dois sem aviso de sucesso nem de falha); `src/pages/Monitoring.tsx:158`. Total: 8 de 44 mutações da camada.
**Causa raiz:** idem.
**Caminho recomendado:** acrescente `onError` em cada uma, no mesmo padrão. Uma pull request só, com um commit por arquivo.
**Arquivos e objetos a tocar:** os seis arquivos citados.
**Não tocar / armadilhas:** `src/pages/Monitoring.tsx` tem texto corrompido (etapa 251) — se a etapa 251 ainda não foi feita, cuidado para não copiar texto quebrado nas mensagens novas.
**Depende de:** 215 · **Libera:** 217
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** provocar falha em cada uma e confirmar a mensagem.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 217 — Distinguir "sem dados" de "falha ao carregar" no painel de auditoria

**Onda / Severidade / Camada:** 5 / Média / Interface
**Achados resolvidos:** G27-1
**Problema hoje:** em `src/components/lux/monitoring/MonitoringView.tsx:30`, `loadingHealth` é declarado e nunca usado; a lista de registros de auditoria mostra "Nenhum log crítico registrado recentemente." **inclusive quando a consulta falhou**. São situações opostas com a mesma mensagem.
**Causa raiz:** o componente só trata o caso de lista vazia.
**Caminho recomendado:** use os três estados da consulta: carregando (esqueleto), erro (mensagem com nova tentativa) e vazio (a mensagem atual). As telas de negócio principais já fazem isso — use `src/components/lux/CompaniesView.tsx` como referência.
**Arquivos e objetos a tocar:** `src/components/lux/monitoring/MonitoringView.tsx`.
**Não tocar / armadilhas:** —
**Depende de:** 216, 064 · **Libera:** 218
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** com a consulta falhando, aparece erro; com lista vazia, a mensagem de vazio.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 218 — Tratar carregamento e erro no gráfico de tendência de SLA

**Onda / Severidade / Camada:** 5 / Média / Interface
**Achados resolvidos:** G27-1
**Problema hoje:** `src/components/lux/monitoring/SlaTrendChart.tsx:36` usa `const { data } = useQuery(...)` sem `isLoading` e sem `error` — o gráfico fica vazio sem dizer por quê.
**Causa raiz:** idem.
**Caminho recomendado:** idem etapa 217. Este é o primeiro de uma sequência de painéis; estabeleça aqui o padrão (esqueleto, erro com nova tentativa, vazio) e repita nos demais.
**Arquivos e objetos a tocar:** `src/components/lux/monitoring/SlaTrendChart.tsx`.
**Não tocar / armadilhas:** —
**Depende de:** 217 · **Libera:** 219
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** com a consulta falhando, o painel mostra erro.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 219 — Tratar carregamento e erro no painel de resiliência de filas

**Onda / Severidade / Camada:** 5 / Média / Interface
**Achados resolvidos:** G27-1
**Problema hoje:** `src/components/lux/monitoring/MultiQueueResilienceCard.tsx:134` sem tratamento.
**Causa raiz:** idem.
**Caminho recomendado:** aplique o padrão da etapa 218.
**Arquivos e objetos a tocar:** o arquivo citado.
**Não tocar / armadilhas:** —
**Depende de:** 218 · **Libera:** 220
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** idem etapa 218.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 220 — Tratar carregamento e erro no histórico de QA

**Onda / Severidade / Camada:** 5 / Baixa / Interface
**Achados resolvidos:** G27-1
**Problema hoje:** `src/components/lux/monitoring/QaHistoryPanel.tsx:65` sem tratamento.
**Causa raiz:** idem.
**Caminho recomendado:** padrão da etapa 218.
**Arquivos e objetos a tocar:** o arquivo citado.
**Não tocar / armadilhas:** —
**Depende de:** 219 · **Libera:** 221
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** idem etapa 218.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 221 — Tratar carregamento e erro nos painéis de conformidade e histórico de SLA

**Onda / Severidade / Camada:** 5 / Média / Interface
**Achados resolvidos:** G27-1
**Problema hoje:** `src/components/lux/monitoring/SlaCompliancePanel.tsx:50`, `SlaHistoryCard.tsx:112,132` e `SlaRecommendationsCard.tsx:62` sem tratamento.
**Causa raiz:** idem.
**Caminho recomendado:** padrão da etapa 218, nos três arquivos.
**Arquivos e objetos a tocar:** os três arquivos citados.
**Não tocar / armadilhas:** —
**Depende de:** 220 · **Libera:** 222
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** idem etapa 218.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 222 — Tratar carregamento e erro no simulador de falhas e no detalhe de tarefa

**Onda / Severidade / Camada:** 5 / Baixa / Interface
**Achados resolvidos:** G27-1
**Problema hoje:** `src/components/lux/monitoring/ChaosEngineeringPanel.tsx:20,33` e `JobDetailsSheet.tsx:82` sem tratamento.
**Causa raiz:** idem.
**Caminho recomendado:** padrão da etapa 218.
**Arquivos e objetos a tocar:** os dois arquivos citados.
**Não tocar / armadilhas:** o simulador de falhas deve ficar restrito a administrador (etapa 158) — se ainda não estiver, faça as duas juntas.
**Depende de:** 221 · **Libera:** 223
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** idem etapa 218.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 223 — Tratar carregamento e erro no funil de enriquecimento

**Onda / Severidade / Camada:** 5 / Média / Interface
**Achados resolvidos:** G27-1
**Problema hoje:** `src/components/lux/EnrichmentFunnel.tsx:34` sem tratamento.
**Causa raiz:** idem.
**Caminho recomendado:** padrão da etapa 218. Este componente já acerta a chave de cache com o estado de demonstração (`:35`) — mantenha.
**Arquivos e objetos a tocar:** `src/components/lux/EnrichmentFunnel.tsx`.
**Não tocar / armadilhas:** —
**Depende de:** 222 · **Libera:** 224
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** idem etapa 218.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 224 — Tratar erro nas cinco consultas do painel de rastreio de campanha

**Onda / Severidade / Camada:** 5 / Média / Interface
**Achados resolvidos:** G27-1
**Problema hoje:** `src/components/lux/campaigns/CampaignTrackingDrawer.tsx` tem cinco consultas e **nenhum** tratamento de erro — as métricas de campanha podem aparecer vazias por falha, e o usuário conclui que a campanha não teve resultado.
**Causa raiz:** idem.
**Caminho recomendado:** padrão da etapa 218 nas cinco. Como são métricas que embasam decisão, deixe explícito "não foi possível carregar" em vez de zero.
**Arquivos e objetos a tocar:** `src/components/lux/campaigns/CampaignTrackingDrawer.tsx`.
**Não tocar / armadilhas:** o filtro de excluídos deste arquivo é a etapa 126 — não misture.
**Depende de:** 223 · **Libera:** 225
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** com uma consulta falhando, o painel não mostra zero.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 225 — Tratar erro na paleta de comandos e na navegação

**Onda / Severidade / Camada:** 5 / Baixa / Interface
**Achados resolvidos:** G27-1
**Problema hoje:** `src/components/lux/command-palette/CommandPalette.tsx:41,52`, `src/components/lux/layout/Sidebar.tsx:42,154` e `src/components/lux/layout/MobileBottomNav.tsx:34` sem tratamento de erro.
**Causa raiz:** idem.
**Caminho recomendado:** nestes casos, erro não deve bloquear a navegação: trate silenciosamente **mas** registre, e deixe a busca da paleta mostrar "não foi possível buscar" em vez de "nenhum resultado". A diferença importa: "nenhum resultado" faz o usuário achar que o dado não existe.
**Arquivos e objetos a tocar:** os três arquivos citados.
**Não tocar / armadilhas:** não faça a barra lateral quebrar por falha de consulta secundária.
**Depende de:** 224 · **Libera:** 226
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** com a busca falhando, a paleta diz que não conseguiu buscar.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 226 — Tratar carregamento e erro na página de monitoramento

**Onda / Severidade / Camada:** 5 / Alta / Interface
**Achados resolvidos:** G27-1
**Problema hoje:** `src/pages/Monitoring.tsx` tem 736 linhas, cerca de 40 painéis e **nenhum** tratamento de erro ou de vazio (`grep` por `isError` no arquivo → zero). É a tela que o dono usa para saber se o sistema está saudável.
**Causa raiz:** idem, em escala.
**Caminho recomendado:** não trate os 40 painéis de uma vez. Crie um componente de envoltório (`PainelComEstado`, por exemplo) que receba os três estados da consulta e cuide de esqueleto, erro e vazio; depois aplique-o aos painéis em grupos de cinco, uma pull request por grupo. Comece pelos painéis que o dono olha primeiro: SLA, fila morta e incidentes. Esta etapa entrega o envoltório e o primeiro grupo.
**Arquivos e objetos a tocar:** novo componente em `src/components/lux/monitoring/`, `src/pages/Monitoring.tsx` (primeiro grupo).
**Não tocar / armadilhas:** não refatore a página inteira numa pull request — ela tem 736 linhas e o diff ficaria impossível de revisar.
**Depende de:** 225, 251 · **Libera:** 227
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** com uma consulta do primeiro grupo falhando, o painel correspondente mostra erro e os outros continuam funcionando.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 227 — Aplicar o envoltório de estado ao segundo grupo de painéis de monitoramento

**Onda / Severidade / Camada:** 5 / Média / Interface
**Achados resolvidos:** G27-1
**Problema hoje:** continuação da etapa 226 — os demais painéis seguem sem estados.
**Causa raiz:** idem.
**Caminho recomendado:** aplique o envoltório da etapa 226 a mais cinco painéis.
**Arquivos e objetos a tocar:** `src/pages/Monitoring.tsx`.
**Não tocar / armadilhas:** —
**Depende de:** 226 · **Libera:** 228
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** idem etapa 226, no segundo grupo.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 228 — Aplicar o envoltório de estado ao terceiro grupo de painéis de monitoramento

**Onda / Severidade / Camada:** 5 / Média / Interface
**Achados resolvidos:** G27-1
**Problema hoje:** idem.
**Causa raiz:** idem.
**Caminho recomendado:** idem, mais cinco painéis.
**Arquivos e objetos a tocar:** `src/pages/Monitoring.tsx`.
**Não tocar / armadilhas:** —
**Depende de:** 227 · **Libera:** 229
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** idem.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 229 — Aplicar o envoltório de estado aos painéis restantes de monitoramento

**Onda / Severidade / Camada:** 5 / Média / Interface
**Achados resolvidos:** G27-1
**Problema hoje:** idem, últimos painéis.
**Causa raiz:** idem.
**Caminho recomendado:** conclua a aplicação e confirme, com uma varredura no arquivo, que não resta consulta sem tratamento.
**Arquivos e objetos a tocar:** `src/pages/Monitoring.tsx`.
**Não tocar / armadilhas:** —
**Depende de:** 228 · **Libera:** 230
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `grep -c "isError" src/pages/Monitoring.tsx` maior que zero e cobrindo todos os painéis.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 230 — Desfazer a atualização otimista das permissões quando a gravação falha

**Onda / Severidade / Camada:** 5 / Baixa / Hooks
**Achados resolvidos:** G5-2
**Problema hoje:** a auditoria confirmou que as duas atualizações otimistas do repositório **já têm** desfazimento (`src/hooks/useRolePermissions.ts:67-84` e `src/hooks/useDeals.ts:174-189`). Esta etapa é preventiva: garantir que novas atualizações otimistas sigam o mesmo padrão.
**Causa raiz:** —
**Caminho recomendado:** documente o padrão num comentário curto em `src/hooks/useRolePermissions.ts` indicando-o como referência, e acrescente um caso de teste que confirme o desfazimento em caso de erro. É pouco trabalho e protege o comportamento correto que já existe.
**Arquivos e objetos a tocar:** `src/hooks/useRolePermissions.ts`, novo teste em `src/hooks/__tests__/`.
**Não tocar / armadilhas:** não altere a lógica que já funciona.
**Depende de:** 229 · **Libera:** 231
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** o teste falha se o desfazimento for removido.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 231 — Fazer o limite de requisições da Lusha falhar fechado

**Onda / Severidade / Camada:** 5 / Média / Backend · custo
**Achados resolvidos:** G18-2
**Problema hoje:** `supabase/functions/lusha-search/index.ts:298-299` libera a chamada quando a verificação de limite falha — mesma falha de concepção da etapa 038, em outra função paga.
**Causa raiz:** priorizar disponibilidade sobre controle de custo.
**Caminho recomendado:** mesmo caminho da etapa 038: recuse a chamada e registre, com janela curta de tolerância se necessário.
**Arquivos e objetos a tocar:** `supabase/functions/lusha-search/index.ts`.
**Não tocar / armadilhas:** —
**Depende de:** 230, 038 · **Libera:** 232
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; custo).
**Como verificar:** com a verificação de limite indisponível, a chamada paga é recusada.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 232 — Criar limite de requisições nas cinco funções pagas que não têm nenhum

**Onda / Severidade / Camada:** 5 / Alta / Backend · custo
**Achados resolvidos:** G18-2
**Problema hoje:** sem nenhum limite: `supabase/functions/ai-agent`, `web-scrape-extract`, `gmaps-places-search`, `instagram-enqueue`, `web-scrape-enqueue`. Um laço de repetição no cliente gera fatura inesperada.
**Causa raiz:** limite implementado só onde houve incidente.
**Caminho recomendado:** reutilize `supabase/functions/_shared/api-rate-limit.ts` — depois da etapa 038, ele falha fechado — aplicando-o nas cinco, com limites por organização definidos com o dono. Uma função por commit, todas na mesma pull request.
**Arquivos e objetos a tocar:** as cinco funções citadas.
**Não tocar / armadilhas:** limites baixos travam uso legítimo; comece folgado e aperte com base no consumo real (que a etapa 149 passa a registrar).
**Depende de:** 231, 038 · **Libera:** —
**Risco e como reverter:** `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; afeta uso e custo).
**Como verificar:** exceder o limite em teste → recusa com mensagem clara; uso normal não é afetado.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

---

## ONDA 6 — Performance (233–250)

### Etapa 233 — Paginar a lista de empresas no servidor

**Onda / Severidade / Camada:** 6 / Alta / Interface · dados
**Achados resolvidos:** G19-1
**Problema hoje:** `src/components/lux/CompaniesView.tsx:73` define 20 itens por página, mas `:80` executa `db.from("companies").select("*")` **sem** `.limit()` nem `.range()` — baixa a tabela inteira e pagina no navegador. Pior: o PostgREST corta a resposta no teto da hospedagem **sem avisar**, e `supabase/config.toml` não define esse teto, então lista, contadores, filtros e mapa passam a mentir em silêncio quando a carteira cresce.
**Causa raiz:** paginação implementada só na interface.
**Caminho recomendado:** use `.range()` com a página atual e peça a contagem exata ao servidor (`{ count: "exact" }`), mostrando "exibindo X de Y" como `src/pages/AdminCompanies.tsx:52` já faz. Os filtros e a ordenação precisam ir para o servidor junto — senão a página 2 filtra apenas o que veio na página 2. É a parte trabalhosa: faça filtro por filtro, conferindo cada um.
**Arquivos e objetos a tocar:** `src/components/lux/CompaniesView.tsx`, possivelmente `src/hooks/useVirtualCompanies.ts`.
**Não tocar / armadilhas:** a busca por texto precisa de índice no servidor, senão a paginação fica lenta — veja a etapa 246. Não remova a virtualização da lista; ela resolve outro problema (desenho), não o volume de dados.
**Depende de:** 084 · **Libera:** 234, 235, 246
**Risco e como reverter:** paginação no servidor com filtro incompleto mostra resultado errado. Teste cada filtro. Reverter = `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** com mais de 1.000 empresas, a primeira página carrega rápido, a contagem total está certa e cada filtro devolve o mesmo resultado de antes.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 234 — Definir o teto de linhas por resposta na configuração do banco

**Onda / Severidade / Camada:** 6 / Alta / Configuração
**Achados resolvidos:** G19-1
**Problema hoje:** `supabase/config.toml` não define `db_max_rows`, então vale o padrão da hospedagem — e o corte acontece sem o cliente saber.
**Causa raiz:** configuração implícita.
**Caminho recomendado:** defina um valor explícito (por exemplo 1.000) para que o comportamento seja previsível e igual em todos os ambientes, e confirme que as telas paginadas pedem menos que isso. Deixe um comentário dizendo por que o valor foi escolhido.
**Arquivos e objetos a tocar:** `supabase/config.toml`.
**Não tocar / armadilhas:** valor menor que o que alguma tela pede hoje passa a cortar silenciosamente **mais** casos — faça depois da etapa 233 e confira as demais listagens antes.
**Depende de:** 233 · **Libera:** 235
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (configuração de produção).
**Como verificar:** pedir mais linhas que o teto devolve exatamente o teto, e a tela mostra que há mais.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 235 — Paginar a lista de contatos no servidor

**Onda / Severidade / Camada:** 6 / Média / Interface · dados
**Achados resolvidos:** G19-1
**Problema hoje:** `src/components/lux/StakeholderFinderView.tsx:63` consulta sem limite.
**Causa raiz:** idem etapa 233.
**Caminho recomendado:** aplique o mesmo padrão da etapa 233.
**Arquivos e objetos a tocar:** `src/components/lux/StakeholderFinderView.tsx`.
**Não tocar / armadilhas:** a chave de cache desta tela foi ajustada na etapa 087 — mantenha.
**Depende de:** 234 · **Libera:** 236
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** idem etapa 233, nos contatos.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 236 — Parar de trazer o bloco de dados brutos para o mapa

**Onda / Severidade / Camada:** 6 / Alta / Interface · dados
**Achados resolvidos:** G19-1
**Problema hoje:** `src/components/lux/CompaniesMapView.tsx:27-37` consulta sem limite **e** inclui a coluna `raw_data`, que guarda a resposta bruta do provedor em formato JSON — pode ser dezenas de quilobytes por empresa. O mapa precisa apenas de coordenadas, nome e nota.
**Causa raiz:** seleção de todas as colunas.
**Caminho recomendado:** liste explicitamente as colunas que o mapa usa e acrescente limite. Esta é a correção de maior ganho por esforço de toda a onda: o volume transferido cai drasticamente.
**Arquivos e objetos a tocar:** `src/components/lux/CompaniesMapView.tsx`.
**Não tocar / armadilhas:** confirme no componente de marcador quais campos são lidos antes de cortar; `src/components/lux/map/MarkerClusterLayer.tsx:60` usa a nota.
**Depende de:** 235, 123 · **Libera:** 237
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** no painel de rede, o tamanho da resposta do mapa cai; o mapa continua mostrando os mesmos marcadores.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 237 — Varrer as consultas que selecionam todas as colunas sem necessidade

**Onda / Severidade / Camada:** 6 / Média / Dados
**Achados resolvidos:** G19-1
**Problema hoje:** `select("*")` é o padrão em mais de 20 arquivos; em tabelas com coluna JSON grande, isso multiplica o tráfego.
**Causa raiz:** conveniência.
**Caminho recomendado:** varra `grep -rn 'select("\*")' src/` e corrija **só** as consultas sobre tabelas com coluna de dados brutos ou de texto longo, listando as colunas usadas. Não faça as outras: o ganho é pequeno e o risco de esquecer uma coluna é real. Entregue a lista do que corrigiu e do que deixou, com o motivo.
**Arquivos e objetos a tocar:** os arquivos selecionados.
**Não tocar / armadilhas:** esquecer uma coluna causa erro só na tela que a usa — confira o componente consumidor de cada consulta alterada.
**Depende de:** 236 · **Libera:** 238
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** cada tela alterada continua mostrando todos os campos que mostrava.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 238 — Remover os índices duplicados dos registros de execução de automação

**Onda / Severidade / Camada:** 6 / Baixa / Banco
**Achados resolvidos:** G19-2
**Problema hoje:** `automation_execution_logs(organization_id, created_at DESC)` está indexada **três vezes**. Índice repetido custa espaço pago e torna cada escrita mais lenta.
**Causa raiz:** índices criados em migrations diferentes com nomes diferentes.
**Caminho recomendado:** confirme no painel quais índices existem e qual é usado (há estatísticas de uso de índice disponíveis), mantenha um e remova os outros com `DROP INDEX`. Faça por tabela, começando por esta, que é a pior.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** remover o índice errado degrada consulta em produção. Confirme o nome exato e, se tiver dúvida, remova um por vez e observe.
**Depende de:** 237 · **Libera:** 239
**Risco e como reverter:** migration que recria o índice (guarde a definição exata na PR).
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** a tabela passa a ter um índice para essa combinação; as consultas do painel de automações continuam rápidas.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 239 — Remover os cinco índices recriados com nome duplicado

**Onda / Severidade / Camada:** 6 / Baixa / Banco
**Achados resolvidos:** G19-2
**Problema hoje:** `supabase/migrations/20260514211631_*.sql:10-14` recriou com sufixo `_org_id` cinco índices que já existiam com sufixo `_org`.
**Causa raiz:** idem.
**Caminho recomendado:** idem etapa 238, para os cinco pares.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** idem.
**Depende de:** 238 · **Libera:** 240
**Risco e como reverter:** migration que recria.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** cada par vira um índice só.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 240 — Varrer e remover os demais índices duplicados

**Onda / Severidade / Camada:** 6 / Baixa / Banco
**Achados resolvidos:** G19-2
**Problema hoje:** a auditoria contou **11 grupos** de duplicidade; as etapas 238 e 239 cobrem seis.
**Causa raiz:** idem.
**Caminho recomendado:** liste os grupos restantes com a consulta de índices duplicados do painel, apresente na PR e remova os confirmados.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** idem.
**Depende de:** 239 · **Libera:** 241
**Risco e como reverter:** migration que recria.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** a consulta de duplicidade não devolve mais nenhum grupo.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 241 — Criar índices na tabela de chaves de idempotência

**Onda / Severidade / Camada:** 6 / Média / Banco
**Achados resolvidos:** G19-2
**Problema hoje:** `idempotency_keys` (`supabase/migrations/20260513140150_*.sql:2`) **não tem nenhum índice**, e é consultada em todo caminho que verifica duplicidade — inclusive nos que as etapas 164 e 165 vão criar.
**Causa raiz:** tabela criada sem índice.
**Caminho recomendado:** crie índice único sobre a chave (que é o critério de busca) e um índice por data para a limpeza periódica. Confirme as colunas antes.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** se houver duplicidade de chave na tabela, o índice único falha — levante antes.
**Depende de:** 240 · **Libera:** 242
**Risco e como reverter:** migration inversa.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** a verificação de idempotência fica rápida (compare o tempo da consulta antes e depois).
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 242 — Criar índices liderados pela organização nas oito tabelas que faltam

**Onda / Severidade / Camada:** 6 / Média / Banco
**Achados resolvidos:** G19-2
**Problema hoje:** em oito tabelas, `organization_id` não é a primeira coluna de nenhum índice — e **toda** consulta do sistema filtra por organização (é como o isolamento funciona). Sem índice liderante, o banco percorre a tabela inteira.
**Causa raiz:** índices criados pensando em outras consultas.
**Caminho recomendado:** identifique as oito tabelas (consulta de índices no painel) e crie, para cada uma, índice liderado pela organização combinado com a coluna de ordenação mais usada pela tela correspondente (normalmente a data de criação, em ordem decrescente). Uma migration por grupo de tabelas, para poder observar o efeito.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** índice custa espaço e deixa a escrita mais lenta; não crie em tabela de fila de alta rotatividade sem confirmar que a leitura justifica.
**Depende de:** 241 · **Libera:** 243
**Risco e como reverter:** migration inversa.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** o plano de execução das consultas dessas telas passa a usar o índice novo.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 243 — Medir as consultas mais lentas em produção

**Onda / Severidade / Camada:** 6 / Média / Banco
**Achados resolvidos:** G19-1, G19-2
**Problema hoje:** as etapas de performance até aqui vêm de leitura de código. Nenhuma medição de produção foi possível na auditoria.
**Causa raiz:** falta de acesso.
**Caminho recomendado:** **etapa de levantamento.** Com acesso ao painel, colete as consultas mais lentas e as mais frequentes, e cruze com as telas. Entregue a lista ordenada por impacto na PR. Isso transforma as próximas etapas de performance em decisões informadas em vez de palpite — e pode mostrar que alguma etapa desta onda não vale o esforço.
**Arquivos e objetos a tocar:** `docs/qa/05-PROGRESSO.md`.
**Não tocar / armadilhas:** nenhuma escrita.
**Depende de:** 002 · **Libera:** 244, 245, 246
**Risco e como reverter:** nenhum.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** a lista no corpo da PR, com tempo médio e número de execuções.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 244 — Corrigir a consulta mais lenta apontada pela medição

**Onda / Severidade / Camada:** 6 / Média / Banco
**Achados resolvidos:** G19-1
**Problema hoje:** a definir pela etapa 243.
**Causa raiz:** a definir.
**Caminho recomendado:** com a lista da etapa 243, pegue a consulta de maior impacto (tempo médio multiplicado por frequência), leia o plano de execução e corrija a causa — normalmente índice ausente, filtro que não usa índice, ou junção desnecessária. Documente o antes e o depois na PR. Se a correção for índice, é migration e precisa de aprovação.
**Arquivos e objetos a tocar:** a definir pela medição.
**Não tocar / armadilhas:** não otimize por intuição; use o plano de execução.
**Depende de:** 243 · **Libera:** 245
**Risco e como reverter:** conforme a correção.
**Precisa de aprovação humana antes do merge:** **sim**, se envolver migration.
**Como verificar:** tempo médio da consulta antes e depois, medidos no painel.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 245 — Corrigir a segunda consulta mais lenta apontada pela medição

**Onda / Severidade / Camada:** 6 / Média / Banco
**Achados resolvidos:** G19-1
**Problema hoje:** a definir pela etapa 243.
**Causa raiz:** a definir.
**Caminho recomendado:** idem etapa 244.
**Arquivos e objetos a tocar:** a definir.
**Não tocar / armadilhas:** idem.
**Depende de:** 244 · **Libera:** 246
**Risco e como reverter:** conforme a correção.
**Precisa de aprovação humana antes do merge:** **sim**, se envolver migration.
**Como verificar:** idem etapa 244.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 246 — Criar índice de busca por texto para a lista de empresas

**Onda / Severidade / Camada:** 6 / Média / Banco
**Achados resolvidos:** G19-1
**Problema hoje:** depois da etapa 233, a busca por nome passa a rodar no servidor; sem índice adequado, cada busca percorre a tabela.
**Causa raiz:** busca por texto sem índice.
**Caminho recomendado:** crie índice de texto (trigrama ou busca completa, conforme o tipo de busca que a tela oferece) sobre o nome da empresa, combinado com a organização. Confirme na etapa 243 se a busca aparece entre as consultas custosas — se não aparecer, registre que a etapa não é necessária e siga.
**Arquivos e objetos a tocar:** nova migration em `supabase/migrations/`.
**Não tocar / armadilhas:** índice de trigrama exige a extensão correspondente habilitada; confirme antes.
**Depende de:** 233, 243 · **Libera:** 247
**Risco e como reverter:** migration inversa.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** busca por parte do nome responde rápido com carteira grande, e o plano usa o índice.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 247 — Reduzir o volume de dados do painel inicial

**Onda / Severidade / Camada:** 6 / Média / Interface
**Achados resolvidos:** G19-1
**Problema hoje:** o painel inicial monta muitos componentes, cada um com consulta própria (o inventário de rotas mostra mais de 100 hooks na página `/`). Mesmo com cada consulta leve, o conjunto é pesado no primeiro acesso.
**Causa raiz:** composição de muitos painéis independentes.
**Caminho recomendado:** não reescreva o painel. Carregue sob demanda os painéis abaixo da primeira dobra (o repositório já usa carregamento tardio no registro de views — aplique a mesma ideia aos painéis) e confirme o ganho medindo o tempo até a tela ficar utilizável, antes e depois. Se o ganho for pequeno, registre e pare: a etapa não vale.
**Arquivos e objetos a tocar:** `src/components/lux/DashboardView.tsx`.
**Não tocar / armadilhas:** não quebre a ordem dos painéis que o usuário personalizou (o layout é salvo por usuário em `dashboard_layouts`).
**Depende de:** 246 · **Libera:** 248
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** medida de tempo até a tela ficar utilizável, antes e depois, registrada na PR.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 248 — Evitar consultas em cascata na lista de empresas

**Onda / Severidade / Camada:** 6 / Média / Interface · dados
**Achados resolvidos:** G19-1
**Problema hoje:** quando a lista desenha uma linha por empresa e cada linha busca algo próprio (por exemplo a contagem de contatos), o número de consultas cresce com o número de linhas.
**Causa raiz:** dado relacionado buscado por item.
**Caminho recomendado:** confirme primeiro se o problema existe: abra a lista com o painel de rede aberto e conte as requisições. Se houver uma por linha, traga o dado relacionado numa única consulta (junção ou agregação no servidor). Se não houver, registre que não se aplica e siga — não invente otimização.
**Arquivos e objetos a tocar:** `src/components/lux/CompaniesView.tsx`, `src/components/lux/CompanyTableRow.tsx`.
**Não tocar / armadilhas:** —
**Depende de:** 247 · **Libera:** 249
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** contagem de requisições ao abrir a lista, antes e depois.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 249 — Medir o tamanho do pacote do site e reduzir o maior item

**Onda / Severidade / Camada:** 6 / Baixa / Interface
**Achados resolvidos:** G19-1
**Problema hoje:** o projeto tem 495 arquivos de código e várias bibliotecas visuais; o tamanho do pacote nunca foi medido nesta auditoria.
**Causa raiz:** —
**Caminho recomendado:** rode `npm run analyze` (o script já existe em `package.json`) e identifique o maior item. Se for uma biblioteca usada em uma tela só, carregue-a sob demanda. Entregue a medição antes e depois. Se nada se destacar, registre e encerre a etapa — não troque biblioteca por esporte.
**Arquivos e objetos a tocar:** conforme a medição.
**Não tocar / armadilhas:** não remova dependência usada por componente de interface compartilhado sem conferir todos os usos.
**Depende de:** 248 · **Libera:** 250
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** tamanho do pacote antes e depois, no corpo da PR.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 250 — Medir e registrar o tamanho das maiores tabelas

**Onda / Severidade / Camada:** 6 / Média / Banco
**Achados resolvidos:** G19-2
**Problema hoje:** `docs/ESTADO_ATUAL.md` §R2 registra que uma tabela de registro de execução chegou a 1 gigabyte antes de ganhar política de retenção. Outras tabelas podem estar no mesmo caminho, e isso é custo direto.
**Causa raiz:** crescimento sem retenção.
**Caminho recomendado:** **etapa de levantamento.** Liste as dez maiores relações com tamanho e taxa de crescimento, e verifique quais têm rotina de limpeza entre as 12 existentes. Entregue a tabela na PR, apontando as que crescem sem limpeza. Cada retenção nova vira etapa própria, com aprovação, porque apaga dado.
**Arquivos e objetos a tocar:** `docs/qa/05-PROGRESSO.md`.
**Não tocar / armadilhas:** nenhuma escrita; não apague nada nesta etapa.
**Depende de:** 002 · **Libera:** —
**Risco e como reverter:** nenhum.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** a tabela das dez maiores relações, com cobertura de limpeza, no corpo da PR.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

---

## ONDA 7 — Experiência de uso e consistência (251–277)

### Etapa 251 — Corrigir o texto corrompido da página de monitoramento

**Onda / Severidade / Camada:** 7 / Alta / Interface
**Achados resolvidos:** G3-1
**Problema hoje:** `src/pages/Monitoring.tsx` tem **21 linhas** com duplo encoding, e o texto chega quebrado à tela. Confirmado no navegador pelo retrato do DOM capturado durante a execução Playwright: `heading "Monitoramento de AutomaÃ§Ãµes"` (`:239`), `textbox "Buscar execuÃ§Ãµes..."`, abas `"Status AutomaÃ§Ãµes"`, `"SaÃºde do Banco"`, `"LatÃªncia"`, `"Auditoria de ExecuÃ§Ã£o"`, opções `"ConcluÃdos"` e `"Ãšltimos 7 dias"`. Também afeta o cabeçalho do CSV exportado (`:195`) e os avisos (`:174`, `:214`).
**Causa raiz:** o arquivo foi salvo com texto UTF-8 relido como Latin-1 e gravado de novo — os bytes no arquivo já são a sequência errada.
**Caminho recomendado:** corrija as 21 linhas, uma a uma, escrevendo o texto correto em português. **Não** use conversão automática de arquivo inteiro: o arquivo tem 736 linhas e uma conversão errada estraga o que está certo. Localize as linhas com `grep -n -e "Ã§" -e "Ã£" -e "Ã©" -e "Ãº" -e "Ã¡" -e "Ãµ" src/pages/Monitoring.tsx` e confira o resultado com o mesmo comando (deve devolver vazio).
**Arquivos e objetos a tocar:** `src/pages/Monitoring.tsx`.
**Não tocar / armadilhas:** depois da correção, o teste `e2e/monitoring-navigation.spec.ts:21` volta a passar (etapa 082) — é o sinal de que a correção pegou. Cuidado com o editor: salve em UTF-8.
**Depende de:** — · **Libera:** 082, 226, 252
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `grep -c -e "Ã§" -e "Ã£" src/pages/Monitoring.tsx` → 0; `npx playwright test monitoring-navigation.spec.ts` → passa.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 252 — Corrigir o rótulo acessível corrompido na tela de login

**Onda / Severidade / Camada:** 7 / Média / Interface · acessibilidade
**Achados resolvidos:** G3-1, G26-1
**Problema hoje:** `src/components/lux/auth/LoginCard.tsx:77` tem `aria-label="VerificaÃ§Ã£o em duas etapas"` — um leitor de tela anuncia o texto quebrado. `:69` também tem comentário corrompido.
**Causa raiz:** idem etapa 251.
**Caminho recomendado:** corrija as duas linhas.
**Arquivos e objetos a tocar:** `src/components/lux/auth/LoginCard.tsx`.
**Não tocar / armadilhas:** —
**Depende de:** 251 · **Libera:** 253
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** a verificação por sequências corrompidas no arquivo devolve vazio.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 253 — Corrigir os comentários corrompidos do contexto de autenticação e criar verificação automática

**Onda / Severidade / Camada:** 7 / Baixa / Interface · CI
**Achados resolvidos:** G3-1
**Problema hoje:** `src/contexts/auth-context.ts:9-10` tem duas linhas de comentário corrompidas (não visíveis ao usuário). Mais importante: nada impede que o problema volte.
**Causa raiz:** idem.
**Caminho recomendado:** corrija as duas linhas e acrescente ao job de qualidade do CI uma verificação que falhe se encontrar sequências de duplo encoding em `src/`, `supabase/` ou `e2e/` — é um `grep` de cinco padrões, como os scripts de `scripts/` já fazem.
**Arquivos e objetos a tocar:** `src/contexts/auth-context.ts`, novo script em `scripts/`, `.github/workflows/ci.yml`.
**Não tocar / armadilhas:** o padrão de busca não pode acusar texto legítimo — teste contra o repositório inteiro depois das etapas 251 e 252 e confirme que devolve vazio.
**Depende de:** 252 · **Libera:** 254
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (altera CI).
**Como verificar:** o script devolve 0 no estado corrigido e 1 se você introduzir uma sequência corrompida de propósito num arquivo temporário.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 254 — Dar rótulo acessível aos controles da lista de automações

**Onda / Severidade / Camada:** 7 / Baixa / Acessibilidade
**Achados resolvidos:** G26-1
**Problema hoje:** `src/components/lux/AutomationsList.tsx:162,165` são botões só com ícone, sem rótulo para leitor de tela.
**Causa raiz:** ícone usado sem texto alternativo.
**Caminho recomendado:** acrescente `aria-label` descrevendo a ação ("Pausar fluxo", "Recarregar lista"). Se a etapa 070 removeu esses controles, registre como não aplicável.
**Arquivos e objetos a tocar:** `src/components/lux/AutomationsList.tsx`.
**Não tocar / armadilhas:** —
**Depende de:** 070, 253 · **Libera:** 255
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** cada botão só com ícone tem rótulo; confira com a verificação de acessibilidade de `e2e/accessibility.spec.ts`.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 255 — Dar rótulo acessível ao botão que apaga todas as notificações

**Onda / Severidade / Camada:** 7 / Média / Acessibilidade
**Achados resolvidos:** G26-1
**Problema hoje:** `src/components/lux/NotificationsPanel.tsx:191` é um botão só com ícone, sem rótulo — e executa `clearAll()`, que **apaga todas as notificações**. Quem usa leitor de tela pode acioná-lo sem saber o que faz.
**Causa raiz:** idem.
**Caminho recomendado:** acrescente rótulo explícito ("Marcar todas as notificações como lidas" ou "Apagar todas", conforme o comportamento real — leia a função antes de escrever o rótulo) e considere pedir confirmação, usando o `ConfirmProvider` que já existe (`src/hooks/useConfirm.tsx`, montado em `src/App.tsx:307`).
**Arquivos e objetos a tocar:** `src/components/lux/NotificationsPanel.tsx`.
**Não tocar / armadilhas:** o rótulo precisa corresponder ao que a função faz; não presuma pelo ícone.
**Depende de:** 254 · **Libera:** 256
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** o botão anuncia a ação correta e, se foi decidido, pede confirmação.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 256 — Dar rótulo acessível aos demais botões só com ícone

**Onda / Severidade / Camada:** 7 / Baixa / Acessibilidade
**Achados resolvidos:** G26-1
**Problema hoje:** `src/components/lux/CompanyTableRow.tsx:158`, `src/components/lux/organizations/WorkspaceSwitcher.tsx:37`, `src/components/lux/settings/ApiKeysPanel.tsx:103` e `src/components/lux/CompanyDetailModal.tsx:111` sem rótulo.
**Causa raiz:** idem.
**Caminho recomendado:** idem etapa 254, nos quatro.
**Arquivos e objetos a tocar:** os quatro arquivos citados.
**Não tocar / armadilhas:** o repositório **já acerta** em várias partes (diálogos com título, indicador de carregamento com papel, barra lateral com papel de navegação, botões com indicação de página atual) — não mexa nisso.
**Depende de:** 255 · **Libera:** 257
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `npx playwright test accessibility.spec.ts` continua passando e os quatro botões têm rótulo.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 257 — Reduzir o escopo do anúncio automático de mudança de tela

**Onda / Severidade / Camada:** 7 / Baixa / Acessibilidade
**Achados resolvidos:** G26-1
**Problema hoje:** `src/pages/Index.tsx:188` envolve a view inteira em `<main aria-live="polite">`, então o leitor de tela reanuncia a página toda a cada troca de aba — o oposto do pretendido.
**Causa raiz:** região de anúncio aplicada ao contêiner maior em vez de a uma área de mensagem.
**Caminho recomendado:** remova o anúncio automático do contêiner e crie uma região pequena e dedicada, que anuncie apenas o nome da tela ao trocar. Esse é o padrão correto para navegação em aplicação de página única.
**Arquivos e objetos a tocar:** `src/pages/Index.tsx`.
**Não tocar / armadilhas:** mantenha o elemento `main` e o atalho "pular para o conteúdo", que já existem e funcionam.
**Depende de:** 256 · **Libera:** 258
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** com leitor de tela, trocar de aba anuncia o nome da tela, não o conteúdo inteiro.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 258 — Dar aviso claro quando a organização ainda não carregou

**Onda / Severidade / Camada:** 7 / Média / Interface
**Achados resolvidos:** G1-1, G1-4
**Problema hoje:** depois das etapas 010 a 016, as telas passam a aguardar a organização em vez de consultar sem escopo. Sem um aviso, o usuário vê telas em carregamento sem entender.
**Causa raiz:** estado novo introduzido pelas correções de isolamento.
**Caminho recomendado:** use o `OrgErrorBanner` que já é global (`src/App.tsx:311`) para mostrar "carregando sua organização" enquanto não houver organização ativa, e evite que o menu ofereça itens de administração nesse intervalo (a etapa 015 corrige o papel assumido por padrão).
**Arquivos e objetos a tocar:** `src/components/lux/OrgErrorBanner.tsx`, possivelmente `src/contexts/ActiveOrgContext.tsx`.
**Não tocar / armadilhas:** não transforme o aviso em bloqueio de tela; o usuário deve conseguir navegar.
**Depende de:** 010, 015 · **Libera:** 259
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** com armazenamento local limpo, o primeiro acesso mostra o aviso e depois o conteúdo.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 259 — Esconder o menu de administração até o papel ser conhecido

**Onda / Severidade / Camada:** 7 / Média / Interface
**Achados resolvidos:** G1-4
**Problema hoje:** `src/hooks/usePermissions.ts:36` devolve `"admin"` quando não há organização ativa, então nos primeiros instantes qualquer usuário vê itens de administração.
**Causa raiz:** valor padrão permissivo.
**Caminho recomendado:** devolva um estado "desconhecido" em vez de `"admin"`, e faça a interface tratar "desconhecido" como "não mostrar ainda". Isso exige ajustar os consumidores de `usePermissions` — localize-os com `grep` e trate cada um. É a inversão correta: desconhecido não é administrador.
**Arquivos e objetos a tocar:** `src/hooks/usePermissions.ts` e seus consumidores.
**Não tocar / armadilhas:** se algum consumidor tratar "desconhecido" como "sem permissão" de forma permanente, a tela nunca mostra o item — garanta que o estado se resolve quando a organização chega.
**Depende de:** 258, 160 · **Libera:** 260
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** nos primeiros instantes após entrar, nenhum item de administração aparece; depois, aparece para quem tem o papel.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 260 — Validar as variáveis de ambiente do site na inicialização

**Onda / Severidade / Camada:** 7 / Média / Interface
**Achados resolvidos:** G34-2
**Problema hoje:** `src/integrations/supabase/client.ts:5-6,11` cria o cliente com `import.meta.env.VITE_SUPABASE_URL` e a chave sem nenhuma verificação; se faltarem, o aplicativo quebra com erro obscuro na inicialização. O comentário de `.env.test` confirma que o cliente gerado "nao tem fallback".
**Causa raiz:** arquivo gerado, sem validação.
**Caminho recomendado:** **não edite o arquivo gerado** (o cabeçalho diz "This file is automatically generated"). Crie um módulo próprio que valide as três variáveis e lance um erro com mensagem clara, e importe-o em `src/main.tsx` antes de montar a aplicação. Assim, o erro de configuração aparece legível em vez de quebrar em baixo nível.
**Arquivos e objetos a tocar:** novo módulo em `src/lib/`, `src/main.tsx`.
**Não tocar / armadilhas:** não quebre o ambiente de teste, que usa valores de exemplo em `.env.test` — valide a presença, não o conteúdo.
**Depende de:** 259 · **Libera:** 261
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** rodar o site sem uma das variáveis mostra a mensagem clara em vez de tela branca.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 261 — Unificar a classificação de empresa por nota numa única fonte

**Onda / Severidade / Camada:** 7 / Média / Interface
**Achados resolvidos:** G28-2
**Problema hoje:** depois da etapa 099 o limite de "qualificado" passa a ser único, mas as faixas de classificação (90/75/60 em `src/lib/company-filters-utils.ts:9-14`) continuam separadas das cores e rótulos usados em cada tela.
**Causa raiz:** apresentação definida por tela.
**Caminho recomendado:** exponha, no mesmo arquivo que guarda as faixas, uma função que devolva rótulo e cor para uma nota, e use-a nas telas (lista, mapa, detalhe, automação). Uma fonte, vários consumidores.
**Arquivos e objetos a tocar:** `src/lib/company-filters-utils.ts` e as telas que classificam nota.
**Não tocar / armadilhas:** não mude as faixas nesta etapa, só unifique a origem.
**Depende de:** 099 · **Libera:** 262
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** a mesma empresa aparece com a mesma classificação e a mesma cor em todas as telas.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 262 — Mostrar o estado de carregamento em todas as ações que chamam serviço pago

**Onda / Severidade / Camada:** 7 / Média / Interface
**Achados resolvidos:** G16-6, G18-2
**Problema hoje:** ações de enriquecimento e de busca externa podem ser clicadas duas vezes se o botão não indicar que está processando — e cada clique custa dinheiro.
**Causa raiz:** falta de estado visual durante a chamada.
**Caminho recomendado:** liste as ações que chamam serviço pago (enriquecer, revelar contato, buscar lugares, raspar) e garanta, em cada botão, que ele fique desabilitado com indicador enquanto a chamada está em curso. O repositório já usa esse padrão em vários botões — siga-o.
**Arquivos e objetos a tocar:** os componentes das ações pagas.
**Não tocar / armadilhas:** desabilitar sem indicador visual deixa o usuário achando que o clique não funcionou.
**Depende de:** 261, 075 · **Libera:** 263
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** com rede lenta simulada, cada botão pago fica desabilitado com indicador durante a chamada.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 263 — Pedir confirmação nas ações destrutivas em lote

**Onda / Severidade / Camada:** 7 / Média / Interface
**Achados resolvidos:** G5-3
**Problema hoje:** a exclusão em lote de empresas (`src/components/lux/CompaniesView.tsx:201-212`) afeta muitos registros de uma vez. Confirme se há diálogo de confirmação com a contagem; se não houver, é risco real de perda de trabalho.
**Causa raiz:** ação em lote sem barreira.
**Caminho recomendado:** use o `ConfirmProvider` já existente (`src/hooks/useConfirm.tsx`) para exigir confirmação informando **quantos** registros serão afetados. Faça o mesmo em qualquer outra ação em lote que encontrar.
**Arquivos e objetos a tocar:** `src/components/lux/CompaniesView.tsx` e outras telas com ação em lote.
**Não tocar / armadilhas:** não acrescente confirmação em ação de um registro só, que viraria atrito desnecessário.
**Depende de:** 262 · **Libera:** 264
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** excluir 5 empresas pede confirmação dizendo "5".
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 264 — Padronizar as mensagens de aviso ao usuário

**Onda / Severidade / Camada:** 7 / Baixa / Interface
**Achados resolvidos:** G27-2
**Problema hoje:** depois das etapas 199 a 216, haverá dezenas de mensagens novas de erro. Sem um padrão, cada uma fala de um jeito.
**Causa raiz:** mensagens escritas caso a caso.
**Caminho recomendado:** defina um formato curto (o que aconteceu, o que o usuário pode fazer) e aplique nas mensagens criadas pelas etapas anteriores. Não crie uma biblioteca de internacionalização nesta etapa — é escopo muito maior.
**Arquivos e objetos a tocar:** os arquivos das mensagens criadas nas ondas anteriores.
**Não tocar / armadilhas:** não troque mensagens que já existiam e estão boas.
**Depende de:** 216, 263 · **Libera:** 265
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** amostra de dez mensagens, antes e depois, no corpo da PR.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 265 — Remover ou concluir o aviso "em desenvolvimento" do mapa no painel de status

**Onda / Severidade / Camada:** 7 / Baixa / Interface
**Achados resolvidos:** G16-4
**Problema hoje:** `src/components/lux/monitoring/MonitoringView.tsx:202` exibe "Visualização de mapa em desenvolvimento" — texto de obra em produção.
**Causa raiz:** espaço reservado nunca preenchido.
**Caminho recomendado:** o sistema já tem mapa funcional (`src/components/lux/CompaniesMapView.tsx`). Ou aponte para ele, ou remova a seção. Não deixe o aviso.
**Arquivos e objetos a tocar:** `src/components/lux/monitoring/MonitoringView.tsx`.
**Não tocar / armadilhas:** —
**Depende de:** 064, 264 · **Libera:** 266
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** o texto não aparece mais em nenhuma tela (`grep -rn "em desenvolvimento" src/`).
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 266 — Varrer a interface por outros textos de obra e marcações de pendência

**Onda / Severidade / Camada:** 7 / Baixa / Interface
**Achados resolvidos:** G16-4, G16-6
**Problema hoje:** textos como "em desenvolvimento", "em breve", `TODO` e `WIP` podem aparecer em outras telas.
**Causa raiz:** —
**Caminho recomendado:** varra `grep -rniE "em desenvolvimento|em breve|coming soon|TODO|FIXME|WIP" src/` e separe o que é visível ao usuário do que é comentário de código. Remova ou conclua o que é visível; os comentários ficam para a onda 8 (etapa 294).
**Arquivos e objetos a tocar:** as telas apontadas.
**Não tocar / armadilhas:** não apague comentário de código nesta etapa.
**Depende de:** 265 · **Libera:** 267
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** a lista do que era visível e o que foi feito, no corpo da PR.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 267 — Mostrar na interface quando um webhook foi desativado por endereço inválido

**Onda / Severidade / Camada:** 7 / Média / Interface
**Achados resolvidos:** G17-5
**Problema hoje:** depois da etapa 173, webhooks com endereço inválido vão para a fila morta — e o cliente não é avisado.
**Causa raiz:** estado de falha sem apresentação.
**Caminho recomendado:** na tela de integrações, mostre o estado de cada webhook (ativo, com falhas recentes, desativado por erro) e o motivo da última falha. O dado já existe na tabela de entregas.
**Arquivos e objetos a tocar:** `src/components/lux/IntegrationsView.tsx` ou o componente de webhooks.
**Não tocar / armadilhas:** não exponha o corpo completo da resposta do destino, que pode conter dado sensível.
**Depende de:** 173, 266 · **Libera:** 268
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** webhook com endereço inválido aparece marcado com o motivo.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 268 — Mostrar a contagem total ao lado do que está sendo exibido nas listas

**Onda / Severidade / Camada:** 7 / Média / Interface
**Achados resolvidos:** G19-1
**Problema hoje:** depois da paginação no servidor (etapas 233 e 235), o usuário precisa saber quantos registros existem no total — senão não sabe se está vendo tudo. `src/pages/AdminCompanies.tsx:52` já faz isso e serve de referência.
**Causa raiz:** —
**Caminho recomendado:** mostre "exibindo X de Y" nas listas paginadas, usando a contagem exata que a etapa 233 passou a pedir.
**Arquivos e objetos a tocar:** `src/components/lux/CompaniesView.tsx`, `src/components/lux/StakeholderFinderView.tsx`.
**Não tocar / armadilhas:** contagem exata em tabela muito grande pode ser lenta; se a medição da etapa 243 mostrar isso, use contagem aproximada e deixe claro que é aproximada.
**Depende de:** 233, 235 · **Libera:** 269
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** a contagem exibida corresponde ao total real.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 269 — Mostrar o progresso das tarefas de raspagem enfileiradas

**Onda / Severidade / Camada:** 7 / Média / Interface
**Achados resolvidos:** G16-1
**Problema hoje:** depois das etapas 051 a 053 a raspagem passa a gravar resultados, mas o usuário continua sem saber em que ponto a tarefa está. Combinado com o estado antigo em que a tarefa era marcada como concluída sem dados, a confiança na funcionalidade está baixa.
**Causa raiz:** estado da fila não apresentado.
**Caminho recomendado:** a tela de resultados de raspagem já existe (`src/components/lux/ScrapeResultsView.tsx`) e há monitoramento em tempo real (`src/hooks/useRealtimeScrapeJobs.ts`). Mostre, por tarefa, o estado atual, quantos resultados já chegaram e, em caso de falha, o motivo registrado na auditoria da tarefa.
**Arquivos e objetos a tocar:** `src/components/lux/ScrapeResultsView.tsx`.
**Não tocar / armadilhas:** não crie consulta nova em tempo real; reutilize o hook existente.
**Depende de:** 051, 268 · **Libera:** 270
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** acompanhar uma raspagem do início ao fim pela tela, com os estados aparecendo.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 270 — Mostrar o motivo quando uma empresa não pôde ser enriquecida

**Onda / Severidade / Camada:** 7 / Média / Interface
**Achados resolvidos:** G20-1
**Problema hoje:** empresa com CNPJ fora do padrão nunca casa com o cache e o enriquecimento falha em silêncio (antes das etapas 116 e 117). Mesmo depois, pode falhar por outros motivos, e o usuário não sabe qual.
**Causa raiz:** falha de enriquecimento sem apresentação.
**Caminho recomendado:** mostre, no detalhe da empresa, o estado do último enriquecimento e o motivo da falha quando houver. Se não existir campo para isso, use o registro da fila de enriquecimento, que já guarda estado.
**Arquivos e objetos a tocar:** `src/components/lux/CompanyDetailModal.tsx`.
**Não tocar / armadilhas:** não exponha mensagem técnica do provedor; resuma.
**Depende de:** 116, 269 · **Libera:** 271
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** empresa com enriquecimento falho mostra o motivo.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 271 — Revisar o comportamento das telas em tela de celular

**Onda / Severidade / Camada:** 7 / Média / Interface
**Achados resolvidos:** G16-6
**Problema hoje:** a auditoria encontrou um caso em que a versão de celular funciona e a de computador não (`src/components/lux/CompanyTableRow.tsx:141` contra `:163`) — sinal de que as duas versões divergem. Os testes de interface cobrem apenas duas verificações de celular.
**Causa raiz:** duas implementações para o mesmo componente.
**Caminho recomendado:** percorra as telas principais nas larguras de celular e de computador e registre as divergências encontradas. Corrija as que forem defeito (ação ausente de um lado); deixe as que forem adaptação intencional. Entregue a lista na PR.
**Arquivos e objetos a tocar:** os componentes com divergência.
**Não tocar / armadilhas:** não unifique as duas versões num componente só nesta etapa — seria mudança de arquitetura.
**Depende de:** 079, 270 · **Libera:** 272
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** a lista de divergências e o que foi corrigido, no corpo da PR.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 272 — Cobrir com teste de interface as telas de celular

**Onda / Severidade / Camada:** 7 / Baixa / Testes
**Achados resolvidos:** G16-6
**Problema hoje:** só duas verificações de celular existem em `e2e/navigation.spec.ts:330,336`.
**Causa raiz:** cobertura mínima.
**Caminho recomendado:** acrescente verificações para as telas principais em largura de celular, reaproveitando o modo demonstração que os testes já usam (`e2e/helpers/auth.ts:7`). Comece por lista de empresas, funil e painel inicial.
**Arquivos e objetos a tocar:** `e2e/navigation.spec.ts` ou novo arquivo em `e2e/`.
**Não tocar / armadilhas:** depois da etapa 092, o modo demonstração pode não cobrir todas as rotas — ajuste os testes conforme a decisão tomada lá.
**Depende de:** 271, 092 · **Libera:** 273
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `npx playwright test` → os novos casos passam.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 273 — Atualizar o documento de estado atual com os achados desta auditoria

**Onda / Severidade / Camada:** 7 / Média / Documentação
**Achados resolvidos:** G24-1
**Problema hoje:** `docs/ESTADO_ATUAL.md` afirma "eslint 0 errors" (são 22), e `AGENTS.md` afirma que o repositório é privado (é público), que não há proteção de branch (há) e que o arquivo de CI está ilegível (não está).
**Causa raiz:** documentos de estado não acompanharam as mudanças.
**Caminho recomendado:** corrija as oito divergências listadas no achado G24-1 de `docs/qa/03-ACHADOS.md`, citando a evidência de cada uma. Esses documentos são o que o dono e os agentes leem antes de decidir — mantê-los errados é o que fez esta auditoria encontrar dois riscos sérios que já estavam "resolvidos" no papel.
**Arquivos e objetos a tocar:** `docs/ESTADO_ATUAL.md`, `AGENTS.md`, `docs/agentes/github-ci.md`, `docs/agentes/banco.md`.
**Não tocar / armadilhas:** `AGENTS.md` tem verificação de integridade (`node scripts/ci/check-claude-md-integrity.mjs`) — rode-a depois de editar.
**Depende de:** 272 · **Libera:** 274
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (altera as instruções que os agentes seguem).
**Como verificar:** cada uma das oito afirmações corrigida com a evidência citada; a verificação de integridade passa.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 274 — Corrigir a referência errada ao projeto do banco nas instruções

**Onda / Severidade / Camada:** 7 / Média / Documentação
**Achados resolvidos:** G24-1, G23-2
**Problema hoje:** `AGENTS.md` §Banco afirma que `supabase/config.toml:1` está cravado no projeto errado — mas hoje a linha traz o projeto oficial; e cita `supabase/functions/mcp/index.ts:220` como prova do projeto oficial, quando a linha diz `local-e2e`. As duas afirmações estão desatualizadas em direções opostas.
**Causa raiz:** idem.
**Caminho recomendado:** corrija as duas, deixando claro que o único lugar com referência errada era `e2e/helpers/supabase.ts:18` (resolvido na etapa 006) e que o pacote da função MCP tinha o projeto de teste (resolvido na etapa 046).
**Arquivos e objetos a tocar:** `AGENTS.md`, `docs/agentes/banco.md`.
**Não tocar / armadilhas:** idem etapa 273 sobre a verificação de integridade.
**Depende de:** 273, 006, 046 · **Libera:** 275
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (instruções de agentes).
**Como verificar:** as duas afirmações correspondem ao código atual.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 275 — Documentar o procedimento de volta atrás do deploy

**Onda / Severidade / Camada:** 7 / Alta / Documentação · infraestrutura
**Achados resolvidos:** G22-3
**Problema hoje:** busca por `rollback`, `reverter` e `revert` em `docs/agentes/lovable-deploy.md` e `docs/agentes/github-ci.md` → **zero ocorrências**. Juntar na `main` publica o site automaticamente e `.github/workflows/db-migrations.yml:165-169` aplica migrations em produção. Quando algo quebrar, ninguém sabe o caminho de volta.
**Causa raiz:** procedimento nunca escrito.
**Caminho recomendado:** escreva um documento curto e operacional com três caminhos: (1) voltar o site (a plataforma de hospedagem permite promover um deploy anterior — descreva os passos exatos); (2) voltar uma migration (não há volta automática; descreva como escrever a migration inversa e o que fazer quando há perda de dado); (3) voltar uma edge function (publicar a versão anterior). Para cada um, diga quem pode fazer e quanto tempo leva. Teste o caminho (1) de verdade num horário de baixo uso, com o dono ciente — procedimento não testado não existe.
**Arquivos e objetos a tocar:** novo documento em `docs/agentes/`, referenciado em `AGENTS.md`.
**Não tocar / armadilhas:** não teste o caminho (2) em produção.
**Depende de:** 274 · **Libera:** 276
**Risco e como reverter:** a verificação do caminho (1) causa uma troca de versão momentânea — combine o horário.
**Precisa de aprovação humana antes do merge:** **sim** (envolve operação em produção).
**Como verificar:** o caminho (1) executado e revertido, com o registro do tempo que levou.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 276 — Zerar os 22 erros de lint herdados

**Onda / Severidade / Camada:** 7 / Média / Higiene
**Achados resolvidos:** G2-2
**Problema hoje:** `npm run lint` sai com **exit 1** e 22 erros (medido na auditoria), todos do tipo "tipo não especificado": 15 em `supabase/functions/_shared/hiker-client.ts`, 2 em `supabase/functions/instagram-enqueue/index.ts:51,60`, 2 em `supabase/functions/instagram-worker/index.ts:37,74`, 1 em `supabase/functions/latency-alerts/index.ts:40` e os demais. A instrução oficial do repositório manda rodar esse comando antes de cada pull request, o que hoje é impossível de interpretar.
**Causa raiz:** dívida acumulada, congelada pelo mecanismo de limite progressivo (`scripts/ci/lint-ratchet.mjs`, que aceita 26 ocorrências).
**Caminho recomendado:** declare os tipos reais, arquivo por arquivo, começando pelo cliente de integração (15 dos 22). Onde o formato do terceiro não for conhecido, use um tipo mínimo com os campos realmente usados — não troque um tipo vago por outro. Depois de zerar, reduza o limite do mecanismo progressivo com `npm run lint:ratchet:update` para que a dívida não volte.
**Arquivos e objetos a tocar:** os cinco arquivos com erro, `scripts/ci/lint-ratchet.mjs` (linha de base).
**Não tocar / armadilhas:** não desligue a regra no arquivo de configuração do lint — seria esconder o problema. As etapas 176 e 178 também mexem em alguns desses arquivos; coordene para não conflitar.
**Depende de:** 176 · **Libera:** 277
**Risco e como reverter:** tipagem errada pode mudar comportamento; os tipos dessas linhas descrevem respostas de terceiros, então confirme contra um exemplo real de resposta. Reverter = `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `npm run lint` → **exit 0**; `node scripts/ci/lint-ratchet.mjs` com a linha de base nova → passa.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 277 — Corrigir os quatro avisos de lint restantes

**Onda / Severidade / Camada:** 7 / Baixa / Higiene
**Achados resolvidos:** G2-2
**Problema hoje:** quatro avisos: `src/App.tsx:93` (exportação que atrapalha a atualização instantânea) e três em `src/components/lux/monitoring/SourceComparisonReport.tsx:68` (expressão que muda a cada desenho e invalida a memorização).
**Causa raiz:** —
**Caminho recomendado:** mova `safeNextPath` de `src/App.tsx:93` para um módulo próprio em `src/lib/` (a função é exportada e testada, então o movimento é seguro — confira os importadores). Em `SourceComparisonReport.tsx:68`, estabilize a expressão como o próprio aviso sugere.
**Arquivos e objetos a tocar:** `src/App.tsx`, novo módulo em `src/lib/`, `src/components/lux/monitoring/SourceComparisonReport.tsx`.
**Não tocar / armadilhas:** `safeNextPath` tem teste; atualize o caminho de importação no teste.
**Depende de:** 276 · **Libera:** —
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `npm run lint` → exit 0 e zero avisos.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

---

## ONDA 8 — Higiene: código morto, CI e observabilidade (278–300)

### Etapa 278 — Regerar o pacote da função MCP com as dependências atuais

**Onda / Severidade / Camada:** 8 / Alta / Backend
**Achados resolvidos:** G8-1
**Problema hoje:** `package.json:72,130` declaram `@lovable.dev/mcp-js ^3.5.0` e `zod ^4.6.7`, e o pacote versionado `supabase/functions/mcp/index.ts` importa `@lovable.dev/mcp-js@0.24.0` e `zod@^3.25.76`. Medido na auditoria: rodar `npm run dev` ou `npm run build` regera o arquivo e deixa 13 linhas alteradas, todas de versão — aconteceu duas vezes durante a auditoria.
**Causa raiz:** pacote gerado é versionado, mas não é regerado nem conferido quando as dependências sobem.
**Caminho recomendado:** regere o pacote com as dependências instaladas, **teste a função** antes de publicar (a mudança atravessa duas versões maiores: zod 3→4 e a biblioteca 0.24→3.5, e ninguém testou essa combinação) e comite o resultado. Se a função quebrar com a versão nova, a decisão passa a ser do dono: fixar as dependências na versão antiga ou adaptar o código de `src/lib/mcp/`. Faça junto da etapa 046, que corrige o identificador de projeto no mesmo arquivo.
**Arquivos e objetos a tocar:** `supabase/functions/mcp/index.ts` (gerado), possivelmente `src/lib/mcp/`.
**Não tocar / armadilhas:** `eslint.config.js:9` exclui esse arquivo da análise, então nenhum portão vai avisar de erro nele. Leia o diff inteiro.
**Depende de:** 046 · **Libera:** 279
**Risco e como reverter:** se a versão nova quebrar o canal MCP, a integração para. Teste antes. Reverter = `git revert` + redeploy.
**Precisa de aprovação humana antes do merge:** **sim** (produção; mudança de versão maior de dependência).
**Como verificar:** a função responde às chamadas do canal MCP depois do deploy, com o cliente real.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 279 — Criar verificação que impeça o pacote gerado de divergir do gerador

**Onda / Severidade / Camada:** 8 / Média / CI
**Achados resolvidos:** G8-1
**Problema hoje:** nada avisa quando o pacote versionado fica para trás das dependências; a divergência só aparece como arquivo "sujo" na máquina de quem roda o projeto.
**Causa raiz:** artefato gerado sem verificação de atualidade.
**Caminho recomendado:** acrescente ao job de qualidade um passo que regere o pacote e falhe se o resultado diferir do que está versionado — o padrão é o mesmo que a etapa 008 usa para o arquivo de referência de tabelas. Assim, subir dependência sem regerar passa a quebrar o CI em vez de ficar silencioso.
**Arquivos e objetos a tocar:** `.github/workflows/ci.yml`, possivelmente novo script em `scripts/ci/`.
**Não tocar / armadilhas:** a geração precisa ser determinística; se a ferramenta gerar saída diferente a cada execução, o passo fica instável — confirme antes com duas execuções seguidas.
**Depende de:** 278 · **Libera:** 280
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (altera CI).
**Como verificar:** o passo passa no estado atual e falha se você alterar uma versão em `package.json` sem regerar.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 280 — Trocar a instalação de dependências do CI por instalação fiel ao arquivo de trava

**Onda / Severidade / Camada:** 8 / Média / CI
**Achados resolvidos:** G8-2
**Problema hoje:** o CI usa `npm install`, que **reescreve** o arquivo de trava. Medido na auditoria: `npm install --legacy-peer-deps` alterou `package-lock.json` (30 linhas removidas), porque o arquivo foi gerado por outra versão de npm ou outra plataforma. Duas construções do mesmo commit podem instalar versões diferentes.
**Causa raiz:** instalação que resolve em vez de respeitar.
**Caminho recomendado:** regere o arquivo de trava localmente com a mesma versão de npm que o CI usa, comite, e troque o comando do CI por `npm ci --legacy-peer-deps`, que falha quando o arquivo está divergente — exatamente o que se quer. Faça nesta ordem, ou o CI quebra de imediato.
**Arquivos e objetos a tocar:** `package-lock.json`, `.github/workflows/ci.yml` e os outros workflows que instalam dependências.
**Não tocar / armadilhas:** a árvore de dependências tem faixas incompatíveis declaradas (é por isso que existe a opção `--legacy-peer-deps`) — mantenha a opção. Não remova `bun.lock` nem `bun.lockb` nesta etapa (é a 281).
**Depende de:** 279 · **Libera:** 281
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (altera CI).
**Como verificar:** `npm ci --legacy-peer-deps` roda sem alterar o arquivo de trava; o CI continua verde.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 281 — Decidir qual gerenciador de pacotes o projeto usa

**Onda / Severidade / Camada:** 8 / Média / Higiene
**Achados resolvidos:** G23-7
**Problema hoje:** coexistem três arquivos de trava — `package-lock.json`, `bun.lock` e `bun.lockb` (binário). O CI usa npm; `.husky/pre-commit:1` usa `node` (embora a documentação afirme que usa bun). Três travas significa três árvores de dependência possíveis.
**Causa raiz:** migração de gerenciador que nunca terminou.
**Caminho recomendado:** pergunte ao dono qual é o gerenciador oficial. O CI usa npm, o que é o argumento mais forte. Escolhido um, remova as travas dos outros e ajuste a documentação (`AGENTS.md` §Stack). Não mantenha dois "por garantia": é a origem de defeito que só aparece em um ambiente.
**Arquivos e objetos a tocar:** remoção de arquivos de trava, `AGENTS.md`, possivelmente `.husky/pre-commit`.
**Não tocar / armadilhas:** confirme que nenhum script de `package.json` chama `bun` antes de remover (`npm run generate-audit-pdf` chama).
**Depende de:** 280 · **Libera:** 282
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (decisão de projeto).
**Como verificar:** apenas uma trava no repositório; instalação e portões funcionam.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 282 — Resolver a configuração duplicada e quebrada do verificador de mensagem de commit

**Onda / Severidade / Camada:** 8 / Média / Higiene
**Achados resolvidos:** G23-3
**Problema hoje:** `npx commitlint` **falha** com erro de módulo (medido na auditoria); existem dois arquivos de configuração (`commitlint.config.cjs` e `commitlint.config.js`) e **não existe** o gatilho que o executaria. Ligar a verificação hoje travaria todos os commits.
**Causa raiz:** configuração duplicada em formatos incompatíveis com o tipo de módulo do projeto.
**Caminho recomendado:** remova `commitlint.config.js` (o formato `.cjs` é o compatível, já que o projeto declara módulos ES), confirme que `npx commitlint --from HEAD~1` roda sem erro, **e só então** crie `.husky/commit-msg`. Nesta ordem — criar o gatilho antes travaria os commits.
**Arquivos e objetos a tocar:** remover `commitlint.config.js`, novo `.husky/commit-msg`.
**Não tocar / armadilhas:** teste o gatilho com uma mensagem válida e uma inválida antes de propor o merge; se travar, qualquer um que clonar o repositório fica impedido de comitar.
**Depende de:** 281 · **Libera:** 283
**Risco e como reverter:** apagar `.husky/commit-msg`.
**Precisa de aprovação humana antes do merge:** **sim** (afeta o fluxo de trabalho de todos).
**Como verificar:** commit com mensagem no padrão passa; fora do padrão é recusado com mensagem clara.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 283 — Fazer o CI cobrar o limite de cobertura que o projeto declara

**Onda / Severidade / Camada:** 8 / Média / CI
**Achados resolvidos:** G2-2 (B2 da camada de infraestrutura)
**Problema hoje:** `vitest.config.ts:14-19` declara limite de 70% de cobertura, e o CI roda `npm run test` **sem** medir cobertura — o limite nunca é cobrado.
**Causa raiz:** configuração declarada e não exercida.
**Caminho recomendado:** **primeiro meça**: rode `npm run test:coverage` e veja onde o projeto está hoje. Se estiver abaixo de 70%, não ligue o limite de imediato (o CI ficaria vermelho) — ajuste o limite para o valor atual e combine com o dono subi-lo aos poucos, como o mecanismo progressivo do lint já faz. Entregue o número medido na PR.
**Arquivos e objetos a tocar:** `.github/workflows/ci.yml`, `vitest.config.ts`.
**Não tocar / armadilhas:** medir cobertura deixa o CI mais lento; confirme o tempo adicional.
**Depende de:** 282 · **Libera:** 284
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (altera CI).
**Como verificar:** o CI reprova uma pull request que derrube a cobertura abaixo do limite configurado.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 284 — Colocar os testes de interface em algum workflow

**Onda / Severidade / Camada:** 8 / Alta / CI
**Achados resolvidos:** G2-3
**Problema hoje:** o Playwright **não roda em nenhum workflow**, embora os segredos `E2E_TEST_EMAIL` e `E2E_TEST_PASSWORD` estejam cadastrados e sem uso. Foi por isso que dois casos quebrados ficaram na `main` sem ninguém notar (etapas 081 e 082).
**Causa raiz:** suíte criada e nunca integrada.
**Caminho recomendado:** acrescente um job que rode a suíte de interface. Comece **só** com os casos que funcionam em modo demonstração (navegação, rotas protegidas, acessibilidade), que não precisam de banco — assim o job é estável desde o primeiro dia. Os casos que falam com o banco entram depois, com as variáveis da etapa 006, em etapa própria. Rode em cada pull request; se o tempo incomodar, rode em agendamento diário.
**Arquivos e objetos a tocar:** `.github/workflows/ci.yml` ou novo workflow.
**Não tocar / armadilhas:** a suíte sobe um servidor de desenvolvimento (`playwright.config.ts:38-43`) e precisa das três variáveis do site; use valores de exemplo, como `.env.test` faz. Rode com o registro de rastreamento desligado para não gastar tempo.
**Depende de:** 081, 082, 006 · **Libera:** 285
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (altera CI).
**Como verificar:** o job roda e passa numa pull request de teste; quebrando um caso de propósito, o job reprova.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 285 — Incluir a suíte de garantias de acesso no CI

**Onda / Severidade / Camada:** 8 / Alta / CI · segurança
**Achados resolvidos:** G2-1
**Problema hoje:** depois das etapas 006 e 007 a suíte passa a valer algo; sem rodar no CI, continua sem efeito.
**Causa raiz:** idem etapa 284.
**Caminho recomendado:** acrescente a suíte de garantias de acesso ao job criado na etapa 284, com as variáveis de endereço e chave do projeto apontando para **produção em modo leitura** (a chave publicável é pública por projeto e não concede privilégio). Configure também os dois usuários de teste (`E2E_USER_A_*`, `E2E_USER_B_*`) para que os dois casos de isolamento entre inquilinos deixem de ser pulados — é a verificação mais valiosa da suíte e a única que prova o isolamento de verdade. Peça ao dono a criação desses dois usuários em organizações distintas.
**Arquivos e objetos a tocar:** `.github/workflows/ci.yml` ou o workflow da etapa 284.
**Não tocar / armadilhas:** os usuários de teste não devem ter dado real; e a suíte **não** deve escrever em produção — confirme lendo os casos antes de ligar.
**Depende de:** 284, 007 · **Libera:** 286
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (CI com acesso a produção e criação de usuários de teste).
**Como verificar:** os 77 casos rodam contra o projeto real, com tempo por caso acima de 50 ms (prova de ida à rede), e os 2 casos de isolamento deixam de ser pulados.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 286 — Fazer o CI avisar quando falhar

**Onda / Severidade / Camada:** 8 / Alta / CI · observabilidade
**Achados resolvidos:** G22-2
**Problema hoje:** **nenhum** workflow notifica falha; o único `if: failure()` do repositório escreve no resumo da execução, que só é visto por quem abre a página. Um deploy pode quebrar produção e ninguém saber.
**Causa raiz:** nenhum canal de aviso configurado.
**Caminho recomendado:** pergunte ao dono por qual canal ele quer ser avisado (e-mail é o mais simples e não exige integração nova; o GitHub já envia aviso de falha para quem acompanha o repositório — confirme se ele acompanha). Configure o mínimo que funcione e **teste provocando uma falha** numa branch de teste. Aviso não testado não é aviso.
**Arquivos e objetos a tocar:** os workflows, ou a configuração de notificação do repositório.
**Não tocar / armadilhas:** não configure canal que exija segredo novo sem necessidade; comece pelo caminho que já existe.
**Depende de:** 285 · **Libera:** 287
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (infraestrutura).
**Como verificar:** falha provocada numa branch de teste gera aviso recebido de fato.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 287 — Ligar o teste de fumaça de produção ao deploy

**Onda / Severidade / Camada:** 8 / Alta / CI · observabilidade
**Achados resolvidos:** G22-2
**Problema hoje:** o teste de fumaça de produção roda por agendamento às 09:00 UTC, **desacoplado do deploy**. Um deploy quebrado às 10h só seria detectado no dia seguinte.
**Causa raiz:** verificação temporal em vez de verificação pós-mudança.
**Caminho recomendado:** acrescente a execução do teste de fumaça depois do deploy, e mantenha também o agendamento (os dois se complementam: um pega regressão de mudança, o outro pega quebra externa). Combine com a etapa 286 para que a falha avise alguém.
**Arquivos e objetos a tocar:** o workflow do teste de fumaça e o de deploy.
**Não tocar / armadilhas:** o deploy do site é feito pela plataforma de hospedagem, não pelo workflow — então o gatilho precisa ser o evento de deploy concluído, não o merge. Confirme como esse evento chega.
**Depende de:** 286 · **Libera:** 288
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (CI e deploy).
**Como verificar:** um deploy de teste dispara o teste de fumaça e o resultado aparece.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 288 — Reavaliar a permissividade da revisão de dependências

**Onda / Severidade / Camada:** 8 / Média / CI
**Achados resolvidos:** G10-1 (B3 da camada de infraestrutura)
**Problema hoje:** `.github/workflows/dependency-review.yml:36` tem `continue-on-error: true`, justificado em comentário por o repositório ser privado — premissa **falsa**, como a etapa 010 mostrou (ele é público).
**Causa raiz:** justificativa baseada em premissa errada.
**Caminho recomendado:** se o repositório voltar a ser privado (ação imediata recomendada antes da Onda 1), a justificativa se restabelece e a etapa é só corrigir o comentário. Se continuar público, remova a tolerância e deixe o passo reprovar. Confirme com o dono qual é o caso antes de alterar.
**Arquivos e objetos a tocar:** `.github/workflows/dependency-review.yml`.
**Não tocar / armadilhas:** —
**Depende de:** 287 · **Libera:** 289
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (altera CI).
**Como verificar:** o passo reprova uma pull request com dependência vulnerável conhecida, se for o caso escolhido.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 289 — Incluir a verificação de integridade das instruções de agente num portão

**Onda / Severidade / Camada:** 8 / Baixa / CI
**Achados resolvidos:** G24-1
**Problema hoje:** `scripts/ci/check-claude-md-integrity.mjs` existe e não está em nenhum portão (consta apenas como execução manual na configuração de automação). Por isso as oito divergências do achado G24-1 passaram.
**Causa raiz:** verificação criada e não ligada.
**Caminho recomendado:** acrescente a chamada ao job de qualidade. Rode antes para confirmar que o repositório passa no estado atual — se não passar, a correção vem primeiro (etapas 273 e 274).
**Arquivos e objetos a tocar:** `.github/workflows/ci.yml`.
**Não tocar / armadilhas:** —
**Depende de:** 288, 273 · **Libera:** 290
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (altera CI).
**Como verificar:** o passo passa; alterando a instrução de forma inconsistente, reprova.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 290 — Remover a tolerância a falha na geração do PDF de auditoria

**Onda / Severidade / Camada:** 8 / Baixa / Higiene
**Achados resolvidos:** G8-2
**Problema hoje:** `package.json:14` engole a falha da geração do PDF com `|| echo`. É deliberado e a construção principal ainda reprova — mas esconde que a geração está quebrada quando está.
**Causa raiz:** passo opcional dentro do comando principal.
**Caminho recomendado:** tire a geração do PDF do comando de construção e deixe-a como comando próprio (`npm run generate-audit-pdf`), chamado onde for necessário. Assim a falha aparece quando alguém quer o PDF, em vez de nunca.
**Arquivos e objetos a tocar:** `package.json`.
**Não tocar / armadilhas:** confirme se algum workflow depende do PDF ser gerado na construção.
**Depende de:** 289 · **Libera:** 291
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `npm run build` não tenta gerar PDF; `npm run generate-audit-pdf` falha visivelmente se estiver quebrado.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 291 — Instalar monitoramento de erro no site

**Onda / Severidade / Camada:** 8 / Alta / Observabilidade
**Achados resolvidos:** G22-1
**Problema hoje:** busca por Sentry, Datadog, LogRocket, Bugsnag e Rollbar em `src/`, `package.json` e `index.html` → **zero**. Só existe `src/components/lux/ErrorBoundary.tsx`, que troca a tela branca por uma mensagem e **não avisa ninguém**. Se o site quebrar para um cliente, a empresa só descobre se ele reclamar.
**Causa raiz:** nunca instalado.
**Caminho recomendado:** escolha com o dono um serviço (há opções gratuitas para volume baixo) e instale o mínimo: captura de erro não tratado, captura do que o `ErrorBoundary` já pega, e identificação da organização **sem** dado pessoal. Atenção: a chave desse tipo de serviço vai para o pacote público do site — é projetada para isso, mas confirme que a escolhida não é uma chave privilegiada. Não instale gravação de sessão nesta etapa: é outro nível de decisão de privacidade.
**Arquivos e objetos a tocar:** `package.json`, `src/main.tsx`, `src/components/lux/ErrorBoundary.tsx`.
**Não tocar / armadilhas:** não envie para o serviço o e-mail nem o nome dos usuários; use o identificador da organização. A auditoria registrou que hoje não há segredo no pacote do site — não quebre isso.
**Depende de:** 290 · **Libera:** 292
**Risco e como reverter:** dependência nova (avise na PR, conforme a regra 3 das instruções). Reverter = `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (dependência nova, custo e tratamento de dado).
**Como verificar:** provocar um erro de propósito numa versão de pré-visualização e confirmar que ele aparece no painel do serviço.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 292 — Criar alerta para falha de rotina agendada

**Onda / Severidade / Camada:** 8 / Alta / Observabilidade
**Achados resolvidos:** G22-2
**Problema hoje:** não há alerta de rotina agendada no repositório, e os guardas de fila só rodam dentro do portão que estava desarmado. A etapa 147 vai mostrar quais rotinas estão paradas — e nada avisaria se uma parasse amanhã.
**Causa raiz:** nenhum alerta sobre o agendador.
**Caminho recomendado:** o banco já registra as execuções das rotinas. Crie uma rotina de verificação diária que leia esses registros e avise quando alguma rotina esperada não tiver executado com sucesso nas últimas 24 horas. O repositório já tem funções de alerta (`dlq-alerts`, `sla-alerts`, `reaper-alerts`) — siga o padrão de uma delas, inclusive o canal de aviso.
**Arquivos e objetos a tocar:** nova função em `supabase/functions/`, nova migration para o agendamento.
**Não tocar / armadilhas:** a rotina de verificação também pode falhar; o aviso do CI (etapa 286) e o monitoramento de erro (etapa 291) cobrem camadas diferentes — não conte com uma só.
**Depende de:** 291, 147 · **Libera:** 293
**Risco e como reverter:** migration que remove o agendamento + `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (migration em produção).
**Como verificar:** desativar uma rotina de teste e confirmar que o alerta chega no dia seguinte.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 293 — Remover os dois módulos de hook sem nenhum importador

**Onda / Severidade / Camada:** 8 / Baixa / Código morto
**Achados resolvidos:** G9-1
**Problema hoje:** `src/hooks/useFeatureFlag.ts` (singular) não tem importador — o consumidor real, `src/components/lux/LushaIntelligenceView.tsx:11`, importa de `@/hooks/useFeatureFlags` (plural). `src/hooks/useCircuitBreakerAlerts.ts` tem 117 linhas, quatro hooks exportados e zero referências.
**Causa raiz:** arquivos substituídos e não removidos.
**Caminho recomendado:** confirme a ausência de importador com `grep -rn "useFeatureFlag\b" src/` e `grep -rn "useCircuitBreakerAlerts" src/` (atenção ao limite de palavra, para não confundir singular com plural), e remova os dois arquivos. Registre na PR que `useFeatureFlag.ts:74-75` continha um controle de cancelamento que nunca era usado — se alguém precisar do arquivo no futuro, não deve copiá-lo como está.
**Arquivos e objetos a tocar:** remover os dois arquivos.
**Não tocar / armadilhas:** **não** remova `useFeatureFlags.ts` (plural), que é o usado.
**Depende de:** 292 · **Libera:** 294
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `npx tsc --noEmit -p tsconfig.app.json` → exit 0; `npm run test` → verde.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 294 — Remover os quatro componentes sem referência

**Onda / Severidade / Camada:** 8 / Baixa / Código morto
**Achados resolvidos:** G25-1
**Problema hoje:** sem nenhuma referência em produção: `src/components/automation/WorkflowEditor.tsx` (27 linhas, e o **próprio arquivo declara nas linhas 1-2** que é resto de arquivo corrompido, devolvendo `null`), `src/components/lux/LuxImage.tsx` (67 linhas), `src/components/NavLink.tsx` (32 linhas).
**Causa raiz:** idem.
**Caminho recomendado:** confirme a ausência de referência de cada um e remova. Comece por `WorkflowEditor.tsx`, que é autodeclarado inútil.
**Arquivos e objetos a tocar:** remover os três arquivos.
**Não tocar / armadilhas:** confirme que nenhum teste os importa.
**Depende de:** 293 · **Libera:** 295
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** idem etapa 293.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 295 — Remover os doze componentes de interface do modelo que nunca foram usados

**Onda / Severidade / Camada:** 8 / Baixa / Código morto
**Achados resolvidos:** G25-1
**Problema hoje:** 12 arquivos de `src/components/ui/` vieram do modelo de projeto e nunca foram usados.
**Causa raiz:** modelo instalado por inteiro.
**Caminho recomendado:** confirme um por um com busca de importação e remova. **Atenção:** componentes desse diretório costumam ser importados uns pelos outros — confirme que nenhum dos 12 é dependência de um dos usados. Se houver dúvida em algum, deixe-o e registre.
**Arquivos e objetos a tocar:** remover os arquivos confirmados em `src/components/ui/`.
**Não tocar / armadilhas:** remover um componente que outro importa quebra a construção; o typecheck pega, mas confirme antes para não perder tempo.
**Depende de:** 294 · **Libera:** 296
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** idem etapa 293, mais `npm run build` com sucesso.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 296 — Remover as importações não usadas que o lint não pega

**Onda / Severidade / Camada:** 8 / Baixa / Código morto
**Achados resolvidos:** G25-1
**Problema hoje:** `src/pages/Index.tsx:11` importa `TopProgressBar` com o uso comentado em `:123`; `src/components/lux/layout/Sidebar.tsx:4` importa `supabase` sem usar; `src/components/lux/monitoring/MonitoringView.tsx:30` declara `loadingHealth` sem usar. A regra que pegaria isso está **desligada** em `eslint.config.js:27`.
**Causa raiz:** regra desligada, provavelmente para reduzir ruído na época.
**Caminho recomendado:** remova as três, e então **ligue a regra** (`@typescript-eslint/no-unused-vars`) — mas antes rode o lint com ela ligada para ver quantas ocorrências aparecem. Se forem muitas, ligue como aviso e use o mecanismo progressivo do lint para reduzir aos poucos, como a etapa 276 faz. Decida com base no número medido, não por princípio.
**Arquivos e objetos a tocar:** os três arquivos citados, `eslint.config.js`.
**Não tocar / armadilhas:** o uso comentado em `src/pages/Index.tsx:123` sugere que alguém pretendia voltar a usar — confirme com o dono se o indicador de progresso no topo deve existir (a etapa 068 tem decisão parecida) antes de remover a importação.
**Depende de:** 295, 276 · **Libera:** 297
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** `npm run lint` → exit 0 com a regra no estado escolhido.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 297 — Regerar o inventário de funções de backend

**Onda / Severidade / Camada:** 8 / Baixa / Higiene
**Achados resolvidos:** G24-2
**Problema hoje:** `inventario/estado/edges.json` é de 2026-11-08 e declara 58 funções; não conhece `mcp-query` nem `send-scheduled-reports` — justamente as duas mais sensíveis desta auditoria — e reporta duas funções com 1 linha quando têm 298 e 291.
**Causa raiz:** inventário gerado semanalmente por workflow que abre pull request e a deixa aberta; ninguém juntou.
**Caminho recomendado:** rode `npm run inventario:edges` (precisa do `ripgrep` instalado) e comite o resultado. Verifique por que as pull requests semanais ficaram abertas — se é por falta de revisão, combine com o dono se o workflow pode juntar sozinho (é só documentação gerada).
**Arquivos e objetos a tocar:** `inventario/estado/edges.json`.
**Não tocar / armadilhas:** a lista `sem_chamador_no_repo` **não** é lista de código morto (`AGENTS.md` alerta sobre isso): a maioria são rotinas agendadas que vivem no banco ou endpoints públicos. Não apague função com base nela.
**Depende de:** 296 · **Libera:** 298
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** o arquivo lista as 61 funções com contagem de linhas correta.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 298 — Fechar ou concluir as oito pull requests abertas

**Onda / Severidade / Camada:** 8 / Média / Higiene
**Achados resolvidos:** G34-3
**Problema hoje:** na data da auditoria havia **8 pull requests abertas** (#148 a #158), todas de 2026-11-22, incluindo trabalhos que tocam áreas deste plano: execução durável de fluxo (#149), significância estatística de teste A/B (#150), agregação de análises (#151), guarda de organização em rotinas (#152), interface de alertas de disjuntor (#153), portão de administrador no reprocessamento de fila morta (#155) e passos de fluxo efetivos (#158). Algumas podem conflitar com etapas deste plano.
**Causa raiz:** trabalho paralelo sem conclusão.
**Caminho recomendado:** **antes de começar a Onda 1**, liste as oito, veja quais arquivos cada uma toca e cruze com as etapas deste plano. Apresente ao dono: para cada uma, juntar, fechar ou aguardar. Em especial, #155 se sobrepõe à etapa 045 e #152 à etapa 113 — se já estiverem prontas, as etapas correspondentes viram verificação em vez de implementação.
**Arquivos e objetos a tocar:** nenhum (relatório no corpo da PR e registro em `05-PROGRESSO.md`).
**Não tocar / armadilhas:** **não** mexa em branch de outra pessoa ou de outra sessão, nem para "ajudar" — a regra do repositório é explícita. Só relate.
**Depende de:** — · **Libera:** 001
**Risco e como reverter:** nenhum.
**Precisa de aprovação humana antes do merge:** **sim** (decisão sobre trabalho de terceiros).
**Como verificar:** a tabela das oito com arquivos tocados, etapa correspondente e recomendação, no corpo da PR.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 299 — Rodar os guardas de banco e registrar o que eles apontarem

**Onda / Severidade / Camada:** 8 / Alta / Banco · segurança
**Achados resolvidos:** G13-1
**Problema hoje:** os cinco guardas de banco nunca executaram de verdade (etapa 001). Depois de armados, vão apontar problemas reais pela primeira vez — e ninguém sabe quantos.
**Causa raiz:** portão desarmado desde sempre.
**Caminho recomendado:** com a variável de conexão configurada (etapa 002) e os guardas corrigidos (etapa 001), rode os cinco localmente e registre **tudo** o que eles apontarem: permissão de função exposta, gatilho de auditoria ausente, tabela sem regra de acesso, cobertura de fila, concessões a visitante anônimo. Cada problema apontado vira anotação em "Achados novos" de `05-PROGRESSO.md`, e os críticos viram etapa nova com aprovação. Esta etapa é a que transforma o portão em informação.
**Arquivos e objetos a tocar:** `docs/qa/05-PROGRESSO.md`.
**Não tocar / armadilhas:** não corrija nada nesta etapa — só registre. Corrigir cinco categorias de problema de banco numa pull request seria impossível de revisar.
**Depende de:** 001, 002 · **Libera:** 300
**Risco e como reverter:** nenhum (somente leitura).
**Precisa de aprovação humana antes do merge:** não
**Como verificar:** a saída dos cinco guardas registrada integralmente no corpo da PR, com a classificação de cada apontamento.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

### Etapa 300 — Criar regra automática que obrigue o uso do wrapper de organização

**Onda / Severidade / Camada:** 8 / Alta / CI · multi-organização
**Achados resolvidos:** G1-3
**Problema hoje:** a auditoria encontrou **50** chamadas de `supabase.from()` cruas em tabelas de organização, em 25 arquivos de `src/`. As etapas 111, 123 a 127, 139, 140 e 206 a 210 corrigem as conhecidas — e nada impede que a próxima apareça. O wrapper é convenção, não barreira.
**Causa raiz:** ausência de verificação automática.
**Caminho recomendado:** crie uma regra ou um script de verificação que recuse, em `src/`, o uso de `supabase.from("<tabela de organização>")` fora de `src/integrations/supabase/`, usando como lista a mesma classificação de `withOrg.ts` (ou o arquivo gerado na etapa 008). Ligue no job de qualidade. Comece como aviso, meça quantas ocorrências restam, e só então transforme em erro — o mecanismo progressivo do lint (`scripts/ci/lint-ratchet.mjs`) serve de modelo para essa transição.
**Arquivos e objetos a tocar:** novo script em `scripts/ci/`, `.github/workflows/ci.yml`.
**Não tocar / armadilhas:** o próprio wrapper usa `supabase.from` internamente — a verificação precisa excluir `src/integrations/supabase/`. Tabelas globais (`feature_flags`, `health_checks`) não devem ser acusadas.
**Depende de:** 299, 008, 210 · **Libera:** —
**Risco e como reverter:** `git revert`.
**Precisa de aprovação humana antes do merge:** **sim** (altera CI).
**Como verificar:** o script acusa uma consulta crua que você introduza de propósito num arquivo temporário, e não acusa nada no estado corrigido.
**Checklist:** [ ] só os arquivos listados · [ ] typecheck/lint/testes dos tocados · [ ] verificação executada e evidência anotada · [ ] deploy confirmado (quando se aplica) · [ ] marcada no progresso

---

## Backlog — achados cobertos, mas com trabalho residual

Estas não são etapas numeradas porque dependem de decisão do dono ou de levantamento que este plano já prevê. Quando a decisão sair, cada uma vira uma etapa própria.

1. **Aplicar a matriz de permissões tabela por tabela** — depende da escolha feita na etapa 138. Se for a opção de tornar a matriz real, são cerca de 15 etapas (uma por grupo de tabelas).
2. **Criar política de retenção para as tabelas que a etapa 250 apontar** — uma etapa por tabela, cada uma com aprovação, porque apaga dado.
3. **Corrigir o que os guardas de banco apontarem na etapa 299** — número desconhecido até a execução.
4. **Avaliar os critérios de perfil ideal sem dado disponível** (funcionários, faturamento) — se a etapa 097 concluir que faltam colunas, criá-las é migration e decisão de produto.
5. **Unificar as duas versões (celular e computador) dos componentes divergentes** apontados na etapa 271 — é mudança de arquitetura, não cabia como etapa atômica.
6. **Internacionalização das mensagens** — a etapa 264 padroniza o formato; separar texto do código é projeto próprio.
7. **Converter o restante das respostas de erro ao padrão único** (etapa 179 converte as três piores; sobram as demais).
8. **Remover o valor padrão de organização da coluna de negócios** (`default_org_for_current_user`) depois da etapa 110 — é mudança de schema com efeito em todos os caminhos de gravação.
