ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS desired_hospitals text[] NOT NULL DEFAULT '{}';
UPDATE public.patients
SET desired_hospitals = ARRAY[desired_hospital]
WHERE (desired_hospitals IS NULL OR array_length(desired_hospitals, 1) IS NULL)
  AND desired_hospital IS NOT NULL AND desired_hospital <> '';