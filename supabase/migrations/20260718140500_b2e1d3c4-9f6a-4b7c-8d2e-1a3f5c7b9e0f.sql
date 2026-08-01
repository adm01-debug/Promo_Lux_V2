-- ============================================================================
-- webhook-dispatcher precisa "travar" uma entrega antes de processá-la
-- (cron + replay manual concorrentes hoje podem enviar a mesma entrega duas
-- vezes). O padrão de claim atômico é um UPDATE ... WHERE status IN
-- ('pending','retrying') ... RETURNING — para isso, 'sending' precisa ser um
-- status válido durante a janela de processamento.
-- ============================================================================

ALTER TABLE public.webhook_deliveries DROP CONSTRAINT IF EXISTS webhook_deliveries_status_check;

ALTER TABLE public.webhook_deliveries
  ADD CONSTRAINT webhook_deliveries_status_check
  CHECK (status IN ('pending', 'sending', 'success', 'failed', 'retrying'));

-- ============================================================================
-- src/hooks/useWebhooks.ts (botão "Reenviar" na UI) faz um reset client-side
-- (status='pending', attempts=0, ...) ANTES de invocar webhook-dispatcher —
-- mas webhook_deliveries só tinha policy de SELECT para authenticated (mais
-- "Service manage deliveries" só para service_role). Sem policy de UPDATE, o
-- reset era um no-op silencioso sob RLS (0 linhas afetadas, sem erro), e o
-- replay dependia inteiramente do dispatcher aceitar qualquer delivery_id
-- independente do status — exatamente o buraco fechado no claim atômico
-- acima. Fecha o ciclo: permite ao admin da org resetar SUA delivery para
-- replay, mas só nesse formato exato (não pode forjar status_code/
-- response_body/outro status via UPDATE direto).
-- ============================================================================
CREATE POLICY "Admins replay deliveries" ON public.webhook_deliveries
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (
    public.has_org_role(organization_id, auth.uid(), 'admin')
    AND status = 'pending'
    AND attempts = 0
  );
