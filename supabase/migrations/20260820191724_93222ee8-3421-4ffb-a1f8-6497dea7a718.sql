ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS scope_surgeons text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.current_scope_surgeons()
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN public.current_is_admin() THEN '{}'::text[]
    ELSE COALESCE((SELECT scope_surgeons FROM public.profiles
                    WHERE user_id = auth.uid() AND active = true LIMIT 1), '{}'::text[])
  END
$$;

CREATE OR REPLACE FUNCTION public.current_has_surgeon_scope()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_length(public.current_scope_surgeons(), 1), 0) > 0
$$;

CREATE OR REPLACE FUNCTION public.current_broad_scope()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.current_is_admin()
     OR (
       NOT public.current_assigned_only()
       AND NOT public.current_has_surgeon_scope()
       AND EXISTS (
         SELECT 1 FROM public.user_roles
         WHERE user_id = auth.uid()
           AND role IN ('call_center','intern','concierge')
       )
     )
$$;

CREATE OR REPLACE FUNCTION public.can_access_patient(_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.current_is_admin()
    OR (
      public.current_assigned_only()
      AND EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = _patient_id AND auth.uid() = ANY(p.assigned_user_ids)
      )
    )
    OR (
      NOT public.current_assigned_only()
      AND EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = _patient_id
          AND (
            CASE WHEN public.current_has_surgeon_scope()
              THEN p.surgeon = ANY(public.current_scope_surgeons())
              ELSE (
                public.has_role(auth.uid(), 'call_center')
                OR public.has_role(auth.uid(), 'intern')
                OR public.has_role(auth.uid(), 'concierge')
                OR (public.has_role(auth.uid(), 'surgeon') AND p.surgeon = public.current_surgeon_name())
              )
            END
          )
      )
    )
$$;

DROP POLICY IF EXISTS "Scoped select patients" ON public.patients;
CREATE POLICY "Scoped select patients" ON public.patients
FOR SELECT TO authenticated
USING (
  public.current_broad_scope()
  OR (public.current_assigned_only() AND auth.uid() = ANY(assigned_user_ids))
  OR (public.current_has_surgeon_scope()
      AND NOT public.current_assigned_only()
      AND surgeon = ANY(public.current_scope_surgeons()))
  OR (NOT public.current_has_surgeon_scope() AND surgeon = public.current_scope_surgeon_name())
);

DROP POLICY IF EXISTS "Scoped insert patients" ON public.patients;
CREATE POLICY "Scoped insert patients" ON public.patients
FOR INSERT TO authenticated
WITH CHECK (
  public.current_is_admin()
  OR (
    (NOT public.current_has_surgeon_scope() OR surgeon = ANY(public.current_scope_surgeons()))
    AND (
      public.has_role(auth.uid(), 'call_center')
      OR public.has_role(auth.uid(), 'intern')
      OR (public.has_role(auth.uid(), 'surgeon') AND surgeon = public.current_surgeon_name())
      OR (public.has_role(auth.uid(), 'concierge') AND concierge = public.current_concierge_name())
    )
  )
);

CREATE OR REPLACE FUNCTION public.staff_names()
RETURNS TABLE(surgeon_name text, concierge_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.surgeon_name, p.concierge_name
  FROM public.profiles p
  WHERE p.active = true
    AND (p.surgeon_name IS NOT NULL OR p.concierge_name IS NOT NULL)
    AND auth.uid() IS NOT NULL
$$;

GRANT EXECUTE ON FUNCTION public.staff_names() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_scope_surgeons() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_has_surgeon_scope() TO authenticated;