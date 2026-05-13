-- Patient uploads: arquivos enviados pelo call center / concierge (RG, exames, fotos clínicas, etc.)
CREATE TABLE public.patient_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'outro',
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL DEFAULT '',
  size_bytes bigint NOT NULL DEFAULT 0,
  uploaded_by uuid,
  drive_file_id text,
  drive_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX patient_uploads_patient_idx ON public.patient_uploads (patient_id, created_at DESC);

ALTER TABLE public.patient_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scoped select patient uploads"
ON public.patient_uploads FOR SELECT TO authenticated
USING (can_access_patient(patient_id));

CREATE POLICY "Scoped insert patient uploads"
ON public.patient_uploads FOR INSERT TO authenticated
WITH CHECK (can_access_patient(patient_id));

CREATE POLICY "Scoped update patient uploads"
ON public.patient_uploads FOR UPDATE TO authenticated
USING (can_access_patient(patient_id))
WITH CHECK (can_access_patient(patient_id));

CREATE POLICY "Scoped delete patient uploads"
ON public.patient_uploads FOR DELETE TO authenticated
USING (can_access_patient(patient_id));

-- Storage bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-uploads', 'patient-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: arquivo dentro de pasta {patient_id}/...
CREATE POLICY "Scoped read patient-uploads"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'patient-uploads'
  AND can_access_patient(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Scoped write patient-uploads"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'patient-uploads'
  AND can_access_patient(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Scoped update patient-uploads"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'patient-uploads'
  AND can_access_patient(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Scoped delete patient-uploads"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'patient-uploads'
  AND can_access_patient(((storage.foldername(name))[1])::uuid)
);
