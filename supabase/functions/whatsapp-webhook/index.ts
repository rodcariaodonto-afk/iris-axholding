import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<any>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GROUPING_DELAY_MS = 10000; // 10 seconds

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // GET request = Webhook verification (Meta Cloud API format - kept for backwards compat)
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      const { data: settings } = await supabase
        .from('nina_settings')
        .select('whatsapp_verify_token')
        .not('whatsapp_verify_token', 'is', null)
        .limit(1)
        .maybeSingle();

      const verifyToken = settings?.whatsapp_verify_token || 'webhook-verify-token';

      if (mode === 'subscribe' && token === verifyToken) {
        console.log('[Webhook] Verification successful');
        return new Response(challenge, { status: 200, headers: corsHeaders });
      } else {
        console.error('[Webhook] Verification failed');
        return new Response('Forbidden', { status: 403, headers: corsHeaders });
      }
    }

    // POST request = Incoming message
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('[Webhook] Received payload:', JSON.stringify(body, null, 2));

      // Detect provider format
      const isEvolutionAPI = body.event || body.instance;
      
      if (isEvolutionAPI) {
        return await handleEvolutionWebhook(supabase, body, supabaseUrl, supabaseServiceKey);
      } else {
        return await handleCloudAPIWebhook(supabase, body, supabaseUrl, supabaseServiceKey);
      }
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  } catch (error) {
    console.error('[Webhook] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});

// =============================================
// Evolution API Handler
// =============================================
async function handleEvolutionWebhook(
  supabase: any, 
  body: any, 
  supabaseUrl: string, 
  supabaseServiceKey: string
) {
  const event = body.event;
  const instanceName = body.instance;

  console.log('[Webhook:Evolution] Event:', event, 'Instance:', instanceName);

  // Handle connection status events
  if (event === 'connection.update') {
    console.log('[Webhook:Evolution] Connection update:', body.data?.state);
    return new Response(JSON.stringify({ status: 'connection_update' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Handle message status updates
  if (event === 'messages.update') {
    const data = body.data;
    if (data?.key?.id && data?.update?.status) {
      const statusMap: Record<number, string> = {
        2: 'sent',
        3: 'delivered', 
        4: 'read',
        5: 'read',
      };
      const newStatus = statusMap[data.update.status];
      if (newStatus) {
        await supabase
          .from('messages')
          .update({
            status: newStatus,
            ...(newStatus === 'delivered' && { delivered_at: new Date().toISOString() }),
            ...(newStatus === 'read' && { read_at: new Date().toISOString() })
          })
          .eq('whatsapp_message_id', data.key.id);
      }
    }
    return new Response(JSON.stringify({ status: 'processed_status' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Only process incoming messages
  if (event !== 'messages.upsert') {
    console.log('[Webhook:Evolution] Ignoring event:', event);
    return new Response(JSON.stringify({ status: 'ignored' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const data = body.data;
  if (!data) {
    console.log('[Webhook:Evolution] No data in payload');
    return new Response(JSON.stringify({ status: 'no_data' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Skip messages sent by us
  if (data.key?.fromMe) {
    console.log('[Webhook:Evolution] Skipping own message');
    return new Response(JSON.stringify({ status: 'own_message' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Extract phone number from remoteJid (format: 5511999999999@s.whatsapp.net)
  const remoteJid = data.key?.remoteJid || '';
  const phoneNumber = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
  
  // Skip group messages
  if (remoteJid.endsWith('@g.us')) {
    console.log('[Webhook:Evolution] Skipping group message');
    return new Response(JSON.stringify({ status: 'group_message' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const messageId = data.key?.id;
  const contactName = data.pushName || null;
  const timestamp = data.messageTimestamp || Math.floor(Date.now() / 1000);

  // Resolve WhatsApp session by instance name (multi-user routing)
  const { data: waSession } = await supabase
    .from('whatsapp_sessions')
    .select('id, account_id, owner_user_id')
    .ilike('evolution_instance_name', instanceName)
    .maybeSingle();

  let sessionId: string | null = waSession?.id ?? null;
  let sessionAccountId: string | null = waSession?.account_id ?? null;
  let ownerId: string | null = waSession?.owner_user_id ?? null;

  // Fallback to nina_settings (legacy)
  if (!ownerId) {
    const { data: ownerSettings } = await supabase
      .from('nina_settings')
      .select('user_id, account_id')
      .eq('evolution_instance_name', instanceName)
      .maybeSingle();
    ownerId = ownerSettings?.user_id || null;
    sessionAccountId = sessionAccountId || ownerSettings?.account_id || null;
  }

  // Get or create contact
  let contactQuery = supabase
    .from('contacts')
    .select('*')
    .eq('phone_number', phoneNumber);
  if (sessionAccountId) contactQuery = contactQuery.eq('account_id', sessionAccountId);
  let { data: contact } = await contactQuery.maybeSingle();

  if (!contact) {
    const { data: newContact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        phone_number: phoneNumber,
        whatsapp_id: phoneNumber,
        name: contactName,
        call_name: contactName?.split(' ')[0] || null,
        user_id: null,
        ...(sessionAccountId ? { account_id: sessionAccountId } : {})
      })
      .select()
      .single();

    if (contactError) {
      console.error('[Webhook:Evolution] Error creating contact:', contactError);
      return new Response(JSON.stringify({ status: 'error', error: contactError.message }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    contact = newContact;
    console.log('[Webhook:Evolution] Created contact:', contact.id);
  } else {
    const updates: any = { last_activity: new Date().toISOString() };
    if (contactName && !contact.name) {
      updates.name = contactName;
      updates.call_name = contactName.split(' ')[0];
    }
    await supabase.from('contacts').update(updates).eq('id', contact.id);
  }

  // Get or create conversation
  let convQuery = supabase
    .from('conversations')
    .select('*')
    .eq('contact_id', contact.id)
    .eq('is_active', true);
  if (sessionAccountId) convQuery = convQuery.eq('account_id', sessionAccountId);
  let { data: conversation } = await convQuery.maybeSingle();

  if (conversation && sessionId && (!conversation.session_id || conversation.session_id !== sessionId || !conversation.assigned_user_id)) {
    const { data: updatedConversation } = await supabase
      .from('conversations')
      .update({ session_id: sessionId, assigned_user_id: ownerId, ...(sessionAccountId ? { account_id: sessionAccountId } : {}) })
      .eq('id', conversation.id)
      .select()
      .single();
    conversation = updatedConversation || conversation;
  }

  if (!conversation) {
    const { data: newConv, error: convError } = await supabase
      .from('conversations')
      .insert({
        contact_id: contact.id,
        status: 'nina',
        is_active: true,
        user_id: null,
        session_id: sessionId,
        assigned_user_id: ownerId,
        ...(sessionAccountId ? { account_id: sessionAccountId } : {}),
      })
      .select()
      .single();

    if (convError) {
      console.error('[Webhook:Evolution] Error creating conversation:', convError);
      return new Response(JSON.stringify({ status: 'error' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    conversation = newConv;
    console.log('[Webhook:Evolution] Created conversation:', conversation.id);
  }

  // Determine message content and type
  let messageContent = '';
  let messageType = 'text';
  let mediaType = null;
  let mediaId = null;
  const msg = data.message;

  if (msg?.conversation) {
    messageContent = msg.conversation;
  } else if (msg?.extendedTextMessage?.text) {
    messageContent = msg.extendedTextMessage.text;
  } else if (msg?.imageMessage) {
    messageContent = msg.imageMessage.caption || '[imagem recebida]';
    messageType = 'image';
    mediaType = 'image';
    mediaId = messageId;
  } else if (msg?.audioMessage) {
    messageContent = '[áudio - processando transcrição...]';
    messageType = 'audio';
    mediaType = 'audio';
    mediaId = messageId;
  } else if (msg?.videoMessage) {
    messageContent = msg.videoMessage.caption || '[vídeo recebido]';
    messageType = 'video';
    mediaType = 'video';
    mediaId = messageId;
  } else if (msg?.documentMessage) {
    messageContent = msg.documentMessage.fileName || '[documento recebido]';
    messageType = 'document';
    mediaType = 'document';
    mediaId = messageId;
  } else {
    messageContent = '[mensagem não suportada]';
  }

  // Create message
  const { data: dbMessage, error: msgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversation.id,
      whatsapp_message_id: messageId,
      content: messageContent,
      type: messageType,
      from_type: 'user',
      status: 'sent',
      media_type: mediaType,
      sent_at: new Date(parseInt(timestamp) * 1000).toISOString(),
      session_id: sessionId,
      ...(sessionAccountId ? { account_id: sessionAccountId } : {}),
      metadata: {
        provider: 'evolution',
        instance: instanceName,
        media_id: mediaId,
        original_message: msg
      }
    })
    .select()
    .single();

  if (msgError) {
    if (msgError.code === '23505') {
      console.log('[Webhook:Evolution] Duplicate message ignored:', messageId);
      return new Response(JSON.stringify({ status: 'duplicate' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    console.error('[Webhook:Evolution] Error creating message:', msgError);
    return new Response(JSON.stringify({ status: 'error' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  console.log('[Webhook:Evolution] Created message:', dbMessage.id);

  // Update conversation
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversation.id);

  // Queue for grouping
  const processAfter = new Date(Date.now() + GROUPING_DELAY_MS).toISOString();
  
  // Reset timer for pending messages from same phone
  await supabase
    .from('message_grouping_queue')
    .update({ process_after: processAfter })
    .eq('processed', false)
    .eq('phone_number_id', instanceName)
    .filter('message_data->>from', 'eq', phoneNumber);

  await supabase
    .from('message_grouping_queue')
    .insert({
      whatsapp_message_id: messageId,
      phone_number_id: instanceName,
      message_id: dbMessage.id,
      account_id: sessionAccountId,
      session_id: sessionId,
      message_data: { from: phoneNumber, type: messageType, key: data.key, ...msg },
      contacts_data: { wa_id: phoneNumber, profile: { name: contactName } },
      process_after: processAfter
    });

  // Trigger message-grouper
  EdgeRuntime.waitUntil(
    fetch(`${supabaseUrl}/functions/v1/message-grouper`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ triggered_by: 'whatsapp-webhook-evolution' })
    }).catch(err => console.error('[Webhook:Evolution] Error triggering message-grouper:', err))
  );

  return new Response(JSON.stringify({ status: 'processed' }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// =============================================
// Cloud API Handler (legacy - kept for backward compat)
// =============================================
async function handleCloudAPIWebhook(
  supabase: any, 
  body: any, 
  supabaseUrl: string, 
  supabaseServiceKey: string
) {
  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;
  
  if (!value) {
    console.log('[Webhook:CloudAPI] No value in payload, ignoring');
    return new Response(JSON.stringify({ status: 'ignored' }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  const messages = value.messages;
  const contacts = value.contacts;
  const phoneNumberId = value.metadata?.phone_number_id;

  const { data: ownerSettings } = await supabase
    .from('nina_settings')
    .select('user_id, whatsapp_access_token')
    .eq('whatsapp_phone_number_id', phoneNumberId)
    .maybeSingle();

  let ownerId = ownerSettings?.user_id || null;
  
  if (!ownerId) {
    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle();
    ownerId = adminRole?.user_id || null;
  }

  // Handle status updates
  if (value.statuses) {
    for (const status of value.statuses) {
      if (status.id) {
        const statusMap: Record<string, string> = {
          'sent': 'sent', 'delivered': 'delivered', 'read': 'read', 'failed': 'failed'
        };
        const newStatus = statusMap[status.status];
        if (newStatus) {
          await supabase
            .from('messages')
            .update({ 
              status: newStatus,
              ...(newStatus === 'delivered' && { delivered_at: new Date().toISOString() }),
              ...(newStatus === 'read' && { read_at: new Date().toISOString() })
            })
            .eq('whatsapp_message_id', status.id);
        }
      }
    }
    return new Response(JSON.stringify({ status: 'processed_statuses' }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  // Resolve session by phone_number_id (multi-user routing)
  const { data: waSession } = await supabase
    .from('whatsapp_sessions')
    .select('id, account_id, owner_user_id')
    .eq('whatsapp_phone_number_id', phoneNumberId)
    .maybeSingle();
  const sessionId: string | null = waSession?.id ?? null;
  const sessionAccountId: string | null = waSession?.account_id ?? null;
  ownerId = waSession?.owner_user_id ?? ownerId;

  if (messages && messages.length > 0) {
    const processAfter = new Date(Date.now() + GROUPING_DELAY_MS).toISOString();

    for (const message of messages) {
      const contactInfo = contacts?.find((c: any) => c.wa_id === message.from);
      const phoneNumber = message.from;
      const whatsappId = contactInfo?.wa_id || phoneNumber;
      const contactName = contactInfo?.profile?.name || null;

      let { data: contact } = await supabase
        .from('contacts').select('*').eq('phone_number', phoneNumber).maybeSingle();

      if (!contact) {
        const { data: newContact, error: contactError } = await supabase
          .from('contacts')
          .insert({ phone_number: phoneNumber, whatsapp_id: whatsappId, name: contactName, call_name: contactName?.split(' ')[0] || null, user_id: null })
          .select().single();
        if (contactError) { console.error('[Webhook:CloudAPI] Error creating contact:', contactError); continue; }
        contact = newContact;
      } else {
        const updates: any = { last_activity: new Date().toISOString() };
        if (contactName && !contact.name) { updates.name = contactName; updates.call_name = contactName.split(' ')[0]; }
        await supabase.from('contacts').update(updates).eq('id', contact.id);
      }

      let { data: conversation } = await supabase
        .from('conversations').select('*').eq('contact_id', contact.id).eq('is_active', true).maybeSingle();

      if (!conversation) {
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({
            contact_id: contact.id, status: 'nina', is_active: true, user_id: null,
            session_id: sessionId, assigned_user_id: ownerId,
            ...(sessionAccountId ? { account_id: sessionAccountId } : {}),
          })
          .select().single();
        if (convError) { console.error('[Webhook:CloudAPI] Error creating conversation:', convError); continue; }
        conversation = newConv;
      }

      let messageContent = '', messageType = 'text', mediaType = null;
      switch (message.type) {
        case 'text': messageContent = message.text?.body || ''; break;
        case 'image': messageContent = message.image?.caption || '[imagem recebida]'; messageType = 'image'; mediaType = 'image'; break;
        case 'audio': messageContent = '[áudio - processando transcrição...]'; messageType = 'audio'; mediaType = 'audio'; break;
        case 'video': messageContent = message.video?.caption || '[vídeo recebido]'; messageType = 'video'; mediaType = 'video'; break;
        case 'document': messageContent = message.document?.filename || '[documento recebido]'; messageType = 'document'; mediaType = 'document'; break;
        default: messageContent = `[${message.type}]`;
      }

      const { data: dbMessage, error: msgError } = await supabase.from('messages').insert({
        conversation_id: conversation.id, whatsapp_message_id: message.id, content: messageContent,
        type: messageType, from_type: 'user', status: 'sent', media_type: mediaType,
        sent_at: new Date(parseInt(message.timestamp) * 1000).toISOString(),
        session_id: sessionId,
        ...(sessionAccountId ? { account_id: sessionAccountId } : {}),
        metadata: { provider: 'cloud_api', original_type: message.type, media_id: message.audio?.id || message.image?.id || message.video?.id || message.document?.id || null }
      }).select().single();

      if (msgError) {
        if (msgError.code === '23505') { console.log('[Webhook:CloudAPI] Duplicate:', message.id); continue; }
        console.error('[Webhook:CloudAPI] Error:', msgError); continue;
      }

      await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversation.id);

      await supabase.from('message_grouping_queue')
        .update({ process_after: processAfter })
        .eq('processed', false).eq('phone_number_id', phoneNumberId)
        .filter('message_data->>from', 'eq', phoneNumber);

      await supabase.from('message_grouping_queue').insert({
        whatsapp_message_id: message.id, phone_number_id: phoneNumberId,
        message_id: dbMessage.id, message_data: message,
        contacts_data: contactInfo || null, process_after: processAfter
      });
    }

    EdgeRuntime.waitUntil(
      fetch(`${supabaseUrl}/functions/v1/message-grouper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify({ triggered_by: 'whatsapp-webhook-cloudapi' })
      }).catch(err => console.error('[Webhook:CloudAPI] Error triggering message-grouper:', err))
    );
  }

  return new Response(JSON.stringify({ status: 'processed' }), { 
    status: 200, 
    headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
  });
}
