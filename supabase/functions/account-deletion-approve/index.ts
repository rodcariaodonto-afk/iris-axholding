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

    const { request_id, action } = await req.json();
    if (!request_id || !['approve', 'cancel'].includes(action)) return json({ error: 'Invalid input' }, 400);

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: dr } = await admin.from('data_deletion_requests').select('*').eq('id', request_id).maybeSingle();
    if (!dr) return json({ error: 'Not found' }, 404);

    // Owner da conta OU super-admin
    const { data: isSuper } = await userClient.rpc('is_super_admin');
    const { data: m } = await admin.from('account_members').select('role')
      .eq('account_id', dr.account_id).eq('user_id', u.user.id).eq('status', 'active').maybeSingle();
    const isOwner = m?.role === 'owner';
    if (!isSuper && !isOwner) return json({ error: 'Forbidden' }, 403);

    if (action === 'approve') {
      await admin.from('data_deletion_requests').update({
        status: 'scheduled', approved_by: u.user.id, approved_at: new Date().toISOString(),
      }).eq('id', request_id);
      await admin.from('accounts').update({ deletion_status: 'scheduled' }).eq('id', dr.account_id);
      await admin.rpc('log_audit_v2', {
        _account_id: dr.account_id, _event_type: 'deletion.approved',
        _severity: 'critical', _entity_type: 'data_deletion_request', _entity_id: request_id,
        _action: 'deletion.approved',
      });
    } else {
      await admin.from('data_deletion_requests').update({
        status: 'cancelled', completed_at: new Date().toISOString(),
      }).eq('id', request_id);
      await admin.from('accounts').update({
        deletion_status: 'none', cancelled_at: null, retention_until: null,
        delete_after: null, deletion_scheduled_at: null, deletion_reason: null, status: 'active',
      }).eq('id', dr.account_id);
      await admin.rpc('log_audit_v2', {
        _account_id: dr.account_id, _event_type: 'deletion.cancelled',
        _severity: 'critical', _entity_type: 'data_deletion_request', _entity_id: request_id,
        _action: 'deletion.cancelled',
      });
    }
    return json({ ok: true });
  } catch (e) {
    console.error('[account-deletion-approve]', e);
    return json({ error: 'Erro interno do servidor' }, 500);
  }
});
