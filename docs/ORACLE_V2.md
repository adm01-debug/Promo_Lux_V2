# Oracle v2 — Runbook

## Visão geral

Oracle v2 substitui o workflow do n8n que buscava decisores na Lusha e enriquecia
contatos com LeadContact. **Não consome crédito Lusha pago** — usa apenas
endpoints de dashboard autenticados por cookie.

Componentes:

| Camada  | Nome                                   | Responsabilidade                                                |
| ------- | -------------------------------------- | --------------------------------------------------------------- |
| Vault   | `supabase.atomicabr.com.br` self-hosted | Guarda cookies `lusha`, `leadcontact`, `linkedin` renovados     |
| Edge    | `oracle-cookies-preflight`             | Valida saúde dos 3 cookies                                      |
| Edge    | `oracle-search-decisors`               | Busca empresa + decisores (Lusha dashboard, grátis)             |
| Edge    | `oracle-enrich-contact`                | Enriquece email/telefone (LeadContact)                          |
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
- **Contatos**: unique parcial `(organization_id, linkedin_public_id)` — mesma
  pessoa nunca duplica dentro da organização.

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
