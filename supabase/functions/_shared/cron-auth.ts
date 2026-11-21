// Gate de autenticação para edge functions invocadas por cron (pg_cron/net.http_post).
//
// Motivo: o valor runtime de `SUPABASE_SERVICE_ROLE_KEY` NÃO corresponde a nenhuma
// chave listável do projeto (a service_role foi rotacionada e o secret ficou
// obsoleto). Comparar contra ele quebrava todos os crons que enviam a credencial.
// A fonte de verdade passa a ser `CRON_SERVICE_KEY` / `CRON_ANON_KEY`, gravados
// como secrets explícitos e auditáveis.
//
// Segurança: continua exigindo uma credencial de service_role ou anon legítima —
// anônimo sem header segue recebendo 401. A chave anon NÃO concede poder extra:
// o gate apenas libera a execução, e todas as operações internas usam o client
// de service_role criado pela própria função.

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Extrai o token de `Authorization: Bearer` ou do header `apikey`. */
export function requestToken(req: Request): string {
  const auth = req.headers.get("Authorization") ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return (req.headers.get("apikey") ?? "").trim();
}

/**
 * Autoriza invocação por cron/interna.
 * @param allowAnon aceita também `CRON_ANON_KEY` (usado por crons legados que
 *   enviam a anon key); a função nunca eleva privilégio a partir dela.
 */
export function isCronAuthorized(req: Request, opts: { allowAnon?: boolean } = {}): boolean {
  const token = requestToken(req);
  if (!token) return false;

  const candidates = [
    Deno.env.get("CRON_SERVICE_KEY"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  ];
  if (opts.allowAnon) {
    candidates.push(Deno.env.get("CRON_ANON_KEY"), Deno.env.get("SUPABASE_ANON_KEY"));
  }

  return candidates.some((expected) => !!expected && timingSafeEqual(token, expected));
}