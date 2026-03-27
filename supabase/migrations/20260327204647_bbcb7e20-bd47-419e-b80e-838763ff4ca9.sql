
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS responsible_contact text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS anesthesia_fees numeric;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS hospital_budget numeric;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS materials_cost numeric;
ALTER TABLE public.patients DROP COLUMN IF EXISTS special_flag;
