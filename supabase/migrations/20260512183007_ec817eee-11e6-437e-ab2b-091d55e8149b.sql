
-- 1. Replace blanket patient-documents storage policies with scoped ones
DROP POLICY IF EXISTS "Authenticated can read patient docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload patient docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update patient docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete patient docs" ON storage.objects;

-- Helper: detect template folders
-- Patient files live under {patient_uuid}/...; template files under template-logos/... or template-pdfs/...

CREATE POLICY "Patient docs: scoped read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'patient-documents'
  AND (
    (storage.foldername(name))[1] IN ('template-logos','template-pdfs')
    OR public.can_access_patient(((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "Patient docs: scoped insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'patient-documents'
  AND (
    (
      (storage.foldername(name))[1] IN ('template-logos','template-pdfs')
      AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'surgeon'))
    )
    OR public.can_access_patient(((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "Patient docs: scoped update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'patient-documents'
  AND (
    (
      (storage.foldername(name))[1] IN ('template-logos','template-pdfs')
      AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'surgeon'))
    )
    OR public.can_access_patient(((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "Patient docs: scoped delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'patient-documents'
  AND (
    (
      (storage.foldername(name))[1] IN ('template-logos','template-pdfs')
      AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'surgeon'))
    )
    OR public.can_access_patient(((storage.foldername(name))[1])::uuid)
  )
);

-- 2. Restrictive deny policies on signature_audit_log to make immutability explicit
CREATE POLICY "Deny client insert audit" ON public.signature_audit_log
AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (false);

CREATE POLICY "Deny client update audit" ON public.signature_audit_log
AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny client delete audit" ON public.signature_audit_log
AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);

-- 3. Add scoped UPDATE policy on contact_records
CREATE POLICY "Scoped update contacts" ON public.contact_records
FOR UPDATE TO authenticated
USING (public.can_access_patient(patient_id))
WITH CHECK (public.can_access_patient(patient_id));

-- 4. Restrict EXECUTE on sensitive SECURITY DEFINER functions to service_role only
REVOKE EXECUTE ON FUNCTION public.set_signing_certificate(uuid, text, text, text, text, date, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_signing_certificate(uuid, text, text, text, text, date, date, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_signing_certificate_secret(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_signing_certificate_meta(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.insert_signature_audit(uuid, text, uuid, text, uuid, text, uuid, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.count_recent_signatures(uuid) FROM PUBLIC, anon, authenticated;
