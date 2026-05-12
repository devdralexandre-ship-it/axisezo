
-- Tabela pública de verificação de assinaturas
CREATE TABLE public.signature_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.patient_documents(id) ON DELETE CASCADE,
  signer_user_id uuid NOT NULL,
  signer_name text NOT NULL,
  signer_crm text,
  signer_specialty text,
  patient_name_snapshot text,
  document_title text NOT NULL,
  document_type text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  pdf_sha256 text,
  subject_cn text,
  valid_to date,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_signature_verifications_document ON public.signature_verifications(document_id);

ALTER TABLE public.signature_verifications ENABLE ROW LEVEL SECURITY;

-- Leitura pública (id é UUID não-enumerável; somente metadados não-clínicos)
CREATE POLICY "Public can read verifications by id"
  ON public.signature_verifications FOR SELECT
  TO anon, authenticated
  USING (true);

-- Escrita apenas via service role (edge function)
CREATE POLICY "Deny client insert verifications"
  ON public.signature_verifications AS RESTRICTIVE FOR INSERT
  TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny client update verifications"
  ON public.signature_verifications AS RESTRICTIVE FOR UPDATE
  TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny client delete verifications"
  ON public.signature_verifications AS RESTRICTIVE FOR DELETE
  TO anon, authenticated USING (false);
