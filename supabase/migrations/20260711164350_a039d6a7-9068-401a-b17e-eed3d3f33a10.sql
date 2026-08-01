-- Multi-step campaign sequencing: per-recipient progression + scheduling
ALTER TABLE public.campaign_recipients
  ADD COLUMN IF NOT EXISTS current_step integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_action_at timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS sequence_completed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_step_error text;

-- Index to efficiently pull recipients ready for their next step
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_next_action
  ON public.campaign_recipients (campaign_id, next_action_at)
  WHERE sequence_completed_at IS NULL;

-- Prevent duplicate sends of the same step to the same recipient (idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_messages_recipient_step_unique
  ON public.campaign_messages (recipient_id, step_index);

-- RPC: advance a recipient's sequence state atomically and safely (org-scoped, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.advance_recipient_step(
  _recipient_id uuid,
  _next_step integer,
  _next_action_at timestamp with time zone,
  _completed boolean,
  _error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.campaign_recipients
  SET current_step = _next_step,
      next_action_at = _next_action_at,
      sequence_completed_at = CASE WHEN _completed THEN now() ELSE sequence_completed_at END,
      last_step_error = _error,
      updated_at = now()
  WHERE id = _recipient_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.advance_recipient_step(uuid, integer, timestamp with time zone, boolean, text) TO service_role;