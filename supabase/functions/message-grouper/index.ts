import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('[MessageGrouper] Starting message grouping...');

    const { data: readyMessages, error: fetchError } = await supabase
      .from('message_grouping_queue')
      .select('*')
      .eq('processed', false)
      .lte('process_after', new Date().toISOString())
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('[MessageGrouper] Error fetching messages:', fetchError);
      throw fetchError;
    }

    if (!readyMessages || readyMessages.length === 0) {
      console.log('[MessageGrouper] No messages ready to process');
      await scheduleNextProcessing(supabase, supabaseUrl, supabaseServiceKey);
      return new Response(JSON.stringify({ processed: 0, groups: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[MessageGrouper] Found ${readyMessages.length} messages ready to process`);

    // IMMEDIATELY mark all ready messages as processed to prevent duplicates
    const readyIds = readyMessages.map(m => m.id);
    await supabase
      .from('message_grouping_queue')
      .update({ processed: true })
      .in('id', readyIds);

    console.log(`[MessageGrouper] Marked ${readyIds.length} messages as processed`);

    // Group messages by phone number
    const grouped: Record<string, typeof readyMessages> = {};
    for (const msg of readyMessages) {
      const phone = msg.message_data?.from;
      if (!phone) continue;
      if (!grouped[phone]) grouped[phone] = [];
      grouped[phone].push(msg);
    }

    const groupCount = Object.keys(grouped).length;
    console.log(`[MessageGrouper] Grouped into ${groupCount} phone numbers`);

    let processedCount = 0;

    for (const [phoneNumber, messages] of Object.entries(grouped)) {
      try {
        console.log(`[MessageGrouper] Processing group for ${phoneNumber} with ${messages.length} messages`);

        const phoneNumberId = messages[0].phone_number_id;

        // Get owner settings including Evolution API fields
        const { data: ownerSettings } = await supabase
          .from('nina_settings')
          .select('user_id, whatsapp_access_token, whatsapp_provider, evolution_api_url, evolution_api_key, evolution_instance_name')
          .eq('whatsapp_phone_number_id', phoneNumberId)
          .maybeSingle();

        // If no settings found by phone_number_id, try global settings
        let settings = ownerSettings;
        if (!settings) {
          const { data: globalSettings } = await supabase
            .from('nina_settings')
            .select('user_id, whatsapp_access_token, whatsapp_provider, evolution_api_url, evolution_api_key, evolution_instance_name')
            .limit(1)
            .maybeSingle();
          settings = globalSettings;
        }

        const messageIds = messages.map(m => m.message_id).filter(Boolean);
        
        if (messageIds.length === 0) {
          console.log(`[MessageGrouper] No message_ids found for group ${phoneNumber}, skipping`);
          continue;
        }

        const { data: dbMessages, error: dbMsgError } = await supabase
          .from('messages')
          .select('*')
          .in('id', messageIds)
          .order('sent_at', { ascending: true });

        if (dbMsgError || !dbMessages || dbMessages.length === 0) {
          console.error('[MessageGrouper] Error fetching messages from DB:', dbMsgError);
          continue;
        }

        const lastDbMessage = dbMessages[dbMessages.length - 1];
        const conversationId = lastDbMessage.conversation_id;

        const { data: conversation } = await supabase
          .from('conversations')
          .select('*, contacts(*)')
          .eq('id', conversationId)
          .single();

        if (!conversation) {
          console.error('[MessageGrouper] Conversation not found:', conversationId);
          continue;
        }

        // Combine content and handle audio transcription + media processing
        const combinedContent = await combineAndTranscribeMessages(
          supabase,
          messages,
          dbMessages,
          settings,
          lovableApiKey
        );

        console.log(`[MessageGrouper] Combined content for ${phoneNumber}:`, combinedContent.substring(0, 200));

        if (dbMessages.length > 1) {
          await supabase
            .from('messages')
            .update({
              content: combinedContent,
              metadata: {
                ...lastDbMessage.metadata,
                grouped_messages: messageIds,
                message_count: messageIds.length
              }
            })
            .eq('id', lastDbMessage.id);
          
          console.log(`[MessageGrouper] Updated last message with combined content`);
        } else if (dbMessages[0].type === 'audio' && combinedContent !== dbMessages[0].content) {
          await supabase
            .from('messages')
            .update({ content: combinedContent })
            .eq('id', dbMessages[0].id);
          
          console.log(`[MessageGrouper] Updated audio message with transcription`);
        }

        // If conversation is handled by Nina, queue for AI processing
        if (conversation.status === 'nina') {
          const { data: existingQueue } = await supabase
            .from('nina_processing_queue')
            .select('id')
            .eq('message_id', lastDbMessage.id)
            .maybeSingle();

          if (!existingQueue) {
            const { error: ninaQueueError } = await supabase
              .from('nina_processing_queue')
              .insert({
                message_id: lastDbMessage.id,
                conversation_id: conversationId,
                contact_id: conversation.contact_id,
                priority: 1,
                context_data: {
                  phone_number_id: phoneNumberId,
                  contact_name: conversation.contacts?.name || conversation.contacts?.call_name,
                  message_type: lastDbMessage.type,
                  grouped_count: messageIds.length,
                  combined_content: combinedContent
                }
              });

            if (ninaQueueError) {
              console.error('[MessageGrouper] Error queuing for Nina:', ninaQueueError);
            } else {
              console.log('[MessageGrouper] Message queued for Nina processing');
              
              fetch(`${supabaseUrl}/functions/v1/nina-orchestrator`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseServiceKey}`
                },
                body: JSON.stringify({ triggered_by: 'message-grouper' })
              }).catch(err => console.error('[MessageGrouper] Error triggering nina-orchestrator:', err));
            }
          } else {
            console.log('[MessageGrouper] Message already in Nina queue, skipping');
          }
        }

        processedCount += messages.length;
        console.log(`[MessageGrouper] Group ${phoneNumber} processed successfully`);

      } catch (groupError) {
        console.error(`[MessageGrouper] Error processing group ${phoneNumber}:`, groupError);
      }
    }

    console.log(`[MessageGrouper] Completed. Processed ${processedCount} messages in ${groupCount} groups`);
    await scheduleNextProcessing(supabase, supabaseUrl, supabaseServiceKey);

    return new Response(JSON.stringify({ 
      processed: processedCount, 
      groups: groupCount 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[MessageGrouper] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Upload media (image/document/audio) to Supabase Storage
async function uploadMediaToStorage(
  supabase: any,
  buffer: ArrayBuffer,
  conversationId: string,
  mediaType: string,
  mimeType: string
): Promise<string | null> {
  try {
    const ext = getExtensionFromMime(mimeType);
    const fileName = `${conversationId}/${Date.now()}.${ext}`;
    
    const { data, error } = await supabase.storage
      .from('media-files')
      .upload(fileName, buffer, {
        contentType: mimeType,
        cacheControl: '3600'
      });

    if (error) {
      console.error('[MessageGrouper] Error uploading media:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('media-files')
      .getPublicUrl(fileName);

    console.log('[MessageGrouper] Media uploaded:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('[MessageGrouper] Error uploading media to storage:', error);
    return null;
  }
}

function getExtensionFromMime(mimeType: string): string {
  const base = (mimeType || '').split(';')[0].trim().toLowerCase();
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'application/pdf': 'pdf',
    'audio/ogg': 'ogg',
    'audio/opus': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/webm': 'webm',
    'video/mp4': 'mp4',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  };
  return map[base] || 'bin';
}

// Detect MIME type from message data
function detectMimeType(messageData: any, messageType: string): string {
  if (messageType === 'image') {
    return messageData.imageMessage?.mimetype || messageData.image?.mime_type || 'image/jpeg';
  }
  if (messageType === 'document') {
    return messageData.documentMessage?.mimetype || messageData.document?.mime_type || 'application/pdf';
  }
  if (messageType === 'audio') {
    return messageData.audioMessage?.mimetype || messageData.audio?.mime_type || 'audio/ogg';
  }
  return 'application/octet-stream';
}

// Combine content from multiple messages and transcribe audio / download media
async function combineAndTranscribeMessages(
  supabase: any,
  queueMessages: any[],
  dbMessages: any[],
  settings: any,
  lovableApiKey: string
): Promise<string> {
  const contentParts: string[] = [];

  for (let i = 0; i < queueMessages.length; i++) {
    const queueMsg = queueMessages[i];
    const dbMsg = dbMessages.find(m => m.id === queueMsg.message_id);
    const messageData = queueMsg.message_data;
    
    if (!dbMsg) continue;

    let content = dbMsg.content || '';
    const conversationId = dbMsg.conversation_id;

    // Detect message type from both Evolution API and Meta Cloud API formats
    const isAudio = messageData.type === 'audio' || messageData.messageType === 'audioMessage' || messageData.audioMessage;
    const isImage = messageData.type === 'image' || messageData.messageType === 'imageMessage' || messageData.imageMessage;
    const isDocument = messageData.type === 'document' || messageData.messageType === 'documentMessage' || messageData.documentMessage;

    // Handle media download (audio, image, document)
    if ((isAudio || isImage || isDocument) && lovableApiKey) {
      const mediaTypeLabel = isAudio ? 'audio' : isImage ? 'image' : 'document';
      console.log(`[MessageGrouper] Detected ${mediaTypeLabel} message, processing...`);
      
      let mediaBuffer: ArrayBuffer | null = null;
      const mimeType = detectMimeType(messageData, mediaTypeLabel);

      // Try Evolution API first
      const evolutionMediaObj = messageData.audioMessage || messageData.imageMessage || messageData.documentMessage;
      const evolutionMediaUrl = evolutionMediaObj?.url;
      const evolutionBase64 = evolutionMediaObj?.base64;
      
      if (evolutionBase64) {
        console.log(`[MessageGrouper] Using base64 ${mediaTypeLabel} from Evolution message data`);
        mediaBuffer = base64ToArrayBuffer(evolutionBase64);
      } else if (evolutionMediaUrl && settings?.evolution_api_url && settings?.evolution_api_key) {
        console.log(`[MessageGrouper] Downloading ${mediaTypeLabel} via Evolution API`);
        mediaBuffer = await downloadEvolutionMedia(
          settings.evolution_api_url,
          settings.evolution_api_key,
          settings.evolution_instance_name,
          messageData
        );
      }
      
      // Fallback: try direct URL
      if (!mediaBuffer && evolutionMediaUrl) {
        console.log(`[MessageGrouper] Fallback: direct download from URL`);
        mediaBuffer = await downloadDirectUrl(evolutionMediaUrl);
      }
      
      // Fallback to Meta Cloud API
      const metaMediaId = messageData.audio?.id || messageData.image?.id || messageData.document?.id;
      if (!mediaBuffer && metaMediaId && settings?.whatsapp_access_token) {
        console.log(`[MessageGrouper] Downloading ${mediaTypeLabel} via Meta Cloud API`);
        mediaBuffer = await downloadWhatsAppMedia(settings, metaMediaId);
      }

      if (mediaBuffer) {
        console.log(`[MessageGrouper] ${mediaTypeLabel} downloaded, size:`, mediaBuffer.byteLength, 'bytes');

        // Upload to storage
        const publicUrl = await uploadMediaToStorage(supabase, mediaBuffer, conversationId, mediaTypeLabel, mimeType);
        
        if (publicUrl) {
          // Update message with media_url
          await supabase
            .from('messages')
            .update({ media_url: publicUrl })
            .eq('id', dbMsg.id);
          console.log(`[MessageGrouper] ${mediaTypeLabel} URL saved to message:`, publicUrl);
        }

        // Transcribe audio
        if (isAudio) {
          const transcription = await transcribeAudio(mediaBuffer, lovableApiKey);
          if (transcription) {
            content = transcription;
            await supabase
              .from('messages')
              .update({ content: transcription })
              .eq('id', dbMsg.id);
            console.log('[MessageGrouper] Audio transcribed:', transcription.substring(0, 100));
          }
        }
        
        // For images, set descriptive content with caption if available
        if (isImage) {
          const caption = messageData.imageMessage?.caption || messageData.image?.caption || '';
          content = caption ? `[imagem: ${caption}]` : '[imagem recebida]';
          // Update content with caption info
          await supabase
            .from('messages')
            .update({ content })
            .eq('id', dbMsg.id);
        }
        
        // For documents, set content with filename
        if (isDocument) {
          const fileName = messageData.documentMessage?.fileName || messageData.document?.filename || 'documento';
          const caption = messageData.documentMessage?.caption || messageData.document?.caption || '';
          content = caption ? `[documento: ${fileName} - ${caption}]` : `[documento: ${fileName}]`;
          await supabase
            .from('messages')
            .update({ content })
            .eq('id', dbMsg.id);
        }
      } else {
        console.error(`[MessageGrouper] Failed to download ${mediaTypeLabel}`);
      }
    }

    if (content && content !== '[áudio - processando transcrição...]') {
      contentParts.push(content);
    }
  }

  return contentParts.join('\n');
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let j = 0; j < binaryString.length; j++) {
    bytes[j] = binaryString.charCodeAt(j);
  }
  return bytes.buffer;
}

// Download media via Evolution API's getBase64FromMediaMessage endpoint
async function downloadEvolutionMedia(
  evolutionApiUrl: string,
  evolutionApiKey: string,
  instanceName: string,
  messageData: any
): Promise<ArrayBuffer | null> {
  try {
    const baseUrl = evolutionApiUrl.replace(/\/+$/, '');
    const endpoint = `${baseUrl}/chat/getBase64FromMediaMessage/${instanceName}`;
    console.log('[MessageGrouper] Evolution media endpoint:', endpoint);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
      body: JSON.stringify({
        message: {
          key: messageData.key || messageData.message?.key,
        },
        convertToMp4: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[MessageGrouper] Evolution media download failed:', response.status, errorText);
      return null;
    }

    const result = await response.json();
    const base64Data = result.base64;

    if (!base64Data) {
      console.error('[MessageGrouper] No base64 data in Evolution response');
      return null;
    }

    return base64ToArrayBuffer(base64Data);
  } catch (error) {
    console.error('[MessageGrouper] Error downloading Evolution media:', error);
    return null;
  }
}

// Download media directly from a URL
async function downloadDirectUrl(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error('[MessageGrouper] Direct URL download failed:', response.status);
      return null;
    }
    return await response.arrayBuffer();
  } catch (error) {
    console.error('[MessageGrouper] Error downloading from direct URL:', error);
    return null;
  }
}

// Download media from WhatsApp Meta Cloud API
async function downloadWhatsAppMedia(settings: any, mediaId: string): Promise<ArrayBuffer | null> {
  if (!settings?.whatsapp_access_token) {
    console.error('[MessageGrouper] No WhatsApp access token configured');
    return null;
  }

  try {
    const mediaInfoResponse = await fetch(
      `https://graph.facebook.com/v18.0/${mediaId}`,
      {
        headers: {
          'Authorization': `Bearer ${settings.whatsapp_access_token}`
        }
      }
    );

    if (!mediaInfoResponse.ok) {
      console.error('[MessageGrouper] Failed to get media info:', await mediaInfoResponse.text());
      return null;
    }

    const mediaInfo = await mediaInfoResponse.json();
    const mediaUrl = mediaInfo.url;

    if (!mediaUrl) {
      console.error('[MessageGrouper] No media URL in response');
      return null;
    }

    const mediaResponse = await fetch(mediaUrl, {
      headers: {
        'Authorization': `Bearer ${settings.whatsapp_access_token}`
      }
    });

    if (!mediaResponse.ok) {
      console.error('[MessageGrouper] Failed to download media:', await mediaResponse.text());
      return null;
    }

    return await mediaResponse.arrayBuffer();
  } catch (error) {
    console.error('[MessageGrouper] Error downloading media:', error);
    return null;
  }
}

// Transcribe audio using Lovable AI Gateway (Gemini Flash)
async function transcribeAudio(audioBuffer: ArrayBuffer, lovableApiKey: string): Promise<string | null> {
  try {
    console.log('[MessageGrouper] Transcribing audio via Gemini, size:', audioBuffer.byteLength, 'bytes');

    const uint8Array = new Uint8Array(audioBuffer);
    let binaryStr = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binaryStr += String.fromCharCode(uint8Array[i]);
    }
    const base64Audio = btoa(binaryStr);

    const response = await fetch(LOVABLE_AI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:audio/ogg;base64,${base64Audio}`
              }
            },
            {
              type: "text",
              text: "Transcreva esta mensagem de áudio exatamente como falada pela pessoa. Retorne APENAS o texto da transcrição, nada mais. NÃO invente ou adivinhe conteúdo. O áudio provavelmente está em Português Brasileiro. Transcreva no idioma em que foi falado."
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[MessageGrouper] Transcription error:', response.status, errorText);
      return null;
    }

    const result = await response.json();
    const transcription = result.choices?.[0]?.message?.content || null;
    
    console.log('[MessageGrouper] Transcription result:', transcription);
    return transcription;
  } catch (error) {
    console.error('[MessageGrouper] Error transcribing audio:', error);
    return null;
  }
}

// Schedule next processing if there are pending messages with future process_after
async function scheduleNextProcessing(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<void> {
  try {
    const { data: pendingMessages, error } = await supabase
      .from('message_grouping_queue')
      .select('id, process_after')
      .eq('processed', false)
      .gt('process_after', new Date().toISOString())
      .order('process_after', { ascending: true })
      .limit(1);

    if (error) {
      console.error('[MessageGrouper] Error checking pending messages:', error);
      return;
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log('[MessageGrouper] No pending messages to schedule');
      return;
    }

    const nextProcessAt = new Date(pendingMessages[0].process_after);
    const now = Date.now();
    const delayMs = Math.max(nextProcessAt.getTime() - now + 500, 1000);
    const cappedDelayMs = Math.min(delayMs, 30000);

    console.log(`[MessageGrouper] Scheduling self-invocation in ${cappedDelayMs}ms for pending message ${pendingMessages[0].id}`);

    (globalThis as any).EdgeRuntime?.waitUntil?.(
      new Promise<void>((resolve) => {
        setTimeout(async () => {
          try {
            console.log('[MessageGrouper] Self-invoking after scheduled delay');
            await fetch(`${supabaseUrl}/functions/v1/message-grouper`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`
              },
              body: JSON.stringify({ triggered_by: 'self-reschedule' })
            });
            console.log('[MessageGrouper] Self-invocation completed');
          } catch (err) {
            console.error('[MessageGrouper] Self-reschedule error:', err);
          }
          resolve();
        }, cappedDelayMs);
      })
    );
  } catch (error) {
    console.error('[MessageGrouper] Error scheduling next processing:', error);
  }
}
