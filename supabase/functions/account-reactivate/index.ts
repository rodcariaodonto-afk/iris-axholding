import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'Missing auth' }, 401);
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) return json({ error: 'Unauthorized' }, 401);
    const { account_id } = await req.json();
    if (!account_id) return json({ error: 'Missing account_id' }, 400);

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: m } = await admin.from('account_members').select('role')
      .eq('account_id', account_id).eq('user_id', u.user.id).eq('status', 'active').maybeSingle();
    if (!m || m.role !== 'owner') return json({ error: 'Only owner' }, 403);

    const { data: acc } = await admin.from('accounts').select('deletion_status, retention_until').eq('id', account_id).single();
    if (!acc || acc.deletion_status === 'completed') return json({ error: 'Already deleted' }, 400);

    await admin.from('accounts').update({
      cancelled_at: null, retention_until: null, delete_after: null,
      deletion_scheduled_at: null, deletion_status: 'none', deletion_reason: null, status: 'active',
    }).eq('id', account_id);
    await admin.from('data_deletion_requests').update({
      status: 'cancelled', completed_at: new Date().toISOString(),
    }).eq('account_id', account_id).in('status', ['pending', 'scheduled']);

    await admin.rpc('log_audit_v2', {
      _account_id: account_id, _event_type: 'account.reactivated',
      _severity: 'critical', _entity_type: 'account', _entity_id: account_id,
      _action: 'account.reactivated',
    });
    return json({ ok: true });
  } catch (e) {
    console.error('[account-reactivate]', e);
    return json({ error: 'Erro interno do servidor' }, 500);
  }
});
