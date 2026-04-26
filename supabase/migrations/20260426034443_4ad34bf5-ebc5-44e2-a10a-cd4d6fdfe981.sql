
-- =====================================================================
-- 1. Estender profiles com identidade operacional
-- =====================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS surgeon_name text,
  ADD COLUMN IF NOT EXISTS concierge_name text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- =====================================================================
-- 2. Funções SECURITY DEFINER (evita recursão de RLS)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.current_surgeon_name()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT surgeon_name FROM public.profiles
  WHERE user_id = auth.uid() AND active = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_concierge_name()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT concierge_name FROM public.profiles
  WHERE user_id = auth.uid() AND active = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.can_access_patient(_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'call_center')
    OR EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = _patient_id AND (
        (public.has_role(auth.uid(), 'surgeon')   AND p.surgeon   = public.current_surgeon_name())
        OR (public.has_role(auth.uid(), 'concierge') AND p.concierge = public.current_concierge_name())
      )
    )
$$;

-- =====================================================================
-- 3. RLS: profiles (admin pode ver todos)
-- =====================================================================
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Admin pode atualizar/inserir qualquer profile (para o painel admin)
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert any profile" ON public.profiles;
CREATE POLICY "Admins can insert any profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================================
-- 4. RLS: patients
-- =====================================================================
DROP POLICY IF EXISTS "Authenticated users can view patients" ON public.patients;
DROP POLICY IF EXISTS "Authenticated users can insert patients" ON public.patients;
DROP POLICY IF EXISTS "Authenticated users can update patients" ON public.patients;
DROP POLICY IF EXISTS "Authenticated users can delete patients" ON public.patients;

CREATE POLICY "Scoped select patients"
  ON public.patients FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'call_center')
    OR (public.has_role(auth.uid(), 'surgeon')   AND surgeon   = public.current_surgeon_name())
    OR (public.has_role(auth.uid(), 'concierge') AND concierge = public.current_concierge_name())
  );

CREATE POLICY "Scoped insert patients"
  ON public.patients FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'call_center')
    OR (public.has_role(auth.uid(), 'surgeon')   AND surgeon   = public.current_surgeon_name())
    OR (public.has_role(auth.uid(), 'concierge') AND concierge = public.current_concierge_name())
  );

CREATE POLICY "Scoped update patients"
  ON public.patients FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'call_center')
    OR (public.has_role(auth.uid(), 'surgeon')   AND surgeon   = public.current_surgeon_name())
    OR (public.has_role(auth.uid(), 'concierge') AND concierge = public.current_concierge_name())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'call_center')
    OR (public.has_role(auth.uid(), 'surgeon')   AND surgeon   = public.current_surgeon_name())
    OR (public.has_role(auth.uid(), 'concierge') AND concierge = public.current_concierge_name())
  );

CREATE POLICY "Admins can delete patients"
  ON public.patients FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================================
-- 5. RLS: tasks, contact_records, pending_items, preop_checklist_items, patient_documents
--    (todas usam can_access_patient(patient_id))
-- =====================================================================

-- tasks
DROP POLICY IF EXISTS "Authenticated users can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can delete tasks" ON public.tasks;
CREATE POLICY "Scoped select tasks" ON public.tasks FOR SELECT TO authenticated
  USING (public.can_access_patient(patient_id));
CREATE POLICY "Scoped insert tasks" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.can_access_patient(patient_id));
CREATE POLICY "Scoped update tasks" ON public.tasks FOR UPDATE TO authenticated
  USING (public.can_access_patient(patient_id))
  WITH CHECK (public.can_access_patient(patient_id));
CREATE POLICY "Scoped delete tasks" ON public.tasks FOR DELETE TO authenticated
  USING (public.can_access_patient(patient_id));

-- contact_records
DROP POLICY IF EXISTS "Authenticated users can view contacts" ON public.contact_records;
DROP POLICY IF EXISTS "Authenticated users can insert contacts" ON public.contact_records;
DROP POLICY IF EXISTS "Authenticated users can delete contacts" ON public.contact_records;
CREATE POLICY "Scoped select contacts" ON public.contact_records FOR SELECT TO authenticated
  USING (public.can_access_patient(patient_id));
CREATE POLICY "Scoped insert contacts" ON public.contact_records FOR INSERT TO authenticated
  WITH CHECK (public.can_access_patient(patient_id));
CREATE POLICY "Scoped delete contacts" ON public.contact_records FOR DELETE TO authenticated
  USING (public.can_access_patient(patient_id));

-- pending_items
DROP POLICY IF EXISTS "Authenticated users can view pending items" ON public.pending_items;
DROP POLICY IF EXISTS "Authenticated users can insert pending items" ON public.pending_items;
DROP POLICY IF EXISTS "Authenticated users can update pending items" ON public.pending_items;
DROP POLICY IF EXISTS "Authenticated users can delete pending items" ON public.pending_items;
CREATE POLICY "Scoped select pending" ON public.pending_items FOR SELECT TO authenticated
  USING (public.can_access_patient(patient_id));
CREATE POLICY "Scoped insert pending" ON public.pending_items FOR INSERT TO authenticated
  WITH CHECK (public.can_access_patient(patient_id));
CREATE POLICY "Scoped update pending" ON public.pending_items FOR UPDATE TO authenticated
  USING (public.can_access_patient(patient_id))
  WITH CHECK (public.can_access_patient(patient_id));
CREATE POLICY "Scoped delete pending" ON public.pending_items FOR DELETE TO authenticated
  USING (public.can_access_patient(patient_id));

-- preop_checklist_items
DROP POLICY IF EXISTS "Authenticated users can view checklist" ON public.preop_checklist_items;
DROP POLICY IF EXISTS "Authenticated users can insert checklist" ON public.preop_checklist_items;
DROP POLICY IF EXISTS "Authenticated users can update checklist" ON public.preop_checklist_items;
DROP POLICY IF EXISTS "Authenticated users can delete checklist items" ON public.preop_checklist_items;
CREATE POLICY "Scoped select checklist" ON public.preop_checklist_items FOR SELECT TO authenticated
  USING (public.can_access_patient(patient_id));
CREATE POLICY "Scoped insert checklist" ON public.preop_checklist_items FOR INSERT TO authenticated
  WITH CHECK (public.can_access_patient(patient_id));
CREATE POLICY "Scoped update checklist" ON public.preop_checklist_items FOR UPDATE TO authenticated
  USING (public.can_access_patient(patient_id))
  WITH CHECK (public.can_access_patient(patient_id));
CREATE POLICY "Scoped delete checklist" ON public.preop_checklist_items FOR DELETE TO authenticated
  USING (public.can_access_patient(patient_id));

-- patient_documents
DROP POLICY IF EXISTS "Authenticated can view patient documents" ON public.patient_documents;
DROP POLICY IF EXISTS "Authenticated can insert patient documents" ON public.patient_documents;
DROP POLICY IF EXISTS "Authenticated can update patient documents" ON public.patient_documents;
DROP POLICY IF EXISTS "Authenticated can delete patient documents" ON public.patient_documents;
CREATE POLICY "Scoped select patient documents" ON public.patient_documents FOR SELECT TO authenticated
  USING (public.can_access_patient(patient_id));
CREATE POLICY "Scoped insert patient documents" ON public.patient_documents FOR INSERT TO authenticated
  WITH CHECK (public.can_access_patient(patient_id));
CREATE POLICY "Scoped update patient documents" ON public.patient_documents FOR UPDATE TO authenticated
  USING (public.can_access_patient(patient_id))
  WITH CHECK (public.can_access_patient(patient_id));
CREATE POLICY "Scoped delete patient documents" ON public.patient_documents FOR DELETE TO authenticated
  USING (public.can_access_patient(patient_id));

-- =====================================================================
-- 6. View sem dados financeiros (para call_center)
-- =====================================================================
DROP VIEW IF EXISTS public.patients_no_financials;
CREATE VIEW public.patients_no_financials
WITH (security_invoker=on) AS
SELECT
  id, name, age, patient_type, procedure_name, procedure_category,
  surgical_approach, laterality, surgeon, concierge, owner, stage,
  stage_entered_at, decision_status, last_interaction_date,
  next_follow_up_date, phone, email, indication_date, indication_location,
  payer, responsible_contact, desired_hospital, notes, alerts,
  loss_reason, loss_reason_detail, created_at, updated_at,
  NULL::numeric AS estimated_value,
  NULL::numeric AS medical_fees,
  NULL::numeric AS anesthesia_fees,
  NULL::numeric AS hospital_budget,
  NULL::numeric AS materials_cost,
  NULL::text    AS billing_type
FROM public.patients;

GRANT SELECT ON public.patients_no_financials TO authenticated;
