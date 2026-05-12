REVOKE EXECUTE ON FUNCTION public.set_signing_certificate(uuid,text,text,text,text,date,date,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_signing_certificate_secret(uuid,text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_signing_certificate_meta(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.insert_signature_audit(uuid,text,uuid,text,uuid,text,uuid,text,text,text,text,text,text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.count_recent_signatures(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_delegation_mode(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.authorize_document_signature(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_surgeon_cert_status(uuid) FROM anon;