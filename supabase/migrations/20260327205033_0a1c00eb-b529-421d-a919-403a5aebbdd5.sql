
UPDATE public.patients SET responsible_contact = contact_reference WHERE contact_reference IS NOT NULL AND responsible_contact IS NULL;
ALTER TABLE public.patients DROP COLUMN IF EXISTS contact_reference;
