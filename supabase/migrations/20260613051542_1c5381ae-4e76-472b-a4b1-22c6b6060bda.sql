ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_phone_number_unique;

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_account_phone_unique UNIQUE (account_id, phone_number);