CREATE OR REPLACE FUNCTION public.get_sector_summary(p_user_id UUID)
RETURNS TABLE (sector TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(c.sector, 'Outros') as sector,
    COUNT(*) as count
  FROM public.companies c
  WHERE c.user_id = p_user_id
  GROUP BY COALESCE(c.sector, 'Outros')
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;