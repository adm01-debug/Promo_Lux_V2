# Integrações externas — referência para agentes

Ler antes de mexer em raspagem, enriquecimento, envio de e-mail ou push de lead. O estado medido de cada
integração (com contagem de linhas nas tabelas de evidência) está em `docs/estado/04-integracoes.md` — esta
página é o resumo operacional.

**Regra geral:** chave de provedor só em secret da edge function (`Deno.env.get`), nunca no front. Toda
chamada externa passa por `supabase/functions/_shared/` — há cliente dedicado por provedor; não crie um
`fetch` solto na função de entrada. Saída para host externo passa pelo `_shared/ssrf-guard.ts`.

## Quem está vivo de verdade

| Integração | Código | Estado medido |
|---|---|---|
| **Supabase / Lovable Cloud** | `src/integrations/supabase/`, 152 usos de `Deno.env.get` de Supabase nas edges | ✅ vivo (95 tabelas, 255 policies, 30 crons) |
| **Webhooks de saída** | `webhook-dispatcher/index.ts`, `lux/integrations/WebhooksPanel.tsx` | ✅ vivo — `webhook_deliveries` com 63 entregas |
| **Google Maps via Omkar (raspagem)** | `gmaps-proxy/index.ts`, `_shared/gmaps-mapper.ts`, `_shared/omkar-gmaps-config.ts`, `GMAPS_PROVIDER` | 🟨 cron 28 com 24.919 sucessos, mas **`scrape_results` = 0**: o resultado bruto não é persistido |
| **Lusha** | 53 arquivos: `lusha-search`, `lusha-reveal`, `lusha-decision-makers`, `_shared/lusha-client.ts`, `_shared/lusha-departments.ts`, `docs/LUSHA-INTEGRATION.md` | 🟨 **a única externa com dado real** (`lusha_contacts` = 12), mas `lusha_credit_usage_log` e `lusha_dm_search_history` = 0 — crédito e histórico não gravam |
| **CNPJá (Receita Federal)** | `cnpj-enrich`, `cnpj-enrich-worker`, `cnpj-settings-status`, tela `/settings/cnpj` | 🟨 cron 17 com 12.460 sucessos e **as 3 tabelas de fila/cache/rate com 0 linhas** — worker queima recurso sem enriquecer |
| **Lovable AI Gateway (Gemini)** | `ai-agent/index.ts`, `LOVABLE_API_KEY` (6 pontos), `AIAgentView` | 🟨 `agent_chat_messages` = 0 — nenhuma conversa persistida |
| **Gmail / Microsoft OAuth** | `email-oauth-connect`/`-callback`/`-disconnect`, `sendGmail()` e `sendOutlook()` em `campaign-dispatch` | 🟨 `email_accounts` = 0 — o envio nunca teve remetente |
| **API pública REST (LUX como provedor)** | `public-api/index.ts`, `docs/openapi.ts`, `ApiDocsCard.tsx` | 🟨 `api_keys` = 0 e `api_request_logs` = 0 |
| **Google Places API (New)** | `gmaps-places-search/index.ts`, `usePlacesApiUsage.ts` | 🟦 flag `use_places_api_new` = **false** em `feature_flags` (`requires_connector: google_maps`) |
| **Apollo.io** | `_shared/apollo-client.ts`, `apollo-cache.ts`, `apollo-departments.ts` | 🟦 consumido só por `oracle-search-decisors`; caches vazios |
| **Bitrix24 (Oracle → CRM)** | `oracle-push-bitrix/index.ts`, `_shared/bitrix-client.ts`, `BITRIX_WEBHOOK_BASE`, guard SSRF | 🟦 sem evidência de um único lead entregue |
| **Apify** | `_shared/apify-gateway.ts` + fixtures, `docs/apify-mock-mode.md` | 🟦 consumidores (`instagram-connection-status`, `instagram-worker-health`) **sem chamador** |
| **HikerAPI (Instagram)** | `instagram-worker`, `-enqueue`, `-worker-health`, `-dlq-replay`, `_shared/hiker-client.ts` | 🟦 **nenhum cron, nenhum chamador**; `instagram_scrape_*` com 0 linhas |

Antes de dizer "a integração X funciona", confira a tabela de evidência dela em
`docs/estado/04-integracoes.md`. Secret configurado + código presente **não** é prova de tráfego.

## Modo mock

`APIFY_MOCK_MODE`, `APIFY_MOCK_FAULTS` e `HIKER_MOCK_MODE` existem para testar sem gastar crédito
(`docs/apify-mock-mode.md`). O `edge-tests-daily.yml` já roda com os três ligados. **Nunca** ligue mock em
produção nem desligue para "testar de verdade" sem o dono: cada chamada real é custo.

## Testes Deno × Vitest

Os testes em `supabase/functions/**/__tests__/` são **Vitest** (projeto `edge` em `vitest.config.ts`), não
Deno. Quatro arquivos são Deno-nativos e estão excluídos de propósito no `vitest.config.ts`:
`gmaps-mapper.test.ts`, `hiker-normalize.test.ts`, `hiker-normalize-extra.test.ts`,
`instagram-config-hash.test.ts` — esses rodam só por `deno test`. Escreveu teste de edge function? Decida o
runner antes e registre no arquivo certo, senão ele fica sem runner (foi o que quebrou o
`edge-tests-daily.yml`, ver `github-ci.md`).
