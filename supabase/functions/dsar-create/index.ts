import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const VALID_TYPES = ['access', 'rectification', 'portability', 'erasure', 'anonymization', 'consent_revocation', 'opposition'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    // Rate limit simples: 5 por hora por IP
    const { data: rl } = await admin.from('dsar_rate_limit').select('*').eq('ip', ip).maybeSingle();
    const hourAgo = Date.now() - 60 * 60 * 1000;
    if (rl && new Date(rl.window_start).getTime() > hourAgo) {
      if (rl.count >= 5) return json({ error: 'Rate limit exceeded' }, 429);
      await admin.from('dsar_rate_limit').update({ count: rl.count + 1 }).eq('ip', ip);
    } else {
      await admin.from('dsar_rate_limit').upsert({ ip, count: 1, window_start: new Date().toISOString() });
    }

    const body = await req.json();
    const { account_id, requester_name, requester_email, request_type, description, requester_phone } = body;

    if (!account_id || !requester_name || !requester_email || !request_type) return json({ error: 'Missing required fields' }, 400);
    if (!VALID_TYPES.includes(request_type)) return json({ error: 'Invalid request_type' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requester_email)) return json({ error: 'Invalid email' }, 400);
    if (requester_name.length > 200 || (description && description.length > 2000)) return json({ error: 'Field too long' }, 400);

    const { data: acc } = await admin.from('accounts').select('id, status').eq('id', account_id).maybeSingle();
    if (!acc || acc.status !== 'active') return json({ error: 'Account not available' }, 404);

    const { data: dsar, error } = await admin.from('data_subject_requests').insert({
      account_id, requester_name, requester_email, requester_phone,
      request_type, description, status: 'open', priority: 'normal',
    }).select('id').single();
    if (error) throw error;

    await admin.rpc('log_audit_v2', {
      _account_id: account_id, _event_type: 'dsar.created',
      _severity: 'warn', _entity_type: 'data_subject_request', _entity_id: dsar.id,
      _action: 'dsar.created', _metadata: { request_type, ip },
    });
    await admin.from('governance_notifications').insert({
      account_id, type: 'dsar.created', severity: 'warn',
      title: 'Novo pedido de titular',
      body: `${requester_name} solicitou: ${request_type}`,
      link: '/account/governance/dsar',
    });

    return json({ ok: true, request_id: dsar.id });
  } catch (e) {
    console.error('[dsar-create]', e);
    return json({ error: 'Erro interno do servidor' }, 500);
  }
});
