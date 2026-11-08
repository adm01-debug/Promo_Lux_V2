# Estado real do projeto — inventário gerado

Pasta de **dados gerados por script**, não de relatórios escritos à mão. É a fonte de consulta dos
agentes para "o que existe hoje" no código. Se um número aqui divergir do que você mediu, regere o
arquivo em vez de corrigir à mão.

| Arquivo | Como gerar | O que tem |
|---|---|---|
| `edges.json` | `npm run inventario:edges` (`node scripts/inventario/gerar-repo.mjs`, exige `ripgrep`) | as 58 edge functions de `supabase/functions/`: linhas, segredos lidos (`Deno.env.get`) e quem invoca cada uma (`src/`, migrations, outras edges, `e2e/`, CI) |
| `tabelas-uso.json` (não versionado) | `node scripts/inventario/gerar-repo.mjs < lista-de-tabelas.txt` | quantos `.from('tabela')` cada tabela tem em `src/` e `supabase/functions/` |

## Como ler `edges.json`

- **`sem_chamador_no_repo`** (e o `sem_chamador` de cada função) significa "sem referência estática em
  `src/`, migrations, outra edge, `e2e/` ou `supabase/config.toml`". **Não é lista de código morto.** A
  maior parte das 20 atuais são **crons de `pg_cron` vivos**, agendados dentro do banco e portanto
  invisíveis para um script que só lê o repositório (`docs/estado/02-backend-edge-functions.md:38-42`
  registra execuções bem-sucedidas de várias), ou endpoints públicos por design (`mcp`, `track-click`,
  `track-open`). Cruze com `docs/estado/02-backend-edge-functions.md` e `docs/ESTADO_ATUAL.md` antes de
  propor deleção de qualquer uma.
- **`segredos_lidos`** lista os nomes lidos via `Deno.env.get` — nunca os valores. Serve para saber quais
  secrets a função exige antes de fazer deploy dela.
- As relações são extraídas estaticamente por `ripgrep`: referência encontrada não prova execução.

## O que NÃO está aqui

O estado do **banco ao vivo** (tabelas, colunas, RLS, funções, triggers, cron, lints do projeto
oficial `pttzwlbidamibjssqiqb`) não é gerado nesta pasta: quem coleta é
`scripts/supabase_snapshot/snapshot.py`, pelo `.github/workflows/contexto.yml`, e o resultado é
publicado em `docs/contexto/supabase/` na branch `contexto`:

```bash
git fetch origin contexto && git show origin/contexto:docs/contexto/00-INDEX.md
```

## Atualização automática

`.github/workflows/inventario-estado-semanal.yml` (segunda, 10:23 UTC) regera e abre PR em
`automation/inventario-estado` **se o conteúdo mudou** — `node scripts/inventario/mudou-conteudo.mjs`
compara o JSON ignorando os carimbos `medido_em`/`gerado_em`, para não abrir PR só por causa da data.
O PR fica aberto para o dono: merge em `main` dispara deploy em produção pela Lovable.
