# Lovable e deploy — referência para agentes

Ler quando for confirmar um deploy, mexer em env var, domínio ou deploy de edge functions.

| O que | Valor |
|---|---|
| Plataforma de deploy | **Vercel** (projeto `juca1/promo-lux-v2`) — deploy automático a cada merge em `main` (`vercel.json` presente na raiz; `installCommand: npm install --legacy-peer-deps`, `buildCommand: npm run build`, `framework: vite`). Lovable foi **abandonado** como plataforma de deploy (ver `README.md` para histórico) |
| Produção (front) | `https://promo-lux-v2.vercel.app` |
| Backend | Supabase `pttzwlbidamibjssqiqb` (ver `docs/agentes/banco.md`) |
| Lovable (legado, **morto**) | `https://lux-ai-company-finder.lovable.app` responde 200 mas serve bundle congelado de ~mai/2026 que aponta para `cjxkodfpohnugpionkam.supabase.co` — **projeto extinto (NXDOMAIN, verificado em 2026-11-22 via DNS do Windows, Google DoH e Cloudflare DoH)**. O bundle tem só `/`, `/login`, `/reset-password`, `*` — sem `/status`, `/survey/:token`, `/monitoring`, `/admin`. Não use como referência do que está em produção; validar lá produz falso negativo |
| Framework / build / output | Vite 5 + React 19 · `npm run build` · `dist/` · Node 20 no CI · `outputDirectory: dist` no Vercel |
| Artefatos da plataforma | `.lovable/plan.md`, `.lovable/memory/design/tokens.md`, `.lovable/mcp/manifest.json` |
| Plugin de build | `lovable-tagger` (só em `mode === "development"`) e `@lovable.dev/mcp-js/stacks/supabase/vite` (`mcpPlugin()`), ambos em `vite.config.ts` |
| Dev server | porta **8080** (`vite.config.ts`, `host: true`) — o `playwright.config.ts` depende dessa porta |

## Deploy e edge functions

- **Front:** publicado pela **Vercel**. Merge em `main` = build + deploy em `promo-lux-v2.vercel.app` (via `vercel.json`). Em 20-nov-2026, o bundle servido em produção (`index-D_pE71Dk.js`) continha os marcadores `admin/companies`, `settings/cnpj` e `Monitoring` — **alinhado com a main** (23 views + 9 pages em `src/lib/viewRegistry.ts`). Confirme o resultado abrindo a URL de produção e reporte; não diga "deployado" sem isso. O smoke test `.github/workflows/production-smoke.yml` monitora essa paridade diariamente.
- **Edge functions:** sobem por `.github/workflows/edge-functions-deploy.yml` (jobs `plan` e `apply`, ambos com `environment: Production` — cada um exige aprovação manual em *Review deployments*; `apply` pode falhar com `500 Function deploy failed due to an internal error`, transitório, retry resolve). O `db-migrations.yml` é separado e só faz `supabase db push`. `verify_jwt` por função fica em `supabase/config.toml`; funções com `verify_jwt = false` são superfície pública e exigem gate próprio no código.
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
  `VITE_SUPABASE_PUBLISHABLE_KEY`. `VITE_SUPABASE_PROJECT_ID` também existe no `.env`.
- **`.env` não é mais versionado** (removido do tracking em `fix(ci): pina Supabase CLI v3.1.0 no job
  rls-tests` — PR #48; o `.gitignore` cobre `.env`, `.env.local` e `.env.*.local`). Nada de segredo em env
  `VITE_*`: essas variáveis são inlinadas no bundle JS público em build time. Autorização de admin usa
  JWT + papel em `organization_members`.
- Env vars de E2E, todas opcionais com fallback público: `E2E_BASE_URL`, `E2E_SUPABASE_URL`,
  `E2E_SUPABASE_ANON_KEY`, `E2E_USER_A_EMAIL`/`_PASSWORD`, `E2E_USER_B_EMAIL`/`_PASSWORD`
  (`e2e/helpers/supabase.ts`). Sem elas, os testes de RLS caem no ref divergente — ver `banco.md`.
