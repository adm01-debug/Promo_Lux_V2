# ADR-007: Defense-in-depth com Org Isolation Proxy

## Status
Aceito

## Contexto
Em sistemas multi-tenant baseados em Supabase, o RLS (Row Level Security) é a primeira linha de defesa. No entanto, bugs no código do frontend (ex: esquecer um filtro `.eq("organization_id", id)`) podem levar à exposição acidental de dados ou tentativas de escrita entre tenants que, embora bloqueadas pelo banco, geram comportamentos inconsistentes na UI.

## Decisão
Implementamos um wrapper de defesa em profundidade chamado `db` (em `src/integrations/supabase/withOrg.ts`) que utiliza JavaScript Proxies para interceptar todas as chamadas ao cliente Supabase:

1. **Fail-Closed**: Bloqueia operações de escrita (insert, update, delete) se não houver uma organização ativa definida.
2. **Injeção Automática**: Injeta o `organization_id` da organização ativa em todos os `insert` e `upsert`.
3. **Filtro Forçado**: Adiciona automaticamente `.eq("organization_id", activeOrgId)` em todos os `select`, `update` e `delete`.
4. **Validação de Payload**: Lança `OrgMismatchError` se o payload de escrita tentar especificar uma organização diferente da ativa.
5. **Tratamento Global**: Integra-se ao `orgErrorHandler` para disparar toasts e redirecionamentos em caso de violação.

## Consequências
- **Positivo**: Elimina a necessidade de passar manualmente o filtro de org em todas as queries.
- **Positivo**: Garante que o frontend nunca tente "cruzar a fronteira" entre organizações.
- **Negativo**: Pequeno overhead de Proxy (negligenciável).
- **Regra**: O uso do `supabase.from()` direto é desencorajado para tabelas escopadas; deve-se preferir `db.from()`.
