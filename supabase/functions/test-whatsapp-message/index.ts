import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone_number, message } = await req.json();

    if (!phone_number || !message) {
      return new Response(
        JSON.stringify({ success: false, error: 'Número de telefone e mensagem são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanPhone = phone_number.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      return new Response(
        JSON.stringify({ success: false, error: 'Formato de número inválido. Use o formato internacional (ex: 5511999999999)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth
    let userId: string | null = null;
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get settings with triple fallback
    const selectFields = 'whatsapp_provider, whatsapp_access_token, whatsapp_phone_number_id, evolution_api_url, evolution_api_key, evolution_instance_name';
    let settings = null;

    const { data: s1 } = await supabase.from('nina_settings').select(selectFields).eq('user_id', userId).maybeSingle();
    settings = s1;
    if (!settings) {
      const { data: s2 } = await supabase.from('nina_settings').select(selectFields).is('user_id', null).maybeSingle();
      settings = s2;
    }
    if (!settings) {
      const { data: s3 } = await supabase.from('nina_settings').select(selectFields).limit(1).maybeSingle();
      settings = s3;
    }

    if (!settings) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sistema não configurado.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const provider = settings.whatsapp_provider || 'evolution';

    // Get or create contact & conversation
    let { data: existingContact } = await supabase.from('contacts').select('*').eq('phone_number', cleanPhone).maybeSingle();
    let contactId: string;

    if (existingContact) {
      contactId = existingContact.id;
    } else {
      const { data: newContact, error: contactError } = await supabase
        .from('contacts').insert({ phone_number: cleanPhone, whatsapp_id: cleanPhone, user_id: null }).select().single();
      if (contactError) throw contactError;
      contactId = newContact.id;
    }

    let { data: existingConv } = await supabase.from('conversations').select('*').eq('contact_id', contactId).eq('is_active', true).maybeSingle();
    let conversationId: string;

    if (existingConv) {
      conversationId = existingConv.id;
    } else {
      const { data: newConv, error: convError } = await supabase
        .from('conversations').insert({ contact_id: contactId, status: 'nina', is_active: true, user_id: null }).select().single();
      if (convError) throw convError;
      conversationId = newConv.id;
    }

    // Create message record
    const { data: newMessage, error: messageError } = await supabase
      .from('messages').insert({ conversation_id: conversationId, from_type: 'nina', type: 'text', content: message, status: 'processing' }).select().single();
    if (messageError) throw messageError;

    // Send via appropriate provider
    let whatsappMessageId: string | null = null;

    if (provider === 'evolution') {
      if (!settings.evolution_api_url || !settings.evolution_api_key || !settings.evolution_instance_name) {
        await supabase.from('messages').update({ status: 'failed' }).eq('id', newMessage.id);
        return new Response(
          JSON.stringify({ success: false, error: 'Evolution API não configurada.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const baseUrl = settings.evolution_api_url.replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/message/sendText/${settings.evolution_instance_name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': settings.evolution_api_key },
        body: JSON.stringify({ number: cleanPhone, text: message })
      });

      const responseData = await response.json();
      if (!response.ok) {
        await supabase.from('messages').update({ status: 'failed' }).eq('id', newMessage.id);
        return new Response(
          JSON.stringify({ success: false, error: responseData.message || 'Erro na Evolution API', details: responseData }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      whatsappMessageId = responseData.key?.id || responseData.id || null;
    } else {
      // Cloud API
      if (!settings.whatsapp_access_token || !settings.whatsapp_phone_number_id) {
        await supabase.from('messages').update({ status: 'failed' }).eq('id', newMessage.id);
        return new Response(
          JSON.stringify({ success: false, error: 'WhatsApp Cloud API não configurada.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const response = await fetch(`https://graph.facebook.com/v17.0/${settings.whatsapp_phone_number_id}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${settings.whatsapp_access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: cleanPhone, type: 'text', text: { body: message } })
      });

      const responseData = await response.json();
      if (!response.ok) {
        await supabase.from('messages').update({ status: 'failed' }).eq('id', newMessage.id);
        return new Response(
          JSON.stringify({ success: false, error: responseData.error?.message || 'Erro na API do WhatsApp', details: responseData }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      whatsappMessageId = responseData.messages?.[0]?.id;
    }

    // Update message
    await supabase.from('messages').update({ whatsapp_message_id: whatsappMessageId, status: 'sent' }).eq('id', newMessage.id);
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId);

    return new Response(
      JSON.stringify({ success: true, message_id: whatsappMessageId, contact_id: contactId, conversation_id: conversationId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro inesperado' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
