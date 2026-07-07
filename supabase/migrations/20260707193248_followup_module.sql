-- ============================================================
-- MÓDULO: FOLLOW-UP AUTOMÁTICO
-- Dispara mensagem de reengajamento quando lead não responde em N minutos
-- ============================================================
-- Para reverter:
--   ALTER TABLE public.conversations DROP COLUMN IF EXISTS followup_count;
--   ALTER TABLE public.conversations DROP COLUMN IF EXISTS last_followup_at;
--   DROP INDEX IF EXISTS idx_conversations_followup_eligible;
--   SELECT cron.unschedule('followup-dispatcher');
-- ============================================================

-- 1. Colunas em conversations
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS followup_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_followup_at TIMESTAMPTZ;

-- 2. Índice parcial — só conversas elegíveis, evita full scan a cada 15 min
CREATE INDEX IF NOT EXISTS idx_conversations_followup_eligible
  ON public.conversations (last_message_at)
  WHERE is_active = true
    AND status = 'nina'
    AND followup_count < 2;

-- 3. Cron job — a cada 15 minutos, horário comercial BRT (11-22 UTC)
-- Mesmo padrão de process-email-queue (migration 20260515212159_email_infra.sql)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove job anterior se existir (idempotente)
    PERFORM cron.unschedule('followup-dispatcher') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'followup-dispatcher'
    );

    PERFORM cron.schedule(
      'followup-dispatcher',
      '*/15 11-22 * * *',
      $$
        SELECT net.http_post(
          url := current_setting('app.supabase_url') || '/functions/v1/trigger-followup-dispatcher',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key')
          ),
          body := '{}'::jsonb
        );
      $$
    );
    RAISE NOTICE 'followup-dispatcher cron job agendado.';
  ELSE
    RAISE NOTICE 'pg_cron não disponível — agende o trigger-followup-dispatcher manualmente.';
  END IF;
END $$;

-- ============================================================
-- Configuração por conta fica em accounts.settings (JSONB existente)
-- Chaves adicionadas pelo frontend via toggleFollowupModule:
--   followup_enabled        boolean  (default false)
--   followup_delay_minutes  integer  (default 120)
--   followup_max_attempts   integer  (default 2)
-- Não requer coluna nova — segue padrão do outbound_campaigns_enabled
-- ============================================================
