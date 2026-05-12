import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { account_id, confirm } = await req.json();
    if (!account_id || confirm !== 'CANCELAR') {
      return new Response(JSON.stringify({ error: 'Missing or invalid confirmation' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin.from('account_members').select('role').eq('account_id', account_id).eq('user_id', userData.user.id).eq('status', 'active').maybeSingle();
    if (!roleRow || roleRow.role !== 'owner') {
      return new Response(JSON.stringify({ error: 'Only owner can cancel account' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const deleteAfter = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await admin.from('accounts').update({ status: 'suspended', cancelled_at: new Date().toISOString(), delete_after: deleteAfter }).eq('id', account_id);
    await admin.rpc('log_audit', { _account_id: account_id, _action: 'account.cancelled', _resource_type: 'account', _resource_id: account_id, _metadata: { delete_after: deleteAfter } });

    return new Response(JSON.stringify({ ok: true, delete_after: deleteAfter }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
