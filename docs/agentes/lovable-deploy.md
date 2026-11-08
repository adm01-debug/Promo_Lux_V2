# Lovable e deploy — referência para agentes

Ler quando for confirmar um deploy, mexer em env var, domínio ou deploy de edge functions.

| O que | Valor |
|---|---|
| Plataforma de deploy | **Lovable** (`lovable.dev`) — o projeto nasceu e é publicado por lá (`README.md` › Deploy; badge "Built with Lovable") |
| Produção (front) | `https://lux-ai-company-finder.lovable.app` |
| Backend | Lovable Cloud = Supabase `pttzwlbidamibjssqiqb` (ver `docs/agentes/banco.md`) |
| Vercel | **não há `vercel.json` neste repo**. A string `vercel_icfg_…` em `supabase/.temp/linked-project.json` é o id da organização que provisionou o Supabase, não um projeto de front. Deploy em Vercel: `NÃO VERIFICADO` |
| Framework / build / output | Vite 5 + React 19 · `npm run build` · `dist/` · Node 20 no CI |
| Artefatos da plataforma | `.lovable/plan.md`, `.lovable/memory/design/tokens.md`, `.lovable/mcp/manifest.json` |
| Plugin de build | `lovable-tagger` (só em `mode === "development"`) e `@lovable.dev/mcp-js/stacks/supabase/vite` (`mcpPlugin()`), ambos em `vite.config.ts` |
| Dev server | porta **8080** (`vite.config.ts`, `host: true`) — o `playwright.config.ts` depende dessa porta |

## Deploy e edge functions

- **Front:** publicado pela Lovable. Merge em `main` = deploy em produção. Confirme o resultado abrindo a
  URL de produção e reporte; não diga "deployado" sem isso.
- **Edge functions:** sobem pela própria Lovable ao salvar (`README.md` › Deploy). `verify_jwt` por função
  fica em `supabase/config.toml` — hoje com `verify_jwt = false` em `qa-ingest-run`, `admin-list-companies`
  e `migrate-helper`. Mexer nesses três é mexer em superfície pública: trate como mudança de segurança.
- **MCP do produto:** `supabase/functions/mcp/` serve `/functions/v1/mcp` com OAuth
  (`issuer: https://pttzwlbidamibjssqiqb.supabase.co/auth/v1`, audience `authenticated`) e 5 tools de
  leitura declaradas em `.lovable/mcp/manifest.json` (`list_companies`, `get_company`,
  `list_decision_makers`, `list_scrape_jobs`, `get_dashboard_stats`). Mudou a tool no código → atualize o
  manifesto no mesmo PR.
- **Armadilha do `build`:** `package.json` define
  `"build": "vite build && (npm run generate-audit-pdf || echo '...')"`. O `||` engole a falha por desenho:
  o PDF de auditoria pode nunca ser gerado sem ninguém notar, e `npm run build` continua verde. Se o PDF
  importa na sua tarefa, rode `npm run generate-audit-pdf` separado (precisa de `bun`) e confira o arquivo.

## Regras de env vars

- Vars `VITE_*` entram no bundle e são **públicas** — nunca segredo com esse prefixo.
- **Nunca** colocar no front chave de servidor: `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`,
  `LUSHA_API_KEY`, `APIFY_*`, `HIKER_API_KEY`, `APOLLO_API_KEY`, `CNPJA_API_KEY`, `GOOGLE_MAPS_API_KEY`,
  `BITRIX_WEBHOOK_BASE`, `TRACKING_SIGNING_SECRET`, OAuth client secrets. Tudo isso é secret de edge
  function (`Deno.env.get`) — inventário completo em `docs/estado/04-integracoes.md` §1.
- Vars usadas pelo front (`src/integrations/supabase/client.ts`): `VITE_SUPABASE_URL` e
  `VITE_SUPABASE_PUBLISHABLE_KEY`. `VITE_SUPABASE_PROJECT_ID` e `VITE_ADMIN_LIST_TOKEN` também existem no
  `.env`.
- **`.env` está versionado** (`git ls-files .env` retorna o arquivo; o `.gitignore` não cobre `.env*`), e
  carrega `VITE_ADMIN_LIST_TOKEN`. Não adicione nada novo ali e nunca imprima o conteúdo. Remover do
  versionamento e rotacionar o token é decisão do dono.
- Env vars de E2E, todas opcionais com fallback público: `E2E_BASE_URL`, `E2E_SUPABASE_URL`,
  `E2E_SUPABASE_ANON_KEY`, `E2E_USER_A_EMAIL`/`_PASSWORD`, `E2E_USER_B_EMAIL`/`_PASSWORD`
  (`e2e/helpers/supabase.ts`). Sem elas, os testes de RLS caem no ref divergente — ver `banco.md`.
