-- Etapa 037 (docs/qa/04-PLANO.md): a contagem de tentativas de login passa a
-- ser uma unica transacao no banco. Antes a edge function auth-rate-limit lia a
-- linha, calculava em JavaScript e gravava em seguida: N logins simultaneos
-- liam o mesmo "attempts" e o teto de 5 nunca era atingido (provado em banco de
-- replay: 20 simultaneos terminavam com attempts=1 e sem bloqueio).
--
-- Chamador: supabase/functions/auth-rate-limit (service_role). A tabela tem RLS
-- com a policy "Servico interno apenas" USING (false), entao nem anon nem
-- authenticated enxergam as linhas.

-- 1) ON CONFLICT (identifier) exige indice unico; hoje existe apenas um indice
--    comum (idx_auth_rate_limits_identifier). Linhas duplicadas do mesmo
--    identifier sao resolvidas mantendo a de last_attempt mais recente.
DELETE FROM public.auth_rate_limits a
USING public.auth_rate_limits b
WHERE a.identifier = b.identifier
  AND (COALESCE(a.last_attempt, 'epoch'::timestamptz), a.id)
    < (COALESCE(b.last_attempt, 'epoch'::timestamptz), b.id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_auth_rate_limits_identifier
  ON public.auth_rate_limits (identifier);

-- 2) Contagem atomica. O SELECT ... FOR UPDATE serializa as chamadas
--    concorrentes da mesma chave; a transacao inteira cabe na funcao.
--    "alreadyLocked" diz se o bloqueio ja valia antes desta chamada (a edge
--    function usa isso para distinguir 200 de 429, mantendo o contrato atual).
CREATE OR REPLACE FUNCTION public.check_auth_rate_limit(
  p_identifier text,
  p_max_attempts integer DEFAULT 5,
  p_window_minutes integer DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := left(btrim(coalesce(p_identifier, '')), 254);
  v_prev_attempts integer;
  v_prev_last timestamptz;
  v_prev_locked timestamptz;
  v_attempts integer;
  v_locked_until timestamptz;
  v_already_locked boolean;
  v_now timestamptz := now();
  v_window interval := make_interval(mins => p_window_minutes);
BEGIN
  IF v_key = '' THEN
    RAISE EXCEPTION 'identifier obrigatorio' USING ERRCODE = '22023';
  END IF;

  -- Cria a chave sem contar tentativa; se ja existir, nao mexe.
  INSERT INTO public.auth_rate_limits (identifier, attempts, last_attempt)
  VALUES (v_key, 0, NULL)
  ON CONFLICT (identifier) DO NOTHING;

  SELECT attempts, last_attempt, locked_until
    INTO v_prev_attempts, v_prev_last, v_prev_locked
    FROM public.auth_rate_limits
   WHERE identifier = v_key
     FOR UPDATE;

  v_already_locked := COALESCE(v_prev_locked > v_now, false);

  IF v_already_locked THEN
    -- Nao conta de novo: senao o bloqueio se estenderia a cada request negada.
    v_attempts := v_prev_attempts;
    v_locked_until := v_prev_locked;
  ELSE
    IF v_prev_last IS NULL OR v_prev_last < v_now - v_window THEN
      v_attempts := 1;
    ELSE
      v_attempts := v_prev_attempts + 1;
    END IF;

    IF v_attempts >= p_max_attempts THEN
      v_locked_until := v_now + v_window;
    ELSE
      v_locked_until := NULL;
    END IF;

    UPDATE public.auth_rate_limits
       SET attempts = v_attempts,
           last_attempt = v_now,
           locked_until = v_locked_until
     WHERE identifier = v_key;
  END IF;

  RETURN jsonb_build_object(
    'attempts', v_attempts,
    'locked', COALESCE(v_locked_until > v_now, false),
    'alreadyLocked', v_already_locked,
    'remainingSec', CASE
      WHEN COALESCE(v_locked_until, v_now) > v_now
        THEN ceil(extract(epoch FROM (v_locked_until - v_now)))::integer
      ELSE 0
    END
  );
END;
$$;

COMMENT ON FUNCTION public.check_auth_rate_limit(text, integer, integer) IS
  'Etapa 037: incremento atomico do rate limit de login. Exclusivo do service_role.';

-- 3) O Supabase concede EXECUTE a anon/authenticated por default privileges,
--    entao revogar de PUBLIC nao basta (verificado em banco de replay).
REVOKE ALL ON FUNCTION public.check_auth_rate_limit(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_auth_rate_limit(text, integer, integer)
  TO service_role;