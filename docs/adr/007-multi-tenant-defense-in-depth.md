# ADR-007: Multi-tenant Defense-in-Depth com Proxy Wrapper (`withOrg`)

## Status
Aceito

## Contexto
Em sistemas multi-tenant, o vazamento de dados entre organizações é o risco de segurança mais crítico. Embora o RLS (Row Level Security) do Supabase forneça uma camada de proteção no banco de dados, erros humanos na construção de queries no frontend podem expor dados ou permitir escritas cross-org se o filtro `organization_id` for omitido.

## Decisão
Implementar um padrão de "defesa em profundidade" através do wrapper `withOrg` (exportado como `db` em `src/integrations/supabase/withOrg.ts`).

1. **Proxy dinâmico**: O wrapper utiliza Proxies de JavaScript para interceptar chamadas ao cliente Supabase.
2. **Fail-closed**: Operações de escrita (INSERT, UPDATE, DELETE) em tabelas escopadas falham imediatamente se não houver uma organização ativa definida.
3. **Injeção Automática**: 
   - `SELECT`: Adiciona `.eq("organization_id", orgId)` automaticamente.
   - `INSERT`: Injeta o `organization_id` no payload.
   - `UPDATE/DELETE`: Força o filtro pela org ativa.
4. **Prevenção de Movimentação**: Bloqueia payloads de UPDATE que tentem alterar o `organization_id` de um registro.
5. **Registry de Tabelas**: Apenas tabelas explicitamente listadas em `ORG_SCOPED_TABLES` sofrem a interceptação, permitindo tabelas globais (como `profiles`) funcionarem normalmente.

## Consequências
- **Positivo**: Redução drástica da probabilidade de bugs de isolamento de dados.
- **Positivo**: Código de frontend mais limpo (não é necessário repetir `.eq("organization_id", ...)` em todo lugar).
- **Negativo**: Pequeno overhead de processamento devido ao Proxy (negligenciável frente ao I/O de rede).
- **Risco**: Desenvolvedores podem esquecer de adicionar novas tabelas ao registry em `withOrg.ts`. (Mitigação: Testes automatizados de cobertura de RLS).
