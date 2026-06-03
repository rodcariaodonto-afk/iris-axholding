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

    const { account_id, reason, request_type = 'account' } = await req.json();
    if (!account_id) return json({ error: 'Missing account_id' }, 400);

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: m } = await admin.from('account_members').select('role')
      .eq('account_id', account_id).eq('user_id', u.user.id).eq('status', 'active').maybeSingle();
    if (!m || m.role !== 'owner') return json({ error: 'Only owner can request deletion' }, 403);

    const { data: pol } = await admin.from('account_policies').select('retention_days_after_cancel')
      .eq('account_id', account_id).maybeSingle();
    const days = pol?.retention_days_after_cancel ?? 30;
    const scheduled = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const { data: dr, error } = await admin.from('data_deletion_requests').insert({
      account_id, requested_by: u.user.id, request_type,
      status: 'pending', reason, scheduled_for: scheduled,
    }).select('*').single();
    if (error) throw error;

    await admin.from('accounts').update({
      cancelled_at: new Date().toISOString(),
      retention_until: scheduled,
      delete_after: scheduled,
      deletion_status: 'pending',
      deletion_scheduled_at: scheduled,
      deletion_reason: reason ?? null,
      status: 'cancelled',
    }).eq('id', account_id);

    await admin.rpc('log_audit_v2', {
      _account_id: account_id, _event_type: 'deletion.requested',
      _severity: 'critical', _entity_type: 'account', _entity_id: account_id,
      _action: 'deletion.requested', _metadata: { reason, scheduled_for: scheduled },
    });

    await admin.from('governance_notifications').insert({
      account_id, type: 'deletion.requested', severity: 'critical',
      title: 'Pedido de exclusão criado',
      body: `Conta entrará em retenção por ${days} dias. Exclusão prevista: ${new Date(scheduled).toLocaleDateString('pt-BR')}.`,
      link: '/account/governance/retention',
    });

    return json({ deletion_request: dr, scheduled_for: scheduled });
  } catch (e) {
    console.error('[account-deletion-request]', e);
    return json({ error: 'Erro interno do servidor' }, 500);
  }
});
