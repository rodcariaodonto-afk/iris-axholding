-- Dedupe appointments per (account_id, date, time, title) — keep oldest
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY account_id, date, time, title
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.appointments
)
DELETE FROM public.appointments a
USING ranked r
WHERE a.id = r.id AND r.rn > 1;

-- Prevent future duplicates at the same exact slot/title within an account
CREATE UNIQUE INDEX IF NOT EXISTS appointments_unique_slot
  ON public.appointments (account_id, date, time, title);
