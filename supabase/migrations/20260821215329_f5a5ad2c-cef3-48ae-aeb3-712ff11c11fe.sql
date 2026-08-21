ALTER TABLE public.whatsapp_sessions
  ADD COLUMN IF NOT EXISTS last_inbound_event_at timestamptz,
  ADD COLUMN IF NOT EXISTS health text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS health_reason text,
  ADD COLUMN IF NOT EXISTS last_recovery_at timestamptz;