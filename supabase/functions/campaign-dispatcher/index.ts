import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[Dispatcher] Starting campaign dispatcher...');

    // Business hours check: 08:00–19:00 BRT (UTC-3) = 11:00–22:00 UTC
    const nowUTC = new Date();
    const hourUTC = nowUTC.getUTCHours();
    if (hourUTC < 11 || hourUTC >= 22) {
      console.log('[Dispatcher] Outside business hours (BRT 08:00–19:00), skipping.');
      return new Response(JSON.stringify({ skipped: true, reason: 'outside_business_hours' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch active campaigns, joining accounts to check module flag
    const { data: campaigns, error: campaignsError } = await supabase
      .from('outbound_campaigns')
      .select('*, account:accounts(id, settings)')
      .eq('status', 'active');

    if (campaignsError) throw campaignsError;

    if (!campaigns || campaigns.length === 0) {
      console.log('[Dispatcher] No active campaigns found.');
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let totalProcessed = 0;

    for (const campaign of campaigns) {
      // Skip if account has module disabled
      if (!campaign.account?.settings?.outbound_campaigns_enabled) {
        console.log(`[Dispatcher] Campaign ${campaign.id}: account module disabled, skipping.`);
        continue;
      }

      // Resolve the WhatsApp session to send from. Prefer a connected session,
      // falling back to the default one. Without this the sender uses stale
      // account-level settings (e.g. a non-existent Evolution instance).
      let campaignSessionId: string | null = null;
      let campaignProvider: string | null = null;
      const { data: sessions } = await supabase
        .from('whatsapp_sessions')
        .select('id, status, is_default, provider')
        .eq('account_id', campaign.account_id);

      if (sessions && sessions.length > 0) {
        const connected = sessions.find((s: any) => s.status === 'connected');
        const fallback = sessions.find((s: any) => s.is_default) || sessions[0];
        const chosen = connected || fallback;
        campaignSessionId = chosen?.id || null;
        campaignProvider = chosen?.provider || null;
      }

      // Meta Cloud API requires an approved template for business-initiated
      // messages to cold leads (outside the 24h window). Free text is rejected.
      const useTemplate = campaignProvider === 'meta_cloud' && !!campaign.template_name;
      console.log(`[Dispatcher] Campaign ${campaign.id}: using session ${campaignSessionId} (provider=${campaignProvider}, template=${useTemplate ? campaign.template_name : 'none'})`);


      // Count contacts already sent today
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      const { count: sentToday } = await supabase
        .from('campaign_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .eq('status', 'sent')
        .gte('sent_at', todayStart.toISOString());

      if ((sentToday ?? 0) >= campaign.daily_limit) {
        console.log(`[Dispatcher] Campaign ${campaign.id}: daily limit reached (${sentToday}/${campaign.daily_limit}).`);
        continue;
      }

      const slotsLeft = campaign.daily_limit - (sentToday ?? 0);
      console.log(`[Dispatcher] Campaign ${campaign.id}: ${slotsLeft} slots remaining today.`);

      // Fetch pending contacts up to remaining slots
      const { data: pendingContacts } = await supabase
        .from('campaign_contacts')
        .select('*')
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(slotsLeft);

      if (!pendingContacts || pendingContacts.length === 0) {
        // Check if the campaign is fully done
        const { count: stillPending } = await supabase
          .from('campaign_contacts')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id)
          .eq('status', 'pending');

        if ((stillPending ?? 0) === 0) {
          console.log(`[Dispatcher] Campaign ${campaign.id}: all contacts processed, marking completed.`);
          await supabase
            .from('outbound_campaigns')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', campaign.id);
        }
        continue;
      }

      // Each contact is staggered by delay_seconds to comply with WhatsApp limits
      let delayOffsetMs = 0;

      for (const campaignContact of pendingContacts) {
        try {
          // Get or create contact record
          let { data: contact } = await supabase
            .from('contacts')
            .select('*')
            .eq('phone_number', campaignContact.phone_number)
            .maybeSingle();

          if (!contact) {
            const { data: newContact, error: contactError } = await supabase
              .from('contacts')
              .insert({
                account_id: campaign.account_id,
                phone_number: campaignContact.phone_number,
                whatsapp_id: campaignContact.phone_number,
                name: campaignContact.name || null,
                call_name: campaignContact.name?.split(' ')[0] || null,
              })
              .select()
              .single();

            if (contactError) {
              console.error(`[Dispatcher] Error creating contact ${campaignContact.phone_number}:`, contactError);
              await supabase
                .from('campaign_contacts')
                .update({ status: 'failed', error_message: contactError.message })
                .eq('id', campaignContact.id);
              continue;
            }
            contact = newContact;
            console.log(`[Dispatcher] Created contact: ${contact.id}`);
          }

          // Create a new conversation for this outbound contact
          const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .insert({
              account_id: campaign.account_id,
              contact_id: contact.id,
              status: 'nina',
              is_active: true,
              user_id: null,
              session_id: campaignSessionId,
              metadata: {
                outbound: true,
                campaign_id: campaign.id,
                campaign_name: campaign.name,
                pdf_filename: campaign.pdf_filename || null,
              },
            })
            .select()
            .single();

          if (convError) {
            console.error(`[Dispatcher] Error creating conversation for contact ${contact.id}:`, convError);
            await supabase
              .from('campaign_contacts')
              .update({ status: 'failed', error_message: convError.message })
              .eq('id', campaignContact.id);
            continue;
          }

          const textScheduledAt = new Date(Date.now() + delayOffsetMs).toISOString();

          // Queue the opening text message
          const { error: textQueueError } = await supabase
            .from('send_queue')
            .insert({
              account_id: campaign.account_id,
              conversation_id: conversation.id,
              contact_id: contact.id,
              session_id: campaignSessionId,
              content: campaign.opening_message,
              from_type: 'nina',
              message_type: 'text',
              priority: 1,
              scheduled_at: textScheduledAt,
              metadata: {
                campaign_id: campaign.id,
                campaign_contact_id: campaignContact.id,
              },
            });

          if (textQueueError) {
            console.error(`[Dispatcher] Error queuing text for contact ${contact.id}:`, textQueueError);
            await supabase
              .from('campaign_contacts')
              .update({ status: 'failed', error_message: textQueueError.message })
              .eq('id', campaignContact.id);
            continue;
          }

          // Queue the PDF document 3 seconds after the text (if present)
          if (campaign.pdf_url) {
            const pdfScheduledAt = new Date(Date.now() + delayOffsetMs + 3000).toISOString();
            await supabase
              .from('send_queue')
              .insert({
                account_id: campaign.account_id,
                conversation_id: conversation.id,
                contact_id: contact.id,
                session_id: campaignSessionId,
                content: campaign.pdf_filename || 'document',
                from_type: 'nina',
                message_type: 'document',
                media_url: campaign.pdf_url,
                priority: 1,
                scheduled_at: pdfScheduledAt,
                metadata: {
                  campaign_id: campaign.id,
                  campaign_contact_id: campaignContact.id,
                },
              });
          }

          // Mark contact as sent and link conversation
          await supabase
            .from('campaign_contacts')
            .update({
              status: 'sent',
              sent_at: textScheduledAt,
              contact_id: contact.id,
              conversation_id: conversation.id,
            })
            .eq('id', campaignContact.id);

          delayOffsetMs += campaign.delay_seconds * 1000;
          totalProcessed++;
          console.log(`[Dispatcher] Queued outbound for ${campaignContact.phone_number} (scheduled +${delayOffsetMs / 1000}s)`);

        } catch (err) {
          console.error(`[Dispatcher] Unexpected error for contact ${campaignContact.id}:`, err);
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          await supabase
            .from('campaign_contacts')
            .update({ status: 'failed', error_message: errMsg })
            .eq('id', campaignContact.id);
        }
      }
    }

    console.log(`[Dispatcher] Done. Total contacts queued: ${totalProcessed}`);
    return new Response(JSON.stringify({ processed: totalProcessed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Dispatcher] Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
