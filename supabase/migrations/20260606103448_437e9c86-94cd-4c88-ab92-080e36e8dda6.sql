DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['patients','tasks','contact_records','preop_checklist_items','pending_items','patient_uploads','patient_documents']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;