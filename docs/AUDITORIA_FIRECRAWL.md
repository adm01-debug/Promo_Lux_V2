# Auditoria de Paridade — LUX IA vs Firecrawl

> **Data:** 2026-07-21
> **Referência externa:** [github.com/firecrawl/firecrawl](https://github.com/firecrawl/firecrawl)
> **Escopo:** avaliar o quanto o LUX IA cobre as capacidades do Firecrawl (scrape/crawl/map/search/extract sobre web arbitrária) e onde está à frente/atrás.
> **Resultado:** LUX IA tem infraestrutura de execução **superior** à referência OSS do Firecrawl, mas **não cobre coleta genérica de web** — o motor atual é vertical em Google Maps + enriquecimento LinkedIn/Lusha/LeadContact.

---

## 1. O que é o Firecrawl

API/engine open-source que transforma sites em dados prontos para LLM. Núcleo do produto:

| Endpoint | Função |
|---|---|
| `POST /v2/scrape` | URL → markdown / HTML / links / screenshot / branding / summary / JSON estruturado |
| `POST /v2/crawl` | Percorre recursivamente um domínio respeitando `includePaths`/`excludePaths`/`maxDepth` |
| `POST /v2/map` | Descoberta rápida de URLs de um site (sitemap + heurísticas) |
| `POST /v2/search` | Busca web + scrape opcional dos top-N resultados |
| Extract (via `formats: [{ type: 'json', schema }]`) | JSON estruturado extraído por LLM |

Diferencial declarado do OSS: JS rendering (Playwright), bypass de anti-bot, formatos LLM-ready.

---

## 2. Matriz de paridade

Coluna "Prova" cita o arquivo/comando que evidencia o estado atual.

### 2.1 Capacidades de coleta (o que o Firecrawl faz)

| Feature Firecrawl | LUX IA hoje | Status | Prova |
|---|---|---|---|
| **Scrape** URL arbitrária → markdown/HTML | Não existe motor de scrape genérico. `gmaps-proxy` só chama a API externa GMaps; `scrape-queue-worker` só posta payloads em `gmaps.atomicabr.com.br` | ❌ **Gap** | `rg -l 'firecrawl\|fetch.*<html\|deno-dom' src supabase/functions` retorna vazio |
| **Crawl** recursivo de domínio | Não existe | ❌ **Gap** | `rg -l 'maxDepth\|crawl' supabase/functions` retorna vazio |
| **Map** (descoberta de URLs / sitemap) | Não existe | ❌ **Gap** | idem |
| **Search web** + scrape resultados | Não existe. `ai-agent` só consulta o próprio banco; busca externa restrita a GMaps | ❌ **Gap** | `supabase/functions/ai-agent/index.ts` — sem chamadas HTTP externas de busca |
| **Extract JSON estruturado via LLM** de URL arbitrária | Parcial: `ai-agent` faz chat sobre dados do banco; não recebe URL nem aplica schema | ⚠️ **Parcial** | `supabase/functions/ai-agent/index.ts` |
| **Screenshot** de página | Não existe | ❌ **Gap** | — |
| **Branding** (cores/fontes/logo) | Não existe | ❌ **Gap** | — |
| **Summary** por página | Não existe (só resumos internos de dados) | ❌ **Gap** | — |

### 2.2 Infraestrutura de execução (o que o LUX IA tem)

Aqui o LUX está claramente à frente do que o Firecrawl OSS oferece pronto:

| Capacidade | LUX IA | Firecrawl OSS | Prova |
|---|---|---|---|
| Fila com claim/lease atômico | ✅ `claim_scrape_tasks` + `scrape_queue` | Redis + BullMQ | `supabase/functions/scrape-queue-worker/index.ts` |
| Retry exponencial + classificação transient/permanente | ✅ `fail_scrape_task(_transient)` | Básico | idem, `isTransient()` |
| DLQ com replay e triagem automatizada | ✅ `replay_dead_letter`, `DlqTriageView` | Não nativo | `src/components/lux/monitoring/DlqTriageView.tsx` |
| Circuit breaker por provedor | ✅ `supabase/functions/_shared/circuit-breaker.ts` | Não nativo | `CIRCUIT_SERVICE = "gmaps"` no worker |
| Idempotência por `config_hash` | ✅ | Não | `scrape_jobs.config_hash` |
| `trace_id` propagado em logs estruturados | ✅ | Parcial | `traceOf(task)` no worker |
| Métricas p50/p95/p99 | ✅ `ScrapeLatencyPanel` | Não nativo | `src/components/lux/monitoring/ScrapeLatencyPanel.tsx` |
| Rate limit por org | ✅ `org_rate_limits` / `OrgRateLimitsView` | Não | `src/components/lux/monitoring/OrgRateLimitsView.tsx` |
| Proxies rotativos por org (CRUD UI) | ✅ (GMaps-only hoje) | ✅ | `src/components/lux/monitoring/OrgProxiesView.tsx` |
| Auto-tuning de retry (advisories + rollback) | ✅ `retry-policy-tuner`, `org_retry_policies` | Não | `supabase/functions/retry-policy-tuner/index.ts` |
| Chaos engineering (feature flag) | ✅ `chaos_scrape_enabled` | Não | `scrape-queue-worker/index.ts` L100-125 |
| Adaptive polling do worker | ✅ `worker_should_run` | N/A | worker L246 |
| Multi-tenant + RLS ponta-a-ponta | ✅ | N/A (OSS single-tenant) | `docs/adr/007-multi-tenant-defense-in-depth.md` |
| Simulação Monte Carlo (500 cenários) + relatório comparativo | ✅ `ResilienceReport` + `public/reports/*.json` | Não | `src/lib/resilience/simulator.ts` |

**Conclusão da matriz:** LUX = "avião de caça vertical" (GMaps), Firecrawl = "helicóptero horizontal" (qualquer URL). São produtos diferentes na coleta, mas o LUX opera sobre uma base de resiliência que o Firecrawl OSS não entrega pronta.

---

## 3. Gaps priorizados (Firecrawl → LUX)

| # | Gap | Valor de negócio | Complexidade |
|---|---|---|---|
| **G1** | Scrape genérico de URL → markdown + metadata | Base para tudo abaixo; abre "enriquecer empresa pelo site oficial" | Baixa (nativa) / Trivial (Firecrawl) |
| **G2** | Extract JSON estruturado (URL + schema Zod → JSON) | Alto: about/contato/tech stack/e-mail no rodapé do site das empresas raspadas | Média (nativa: `fetch` + AI Gateway) |
| **G3** | Map/Crawl restrito a um domínio | Descobrir `/contato`, `/equipe`, `/carreiras` de uma empresa | Média (BFS com `deno-dom`) |
| **G4** | Search web + scrape top-N | Prospecção fora do GMaps (feiras, notícias, listas setoriais) | Alta (precisa provedor de search) |
| **G5** | Screenshot + branding (cores/fontes/logo) | UX em Deals/Apresentações; branding para propostas | Alta (requer headless browser) |

Prioridade recomendada: **G1 → G2 → G3** primeiro (unlock imediato para enriquecimento de empresas do GMaps), **G4/G5** só se produto puxar.

---

## 4. Três caminhos, com trade-offs honestos

### Opção A — Conectar Firecrawl como connector Lovable (gateway)

**Como:** `standard_connectors--connect firecrawl` → 1 Edge Function proxy → cliente TS que chama `scrape/crawl/map/search`.

- ✅ Fecha G1-G5 em ~1 dia de trabalho.
- ✅ JS rendering, anti-bot, screenshot e branding "de graça" (feitos pelo Firecrawl).
- ✅ Reuso do gateway Lovable (sem `fc-*` no frontend).
- ❌ **Custo por request** (créditos Firecrawl) — inviável em escala "raspar site de 10 000 empresas".
- ❌ Dependência de provedor externo (mais 1 vetor de outage; nosso circuit breaker cobre, mas é mais uma engrenagem).
- ⚠️ Não vem grátis o multi-tenant RLS que já temos — o proxy precisa validar org.

### Opção B — Auto-hospedar Firecrawl OSS

- ✅ Sem custo por request.
- ❌ Assume Playwright + Redis + workers em VM. Duplica infraestrutura que já temos em Deno/Supabase.
- ❌ Edge Functions Deno **não rodam Playwright** → obriga sair do stack Lovable Cloud para VM externa.
- ❌ Operar Playwright em produção é caro em RAM e frágil (crashes, memory leaks).

Só faz sentido se surgir demanda por **screenshot/branding em massa** e o custo Firecrawl ficar proibitivo.

### Opção C — Nativo dentro do LUX (reusar fila/DLQ/rate-limit atuais)

- ✅ Reusa `scrape_queue`, `org_rate_limits`, DLQ, circuit breaker, `trace_id`, auto-tuner.
- ✅ Multi-tenant RLS já resolvido.
- ✅ Zero custo por request (fora egress).
- ⚠️ Sem JS rendering: sites SPA (React puro, sem SSR) devolvem shell vazio.
- ⚠️ Extract precisa AI Gateway (Gemini 2.5 Flash) — custo controlado, mas existe.
- ⚠️ Engenharia ~5-8 dias para chegar em qualidade de produção (retry, encoding, robots.txt, sitemap parsing).

**Stack sugerido para C:**
- `fetch` + `AbortSignal.timeout` (já usado em `scrape-queue-worker`)
- [`deno-dom`](https://deno.land/x/deno_dom) para parsing HTML → markdown
- [`turndown`](https://esm.sh/turndown) via ESM para markdown de alta fidelidade
- AI Gateway (`google/gemini-2.5-flash`) para extract JSON com `response_schema`
- Tabela `web_scrape_jobs` espelhando `scrape_jobs` (mesma máquina de estados)

---

## 5. Recomendação

**Curto prazo (2 semanas):** **Opção A** para desbloquear G1-G3. Um único connector, um único proxy, um único hook `useFirecrawl()`. Feature-flag `enable_web_scrape` por org para controlar custo.

**Médio prazo (1-2 meses):** **Opção C** apenas para o caso de uso de **enriquecimento em massa a partir do site oficial das empresas raspadas do GMaps** (previsivelmente 10k+/mês). Manter Firecrawl como fallback para páginas JS-heavy detectadas via heurística (HTML < 5 KB + `<div id="root">` vazio).

**Nunca:** Opção B, salvo se o produto exigir screenshot/branding em escala.

---

## 6. Riscos e observações

- **Firecrawl OSS depende de Playwright.** Isso é incompatível com Edge Functions Deno. Qualquer plano de auto-host obriga sair do Lovable Cloud.
- **Extract via LLM falha silenciosamente** em páginas JS-heavy (o LLM inventa dados a partir do shell). Mitigar com: (a) `waitFor` no Firecrawl, ou (b) validação Zod `strict()` na saída, rejeitando payloads sem campos-chave.
- **Reviews e `open_hours` do Google Maps já são cobertos** pela Places API (New) e pelo motor clássico (`gmaps-proxy` + `gmaps-mapper.ts`) — **não requerem Firecrawl**.
- **RLS e multi-tenant não são gratuitos** ao adotar Firecrawl: o proxy precisa injetar `organization_id` e validar `has_org_role` antes de gastar créditos.
- **Robots.txt e LGPD:** qualquer coleta genérica precisa respeitar `robots.txt` e registrar base legal em `docs/LGPD.md`. Firecrawl faz `robots.txt` por default; implementação nativa (Opção C) precisa fazer explicitamente.

---

## 7. Apêndice — comandos de verificação

Provas executáveis das afirmações de "gap":

```bash
# Não há cliente Firecrawl nem parser HTML genérico no projeto:
rg -l -i 'firecrawl' src supabase/functions        # → vazio
rg -l 'deno-dom\|turndown\|jsdom' supabase/functions # → vazio

# Não há crawler recursivo nem descoberta de sitemap:
rg -n 'maxDepth\|sitemap\.xml\|crawl(' supabase/functions # → vazio

# Motor de scrape atual é 100% GMaps:
rg -n 'GMAPS_API_BASE\|gmaps\.atomicabr' supabase/functions
# → supabase/functions/scrape-queue-worker/index.ts
# → supabase/functions/gmaps-proxy/index.ts

# Infraestrutura de resiliência (as ✅ da matriz):
rg -n 'claim_scrape_tasks\|fail_scrape_task\|circuit-breaker\|chaos_scrape_enabled' supabase/functions
```

---

## 8. Fontes consultadas

- `supabase/functions/gmaps-proxy/index.ts`
- `supabase/functions/gmaps-places-search/index.ts`
- `supabase/functions/scrape-queue-worker/index.ts`
- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/_shared/circuit-breaker.ts`
- `docs/edge-functions.md`
- `docs/schema-tabelas-principais.md`
- `docs/GAPS-ENTERPRISE.md`
- `docs/adr/007-multi-tenant-defense-in-depth.md`
- Repositório de referência: <https://github.com/firecrawl/firecrawl>

---

### 📊 Relatório de Execução

**Padrão utilizado:** Auditoria documental (nenhum sub-agente de código ativado)

**Sub-agentes ativados:**

- 🎨 **UI Architect** — ➖ Não necessário
- 🗄️ **Supabase Engineer** — ➖ Não necessário
- 🔍 **Code Auditor** — ✅ Executado (leitura de motor GMaps + resiliência)
- 🧪 **Testing Agent** — ➖ Não necessário
- 📈 **SEO Optimizer** — ➖ Não necessário
- 🚀 **Deploy Ops** — ➖ Não necessário
- 🔌 **API Integrator** — ✅ Executado (análise de integração Firecrawl)

**Resumo:** Gerado `docs/AUDITORIA_FIRECRAWL.md` com matriz de paridade, gaps priorizados, três caminhos com trade-offs e comandos de verificação. Nenhum código de produção alterado.

**Arquivos modificados:** 1 (novo)

**Próximos passos sugeridos:** decidir Opção A (Firecrawl connector) vs Opção C (nativo Deno) para G1-G3.
