# scripts/graphify — grafo de código (graphify)

## O que faz

`setup.sh` instala o binário `graphify` (via `uv` ou `pipx`), registra os hooks de rebuild em `.husky/` e
gera o grafo do repositório em `graphify-out/`. O grafo é a forma barata de responder "onde isto é usado",
"o que chama o quê" e "qual o caminho de A até B" **sem** varrer o repo por texto.

## Como rodar

```bash
npm install --legacy-peer-deps   # instala o husky, que o setup exige
npm run graph:setup              # instala o graphify + gera o grafo
npm run graph:update             # só reindexa o AST depois de mexer no código
```

## Uso

Com `graphify-out/graph.json` presente:

- `graphify query "<pergunta>"` — busca semântica no grafo;
- `graphify path "<A>" "<B>"` — caminho de dependência/chamada entre dois símbolos;
- `graphify explain "<conceito>"` — resumo de um conceito do repo;
- `graphify-out/GRAPH_REPORT.md` — só para revisão ampla (é grande).

**Frescura:** compare `git rev-parse --short HEAD` com a linha "Built from commit" do `GRAPH_REPORT.md`.
Divergiu → `graphify update .` (só AST, sem custo de API).

## Secrets

Nenhum. O `graphify update` é local e offline (só AST).

## Observações

- `graphify-out/` está no `.gitignore` (é grande e específico do clone) — cada máquina gera o seu.
- O que o grafo deve ignorar fica em `.graphifyignore` na raiz. **Nunca** remova as entradas de `.env*`,
  chave e token de lá.
- Em sessão de nuvem, `.claude/hooks/session-start.sh` faz o mesmo trabalho em segundo plano
  (log em `graphify-out/.session-start.log`).
- Os hooks `PreToolUse` de `.claude/settings.json` chamam `graphify hook-guard` e saem em silêncio onde o
  binário não está instalado.
