
-- Restrict signing-certificates storage policies to authenticated role
DROP POLICY IF EXISTS "Own cert read" ON storage.objects;
DROP POLICY IF EXISTS "Own cert write" ON storage.objects;
DROP POLICY IF EXISTS "Own cert update" ON storage.objects;
DROP POLICY IF EXISTS "Own cert delete" ON storage.objects;

CREATE POLICY "Own cert read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'signing-certificates' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Own cert write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'signing-certificates' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Own cert update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'signing-certificates' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Own cert delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'signing-certificates' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Explicit restrictive deny SELECT on signature_verifications for anon/authenticated.
-- Reads must go through the verify-document edge function (service role).
CREATE POLICY "Deny direct SELECT on signature_verifications"
ON public.signature_verifications
AS RESTRICTIVE
FOR SELECT
TO anon, authenticated
USING (false);
