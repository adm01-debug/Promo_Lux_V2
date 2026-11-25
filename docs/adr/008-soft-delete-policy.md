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
   - `api_request_logs` são mantidos por 90 dias.
   - `audit_logs` (trilha de auditoria de quem fez o quê) são mantidos por **5 anos** (1.827 dias) — decisão de negócio de 25/11/2026: o registro tem uso legal e não pode ser truncado em 90/180 dias. Expurgo automático pelo job `daily-log-retention` (`prune_audit_logs(1827)`).
   - Após o prazo de cada tabela, os registros detalhados são removidos (hard delete).

## Consequências
- **Positivo**: Capacidade de recuperação de desastres causados por erro humano.
- **Positivo**: Melhor performance do banco ao manter tabelas de log sob controle.
- **Negativo**: Lógica de queries ligeiramente mais complexa (necessidade de lidar com `deleted_at`).
