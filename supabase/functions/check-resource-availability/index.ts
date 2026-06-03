import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims, error: authErr } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (authErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { resource_id, start_at, end_at, exclude_appointment_id } = body || {};
    if (!resource_id || !start_at || !end_at) {
      return new Response(JSON.stringify({ error: 'resource_id, start_at, end_at obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let query = supabase
      .from('appointments')
      .select('id, title, start_at, end_at, booking_status')
      .eq('resource_id', resource_id)
      .not('booking_status', 'in', '(cancelled,no_show)')
      .lt('start_at', end_at)
      .gt('end_at', start_at);

    if (exclude_appointment_id) query = query.neq('id', exclude_appointment_id);

    const { data: conflicts, error } = await query;
    if (error) throw error;

    return new Response(JSON.stringify({ available: (conflicts || []).length === 0, conflicts: conflicts || [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
