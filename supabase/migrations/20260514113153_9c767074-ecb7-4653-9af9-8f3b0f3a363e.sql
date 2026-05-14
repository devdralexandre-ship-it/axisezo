
-- user_capabilities table
CREATE TABLE IF NOT EXISTS public.user_capabilities (
  user_id uuid PRIMARY KEY,
  caps jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_capabilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own capabilities" ON public.user_capabilities;
CREATE POLICY "Users view own capabilities"
  ON public.user_capabilities FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage capabilities" ON public.user_capabilities;
CREATE POLICY "Admins manage capabilities"
  ON public.user_capabilities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_user_caps_updated_at ON public.user_capabilities;
CREATE TRIGGER trg_user_caps_updated_at
  BEFORE UPDATE ON public.user_capabilities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- assigned_user_ids on patients
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS assigned_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

CREATE INDEX IF NOT EXISTS idx_patients_assigned_user_ids
  ON public.patients USING GIN (assigned_user_ids);

-- has_capability function
CREATE OR REPLACE FUNCTION public.has_capability(_user_id uuid, _cap text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR COALESCE(
      (SELECT (caps ->> _cap)::boolean
       FROM public.user_capabilities
       WHERE user_id = _user_id),
      false
    )
$$;

-- can_access_patient: honor assigned_only restriction; intern role sees all (unless restricted)
CREATE OR REPLACE FUNCTION public.can_access_patient(_patient_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin')
    OR (
      public.has_capability(auth.uid(), 'assigned_only')
      AND EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = _patient_id
          AND auth.uid() = ANY(p.assigned_user_ids)
      )
    )
    OR (
      NOT public.has_capability(auth.uid(), 'assigned_only')
      AND (
        public.has_role(auth.uid(), 'call_center')
        OR public.has_role(auth.uid(), 'intern')
        OR EXISTS (
          SELECT 1 FROM public.patients p
          WHERE p.id = _patient_id AND (
            (public.has_role(auth.uid(), 'surgeon')   AND p.surgeon   = public.current_surgeon_name())
            OR (public.has_role(auth.uid(), 'concierge') AND p.concierge = public.current_concierge_name())
          )
        )
      )
    )
$$;

-- Refresh patients policies
DROP POLICY IF EXISTS "Scoped select patients" ON public.patients;
DROP POLICY IF EXISTS "Scoped update patients" ON public.patients;
DROP POLICY IF EXISTS "Scoped insert patients" ON public.patients;
DROP POLICY IF EXISTS "Admins can delete patients" ON public.patients;
DROP POLICY IF EXISTS "Capability delete patients" ON public.patients;

CREATE POLICY "Scoped select patients"
  ON public.patients FOR SELECT TO authenticated
  USING (public.can_access_patient(id));

CREATE POLICY "Scoped update patients"
  ON public.patients FOR UPDATE TO authenticated
  USING (public.can_access_patient(id))
  WITH CHECK (public.can_access_patient(id));

CREATE POLICY "Scoped insert patients"
  ON public.patients FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'call_center')
    OR public.has_role(auth.uid(), 'intern')
    OR (public.has_role(auth.uid(), 'surgeon')   AND surgeon   = public.current_surgeon_name())
    OR (public.has_role(auth.uid(), 'concierge') AND concierge = public.current_concierge_name())
  );

CREATE POLICY "Capability delete patients"
  ON public.patients FOR DELETE TO authenticated
  USING (public.has_capability(auth.uid(), 'delete_patients'));

-- Allow authenticated to view all profiles (for "Assign to..." selector)
DROP POLICY IF EXISTS "Authenticated view profiles minimal" ON public.profiles;
CREATE POLICY "Authenticated view profiles minimal"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- Seed capabilities for existing users based on current role
WITH role_caps AS (
  SELECT
    p.user_id,
    jsonb_build_object(
      'view_financials',    public.has_role(p.user_id, 'admin') OR public.has_role(p.user_id, 'surgeon') OR public.has_role(p.user_id, 'concierge'),
      'edit_financials',    public.has_role(p.user_id, 'admin') OR public.has_role(p.user_id, 'surgeon'),
      'edit_clinical',      public.has_role(p.user_id, 'admin') OR public.has_role(p.user_id, 'surgeon') OR public.has_role(p.user_id, 'concierge') OR public.has_role(p.user_id, 'call_center'),
      'move_pipeline',      public.has_role(p.user_id, 'admin') OR public.has_role(p.user_id, 'surgeon') OR public.has_role(p.user_id, 'concierge') OR public.has_role(p.user_id, 'call_center'),
      'delete_patients',    public.has_role(p.user_id, 'admin'),
      'assigned_only',      false,
      'generate_documents', public.has_role(p.user_id, 'admin') OR public.has_role(p.user_id, 'surgeon') OR public.has_role(p.user_id, 'concierge'),
      'manage_templates',   public.has_role(p.user_id, 'admin') OR public.has_role(p.user_id, 'surgeon'),
      'manage_library',     public.has_role(p.user_id, 'admin') OR public.has_role(p.user_id, 'surgeon'),
      'import_csv',         public.has_role(p.user_id, 'admin') OR public.has_role(p.user_id, 'call_center'),
      'view_dashboard',     public.has_role(p.user_id, 'admin') OR public.has_role(p.user_id, 'surgeon') OR public.has_role(p.user_id, 'call_center'),
      'manage_users',       public.has_role(p.user_id, 'admin')
    ) AS caps
  FROM public.profiles p
)
INSERT INTO public.user_capabilities (user_id, caps)
SELECT user_id, caps FROM role_caps
ON CONFLICT (user_id) DO NOTHING;
