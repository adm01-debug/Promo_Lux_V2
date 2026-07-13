-- CORREÇÃO DE GAP: default_org_for_current_user() é DEFAULT de coluna
-- organization_id em 22 tabelas. O DEFAULT é avaliado como o usuário
-- autenticado no momento do INSERT, portanto authenticated PRECISA de EXECUTE.
-- A migração de hardening anterior havia revogado — sem isto, todo INSERT
-- que dependa do default falharia com "permission denied for function".
GRANT EXECUTE ON FUNCTION public.default_org_for_current_user() TO authenticated;