-- ============================================================================
-- get_sector_summary(p_user_id uuid) é SECURITY DEFINER (ignora RLS) e
-- filtrava por um p_user_id ARBITRÁRIO vindo do chamador, sem checar
-- `p_user_id = auth.uid()` nem organização — qualquer usuário autenticado
-- podia chamar `select * from get_sector_summary('<uuid-de-outro-usuario>')`
-- e ler a distribuição de empresas por setor de qualquer conta, cross-org.
-- (A função nunca foi consumida pelo frontend — só existia no banco.)
--
-- Corrige seguindo o mesmo padrão já usado por get_dashboard_stats: troca
-- p_user_id por p_org_id, checa organization_members antes de responder, e
-- passa a contar por organization_id (companies é dado compartilhado pela
-- org inteira, não por usuário individual — contar só por user_id
-- sub-contaria o widget para qualquer org com mais de um membro).
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_sector_summary(uuid);

CREATE FUNCTION public.get_sector_summary(p_org_id UUID)
RETURNS TABLE (sector TEXT, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado à organização';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(c.sector, 'Outros') AS sector,
    COUNT(*) AS count
  FROM public.companies c
  WHERE c.organization_id = p_org_id
  GROUP BY COALESCE(c.sector, 'Outros')
  ORDER BY count DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_sector_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sector_summary(uuid) TO authenticated;
