
-- Add new columns to patients table
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS patient_type text DEFAULT 'adult',
  ADD COLUMN IF NOT EXISTS billing_type text,
  ADD COLUMN IF NOT EXISTS medical_fees numeric,
  ADD COLUMN IF NOT EXISTS alerts text,
  ADD COLUMN IF NOT EXISTS surgical_approach text;

-- Create custom pending items table
CREATE TABLE IF NOT EXISTS public.pending_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  title text NOT NULL,
  checked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pending items" ON public.pending_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert pending items" ON public.pending_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update pending items" ON public.pending_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete pending items" ON public.pending_items FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_pending_items_updated_at BEFORE UPDATE ON public.pending_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
