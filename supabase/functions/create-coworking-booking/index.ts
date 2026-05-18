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

    const body = await req.json();
    const {
      account_id, resource_id, contact_id, title,
      date, time, duration = 60, type = 'meeting',
      modality, internal_notes, requires_payment = false, amount,
    } = body || {};

    if (!account_id || !title || !date || !time) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios faltando' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const insert: Record<string, unknown> = {
      account_id, title, date, time, duration, type,
      contact_id: contact_id || null,
      resource_id: resource_id || null,
      service_modality: modality || null,
      internal_notes: internal_notes || null,
      booking_source: 'manual',
      booking_status: requires_payment ? 'reserved' : 'confirmed',
      payment_status: requires_payment ? 'pending' : 'not_required',
      status: 'scheduled',
      user_id: userId,
    };

    const { data: appt, error: apptErr } = await supabase.from('appointments').insert(insert).select().single();
    if (apptErr) {
      if ((apptErr as any).code === '23P01') {
        return new Response(JSON.stringify({ error: 'Sala já reservada nesse horário', code: 'CONFLICT' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw apptErr;
    }

    let payment = null;
    if (requires_payment) {
      const { data: pay, error: payErr } = await supabase
        .from('coworking_payments')
        .insert({ account_id, appointment_id: appt.id, amount: amount || null, status: 'pending', provider: 'manual_pix' })
        .select().single();
      if (payErr) throw payErr;
      payment = pay;
    }

    return new Response(JSON.stringify({ appointment: appt, payment }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
