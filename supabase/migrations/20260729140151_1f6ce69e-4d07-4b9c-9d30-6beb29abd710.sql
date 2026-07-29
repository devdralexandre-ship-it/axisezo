ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS age_months integer;
ALTER TYPE public.loss_reason ADD VALUE IF NOT EXISTS 'ghost';