
-- 1. owner_user_id em whatsapp_sessions
ALTER TABLE public.whatsapp_sessions 
  ADD COLUMN IF NOT EXISTS owner_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_owner ON public.whatsapp_sessions(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_account_owner ON public.whatsapp_sessions(account_id, owner_user_id);

-- Backfill owner_user_id com o primeiro owner/admin da conta
UPDATE public.whatsapp_sessions s
SET owner_user_id = (
  SELECT m.user_id FROM public.account_members m
  WHERE m.account_id = s.account_id
    AND m.status = 'active'
    AND m.role IN ('owner','admin')
  ORDER BY m.role::text, m.joined_at ASC
  LIMIT 1
)
WHERE owner_user_id IS NULL;

-- 2. session_id em tabelas de roteamento (Fase B)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.whatsapp_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.whatsapp_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.send_queue
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.whatsapp_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.nina_processing_queue
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.whatsapp_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.message_processing_queue
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.whatsapp_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.message_grouping_queue
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.whatsapp_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_session ON public.conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_user ON public.conversations(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_session ON public.messages(session_id);
CREATE INDEX IF NOT EXISTS idx_send_queue_session ON public.send_queue(session_id);

-- Backfill session_id para sessão default da conta
UPDATE public.conversations c
SET session_id = (SELECT s.id FROM public.whatsapp_sessions s WHERE s.account_id = c.account_id AND s.is_default = true LIMIT 1)
WHERE c.session_id IS NULL;

UPDATE public.messages m
SET session_id = (SELECT c.session_id FROM public.conversations c WHERE c.id = m.conversation_id)
WHERE m.session_id IS NULL;

UPDATE public.send_queue q
SET session_id = (SELECT c.session_id FROM public.conversations c WHERE c.id = q.conversation_id)
WHERE q.session_id IS NULL;

-- Backfill assigned_user_id quando ausente: usa owner da sessão
UPDATE public.conversations c
SET assigned_user_id = s.owner_user_id
FROM public.whatsapp_sessions s
WHERE c.session_id = s.id
  AND c.assigned_user_id IS NULL
  AND s.owner_user_id IS NOT NULL;

-- 3. Filas de atendimento
CREATE TABLE IF NOT EXISTS public.whatsapp_queues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#3b82f6',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_queues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members read whatsapp_queues"
  ON public.whatsapp_queues FOR SELECT TO authenticated
  USING (is_account_member(account_id) OR is_super_admin());

CREATE POLICY "Account managers modify whatsapp_queues"
  ON public.whatsapp_queues FOR ALL TO authenticated
  USING (has_account_role(account_id, ARRAY['owner'::app_account_role,'admin'::app_account_role,'manager'::app_account_role]) OR is_super_admin())
  WITH CHECK (has_account_role(account_id, ARRAY['owner'::app_account_role,'admin'::app_account_role,'manager'::app_account_role]) OR is_super_admin());

CREATE INDEX IF NOT EXISTS idx_whatsapp_queues_account ON public.whatsapp_queues(account_id);

CREATE TRIGGER trg_whatsapp_queues_updated
  BEFORE UPDATE ON public.whatsapp_queues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Membros das filas
CREATE TABLE IF NOT EXISTS public.whatsapp_queue_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL REFERENCES public.whatsapp_queues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  account_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(queue_id, user_id)
);

ALTER TABLE public.whatsapp_queue_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members read queue_members"
  ON public.whatsapp_queue_members FOR SELECT TO authenticated
  USING (is_account_member(account_id) OR is_super_admin());

CREATE POLICY "Account managers modify queue_members"
  ON public.whatsapp_queue_members FOR ALL TO authenticated
  USING (has_account_role(account_id, ARRAY['owner'::app_account_role,'admin'::app_account_role,'manager'::app_account_role]) OR is_super_admin())
  WITH CHECK (has_account_role(account_id, ARRAY['owner'::app_account_role,'admin'::app_account_role,'manager'::app_account_role]) OR is_super_admin());

CREATE INDEX IF NOT EXISTS idx_queue_members_queue ON public.whatsapp_queue_members(queue_id);
CREATE INDEX IF NOT EXISTS idx_queue_members_user ON public.whatsapp_queue_members(user_id);

-- 5. Auditoria de transferências
CREATE TABLE IF NOT EXISTS public.whatsapp_transfer_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  contact_id uuid,
  from_user_id uuid,
  to_user_id uuid,
  to_queue_id uuid REFERENCES public.whatsapp_queues(id) ON DELETE SET NULL,
  reason text,
  transferred_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_transfer_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members read transfer_logs"
  ON public.whatsapp_transfer_logs FOR SELECT TO authenticated
  USING (is_account_member(account_id) OR is_super_admin());

CREATE POLICY "Service role writes transfer_logs"
  ON public.whatsapp_transfer_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_transfer_logs_conversation ON public.whatsapp_transfer_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_transfer_logs_account ON public.whatsapp_transfer_logs(account_id, created_at DESC);

-- 6. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_queues;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_queue_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_transfer_logs;
