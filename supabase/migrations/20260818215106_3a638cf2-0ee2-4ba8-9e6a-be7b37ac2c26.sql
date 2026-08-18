-- 1) Arg-less scope helpers (evaluated once per query as InitPlan)
CREATE OR REPLACE FUNCTION public.current_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.current_assigned_only()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT NOT public.current_is_admin()
     AND COALESCE((SELECT (caps ->> 'assigned_only')::boolean FROM public.user_capabilities WHERE user_id = auth.uid()), false)
$$;

-- true when the user has broad (all-patients) read scope
CREATE OR REPLACE FUNCTION public.current_broad_scope()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.current_is_admin()
     OR (
       NOT public.current_assigned_only()
       AND EXISTS (
         SELECT 1 FROM public.user_roles
         WHERE user_id = auth.uid()
           AND role IN ('call_center','intern','concierge')
       )
     )
$$;

-- surgeon name only when the user actually holds the surgeon role and is not assigned_only
CREATE OR REPLACE FUNCTION public.current_scope_surgeon_name()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN public.current_assigned_only() THEN NULL
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'surgeon')
      THEN (SELECT surgeon_name FROM public.profiles WHERE user_id = auth.uid() AND active = true LIMIT 1)
    ELSE NULL
  END
$$;

GRANT EXECUTE ON FUNCTION public.current_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_assigned_only() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_broad_scope() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_scope_surgeon_name() TO authenticated;

-- 2) Row-level predicate for a patient row, using arg-less scope
CREATE OR REPLACE FUNCTION public.patient_row_visible(_assigned uuid[], _surgeon text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT false
$$;
DROP FUNCTION IF EXISTS public.patient_row_visible(uuid[], text);

-- 3) Rewrite SELECT policies
DROP POLICY IF EXISTS "Scoped select patients" ON public.patients;
CREATE POLICY "Scoped select patients" ON public.patients
FOR SELECT TO authenticated
USING (
  public.current_broad_scope()
  OR (public.current_assigned_only() AND auth.uid() = ANY(assigned_user_ids))
  OR (surgeon = public.current_scope_surgeon_name())
);

DROP POLICY IF EXISTS "Scoped select tasks" ON public.tasks;
CREATE POLICY "Scoped select tasks" ON public.tasks
FOR SELECT TO authenticated
USING (
  public.current_broad_scope()
  OR EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = tasks.patient_id
      AND (
        (public.current_assigned_only() AND auth.uid() = ANY(p.assigned_user_ids))
        OR p.surgeon = public.current_scope_surgeon_name()
      )
  )
);

DROP POLICY IF EXISTS "Scoped select contacts" ON public.contact_records;
CREATE POLICY "Scoped select contacts" ON public.contact_records
FOR SELECT TO authenticated
USING (
  public.current_broad_scope()
  OR EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = contact_records.patient_id
      AND (
        (public.current_assigned_only() AND auth.uid() = ANY(p.assigned_user_ids))
        OR p.surgeon = public.current_scope_surgeon_name()
      )
  )
);

DROP POLICY IF EXISTS "Scoped select checklist" ON public.preop_checklist_items;
CREATE POLICY "Scoped select checklist" ON public.preop_checklist_items
FOR SELECT TO authenticated
USING (
  public.current_broad_scope()
  OR EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = preop_checklist_items.patient_id
      AND (
        (public.current_assigned_only() AND auth.uid() = ANY(p.assigned_user_ids))
        OR p.surgeon = public.current_scope_surgeon_name()
      )
  )
);

DROP POLICY IF EXISTS "Scoped select pending" ON public.pending_items;
CREATE POLICY "Scoped select pending" ON public.pending_items
FOR SELECT TO authenticated
USING (
  public.current_broad_scope()
  OR EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = pending_items.patient_id
      AND (
        (public.current_assigned_only() AND auth.uid() = ANY(p.assigned_user_ids))
        OR p.surgeon = public.current_scope_surgeon_name()
      )
  )
);

-- 4) Indexes
CREATE INDEX IF NOT EXISTS idx_pending_items_patient_id ON public.pending_items (patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_created_at_desc ON public.patients (created_at DESC);
