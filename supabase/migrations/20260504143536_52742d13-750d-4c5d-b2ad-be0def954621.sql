-- ============ professional_profiles ============
CREATE TABLE public.professional_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  crm TEXT DEFAULT '',
  crm_uf TEXT DEFAULT '',
  rqe TEXT DEFAULT '',
  signature_title TEXT DEFAULT '',
  phone_professional TEXT DEFAULT '',
  email_professional TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.professional_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own professional profile"
  ON public.professional_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own professional profile"
  ON public.professional_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users update own professional profile"
  ON public.professional_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete professional profiles"
  ON public.professional_profiles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_professional_profiles_updated_at
  BEFORE UPDATE ON public.professional_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ procedure_default_codes ============
CREATE TABLE public.procedure_default_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('surgeon','concierge')),
  scope_owner TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('cbhpm_main','cbhpm_extra','cid','opme')),
  code TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX procedure_default_codes_unique
  ON public.procedure_default_codes (procedure, scope, scope_owner, kind, code, label);

CREATE INDEX procedure_default_codes_lookup
  ON public.procedure_default_codes (procedure, scope, scope_owner);

ALTER TABLE public.procedure_default_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view default codes"
  ON public.procedure_default_codes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Roled users insert default codes"
  ON public.procedure_default_codes FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'surgeon')
    OR public.has_role(auth.uid(), 'concierge')
  );

CREATE POLICY "Roled users update default codes"
  ON public.procedure_default_codes FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'surgeon')
    OR public.has_role(auth.uid(), 'concierge')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'surgeon')
    OR public.has_role(auth.uid(), 'concierge')
  );

CREATE POLICY "Roled users delete default codes"
  ON public.procedure_default_codes FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'surgeon')
    OR public.has_role(auth.uid(), 'concierge')
  );

CREATE TRIGGER update_procedure_default_codes_updated_at
  BEFORE UPDATE ON public.procedure_default_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ tasks.preset ============
ALTER TABLE public.tasks ADD COLUMN preset TEXT;