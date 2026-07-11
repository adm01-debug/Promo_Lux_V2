# ADR-008: Política de Soft Delete e Retenção de Dados

## Status
Aceito e Implementado

## Contexto
A exclusão acidental de dados críticos (leads, deals, campanhas) por usuários pode causar prejuízos operacionais. Além disso, a manutenção de logs e históricos é necessária para auditoria e conformidade.

## Decisão
Adotar uma política híbrida de deleção:

1. **Soft Delete (Padrão para Negócio)**:
   - Tabelas como `companies`, `deals`, `campaigns` e `workflows` devem utilizar a coluna `deleted_at`.
   - Registros "deletados" permanecem no banco por 30 dias antes de expurgo permanente.
   - Queries via `withOrg` filtram registros onde `deleted_at IS NULL` por padrão. DELETE é convertido em soft delete; a UI de Lixeira (`RecycleBinView`) permite restaurar ou excluir permanentemente. Expurgo automático (30 dias) via cron + edge function `purge-soft-deleted`.

2. **Hard Delete (Técnico/Segurança)**:
   - Tabelas de configuração técnica (`api_keys`, `webhook_deliveries`) utilizam deleção física imediata.
   - Dados de organizações deletadas (via cascata) são removidos fisicamente.

3. **Arquivamento de Logs**:
   - `audit_logs` e `api_request_logs` são mantidos por 90 dias.
   - Após 90 dias, os dados são agregados em métricas diárias e os registros detalhados são removidos (hard delete).

## Consequências
- **Positivo**: Capacidade de recuperação de desastres causados por erro humano.
- **Positivo**: Melhor performance do banco ao manter tabelas de log sob controle.
- **Negativo**: Lógica de queries ligeiramente mais complexa (necessidade de lidar com `deleted_at`).
