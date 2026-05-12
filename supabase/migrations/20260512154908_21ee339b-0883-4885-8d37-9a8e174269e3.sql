
CREATE TABLE public.signature_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signer_user_id uuid NOT NULL,
  signer_name text,
  acted_by_user_id uuid NOT NULL,
  acted_by_name text,
  patient_id uuid,
  patient_name_snapshot text,
  document_id uuid,
  document_title text,
  document_type text,
  result text NOT NULL DEFAULT 'success',
  error_message text,
  ip_address text,
  user_agent text,
  signed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sig_audit_signer ON public.signature_audit_log(signer_user_id, signed_at DESC);
CREATE INDEX idx_sig_audit_acted_by ON public.signature_audit_log(acted_by_user_id, signed_at DESC);

ALTER TABLE public.signature_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signer sees own cert usage"
  ON public.signature_audit_log FOR SELECT
  USING (auth.uid() = signer_user_id OR auth.uid() = acted_by_user_id OR has_role(auth.uid(), 'admin'));

-- No INSERT/UPDATE/DELETE policies: only service role (edge function) writes here.

CREATE OR REPLACE FUNCTION public.get_surgeon_cert_status(_patient_id uuid)
RETURNS TABLE (
  has_cert boolean,
  surgeon_name text,
  signer_user_id uuid,
  subject_cn text,
  valid_to date
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _surgeon_name text;
  _signer uuid;
BEGIN
  IF NOT public.can_access_patient(_patient_id) THEN
    RETURN;
  END IF;

  SELECT p.surgeon INTO _surgeon_name FROM public.patients p WHERE p.id = _patient_id;

  SELECT pr.user_id INTO _signer
  FROM public.profiles pr
  WHERE pr.surgeon_name = _surgeon_name AND pr.active = true
  LIMIT 1;

  IF _signer IS NULL THEN
    RETURN QUERY SELECT false, _surgeon_name, NULL::uuid, NULL::text, NULL::date;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    sc.user_id IS NOT NULL,
    _surgeon_name,
    _signer,
    sc.subject_cn,
    sc.valid_to
  FROM public.signing_certificates sc
  WHERE sc.user_id = _signer;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, _surgeon_name, _signer, NULL::text, NULL::date;
  END IF;
END;
$$;
