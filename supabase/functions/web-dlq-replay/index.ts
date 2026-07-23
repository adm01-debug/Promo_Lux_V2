// Edge Function: web-dlq-replay
// Autentica o usuário, valida membership na organização e invoca o RPC
// public.replay_web_dead_letter_batch com service_role.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';

const BodySchema = z.object({
  organization_id: z.string().uuid(),
  dlq_ids: z.array(z.string().uuid()).max(500).optional(),
  limit: z.number().int().min(1).max(500).optional(),
  reason: z.string().min(1).max(200).optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: 'server_misconfigured' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'unauthorized' }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) {
    return json({ error: 'unauthorized' }, 401);
  }
  const userId = userRes.user.id;

  let parsed;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch (e) {
    return json({ error: 'invalid_body', details: (e as Error).message }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: member, error: memberErr } = await admin
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', parsed.organization_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (memberErr) {
    console.error('membership_check_failed', memberErr);
    return json({ error: 'membership_check_failed' }, 500);
  }
  if (!member) {
    return json({ error: 'forbidden_org' }, 403);
  }

  const { data, error } = await admin.rpc('replay_web_dead_letter_batch', {
    p_organization_id: parsed.organization_id,
    p_dlq_ids: parsed.dlq_ids ?? null,
    p_limit: parsed.limit ?? 50,
    p_actor: userId,
    p_reason: parsed.reason ?? 'manual_replay',
  });

  if (error) {
    console.error('rpc_failed', error);
    return json({ error: 'rpc_failed', details: error.message }, 500);
  }

  return json({ ok: true, result: data }, 200);
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
