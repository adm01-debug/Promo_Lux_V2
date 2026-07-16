# Oracle v2 — Runbook

## Visão geral

Oracle v2 substitui o workflow do n8n que buscava decisores na Lusha, enriquecia
contatos com LeadContact e cadastrava tudo no Bitrix24. **Não consome crédito
Lusha pago** — usa apenas endpoints de dashboard autenticados por cookie.

Componentes:

| Camada  | Nome                                   | Responsabilidade                                                |
| ------- | -------------------------------------- | --------------------------------------------------------------- |
| Vault   | `supabase.atomicabr.com.br` self-hosted | Guarda cookies `lusha`, `leadcontact`, `linkedin` renovados     |
| Edge    | `oracle-cookies-preflight`             | Valida saúde dos 3 cookies                                      |
| Edge    | `oracle-search-decisors`               | Busca empresa + decisores (Lusha dashboard, grátis)             |
| Edge    | `oracle-enrich-contact`                | Enriquece email/telefone (LeadContact)                          |
| Edge    | `oracle-push-bitrix`                   | Anti-duplicata + cadastro de contato e card no Bitrix24         |
| Front   | `OracleV2Panel`                        | UI dedicada, atrás da feature flag `oracle_v2`                  |

## Fluxo end-to-end

```
Usuário digita empresa+deps
     │
     ▼
oracle-search-decisors
     │  1. preflight cookie 'lusha'
     │  2. dept map PT→EN
     │  3. dashboard-services.lusha.com/v2/filters/companyName
     │  4. loop /v2/search-agent por departamento
     │  5. dedup por (org, linkedin_public_id)
     │  6. insert lusha_contacts status=pending_enrichment
     ▼
Usuário clica "Revelar" ou "Enriquecer todos"
     │
     ▼
oracle-enrich-contact
     │  1. preflight cookie 'leadcontact'
     │  2. UPDATE lock atômico (status='enriching')
     │  3. Promise.allSettled(findEmailAll, findPhone) por contato
     │  4. pick best email/phone + normaliza BR
     │  5. UPSERT parcial (só se antes era null)
     │  6. status → enriched | not_found | error_*
     ▼
Usuário clica "Enviar ao Bitrix"
     │
     ▼
oracle-push-bitrix
     │  1. lock atômico (status='pushing_bitrix'), só 'enriched' sem bitrix_contact_id
     │  2. guarda: sem email e sem telefone → not_found, não polui o CRM
     │  3. crm.contact.list por email → telefone → linkedin
     │  4a. duplicado → crm.item.add estágio DUPLICADO → bitrix_duplicate
     │  4b. novo → crm.contact.add + crm.item.add CADASTRADO → sent_to_bitrix
     │  5. atualiza total_inserted_bitrix na sessão
```

## Feature flag

`feature_flags.flag_key = 'oracle_v2'` — desligue para esconder a aba sem deploy.

## Circuit breakers

| Serviço             | Threshold | Reset  |
| ------------------- | --------- | ------ |
| `cookie_vault`      | 3         | 30s    |
| `lusha_company`     | 5         | 60s    |
| `lusha_search`      | 5         | 60s    |
| `leadcontact_email` | 5         | 120s   |
| `leadcontact_phone` | 5         | 120s   |
| `bitrix`            | 5         | 60s    |

Reset manual: `SELECT reset_circuit_breaker('nome_do_servico');` (admin only).

## Cookies — o que fazer quando quebrar

Todos os cookies são renovados pela automação externa do Claude que popula a
tabela `cookies_config`. O LUX **apenas lê**. Se `oracle-cookies-preflight`
retornar `503`, o problema é do vault, não do LUX:

1. Verifique o dashboard do self-hosted (`supabase.atomicabr.com.br`).
2. Confirme que a automação de renovação está rodando.
3. Após correção, o próximo preflight (5min de refetch) reabre o painel.

Retry: cada leitura do vault faz **3 tentativas com backoff 1s→3s→9s** antes
de falhar. Se todas falharem, o circuit breaker `cookie_vault` abre por 30s.

## Idempotência

- **Sessões**: hash SHA-256(user + org + empresa + deps ordenados). Rechamar
  com mesmos parâmetros retorna a sessão anterior sem reprocessar.
- **Contatos**: unique total `(organization_id, linkedin_public_id)` — mesma
  pessoa nunca duplica dentro da organização. O índice deixou de ser parcial
  porque `ON CONFLICT` do Postgres não infere índices parciais (erro 42P10);
  agora é um UNIQUE total sobre as duas colunas.

## Configuração

- Secret `BITRIX_WEBHOOK_BASE` guarda a URL completa do webhook REST do
  Bitrix24 (ex.: `https://promobrindes.bitrix24.com.br/rest/<user>/<token>/`).
  Sem ele, `oracle-push-bitrix` devolve `bitrix_not_configured`.
- Pipeline de destino: `entityTypeId = 1328`, `categoryId = 284`. Estágios
  (CADASTRADO / DUPLICADO) e enums de departamento vivem em
  `_shared/bitrix-constants.ts`.
- A coluna `lusha_contacts.linkedin_public_id` é `GENERATED ALWAYS` no banco
  e espelha a lógica de `_shared/linkedin-url.ts` (suporta subdomínios de país
  como `br.linkedin.com`). **Alterar a regra no TS exige alterar a expressão
  GENERATED no banco no mesmo commit**, caso contrário edge e DB divergem.

## Observabilidade

- `automation_execution_logs` recebe eventos com `source` `oracle-*` e
  `correlation_id` por requisição.
- `circuit_breakers` visível em Monitoring.
- Logs estruturados JSON no stdout das edges (ADR-006).

## Rollback

Desligar a flag `oracle_v2`:
```sql
UPDATE feature_flags SET is_enabled = false WHERE flag_key = 'oracle_v2';
```
As edges antigas `lusha-decision-makers` / `lusha-reveal` seguem funcionando.
