-- Restrict signature_audit_log SELECT policy to authenticated only
DROP POLICY IF EXISTS "Signer sees own cert usage" ON public.signature_audit_log;
CREATE POLICY "Signer sees own cert usage"
ON public.signature_audit_log
FOR SELECT
TO authenticated
USING (
  (auth.uid() = signer_user_id)
  OR (auth.uid() = acted_by_user_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Replace misleading permissive "deny" policy with a true RESTRICTIVE one
DROP POLICY IF EXISTS "Deny client access to signing-certificates" ON storage.objects;

CREATE POLICY "Restrict signing-certificates to owner folder"
ON storage.objects
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  bucket_id <> 'signing-certificates'
  OR (auth.uid()::text = (storage.foldername(name))[1])
)
WITH CHECK (
  bucket_id <> 'signing-certificates'
  OR (auth.uid()::text = (storage.foldername(name))[1])
);