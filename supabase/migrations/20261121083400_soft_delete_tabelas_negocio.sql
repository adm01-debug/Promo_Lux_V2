-- Soft delete padrao (ADR-008) ampliado para tabelas de dados de negocio.
-- Replicar o mesmo padrao ja aplicado em companies/deals/campaigns/workflows:
--   coluna deleted_at (timestamptz NULL) + indice parcial da lixeira + indice
--   parcial de escopo ativo (organization_id WHERE deleted_at IS NULL).

ALTER TABLE public.email_suppressions ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
ALTER TABLE public.email_accounts      ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
ALTER TABLE public.api_keys            ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
ALTER TABLE public.webhooks            ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_email_suppressions_deleted ON public.email_suppressions (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_accounts_deleted      ON public.email_accounts      (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_deleted           ON public.api_keys            (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhooks_deleted           ON public.webhooks            (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_suppressions_active ON public.email_suppressions (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_email_accounts_active     ON public.email_accounts      (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_active          ON public.api_keys            (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_webhooks_active          ON public.webhooks            (organization_id) WHERE deleted_at IS NULL;

-- Ampliar a RPC de expurgo para cobrir as novas tabelas (mesma janela de
-- retencao de 30 dias). Tabelas de seguranca (users, organization_members,
-- scim_users, oauth_clients) ficam de fora propositalmente: sao contas/acessos,
-- nao dados de negocio, e nao devem ser purgadas pelo cron.
CREATE OR REPLACE FUNCTION public.purge_soft_deleted()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  DELETE FROM public.companies          WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM public.deals              WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM public.campaigns          WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM public.workflows          WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM public.email_suppressions WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM public.email_accounts     WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM public.api_keys           WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM public.webhooks           WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
END;
$function$;

REVOKE ALL ON FUNCTION public.purge_soft_deleted() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_soft_deleted() TO service_role;