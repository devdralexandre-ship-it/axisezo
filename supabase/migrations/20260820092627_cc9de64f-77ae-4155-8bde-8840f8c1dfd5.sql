CREATE TABLE public.patient_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_user_id uuid NOT NULL,
  author_name text NOT NULL,
  for_surgeon boolean NOT NULL DEFAULT false,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.patient_notes TO authenticated;
GRANT ALL ON public.patient_notes TO service_role;

ALTER TABLE public.patient_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_select_accessible_patients"
ON public.patient_notes FOR SELECT TO authenticated
USING (public.can_access_patient(patient_id));

CREATE POLICY "notes_insert_own"
ON public.patient_notes FOR INSERT TO authenticated
WITH CHECK (author_user_id = auth.uid() AND public.can_access_patient(patient_id));

CREATE POLICY "notes_update_own_recent"
ON public.patient_notes FOR UPDATE TO authenticated
USING (author_user_id = auth.uid() AND created_at > now() - interval '2 hours')
WITH CHECK (author_user_id = auth.uid());

CREATE INDEX idx_patient_notes_patient_created ON public.patient_notes (patient_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.patient_notes_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.patient_id IS DISTINCT FROM OLD.patient_id
     OR NEW.author_user_id IS DISTINCT FROM OLD.author_user_id
     OR NEW.author_name IS DISTINCT FROM OLD.author_name
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'nota: autor, paciente e data de criacao nao podem ser alterados';
  END IF;
  IF OLD.created_at < now() - interval '2 hours' THEN
    RAISE EXCEPTION 'nota: o prazo de 2 horas para edicao expirou';
  END IF;
  IF NEW.body IS DISTINCT FROM OLD.body OR NEW.for_surgeon IS DISTINCT FROM OLD.for_surgeon THEN
    NEW.edited_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_patient_notes_guard
BEFORE UPDATE ON public.patient_notes
FOR EACH ROW EXECUTE FUNCTION public.patient_notes_guard();