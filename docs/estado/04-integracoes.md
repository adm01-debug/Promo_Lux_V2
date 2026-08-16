# Dimensão 4 — Integrações

> Anexo de [`../ESTADO_ATUAL.md`](../ESTADO_ATUAL.md) · Commit `890c18d` · 2026-08-16
> Cobre **integrações implementadas, parciais, construídas-e-desligadas e apenas sugeridas em documentação**.

**Método:** três varreduras cruzadas — (1) inventário de 100% dos `Deno.env.get("...")` em `supabase/functions/` (37 variáveis distintas), (2) rastreio de cada cliente em `_shared/` até seu consumidor, (3) tabela de evidência de tráfego real no banco.

**Total: 22 itens** — ✅ 2 · 🟨 7 · 🟦 13 · ⬛ 0

> ⚠️ **Nenhuma integração externa foi chamada ao vivo.** O estado abaixo é inferido de código + secrets + tabelas de evidência. Onde não há tabela que comprove tráfego, está marcado.

---

## 1. Inventário de secrets consumidos pelas Edge Functions

Base factual de tudo o que segue. Ocorrências de `Deno.env.get`:

| Integração | Variáveis | Ocorrências |
|---|---|---:|
| Supabase (interno) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_EXTERNAL_URL`, `SUPABASE_EXTERNAL_ANON_KEY`, `EXTERNAL_VAULT_ANON_KEY` | 152 |
| Lovable AI | `LOVABLE_API_KEY` | 6 |
| Microsoft OAuth | `MS_OAUTH_CLIENT_ID`, `MS_OAUTH_CLIENT_SECRET` | 9 |
| Google OAuth | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | 9 |
| CNPJá | `CNPJA_API_KEY`, `CNPJA_LIMIT_RPM`, `CNPJA_OPEN_LIMIT_RPM`, `CNPJ_WORKER_BATCH` | 10 |
| Lusha | `LUSHA_API_KEY`, `LUSHA_DAILY_QUOTA` | 3 |
| Apify | `APIFY_API_KEY`, `APIFY_TOKEN`, `APIFY_MOCK_MODE`, `APIFY_MOCK_FAULTS` | 6 |
| HikerAPI | `HIKER_API_KEY`, `HIKER_MOCK_MODE`, `INSTAGRAM_WORKER_BATCH` | 5 |
| Apollo | `APOLLO_API_KEY` | 2 |
| Bitrix24 | `BITRIX_WEBHOOK_BASE` | 2 |
| Google Maps | `GOOGLE_MAPS_API_KEY`, `GMAPS_PROVIDER`, `GMAPS_OMKAR_BASE_URL`, `GMAPS_OMKAR_API_KEY` | 4 |
| BrightData | `BRIGHTDATA_API_TOKEN` | 1 |
| Tracking | `TRACKING_SIGNING_SECRET` | 2 |
| Operacional | `QA_INGEST_TOKEN`, `ADMIN_LIST_TOKEN`, `APP_ENV` | 3 |

---

## 2. ✅ IMPLEMENTADO_TOTAL (2)

| # | Integração | Evidência de código | Evidência de uso real |
|---:|---|---|---|
| 1 | **Supabase / Lovable Cloud** (Auth, Postgres, Realtime, Storage) | `src/integrations/supabase/` (11 arq · 7.383 L), `withOrg.ts` | `auth.users` 8 · 95 tabelas · 255 policies · 30 cron jobs · 181 MB |
| 2 | **Webhooks de saída** | `supabase/functions/webhook-dispatcher/index.ts` (184 L), `lux/integrations/WebhooksPanel.tsx` | `webhooks` 1 · **`webhook_deliveries` 63 entregas** |

---

## 3. 🟨 IMPLEMENTADO_PARCIAL (7)

| # | Integração | Código | O que **exatamente** falta |
|---:|---|---|---|
| 3 | **Lovable AI Gateway** (Gemini) | `LOVABLE_API_KEY` em 6 pontos; `ai-agent/index.ts` (200 L); `AIAgentView` (10 refs) | `agent_chat_messages` = **0 linhas**. Nenhuma conversa persistida — a integração pode responder, mas não há registro de nenhum uso |
| 4 | **Google Maps (scraping via Omkar)** | `gmaps-proxy/index.ts` (711 L), `_shared/gmaps-mapper.ts`, `_shared/omkar-gmaps-config.ts`, `GMAPS_PROVIDER` | Funciona: cron 28 com 24.919 sucessos, `scrape_jobs` 1, `companies` 5. Mas **`scrape_results` = 0** — o resultado bruto nunca é persistido |
| 5 | **Gmail (OAuth)** | `email-oauth-connect/callback/disconnect`, `GOOGLE_OAUTH_CLIENT_ID/SECRET`, `sendGmail()` em `campaign-dispatch:576` | **`email_accounts` = 0**. Nenhuma conta jamais conectada; o envio nunca teve remetente |
| 6 | **Microsoft / Outlook (OAuth)** | mesmas functions, `MS_OAUTH_CLIENT_ID/SECRET`, `sendOutlook()` em `campaign-dispatch:328` | idem — `email_accounts` = 0 |
| 7 | **Lusha** | 53 arquivos. `lusha-search` (579 L), `lusha-reveal` (315 L), `lusha-decision-makers` (761 L), `_shared/lusha-client.ts`, `_shared/lusha-departments.ts`, `docs/LUSHA-INTEGRATION.md` | **A única integração externa com dado real: `lusha_contacts` = 12, `lusha_search_sessions` = 1.** Mas `lusha_credit_usage_log` = **0** e `lusha_dm_search_history` = **0** — controle de crédito e histórico de decisores não gravam |
| 8 | **CNPJá** (Receita Federal) | `cnpj-enrich` (243 L), `cnpj-enrich-worker` (209 L), `cnpj-settings-status` (74 L), `/settings/cnpj` | Cron 17 com **12.460 execuções bem-sucedidas** e `cnpj_enrich_queue`, `cnpj_enrich_cache`, `cnpj_enrich_rate_state` **todas com 0 linhas**. Worker consome recurso sem nunca ter enriquecido um CNPJ |
| 9 | **API pública REST (LUX como provedor)** | `public-api/index.ts` (251 L), `docs/openapi.ts`, `ApiDocsCard.tsx` | `api_keys` = **0** e `api_request_logs` = **0**. **Nenhuma chave emitida, nenhuma requisição recebida** |

---

## 4. 🟦 SUGERIDO_OU_INICIADO — construídas e desligadas (7)

Código real existe. Nada chega até ele.

| # | Integração | Código presente | Por que não funciona |
|---:|---|---|---|
| 10 | **Google Places API (New)** | `gmaps-places-search/index.ts` (121 L), `GOOGLE_MAPS_API_KEY`, hook `usePlacesApiUsage.ts` | Flag `use_places_api_new` = **`false`** em `feature_flags`, com `"requires_connector": "google_maps"`. `places_api_usage` = **0** |
| 11 | **Apollo.io** | `_shared/apollo-client.ts`, `_shared/apollo-cache.ts`, `_shared/apollo-departments.ts`, `APOLLO_API_KEY`, 2 suítes de teste | Consumido **só** por `oracle-search-decisors`. `apollo_search_cache` = **0**; `apollo_rate_state` = 1 (linha de inicialização). Sem evidência de uma única busca |
| 12 | **Bitrix24 (CRM)** | `oracle-push-bitrix/index.ts` (404 L), `_shared/bitrix-client.ts`, `BITRIX_WEBHOOK_BASE`, guard SSRF | Nenhuma tabela registra push bem-sucedido. **Sem evidência de que um lead tenha chegado ao Bitrix** |
| 13 | **Apify** | `_shared/apify-gateway.ts` + fixtures + testes, `docs/apify-mock-mode.md` | `APIFY_MOCK_MODE` e `APIFY_MOCK_FAULTS` presentes. Consumido por `instagram-connection-status` e `instagram-worker-health`, ambos **sem chamador** |
| 14 | **HikerAPI (Instagram)** | `instagram-worker` (197 L), `instagram-enqueue` (145 L), `instagram-worker-health` (87 L), `instagram-dlq-replay` (89 L), `_shared/hiker-client.ts`, `InstagramConnectionPanel.tsx` | `HIKER_MOCK_MODE` presente. **Nenhum cron, nenhum chamador** — as menções em `InstagramConnectionPanel.tsx:226-227` são texto dentro de `<code>`, não invocação. As 3 tabelas `instagram_scrape_*` têm **0 linhas** |
| 15 | **BrightData** | `BRIGHTDATA_API_TOKEN` em `instagram-connection-status/index.ts` (única ocorrência) | Só o nome da variável. Sem cliente, sem chamada, sem tabela |
| 16 | **Tracking de e-mail (open/click)** | `track-open` (68 L), `track-click` (70 L), `_shared/tracking-signature.ts` (HMAC), `campaign_events`, `CampaignTrackingDrawer.tsx` | **O fio está partido no meio.** `campaign-dispatch` (655 L) tem **zero** ocorrências de `track`/`pixel`/`open`/`click` e envia `text/plain` (`index.ts:592`). Ninguém gera as URLs. `campaign_events` = **0** |

---

## 5. 🟦 SUGERIDO_OU_INICIADO — apenas propostas em documentação (6)

Zero código. Aparecem em documentos de gap/roadmap e podem ter sido lidas como compromissos.

| # | Proposta | Onde foi sugerida | Código no repo |
|---:|---|---|:---:|
| 17 | **Firecrawl** (coleta web genérica) | `docs/AUDITORIA_FIRECRAWL.md` — documento inteiro de paridade, concluindo que *"LUX IA não cobre coleta genérica de web"* | **0 arquivos** contêm "firecrawl" fora do próprio doc |
| 18 | **Billing por seat (Stripe / Paddle)** | `docs/GAPS-ENTERPRISE.md:65` — *"Billing por seat \| Inexistente \| Stripe/Paddle com seat-based"* | **0** |
| 19 | **ZoomInfo, Hunter, Snov, Cognism, Clearbit** | `docs/GAPS-ENTERPRISE.md:110`; `docs/pesquisa-oss-linkedin-enrichment.md:51-52` | **0** |
| 20 | **SSO Enterprise (SAML / OIDC)** | `docs/AUDITORIA_FINAL_LUX_IA.md` — "Plano de Evolução", item 1 | **0** |
| 21 | **Modelos locais (Ollama)** | idem, item 2 | **0** |
| 22 | **Data Residency por organização** | idem, item 3 | **0** |

---

## 6. Falso-positivo descartado — registro do método

**"Resend" (serviço de e-mail transacional)** apareceu em 3 arquivos na varredura inicial por nome de integração. Verificação linha a linha:

```
src/components/lux/organizations/InviteSection.tsx:13  export interface ResendEntry {
src/components/lux/organizations/InviteSection.tsx:36    resendHistory: Record<string, ResendEntry[]>;
src/components/lux/organizations/InviteSection.tsx:39    handleResendInvite: (inv: Invite) => void;
```

É **reenvio de convite** (`resend invite`), não o serviço Resend. **Descartado do inventário.** Registrado aqui porque uma varredura por palavra-chave sem inspeção teria acrescentado uma integração inexistente à lista.

---

## 7. Leitura consolidada

| Faixa | Qtd | % de 22 |
|---|---:|---:|
| Entrega valor hoje, com dado comprovado | **2** | 9,1% |
| Construída, executa, mas sem lastro de dado | 7 | 31,8% |
| Construída e desligada (flag, sem chamador ou fio partido) | 7 | 31,8% |
| Só proposta em documento | 6 | 27,3% |

**Duas observações para decisão:**

1. **Lusha é a única integração externa com evidência de dado real** (12 contatos). Todas as demais — Apollo, Bitrix, Apify, Hiker, BrightData, Places API — têm cliente, secret e teste, mas **nenhuma linha de dado**. O custo de manutenção dessas 6 é real; o retorno, hoje, é zero.
2. O sistema **consome** integrações razoavelmente bem, mas **como provedor** ainda não existe: `api_keys` = 0 e `api_request_logs` = 0. A API pública documentada em `docs/openapi.ts` nunca foi usada por ninguém.

---

## 8. Lacunas desta dimensão

- **Nenhuma chamada real a API externa foi feita.** Não sei se as credenciais são válidas, nem se os endpoints respondem.
- **Não sei quais secrets estão de fato configurados** no ambiente Supabase — apenas quais o código espera. `supabase_functions_list` via MCP requer `SUPABASE_ACCESS_TOKEN`, não disponível.
- Bitrix e Apollo poderiam ter tráfego real sem tabela de evidência local (push direto sem persistir). Classifiquei como 🟦 por **ausência de prova**, conforme a regra de que célula sem evidência cai para 🟦 e nunca sobe. Se houver log externo no Bitrix mostrando leads recebidos, esta linha deve ser corrigida.
