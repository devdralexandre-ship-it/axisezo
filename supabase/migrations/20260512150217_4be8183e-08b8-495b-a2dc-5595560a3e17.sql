ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS procedure_codes JSONB NOT NULL DEFAULT '{"main": null, "extras": []}'::jsonb;

ALTER TABLE public.patient_documents
  ADD COLUMN IF NOT EXISTS signed_pdf_path text,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_by uuid;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.signing_certificates (
  user_id uuid PRIMARY KEY,
  pfx_path text NOT NULL,
  password_encrypted text NOT NULL,
  subject_cn text,
  valid_from date,
  valid_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.signing_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own cert" ON public.signing_certificates
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Users insert own cert" ON public.signing_certificates
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own cert" ON public.signing_certificates
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own cert" ON public.signing_certificates
  FOR DELETE USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));

CREATE TRIGGER update_signing_certificates_updated_at
  BEFORE UPDATE ON public.signing_certificates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
  VALUES ('signing-certificates','signing-certificates', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Own cert read" ON storage.objects FOR SELECT
  USING (bucket_id='signing-certificates' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Own cert write" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id='signing-certificates' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Own cert update" ON storage.objects FOR UPDATE
  USING (bucket_id='signing-certificates' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Own cert delete" ON storage.objects FOR DELETE
  USING (bucket_id='signing-certificates' AND auth.uid()::text = (storage.foldername(name))[1]);