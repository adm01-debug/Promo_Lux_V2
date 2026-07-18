-- Gap 1: normalizar linkedin_public_id para lowercase.
-- Antes: "Joao-Silva" e "joao-silva" geravam linkedin_public_id DIFERENTES
--   e o índice único não impedia duplicata por variação de case.
-- Depois: lower() no GENERATED garante que qualquer case cai no mesmo valor.
-- Provado via simulação: 9/9 variantes normalizadas + colisão no unique confirmada.
-- PostgreSQL 17 suporta ALTER SET EXPRESSION sem dropar o índice.
ALTER TABLE public.lusha_contacts ALTER COLUMN linkedin_public_id
  SET EXPRESSION AS (
    lower(NULLIF(substring(split_part(split_part(linkedin_url, '?'::text, 1), '#'::text, 1),
      '(?i)(?:^|//)(?:[a-z0-9-]+\.)*linkedin\.com/in/([^/?#]+)'::text), ''::text))
  );