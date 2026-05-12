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

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { account_id } = await req.json();
    if (!account_id) return new Response(JSON.stringify({ error: 'Missing account_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const admin = createClient(supabaseUrl, serviceKey);
    // verify owner/admin
    const { data: roleRow } = await admin.from('account_members').select('role').eq('account_id', account_id).eq('user_id', userData.user.id).eq('status', 'active').maybeSingle();
    if (!roleRow || !['owner', 'admin'].includes(roleRow.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tables = ['contacts', 'conversations', 'messages', 'deals', 'appointments', 'pipeline_stages', 'team_members', 'teams'];
    const dump: Record<string, unknown[]> = {};
    for (const t of tables) {
      const { data } = await admin.from(t).select('*').eq('account_id', account_id);
      dump[t] = data || [];
    }
    const json = JSON.stringify({ exported_at: new Date().toISOString(), account_id, data: dump }, null, 2);
    const path = `${account_id}/export-${Date.now()}.json`;
    const { error: upErr } = await admin.storage.from('account-exports').upload(path, new Blob([json], { type: 'application/json' }), { upsert: false });
    if (upErr) throw upErr;

    const { data: signed } = await admin.storage.from('account-exports').createSignedUrl(path, 60 * 60 * 24);
    await admin.rpc('log_audit', { _account_id: account_id, _action: 'account.exported', _resource_type: 'account', _resource_id: account_id, _metadata: { path } });

    return new Response(JSON.stringify({ url: signed?.signedUrl, path }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[account-export] error', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
