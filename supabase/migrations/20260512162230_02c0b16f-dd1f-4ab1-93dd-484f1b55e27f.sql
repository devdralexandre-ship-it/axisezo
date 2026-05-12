DROP FUNCTION IF EXISTS public.get_surgeon_cert_status(uuid);

ALTER TABLE public.signing_certificates
  ADD COLUMN IF NOT EXISTS pfx_sha256 text,
  ADD COLUMN IF NOT EXISTS delegation_mode text NOT NULL DEFAULT 'always';

ALTER TABLE public.signing_certificates
  DROP CONSTRAINT IF EXISTS signing_certificates_delegation_mode_check;
ALTER TABLE public.signing_certificates
  ADD CONSTRAINT signing_certificates_delegation_mode_check
    CHECK (delegation_mode IN ('always', 'per_document', 'never'));

ALTER TABLE public.patient_documents
  ADD COLUMN IF NOT EXISTS signature_authorized_by uuid,
  ADD COLUMN IF NOT EXISTS signature_authorized_at timestamptz;

ALTER TABLE public.signature_audit_log
  ADD COLUMN IF NOT EXISTS prev_hash text,
  ADD COLUMN IF NOT EXISTS row_hash text;

CREATE OR REPLACE FUNCTION public.signature_audit_hash_chain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE _prev text;
BEGIN
  SELECT row_hash INTO _prev FROM public.signature_audit_log
  ORDER BY signed_at DESC, id DESC LIMIT 1;
  NEW.prev_hash := COALESCE(_prev, '');
  NEW.row_hash := encode(extensions.digest(
    coalesce(NEW.prev_hash,'')||'|'||NEW.signer_user_id::text||'|'||
    coalesce(NEW.acted_by_user_id::text,'')||'|'||
    coalesce(NEW.patient_id::text,'')||'|'||
    coalesce(NEW.document_id::text,'')||'|'||
    coalesce(NEW.result,'')||'|'||
    coalesce(NEW.error_message,'')||'|'||NEW.signed_at::text,
    'sha256'
  ),'hex');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_signature_audit_hash ON public.signature_audit_log;
CREATE TRIGGER trg_signature_audit_hash
  BEFORE INSERT ON public.signature_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.signature_audit_hash_chain();

DROP POLICY IF EXISTS "Deny client access to signing-certificates" ON storage.objects;
CREATE POLICY "Deny client access to signing-certificates"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id <> 'signing-certificates')
  WITH CHECK (bucket_id <> 'signing-certificates');

CREATE OR REPLACE FUNCTION public.set_signing_certificate(
  _user_id uuid, _pfx_path text, _password text, _master_key text,
  _subject_cn text, _valid_from date, _valid_to date, _pfx_sha256 text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
BEGIN
  IF _pfx_path IS NULL OR position((_user_id::text || '/') in _pfx_path) <> 1 THEN
    RAISE EXCEPTION 'invalid pfx_path scope';
  END IF;
  INSERT INTO public.signing_certificates (
    user_id, pfx_path, password_encrypted, subject_cn, valid_from, valid_to, pfx_sha256, updated_at
  ) VALUES (
    _user_id, _pfx_path,
    encode(extensions.pgp_sym_encrypt(_password, _master_key), 'base64'),
    _subject_cn, _valid_from, _valid_to, _pfx_sha256, now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET pfx_path = EXCLUDED.pfx_path,
      password_encrypted = EXCLUDED.password_encrypted,
      subject_cn = EXCLUDED.subject_cn,
      valid_from = EXCLUDED.valid_from,
      valid_to = EXCLUDED.valid_to,
      pfx_sha256 = EXCLUDED.pfx_sha256,
      updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.set_delegation_mode(_mode text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _mode NOT IN ('always','per_document','never') THEN RAISE EXCEPTION 'invalid mode'; END IF;
  UPDATE public.signing_certificates SET delegation_mode = _mode, updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_signing_certificate_meta(_signer_user_id uuid)
RETURNS TABLE(pfx_path text, pfx_sha256 text, delegation_mode text, subject_cn text, valid_to date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pfx_path, pfx_sha256, delegation_mode, subject_cn, valid_to
  FROM public.signing_certificates WHERE user_id = _signer_user_id
$$;

CREATE OR REPLACE FUNCTION public.get_surgeon_cert_status(_patient_id uuid)
RETURNS TABLE(has_cert boolean, surgeon_name text, signer_user_id uuid, subject_cn text, valid_to date, delegation_mode text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _surgeon_name text; _signer uuid;
BEGIN
  IF NOT public.can_access_patient(_patient_id) THEN RETURN; END IF;
  SELECT p.surgeon INTO _surgeon_name FROM public.patients p WHERE p.id = _patient_id;
  SELECT pr.user_id INTO _signer FROM public.profiles pr
    WHERE pr.surgeon_name = _surgeon_name AND pr.active = true LIMIT 1;
  IF _signer IS NULL THEN
    RETURN QUERY SELECT false, _surgeon_name, NULL::uuid, NULL::text, NULL::date, 'always'::text;
    RETURN;
  END IF;
  RETURN QUERY
  SELECT sc.user_id IS NOT NULL, _surgeon_name, _signer, sc.subject_cn, sc.valid_to, sc.delegation_mode
  FROM public.signing_certificates sc WHERE sc.user_id = _signer;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, _surgeon_name, _signer, NULL::text, NULL::date, 'always'::text;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.authorize_document_signature(_document_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _patient_id uuid; _surgeon text; _my_surgeon text;
BEGIN
  SELECT pd.patient_id INTO _patient_id FROM public.patient_documents pd WHERE pd.id = _document_id;
  IF _patient_id IS NULL THEN RAISE EXCEPTION 'document not found'; END IF;
  SELECT p.surgeon INTO _surgeon FROM public.patients p WHERE p.id = _patient_id;
  SELECT current_surgeon_name() INTO _my_surgeon;
  IF NOT has_role(auth.uid(),'admin') AND _surgeon IS DISTINCT FROM _my_surgeon THEN
    RAISE EXCEPTION 'only the responsible surgeon can authorize';
  END IF;
  UPDATE public.patient_documents
  SET signature_authorized_by = auth.uid(), signature_authorized_at = now()
  WHERE id = _document_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.count_recent_signatures(_signer_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.signature_audit_log
  WHERE signer_user_id = _signer_user_id AND result = 'success'
    AND signed_at > now() - interval '24 hours'
$$;