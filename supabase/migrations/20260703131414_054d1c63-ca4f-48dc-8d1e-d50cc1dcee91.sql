
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS clinically_sensitive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS high_risk boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS high_ticket boolean NOT NULL DEFAULT false;

-- Ensure updated_at gets bumped on any change so the "Novo" badge can
-- disappear when a patient record is edited (compared against created_at).
DROP TRIGGER IF EXISTS patients_set_updated_at ON public.patients;
CREATE TRIGGER patients_set_updated_at
BEFORE UPDATE ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
