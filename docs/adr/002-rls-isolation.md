# ADR-002: RLS por user_id em Todas as Tabelas

## Status
Aceito

## Contexto
Sistema multi-tenant onde cada usuário tem dados isolados. Necessário garantir que nenhum usuário acesse dados de outro.

## Decisão
- RLS habilitado em todas as 12 tabelas
- Políticas `SELECT/INSERT/UPDATE/DELETE` com `user_id = auth.uid()` para role `authenticated`
- Política `ALL` com `service_role` para operações internas das edge functions
- Tabela `profiles` usa `id = auth.uid()` (PK = auth user ID)
- Trigger `handle_new_user` cria profile automaticamente no signup
- Edge function `rls-tests` valida isolamento automaticamente

## Consequências
- **Positivo**: Isolamento garantido no nível do banco; impossível bypass via API
- **Positivo**: Testes automatizados detectam regressões de segurança
- **Negativo**: Edge functions precisam usar `service_role` para operações cross-user
- **Regra**: Todo novo dado deve incluir `user_id` com default `auth.uid()`
