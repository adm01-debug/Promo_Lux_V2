# Apify Mock Mode (Dev / E2E)

Modo de desenvolvimento que **mocka o connector-gateway do Apify** para validar
o motor Instagram (fila → worker → DLQ → UI) sem uma conexão Apify ativa.

## Como ativar

Defina o secret de Edge Functions:

```
APIFY_MOCK_MODE=true
```

Nesse modo, o wrapper `supabase/functions/_shared/apify-gateway.ts`:

- **não** chama `https://connector-gateway.lovable.dev/apify`;
- mint sintético de `run_id` + `dataset_id`;
- retorna `status=SUCCEEDED` no primeiro `getRunStatus` (poll converge no tick 1);
- serve fixtures determinísticos de `apify-fixtures.ts` conforme o `actor_id`:
  - `apify/instagram-profile-scraper` → 1 perfil (`lux.ia`);
  - `apify/instagram-post-scraper` → 1 post + 1 reel;
  - `apify/instagram-hashtag-scraper` → 1 post em `#marketing`;
  - `apify/instagram-comment-scraper` → 2 comentários.

Fixtures reproduzem o payload **bruto** que o Apify devolveria, então o
normalizador do worker (`NormalizedInstagramItem`) roda no mesmo caminho do
modo real.

## Uso típico

1. `APIFY_MOCK_MODE=true` no ambiente Cloud dev.
2. Enfileirar tarefa via `enqueue-instagram-task` (todos os 4 `target_type`).
3. Worker consome, faz `startActorRun` → `getRunStatus` → `getDatasetItems`
   sem tocar a rede externa.
4. Resultados aparecem em `instagram_scrape_results` com `raw_items`
   preservado e `normalized` populado.
5. E2E Playwright valida a aba **Instagram** em Monitoring.

## Desligando

Remover ou setar `APIFY_MOCK_MODE=false`. O wrapper volta a exigir
`LOVABLE_API_KEY` + `APIFY_API_KEY` — se qualquer um faltar, `readApifyClientOptions()`
lança erro explícito na primeira invocação.

## Limitações

- Fixtures são estáticos (não simulam paginação real além do `limit`).
- Não injeta falhas — para chaos testing use a política de retry global
  (Rodada #4) ou uma fixture adicional com `throw` no wrapper.
- `config_hash` e dedup funcionam normalmente (é hash do input, não do output).
