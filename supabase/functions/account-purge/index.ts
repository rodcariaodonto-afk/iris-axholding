import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Cron-only: chamado pelo pg_cron (sem JWT de usuário). Protege via service role + secret opcional.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Encontra contas com retenção expirada e deletion_status='scheduled'
    const now = new Date().toISOString();
    const { data: accs } = await admin.from('accounts')
      .select('id, name')
      .lte('delete_after', now)
      .eq('deletion_status', 'scheduled');

    const purged: string[] = [];
    for (const a of accs ?? []) {
      // Tabelas a apagar (FKs lógicas via account_id)
      const tables = [
        'messages', 'conversations', 'conversation_states', 'send_queue',
        'message_processing_queue', 'nina_processing_queue', 'message_grouping_queue',
        'deal_activities', 'deals', 'pipeline_stages', 'appointments',
        'team_members', 'team_functions', 'teams', 'tag_definitions',
        'media_library', 'google_calendar_connections', 'contacts',
        'data_subject_requests', 'governance_notifications', 'data_exports',
        'data_deletion_requests', 'account_invites', 'account_members',
        'account_policies', 'nina_settings', 'audit_logs',
      ];
      for (const t of tables) {
        await admin.from(t).delete().eq('account_id', a.id);
      }
      await admin.from('accounts').update({
        deletion_status: 'completed', deleted_at: now, status: 'deleted', name: '[deleted]',
      }).eq('id', a.id);
      purged.push(a.id);
    }
    return json({ purged_count: purged.length, purged });
  } catch (e) {
    console.error('[account-purge]', e);
    return json({ error: 'Erro interno do servidor' }, 500);
  }
});
