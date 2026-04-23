
-- Document type enum
CREATE TYPE public.document_type AS ENUM ('budget', 'surgical_request', 'medical_certificate', 'report');

-- Templates table
CREATE TABLE public.document_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type public.document_type NOT NULL,
  surgeon TEXT,
  title TEXT NOT NULL,
  body_html TEXT NOT NULL DEFAULT '',
  header_html TEXT NOT NULL DEFAULT '',
  footer_html TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view templates" ON public.document_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert templates" ON public.document_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update templates" ON public.document_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete templates" ON public.document_templates FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_document_templates_updated_at
BEFORE UPDATE ON public.document_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_document_templates_type_surgeon ON public.document_templates(type, surgeon);

-- Patient documents
CREATE TABLE public.patient_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.document_templates(id) ON DELETE SET NULL,
  type public.document_type NOT NULL,
  title TEXT NOT NULL,
  body_html TEXT NOT NULL DEFAULT '',
  pdf_path TEXT,
  created_by UUID,
  sent_via_whatsapp_at TIMESTAMPTZ,
  drive_file_id TEXT,
  drive_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view patient documents" ON public.patient_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert patient documents" ON public.patient_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update patient documents" ON public.patient_documents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete patient documents" ON public.patient_documents FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_patient_documents_updated_at
BEFORE UPDATE ON public.patient_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_patient_documents_patient ON public.patient_documents(patient_id, created_at DESC);

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('patient-documents', 'patient-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can read patient docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'patient-documents');

CREATE POLICY "Authenticated can upload patient docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'patient-documents');

CREATE POLICY "Authenticated can update patient docs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'patient-documents');

CREATE POLICY "Authenticated can delete patient docs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'patient-documents');
