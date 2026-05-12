
CREATE OR REPLACE FUNCTION public.set_signing_certificate(
  _user_id uuid,
  _pfx_path text,
  _password text,
  _master_key text,
  _subject_cn text,
  _valid_from date,
  _valid_to date
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.signing_certificates (user_id, pfx_path, password_encrypted, subject_cn, valid_from, valid_to, updated_at)
  VALUES (
    _user_id,
    _pfx_path,
    encode(extensions.pgp_sym_encrypt(_password, _master_key), 'base64'),
    _subject_cn,
    _valid_from,
    _valid_to,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET pfx_path = EXCLUDED.pfx_path,
      password_encrypted = EXCLUDED.password_encrypted,
      subject_cn = EXCLUDED.subject_cn,
      valid_from = EXCLUDED.valid_from,
      valid_to = EXCLUDED.valid_to,
      updated_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_signing_certificate(uuid, text, text, text, text, date, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_signing_certificate_secret(
  _signer_user_id uuid,
  _master_key text
) RETURNS TABLE (pfx_path text, password text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT sc.pfx_path,
         convert_from(extensions.pgp_sym_decrypt(decode(sc.password_encrypted, 'base64'), _master_key)::bytea, 'utf8') AS password
  FROM public.signing_certificates sc
  WHERE sc.user_id = _signer_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_signing_certificate_secret(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.insert_signature_audit(
  _signer_user_id uuid,
  _signer_name text,
  _acted_by_user_id uuid,
  _acted_by_name text,
  _patient_id uuid,
  _patient_name text,
  _document_id uuid,
  _document_title text,
  _document_type text,
  _result text,
  _error text,
  _ip text,
  _ua text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.signature_audit_log (
    signer_user_id, signer_name, acted_by_user_id, acted_by_name,
    patient_id, patient_name_snapshot, document_id, document_title, document_type,
    result, error_message, ip_address, user_agent
  ) VALUES (
    _signer_user_id, _signer_name, _acted_by_user_id, _acted_by_name,
    _patient_id, _patient_name, _document_id, _document_title, _document_type,
    _result, _error, _ip, _ua
  ) RETURNING id INTO _id;
  RETURN _id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.insert_signature_audit(uuid, text, uuid, text, uuid, text, uuid, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
