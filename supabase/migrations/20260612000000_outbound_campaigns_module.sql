-- ============================================================
-- MÓDULO: CAMPANHAS OUTBOUND
-- ============================================================

-- Tabela 1: Definição da campanha
CREATE TABLE IF NOT EXISTS public.outbound_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.whatsapp_sessions(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
  opening_message TEXT NOT NULL,
  pdf_url TEXT,
  pdf_filename TEXT,
  daily_limit INTEGER NOT NULL DEFAULT 50,
  delay_seconds INTEGER NOT NULL DEFAULT 45,
  scheduled_start_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbound_campaigns_account
  ON public.outbound_campaigns (account_id, status);

-- Tabela 2: Contatos da campanha
CREATE TABLE IF NOT EXISTS public.campaign_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.outbound_campaigns(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'replied', 'opted_out', 'failed', 'converted')),
  sent_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  error_message TEXT,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign_status
  ON public.campaign_contacts (campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_phone
  ON public.campaign_contacts (phone_number);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_account
  ON public.campaign_contacts (account_id);

-- RLS
ALTER TABLE public.outbound_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members read outbound_campaigns"
  ON public.outbound_campaigns FOR SELECT TO authenticated
  USING (is_account_member(account_id) OR is_super_admin());

CREATE POLICY "Account admins manage outbound_campaigns"
  ON public.outbound_campaigns FOR ALL TO authenticated
  USING (has_account_role(account_id, ARRAY['owner','admin']::app_account_role[]) OR is_super_admin())
  WITH CHECK (has_account_role(account_id, ARRAY['owner','admin']::app_account_role[]) OR is_super_admin());

CREATE POLICY "Account members read campaign_contacts"
  ON public.campaign_contacts FOR SELECT TO authenticated
  USING (is_account_member(account_id) OR is_super_admin());

CREATE POLICY "Account admins manage campaign_contacts"
  ON public.campaign_contacts FOR ALL TO authenticated
  USING (has_account_role(account_id, ARRAY['owner','admin']::app_account_role[]) OR is_super_admin())
  WITH CHECK (has_account_role(account_id, ARRAY['owner','admin']::app_account_role[]) OR is_super_admin());

-- Updated_at triggers (padrão do projeto)
CREATE OR REPLACE FUNCTION public.update_outbound_campaigns_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_outbound_campaigns_updated_at
  BEFORE UPDATE ON public.outbound_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_outbound_campaigns_updated_at();

CREATE OR REPLACE FUNCTION public.update_campaign_contacts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_campaign_contacts_updated_at
  BEFORE UPDATE ON public.campaign_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_campaign_contacts_updated_at();
