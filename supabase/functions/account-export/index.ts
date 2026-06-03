import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing auth' }, 401);

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: 'Unauthorized' }, 401);

    const { account_id } = await req.json();
    if (!account_id) return json({ error: 'Missing account_id' }, 400);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin.from('account_members')
      .select('role').eq('account_id', account_id).eq('user_id', userData.user.id).eq('status', 'active').maybeSingle();
    if (!roleRow || !['owner', 'admin'].includes(roleRow.role)) return json({ error: 'Forbidden' }, 403);

    // Cria registro pendente
    const { data: exportRow, error: insErr } = await admin.from('data_exports').insert({
      account_id,
      requested_by: userData.user.id,
      status: 'processing',
      format: 'json',
      scope: { modules: 'all' },
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }).select('*').single();
    if (insErr) throw insErr;

    try {
      const tables = [
        'accounts', 'account_members', 'account_policies', 'contacts', 'conversations',
        'messages', 'deals', 'deal_activities', 'appointments', 'pipeline_stages',
        'teams', 'team_members', 'team_functions', 'tag_definitions',
        'media_library', 'data_subject_requests'
      ];
      const dump: Record<string, unknown> = {};
      for (const t of tables) {
        const idCol = t === 'accounts' ? 'id' : 'account_id';
        const val = account_id;
        const { data } = await admin.from(t).select('*').eq(idCol, val);
        dump[t] = data || [];
      }
      // nina_settings sem segredos
      const { data: nina } = await admin.from('nina_settings').select('*').eq('account_id', account_id).maybeSingle();
      if (nina) {
        delete (nina as any).elevenlabs_api_key;
        delete (nina as any).whatsapp_access_token;
        delete (nina as any).evolution_api_key;
        dump['nina_settings'] = nina;
      }
      // audit_logs últimos 90d
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: logs } = await admin.from('audit_logs').select('*').eq('account_id', account_id).gte('created_at', since);
      dump['audit_logs'] = logs || [];

      const payload = JSON.stringify({
        exported_at: new Date().toISOString(),
        account_id,
        export_id: exportRow.id,
        notes: 'Binários (áudio/mídia) excluídos por padrão; apenas metadados/URLs.',
        data: dump,
      }, null, 2);

      const path = `${account_id}/${exportRow.id}.json`;
      const blob = new Blob([payload], { type: 'application/json' });
      const { error: upErr } = await admin.storage.from('account-exports').upload(path, blob, { upsert: true });
      if (upErr) throw upErr;

      await admin.from('data_exports').update({
        status: 'completed',
        file_path: path,
        file_size: blob.size,
        completed_at: new Date().toISOString(),
      }).eq('id', exportRow.id);

      await admin.rpc('log_audit_v2', {
        _account_id: account_id,
        _event_type: 'data.exported',
        _severity: 'warn',
        _entity_type: 'data_export',
        _entity_id: exportRow.id,
        _action: 'data.exported',
        _metadata: { path, size: blob.size },
      });

      await admin.from('governance_notifications').insert({
        account_id, type: 'export.completed', severity: 'info',
        title: 'Exportação concluída', body: `Arquivo gerado (${(blob.size / 1024).toFixed(1)} KB).`,
        link: '/account/governance/exports',
      });

      const { data: signed } = await admin.storage.from('account-exports').createSignedUrl(path, 60 * 60 * 24 * 7);
      return json({ export_id: exportRow.id, url: signed?.signedUrl, path });
    } catch (e) {
      await admin.from('data_exports').update({
        status: 'failed', error_message: String(e), completed_at: new Date().toISOString(),
      }).eq('id', exportRow.id);
      throw e;
    }
  } catch (e) {
    console.error('[account-export] error', e);
    return json({ error: 'Erro interno do servidor' }, 500);
  }
});
