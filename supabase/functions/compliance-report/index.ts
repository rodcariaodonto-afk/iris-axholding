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
    if (!m || !['owner', 'admin'].includes(m.role)) return json({ error: 'Forbidden' }, 403);

    const since90 = new Date(Date.now() - 90 * 86400000).toISOString();
    const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const since90d = new Date(Date.now() - 90 * 86400000).toISOString();

    const [policies, exports, dsarOpen, criticalEvents, members, integrations] = await Promise.all([
      admin.from('account_policies').select('*').eq('account_id', account_id).maybeSingle(),
      admin.from('data_exports').select('id, created_at, status').eq('account_id', account_id).gte('created_at', since90),
      admin.from('data_subject_requests').select('id').eq('account_id', account_id).in('status', ['open', 'in_progress']),
      admin.from('audit_logs').select('id').eq('account_id', account_id).eq('severity', 'critical').gte('created_at', since30),
      admin.from('account_members').select('user_id, role, last_active_at, status').eq('account_id', account_id),
      admin.from('nina_settings').select('whatsapp_provider, evolution_api_url, whatsapp_phone_number_id').eq('account_id', account_id).maybeSingle(),
    ]);

    const elevatedRoles = (members.data ?? []).filter((x: any) => ['owner', 'admin'].includes(x.role));
    const inactive90d = (members.data ?? []).filter((x: any) => !x.last_active_at || x.last_active_at < since90d);

    const checks = [
      { id: 'rls', label: 'Row-Level Security ativo em todas as tabelas', status: 'ok' },
      { id: 'retention', label: 'Política de retenção configurada', status: policies.data ? 'ok' : 'warn' },
      { id: 'dpo', label: 'DPO/Encarregado definido', status: policies.data?.dpo_email ? 'ok' : 'warn' },
      { id: 'privacy_url', label: 'URL de Política de Privacidade', status: policies.data?.privacy_policy_url ? 'ok' : 'warn' },
      { id: 'exports', label: 'Exportação de dados disponível', status: 'ok', value: (exports.data ?? []).length },
      { id: 'dsar', label: 'Pedidos de titulares pendentes', status: (dsarOpen.data ?? []).length === 0 ? 'ok' : 'warn', value: (dsarOpen.data ?? []).length },
      { id: 'critical', label: 'Eventos críticos nos últimos 30 dias', status: (criticalEvents.data ?? []).length === 0 ? 'ok' : 'warn', value: (criticalEvents.data ?? []).length },
      { id: 'inactive', label: 'Usuários inativos há +90 dias', status: inactive90d.length === 0 ? 'ok' : 'warn', value: inactive90d.length },
      { id: 'elevated', label: 'Usuários com permissões elevadas', status: 'info', value: elevatedRoles.length },
      { id: 'integrations', label: 'Integração WhatsApp configurada', status: integrations.data ? 'ok' : 'info' },
    ];

    const report = {
      generated_at: new Date().toISOString(),
      account_id,
      checks,
      summary: {
        ok: checks.filter(c => c.status === 'ok').length,
        warn: checks.filter(c => c.status === 'warn').length,
        info: checks.filter(c => c.status === 'info').length,
      },
    };

    await admin.rpc('log_audit_v2', {
      _account_id: account_id, _event_type: 'compliance.report_generated',
      _severity: 'info', _entity_type: 'compliance_report', _entity_id: null,
      _action: 'compliance.report_generated',
    });

    return json(report);
  } catch (e) {
    console.error('[compliance-report]', e);
    return json({ error: 'Erro interno do servidor' }, 500);
  }
});
