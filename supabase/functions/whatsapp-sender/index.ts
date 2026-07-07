import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WHATSAPP_API_URL = "https://graph.facebook.com/v18.0";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('[Sender] Starting send process...');

    const MAX_EXECUTION_TIME = 25000;
    const startTime = Date.now();
    let totalSent = 0;
    let iterations = 0;

    const settingsCache: Record<string, any> = {};

    while (Date.now() - startTime < MAX_EXECUTION_TIME) {
      iterations++;

      const { data: queueItems, error: claimError } = await supabase
        .rpc('claim_send_queue_batch', { p_limit: 10 });

      if (claimError) {
        console.error('[Sender] Error claiming batch:', claimError);
        throw claimError;
      }

      if (!queueItems || queueItems.length === 0) {
        const { data: upcoming } = await supabase
          .from('send_queue')
          .select('id, scheduled_at')
          .eq('status', 'pending')
          .gte('scheduled_at', new Date().toISOString())
          .lte('scheduled_at', new Date(Date.now() + 5000).toISOString())
          .order('scheduled_at', { ascending: true })
          .limit(1);

        if (upcoming && upcoming.length > 0) {
          const waitTime = Math.min(
            Math.max(new Date(upcoming[0].scheduled_at).getTime() - Date.now() + 100, 0),
            5000
          );
          if (waitTime > 0 && (Date.now() - startTime + waitTime) < MAX_EXECUTION_TIME) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
        break;
      }

      for (const item of queueItems) {
        try {
          // Get settings; prefer the WhatsApp session attached to the outgoing queue item/conversation
          const { data: conversation } = await supabase
            .from('conversations').select('user_id, account_id, session_id').eq('id', item.conversation_id).single();

          if (!conversation) throw new Error('Conversation not found');

          const sessionId = item.session_id || conversation.session_id || null;
          const queueItem = {
            ...item,
            account_id: item.account_id || conversation.account_id,
            session_id: sessionId,
          };
          const userId = conversation.user_id;
          const cacheKey = sessionId || conversation.account_id || userId || 'global';
          let settings = settingsCache[cacheKey];
          
          if (!settings) {
            settings = await getSettings(supabase, userId, conversation.account_id, sessionId);
            if (!settings) throw new Error('Settings not found');
            settingsCache[cacheKey] = settings;
          }

          const provider = settings.whatsapp_provider || 'evolution';

          if (provider === 'evolution') {
            await sendMessageEvolution(supabase, settings, queueItem);
          } else {
            await sendMessageCloudAPI(supabase, settings, queueItem);
          }
          
          await supabase
            .from('send_queue')
            .update({ status: 'completed', sent_at: new Date().toISOString() })
            .eq('id', item.id);
          
          totalSent++;
          console.log(`[Sender] Sent message ${item.id} (${totalSent} total)`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[Sender] Error sending ${item.id}:`, error);
          
          const newRetryCount = (item.retry_count || 0) + 1;
          const shouldRetry = newRetryCount < 3;
          
          await supabase
            .from('send_queue')
            .update({ 
              status: shouldRetry ? 'pending' : 'failed',
              retry_count: newRetryCount,
              error_message: errorMessage,
              scheduled_at: shouldRetry ? new Date(Date.now() + newRetryCount * 60000).toISOString() : null
            })
            .eq('id', item.id);
        }
      }
    }

    return new Response(JSON.stringify({ sent: totalSent, iterations, executionTime: Date.now() - startTime }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Sender] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function getSettings(supabase: any, userId: string | null, accountId: string | null, sessionId: string | null) {
  const selectFields = 'whatsapp_provider, whatsapp_access_token, whatsapp_phone_number_id, evolution_api_url, evolution_api_key, evolution_instance_name';
  
  if (sessionId) {
    const { data: waSession } = await supabase
      .from('whatsapp_sessions')
      .select('account_id, provider, evolution_instance_name, whatsapp_access_token, whatsapp_phone_number_id')
      .eq('id', sessionId)
      .maybeSingle();
    if (waSession) {
      const { data: accountSettings } = await supabase
        .from('whatsapp_account_settings')
        .select('evolution_api_url, evolution_api_key')
        .eq('account_id', waSession.account_id)
        .maybeSingle();
      return {
        whatsapp_provider: waSession.provider,
        whatsapp_access_token: waSession.whatsapp_access_token,
        whatsapp_phone_number_id: waSession.whatsapp_phone_number_id,
        evolution_api_url: accountSettings?.evolution_api_url,
        evolution_api_key: accountSettings?.evolution_api_key,
        evolution_instance_name: waSession.evolution_instance_name,
      };
    }
  }
  
  if (accountId) {
    const { data } = await supabase.from('nina_settings').select(selectFields).eq('account_id', accountId).maybeSingle();
    if (data) return data;
  }
  
  if (userId) {
    const { data } = await supabase.from('nina_settings').select(selectFields).eq('user_id', userId).maybeSingle();
    if (data) return data;
  }

  const { data: global } = await supabase.from('nina_settings').select(selectFields).is('user_id', null).maybeSingle();
  if (global) return global;

  const { data: any } = await supabase.from('nina_settings').select(selectFields).limit(1).maybeSingle();
  return any;
}

// =============================================
// Evolution API Sender
// =============================================
async function sendMessageEvolution(supabase: any, settings: any, queueItem: any) {
  if (!settings.evolution_api_url || !settings.evolution_api_key || !settings.evolution_instance_name) {
    throw new Error('Evolution API not configured');
  }

  const { data: contact } = await supabase
    .from('contacts').select('phone_number, whatsapp_id').eq('id', queueItem.contact_id).maybeSingle();
  if (!contact) throw new Error('Contact not found');

  const recipient = contact.whatsapp_id || contact.phone_number;
  const baseUrl = settings.evolution_api_url.replace(/\/+$/, '');
  const instance = settings.evolution_instance_name;
  const headers = { 'Content-Type': 'application/json', 'apikey': settings.evolution_api_key };

  let endpoint = '';
  let body: any = {};

  switch (queueItem.message_type) {
    case 'text':
      endpoint = `/message/sendText/${instance}`;
      body = { number: recipient, text: queueItem.content };
      break;
    case 'image':
      endpoint = `/message/sendMedia/${instance}`;
      body = { number: recipient, mediatype: 'image', media: queueItem.media_url, caption: queueItem.content || '' };
      break;
    case 'audio':
      endpoint = `/message/sendWhatsAppAudio/${instance}`;
      body = { number: recipient, audio: queueItem.media_url };
      break;
    case 'document': {
      endpoint = `/message/sendMedia/${instance}`;
      // Derive a proper fileName (with extension) and mimetype so WhatsApp
      // renders the file as a document instead of raw "data".
      const urlExt = (queueItem.media_url?.split('?')[0].split('.').pop() || '').toLowerCase();
      const metaFileName = queueItem.metadata?.file_name as string | undefined;
      const mimeMap: Record<string, string> = {
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ppt: 'application/vnd.ms-powerpoint',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        txt: 'text/plain',
        csv: 'text/csv',
      };
      // Build a filename that ends with the correct extension.
      let fileName = metaFileName || queueItem.content || 'documento';
      if (urlExt && !fileName.toLowerCase().endsWith(`.${urlExt}`)) {
        fileName = `${fileName}.${urlExt}`;
      }
      const mimetype = mimeMap[urlExt] || 'application/octet-stream';
      body = {
        number: recipient,
        mediatype: 'document',
        media: queueItem.media_url,
        fileName,
        mimetype,
        caption: queueItem.content || '',
      };
      break;
    }
    default:
      endpoint = `/message/sendText/${instance}`;
      body = { number: recipient, text: queueItem.content };
  }

  console.log('[Sender:Evolution] Sending to:', `${baseUrl}${endpoint}`);

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  const responseData = await response.json();

  if (!response.ok) {
    console.error('[Sender:Evolution] API error:', responseData);
    throw new Error(responseData.message || responseData.error || 'Evolution API error');
  }

  const whatsappMessageId = responseData.key?.id || responseData.id || null;
  console.log('[Sender:Evolution] Sent, ID:', whatsappMessageId);

  await updateMessageRecord(supabase, queueItem, whatsappMessageId);
}

// =============================================
// Cloud API Sender (legacy)
// =============================================
async function sendMessageCloudAPI(supabase: any, settings: any, queueItem: any) {
  if (!settings.whatsapp_access_token || !settings.whatsapp_phone_number_id) {
    throw new Error('WhatsApp Cloud API not configured');
  }

  const { data: contact } = await supabase
    .from('contacts').select('phone_number, whatsapp_id').eq('id', queueItem.contact_id).maybeSingle();
  if (!contact) throw new Error('Contact not found');

  const recipient = contact.whatsapp_id || contact.phone_number;
  let payload: any = { messaging_product: 'whatsapp', recipient_type: 'individual', to: recipient };

  switch (queueItem.message_type) {
    case 'text': payload.type = 'text'; payload.text = { body: queueItem.content }; break;
    case 'image': payload.type = 'image'; payload.image = { link: queueItem.media_url, caption: queueItem.content || undefined }; break;
    case 'audio': payload.type = 'audio'; payload.audio = { link: queueItem.media_url }; break;
    case 'document': payload.type = 'document'; payload.document = { link: queueItem.media_url, filename: queueItem.content || 'document' }; break;
    case 'template': {
      // Meta approved template — required for business-initiated messages to
      // cold leads outside the 24h customer-service window. Free text is
      // rejected (delivered as "failed"), templates are not.
      const templateName = queueItem.metadata?.template_name;
      const templateLanguage = queueItem.metadata?.template_language || 'pt_BR';
      if (!templateName) throw new Error('template_name missing in queue metadata');
      payload.type = 'template';
      payload.template = {
        name: templateName,
        language: { code: templateLanguage },
      };
      // Only include components if variables/params were provided.
      const components = queueItem.metadata?.template_components;
      if (Array.isArray(components) && components.length > 0) {
        payload.template.components = components;
      }
      break;
    }
    default: payload.type = 'text'; payload.text = { body: queueItem.content };
  }


  const response = await fetch(`${WHATSAPP_API_URL}/${settings.whatsapp_phone_number_id}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${settings.whatsapp_access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const responseData = await response.json();
  if (!response.ok) throw new Error(responseData.error?.message || 'WhatsApp API error');

  const whatsappMessageId = responseData.messages?.[0]?.id;
  await updateMessageRecord(supabase, queueItem, whatsappMessageId);
}

async function updateMessageRecord(supabase: any, queueItem: any, whatsappMessageId: string | null) {
  if (queueItem.message_id) {
    const { error } = await supabase.from('messages').update({
      whatsapp_message_id: whatsappMessageId,
      status: 'sent',
      sent_at: new Date().toISOString(),
      session_id: queueItem.session_id || null,
    }).eq('id', queueItem.message_id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('messages').insert({
      account_id: queueItem.account_id,
      conversation_id: queueItem.conversation_id, whatsapp_message_id: whatsappMessageId,
      content: queueItem.content, type: queueItem.message_type, from_type: queueItem.from_type,
      status: 'sent', media_url: queueItem.media_url || null,
      session_id: queueItem.session_id || null,
      sent_at: new Date().toISOString(), metadata: queueItem.metadata || {}
    });
    if (error) throw error;
  }

  await supabase.from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', queueItem.conversation_id);
}
