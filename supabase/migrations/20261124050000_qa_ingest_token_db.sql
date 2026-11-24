-- =============================================================================
-- qa-ingest-run: token de ingestao persistido no banco (self-service do dono)
-- =============================================================================
-- Causa raiz: a edge function `qa-ingest-run` dependia exclusivamente do segredo
-- de plataforma `QA_INGEST_TOKEN`. Em producao ele nunca existiu e a Management
-- API do Supabase recusa gravar segredos neste projeto (HTTP 403 — a conta nao e
-- membro da org dona do projeto). Resultado: a funcao respondia
--   HTTP 400 {"error":"QA_INGEST_TOKEN not configured on server"}
-- para todo POST, e o painel de QA em Settings nunca recebia rodadas.
--
-- Solucao: o token passa a viver no banco, com apenas o hash SHA-256 armazenado,
-- no mesmo padrao ja usado pelo SCIM (`generate_scim_token` / `verify_scim_token`):
-- tokens de 32 bytes aleatorios, guardados como `encode(sha256(token::bytea),'hex')`.
-- A edge function le esta tabela com service_role; o segredo de plataforma
-- continua sendo aceito quando existir (compatibilidade e fallback).
--
-- Seguranca: tabela sem NENHUMA policy de RLS e sem grants para anon/authenticated
-- — inacessivel via PostgREST. Somente a edge function (service_role) le/escreve.
-- Nao cria funcao nova: nao altera a lista estrita de
-- `scripts/sql/check-function-grants.sql` nem o allowlist de SECURITY DEFINER.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.qa_ingest_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label        text NOT NULL DEFAULT 'CI',
  token_hash   text NOT NULL,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS qa_ingest_tokens_token_hash_key
  ON public.qa_ingest_tokens (token_hash);

CREATE INDEX IF NOT EXISTS qa_ingest_tokens_active_idx
  ON public.qa_ingest_tokens (created_at DESC)
  WHERE revoked_at IS NULL;

ALTER TABLE public.qa_ingest_tokens ENABLE ROW LEVEL SECURITY;

-- Sem policies: nenhum acesso via PostgREST. Revoga os grants default do schema
-- public (o Supabase concede ALL a anon/authenticated em tabelas novas).
REVOKE ALL ON public.qa_ingest_tokens FROM anon, authenticated;
GRANT ALL ON public.qa_ingest_tokens TO service_role;

COMMENT ON TABLE public.qa_ingest_tokens IS
  'Tokens de ingestao do pipeline de QA (somente hash SHA-256). Sem policies de RLS: acesso exclusivo da edge function qa-ingest-run via service_role.';
COMMENT ON COLUMN public.qa_ingest_tokens.token_hash IS
  'encode(sha256(token::bytea),''hex'') — mesmo formato usado por org_integrations/SCIM.';
COMMENT ON COLUMN public.qa_ingest_tokens.revoked_at IS
  'Preenchido no revoke; tokens revogados sao rejeitados e nao podem ser reativados.';