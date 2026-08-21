-- 1) patients: only admins may change assigned_user_ids
DROP POLICY IF EXISTS "Scoped update patients" ON public.patients;
CREATE POLICY "Scoped update patients" ON public.patients
FOR UPDATE
USING (public.can_access_patient(id))
WITH CHECK (
  public.can_access_patient(id)
  AND (
    public.current_is_admin()
    OR assigned_user_ids = (SELECT p.assigned_user_ids FROM public.patients p WHERE p.id = patients.id)
  )
);

-- 2) patient_notes: re-validate patient access on edit
DROP POLICY IF EXISTS "notes_update_own_recent" ON public.patient_notes;
CREATE POLICY "notes_update_own_recent" ON public.patient_notes
FOR UPDATE
USING (author_user_id = auth.uid() AND created_at > (now() - interval '2 hours'))
WITH CHECK (author_user_id = auth.uid() AND public.can_access_patient(patient_id));

-- 3) patient_documents: signature attribution must match the acting user
DROP POLICY IF EXISTS "Scoped update patient documents" ON public.patient_documents;
CREATE POLICY "Scoped update patient documents" ON public.patient_documents
FOR UPDATE
USING (public.can_access_patient(patient_id))
WITH CHECK (
  public.can_access_patient(patient_id)
  AND (
    public.current_is_admin()
    OR (
      (signed_by IS NULL OR signed_by = auth.uid())
      AND (signature_authorized_by IS NULL OR signature_authorized_by = auth.uid())
    )
  )
);