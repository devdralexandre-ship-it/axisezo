
CREATE OR REPLACE FUNCTION public.merge_patients(_keep uuid, _remove uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'only admin can merge patients';
  END IF;
  IF _keep IS NULL OR _remove IS NULL OR array_length(_remove, 1) IS NULL THEN
    RAISE EXCEPTION 'invalid arguments';
  END IF;
  IF _keep = ANY(_remove) THEN
    RAISE EXCEPTION 'keep id cannot be in remove list';
  END IF;

  UPDATE public.contact_records         SET patient_id = _keep WHERE patient_id = ANY(_remove);
  UPDATE public.patient_documents       SET patient_id = _keep WHERE patient_id = ANY(_remove);
  UPDATE public.patient_uploads         SET patient_id = _keep WHERE patient_id = ANY(_remove);
  UPDATE public.patient_sent_materials  SET patient_id = _keep WHERE patient_id = ANY(_remove);
  UPDATE public.pending_items           SET patient_id = _keep WHERE patient_id = ANY(_remove);
  UPDATE public.preop_checklist_items   SET patient_id = _keep WHERE patient_id = ANY(_remove);
  UPDATE public.tasks                   SET patient_id = _keep WHERE patient_id = ANY(_remove);
  UPDATE public.signature_audit_log     SET patient_id = _keep WHERE patient_id = ANY(_remove);

  DELETE FROM public.patients WHERE id = ANY(_remove);
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_patients(uuid, uuid[]) TO authenticated;
