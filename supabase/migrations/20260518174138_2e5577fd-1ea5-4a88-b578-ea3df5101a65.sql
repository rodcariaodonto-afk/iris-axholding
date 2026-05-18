
-- ============ Coworking module ============

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. bookable_resources
CREATE TABLE IF NOT EXISTS public.bookable_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'room',
  capacity integer,
  description text,
  google_calendar_id text,
  is_active boolean NOT NULL DEFAULT true,
  is_publicly_bookable boolean NOT NULL DEFAULT true,
  allocation_priority integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookable_resources_account_active
  ON public.bookable_resources (account_id, is_active);
CREATE INDEX IF NOT EXISTS idx_bookable_resources_account_priority
  ON public.bookable_resources (account_id, is_publicly_bookable, allocation_priority);

ALTER TABLE public.bookable_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members read bookable_resources"
  ON public.bookable_resources FOR SELECT TO authenticated
  USING (public.is_account_member(account_id) OR public.is_super_admin());

CREATE POLICY "Account admins manage bookable_resources"
  ON public.bookable_resources FOR ALL TO authenticated
  USING (public.has_account_role(account_id, ARRAY['owner','admin','manager']::app_account_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_account_role(account_id, ARRAY['owner','admin','manager']::app_account_role[]) OR public.is_super_admin());

CREATE TRIGGER trg_bookable_resources_updated_at
  BEFORE UPDATE ON public.bookable_resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. appointments extension
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS resource_id uuid REFERENCES public.bookable_resources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS booking_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS booking_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS customer_type text,
  ADD COLUMN IF NOT EXISTS service_modality text,
  ADD COLUMN IF NOT EXISTS requires_human_validation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS start_at timestamptz,
  ADD COLUMN IF NOT EXISTS end_at timestamptz;

CREATE OR REPLACE FUNCTION public.sync_appointment_timerange()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.date IS NOT NULL AND NEW.time IS NOT NULL THEN
    NEW.start_at := ((NEW.date::text || ' ' || NEW.time::text)::timestamp AT TIME ZONE 'America/Sao_Paulo');
    NEW.end_at   := NEW.start_at + make_interval(mins => COALESCE(NEW.duration, 60));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_appointments_sync_timerange ON public.appointments;
CREATE TRIGGER trg_appointments_sync_timerange
  BEFORE INSERT OR UPDATE OF date, time, duration ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_timerange();

-- Backfill
UPDATE public.appointments
SET start_at = ((date::text || ' ' || time::text)::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    end_at   = ((date::text || ' ' || time::text)::timestamp AT TIME ZONE 'America/Sao_Paulo') + make_interval(mins => COALESCE(duration, 60))
WHERE start_at IS NULL AND date IS NOT NULL AND time IS NOT NULL;

-- 3. Anti-overbook
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_no_double_booking;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_double_booking
  EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  )
  WHERE (
    resource_id IS NOT NULL
    AND start_at IS NOT NULL
    AND end_at IS NOT NULL
    AND booking_status NOT IN ('cancelled','no_show')
  );

CREATE INDEX IF NOT EXISTS idx_appointments_resource_timerange
  ON public.appointments (resource_id, start_at, end_at)
  WHERE resource_id IS NOT NULL;

-- 4. coworking_payments
CREATE TABLE IF NOT EXISTS public.coworking_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'manual_pix',
  amount numeric(12,2),
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'pending',
  external_id text,
  proof_url text,
  paid_at timestamptz,
  validated_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coworking_payments_account
  ON public.coworking_payments (account_id, status);
CREATE INDEX IF NOT EXISTS idx_coworking_payments_appointment
  ON public.coworking_payments (appointment_id);

ALTER TABLE public.coworking_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members read coworking_payments"
  ON public.coworking_payments FOR SELECT TO authenticated
  USING (public.is_account_member(account_id) OR public.is_super_admin());

CREATE POLICY "Account admins manage coworking_payments"
  ON public.coworking_payments FOR ALL TO authenticated
  USING (public.has_account_role(account_id, ARRAY['owner','admin','manager']::app_account_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_account_role(account_id, ARRAY['owner','admin','manager']::app_account_role[]) OR public.is_super_admin());

CREATE TRIGGER trg_coworking_payments_updated_at
  BEFORE UPDATE ON public.coworking_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enforce_coworking_payment_validator()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.validated_by IS NOT NULL
     AND NEW.validated_by IS DISTINCT FROM COALESCE(OLD.validated_by, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    IF NOT public.has_account_role(NEW.account_id, ARRAY['owner','admin','manager']::app_account_role[])
       AND NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'Only owner/admin/manager can validate payments';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enforce_coworking_payment_validator ON public.coworking_payments;
CREATE TRIGGER trg_enforce_coworking_payment_validator
BEFORE INSERT OR UPDATE ON public.coworking_payments
FOR EACH ROW EXECUTE FUNCTION public.enforce_coworking_payment_validator();

-- 5. Bootstrap RPC
CREATE OR REPLACE FUNCTION public.bootstrap_coworking_defaults(_account_id uuid)
RETURNS SETOF public.bookable_resources
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_account_member(_account_id) AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not a member of this account';
  END IF;

  IF EXISTS (SELECT 1 FROM public.bookable_resources WHERE account_id = _account_id) THEN
    RETURN QUERY SELECT * FROM public.bookable_resources
      WHERE account_id = _account_id ORDER BY allocation_priority, name;
    RETURN;
  END IF;

  INSERT INTO public.bookable_resources
    (account_id, name, type, capacity, description, is_active, is_publicly_bookable, allocation_priority, metadata)
  VALUES
    (_account_id, 'Sala 01', 'room', 4, 'Sala padrão para atendimentos individuais', true,  true,  1, '{"default":true}'::jsonb),
    (_account_id, 'Sala 02', 'room', 4, 'Sala reserva — inativa por padrão',          false, false, 99,'{"default":true}'::jsonb),
    (_account_id, 'Sala 03', 'room', 6, 'Sala maior — só sob pedido explícito',       true,  false, 3, '{"default":true,"only_when_explicitly_requested":true}'::jsonb),
    (_account_id, 'Sala 04', 'room', 4, 'Sala alternativa para atendimentos',         true,  true,  2, '{"default":true}'::jsonb);

  RETURN QUERY SELECT * FROM public.bookable_resources
    WHERE account_id = _account_id ORDER BY allocation_priority, name;
END; $$;

-- 6. Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.bookable_resources;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.coworking_payments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
