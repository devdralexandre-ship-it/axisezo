-- Add structured data column to patient_documents
ALTER TABLE public.patient_documents
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Add logo and defaults to document_templates
ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS logo_path text,
  ADD COLUMN IF NOT EXISTS default_data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- New table for learned code suggestions (CBHPM, CID, OPME)
CREATE TABLE IF NOT EXISTS public.procedure_code_suggestions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  procedure text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('cbhpm','cid','opme')),
  value text NOT NULL,
  label text NOT NULL DEFAULT '',
  usage_count integer NOT NULL DEFAULT 1,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (procedure, kind, value)
);

CREATE INDEX IF NOT EXISTS idx_procedure_code_suggestions_lookup
  ON public.procedure_code_suggestions (procedure, kind, usage_count DESC);

ALTER TABLE public.procedure_code_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view suggestions"
  ON public.procedure_code_suggestions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert suggestions"
  ON public.procedure_code_suggestions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update suggestions"
  ON public.procedure_code_suggestions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete suggestions"
  ON public.procedure_code_suggestions FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_procedure_code_suggestions_updated_at
  BEFORE UPDATE ON public.procedure_code_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();