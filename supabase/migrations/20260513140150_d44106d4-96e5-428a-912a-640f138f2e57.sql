-- Create idempotency_keys table
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    response_body JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, key)
);

-- Enable RLS
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own idempotency keys" 
ON public.idempotency_keys 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own idempotency keys" 
ON public.idempotency_keys 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Cleanup trigger (optional, keeping for 24h)
CREATE OR REPLACE FUNCTION public.cleanup_old_idempotency_keys()
RETURNS trigger AS $$
BEGIN
    DELETE FROM public.idempotency_keys WHERE created_at < now() - interval '24 hours';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- In a real app we would use pg_cron, but for now we rely on explicit cleanup or retention policy.
