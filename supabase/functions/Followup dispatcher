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
    console.log('[FollowupDispatcher] Starting...');

    // Horário comercial BRT (UTC-3): 08:00–19:00 = 11:00–22:00 UTC
    const nowUTC = new Date();
    const hourUTC = nowUTC.getUTCHours();
    if (hourUTC < 11 || hourUTC >= 22) {
      console.log('[FollowupDispatcher] Outside business hours, skipping.');
      return new Response(JSON.stringify({ skipped: true, reason: 'outside_business_hours' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Buscar contas com follow-up habilitado
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, settings')
      .eq('settings->>followup_enabled', 'true');

    if (accountsError) throw accountsError;

    if (!accounts || accounts.length === 0) {
      console.log('[FollowupDispatcher] No accounts with followup enabled.');
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalProcessed = 0;
    let totalSkipped = 0;

    for (const account of accounts) {
      const settings = account.settings || {};
      const delayMinutes: number = Number(settings.followup_delay_minutes ?? 120);
      const maxAttempts: number = Math.min(Number(settings.followup_max_attempts ?? 2), 2); // máx 2
      const cutoff = new Date(Date.now() - delayMinutes * 60 * 1000).toISOString();

      console.log(`[FollowupDispatcher] Account ${account.id}: delay=${delayMinutes}min, maxAttempts=${maxAttempts}`);

      // 2. Buscar conversas elegíveis (limit 20 por execução por conta)
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id, followup_count, last_followup_at, last_message_at, metadata, session_id, contact_id, account_id')
        .eq('account_id', account.id)
        .eq('is_active', true)
        .eq('status', 'nina')
        .lt('followup_count', maxAttempts)
        .lte('last_message_at', cutoff)
        .not('tags', 'cs', '{"opted_out"}')
        .limit(20);

      if (convError) {
        console.error(`[FollowupDispatcher] Error fetching conversations for account ${account.id}:`, convError);
        continue;
      }

      if (!conversations || conversations.length === 0) {
        console.log(`[FollowupDispatcher] Account ${account.id}: no eligible conversations.`);
        continue;
      }

      console.log(`[FollowupDispatcher] Account ${account.id}: ${conversations.length} candidates.`);

      for (const conv of conversations) {
        try {
          // 3a. Garantir que o 2º follow-up só vai no dia seguinte (mín 20h após o 1º)
          if (conv.followup_count > 0 && conv.last_followup_at) {
            const hoursSinceLast = (Date.now() - new Date(conv.last_followup_at).getTime()) / 3600000;
            if (hoursSinceLast < 20) {
              console.log(`[FollowupDispatcher] Conv ${conv.id}: skip — 2nd attempt too soon (${hoursSinceLast.toFixed(1)}h).`);
              totalSkipped++;
              continue;
            }
          }

          // 3b. Buscar última mensagem da conversa — deve ser da Nina (não do lead)
          const { data: lastMessages } = await supabase
            .from('messages')
            .select('from_type, sent_at')
            .eq('conversation_id', conv.id)
            .order('sent_at', { ascending: false })
            .limit(1);

          const lastMsg = lastMessages?.[0];
          if (!lastMsg || lastMsg.from_type !== 'nina') {
            console.log(`[FollowupDispatcher] Conv ${conv.id}: skip — last_msg_is_user or no messages.`);
            totalSkipped++;
            continue;
          }

          // 3c. Verificar janela de 24h da Meta: deve existir pelo menos 1 mensagem
          //     do lead nas últimas 23h (margem de 1h para segurança)
          const windowCutoff = new Date(Date.now() - 23 * 3600 * 1000).toISOString();
          const { count: userMsgCount } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('from_type', 'user')
            .gte('sent_at', windowCutoff);

          if ((userMsgCount ?? 0) === 0) {
            console.log(`[FollowupDispatcher] Conv ${conv.id}: skip — window_closed (no user msg in last 23h).`);
            totalSkipped++;
            continue;
          }

          // 3d. Verificar se contato não está bloqueado
          const { data: contact } = await supabase
            .from('contacts')
            .select('is_blocked')
            .eq('id', conv.contact_id)
            .maybeSingle();

          if (contact?.is_blocked) {
            console.log(`[FollowupDispatcher] Conv ${conv.id}: skip — contact_blocked.`);
            totalSkipped++;
            continue;
          }

          // 4. ATUALIZAR CONTADOR ANTES de invocar (idempotência — evita duplo disparo)
          const { error: updateError } = await supabase
            .from('conversations')
            .update({
              followup_count: conv.followup_count + 1,
              last_followup_at: new Date().toISOString(),
            })
            .eq('id', conv.id)
            // Garantia extra de concorrência: só atualiza se count não mudou
            .eq('followup_count', conv.followup_count);

          if (updateError) {
            console.error(`[FollowupDispatcher] Conv ${conv.id}: error updating counter:`, updateError);
            continue;
          }

          // 5. Inserir mensagem sintética na nina_processing_queue
          //    O orchestrator vai tratá-la como trigger de follow-up
          const attempt = conv.followup_count + 1;
          const syntheticContent = `[SISTEMA_FOLLOWUP: tentativa=${attempt} de ${maxAttempts}. O lead não respondeu há mais de ${delayMinutes} minutos. Gere UMA mensagem curta de reengajamento seguindo o <followup_protocol> do seu prompt. Não cumprimente. Não cobre o lead. Referencie contextualmente o ponto onde a conversa parou.]`;

          // Inserir mensagem sintética na tabela messages (from_type nina, marcada como followup)
          const { data: syntheticMsg, error: msgError } = await supabase
            .from('messages')
            .insert({
              conversation_id: conv.id,
              from_type: 'nina',
              type: 'text',
              content: syntheticContent,
              processed_by_nina: false,
              metadata: {
                followup: true,
                followup_attempt: attempt,
                followup_max: maxAttempts,
                synthetic: true,
              },
            })
            .select()
            .single();

          if (msgError) {
            console.error(`[FollowupDispatcher] Conv ${conv.id}: error inserting synthetic msg:`, msgError);
            // Reverter contador
            await supabase
              .from('conversations')
              .update({ followup_count: conv.followup_count, last_followup_at: conv.last_followup_at })
              .eq('id', conv.id);
            continue;
          }

          // 6. Enfileirar na nina_processing_queue
          const { error: queueError } = await supabase
            .from('nina_processing_queue')
            .insert({
              conversation_id: conv.id,
              message_id: syntheticMsg.id,
              status: 'pending',
              retry_count: 0,
              metadata: {
                followup: true,
                followup_attempt: attempt,
              },
            });

          if (queueError) {
            console.error(`[FollowupDispatcher] Conv ${conv.id}: error enqueuing:`, queueError);
            continue;
          }

          // 7. Invocar nina-orchestrator imediatamente
          const orchestratorUrl = `${supabaseUrl}/functions/v1/nina-orchestrator`;
          fetch(orchestratorUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          }).catch((err) => {
            console.error(`[FollowupDispatcher] Conv ${conv.id}: orchestrator invoke error:`, err);
          });

          totalProcessed++;
          console.log(`[FollowupDispatcher] Conv ${conv.id}: follow-up ${attempt}/${maxAttempts} enqueued.`);

        } catch (err) {
          console.error(`[FollowupDispatcher] Unexpected error for conv ${conv.id}:`, err);
        }
      }
    }

    console.log(`[FollowupDispatcher] Done. Processed: ${totalProcessed}, Skipped: ${totalSkipped}`);
    return new Response(JSON.stringify({ processed: totalProcessed, skipped: totalSkipped }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[FollowupDispatcher] Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
