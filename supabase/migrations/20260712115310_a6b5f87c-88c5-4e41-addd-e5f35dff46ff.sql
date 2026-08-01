-- Remoção de índices exatamente duplicados (mantém 1 índice por assinatura de colunas).
-- Nenhuma regressão de leitura: em cada par permanece um índice com definição idêntica.

DROP INDEX IF EXISTS public.idx_companies_org_id;
DROP INDEX IF EXISTS public.idx_companies_user_score;
DROP INDEX IF EXISTS public.idx_campaign_messages_recipient_step;