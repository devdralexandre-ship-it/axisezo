
-- Fix: Restrict signature_verifications public SELECT.
-- The verify-document edge function uses the service role, so clients don't need direct table access.
DROP POLICY IF EXISTS "Public can read verifications by id" ON public.signature_verifications;

-- Fix: Scope signing_certificates policies to authenticated role only (was public).
DROP POLICY IF EXISTS "Users view own cert" ON public.signing_certificates;
DROP POLICY IF EXISTS "Users insert own cert" ON public.signing_certificates;
DROP POLICY IF EXISTS "Users update own cert" ON public.signing_certificates;
DROP POLICY IF EXISTS "Users delete own cert" ON public.signing_certificates;

CREATE POLICY "Users view own cert" ON public.signing_certificates
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own cert" ON public.signing_certificates
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own cert" ON public.signing_certificates
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own cert" ON public.signing_certificates
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
