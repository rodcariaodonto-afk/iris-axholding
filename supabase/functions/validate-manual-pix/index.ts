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
    const userId = claims.claims.sub;

    const { payment_id } = await req.json();
    if (!payment_id) {
      return new Response(JSON.stringify({ error: 'payment_id obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: payment, error: payErr } = await supabase
      .from('coworking_payments')
      .update({ status: 'paid', paid_at: new Date().toISOString(), validated_by: userId })
      .eq('id', payment_id)
      .select().single();
    if (payErr) throw payErr;

    const { error: apptErr } = await supabase
      .from('appointments')
      .update({ payment_status: 'paid', booking_status: 'confirmed' })
      .eq('id', payment.appointment_id);
    if (apptErr) throw apptErr;

    return new Response(JSON.stringify({ payment }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
