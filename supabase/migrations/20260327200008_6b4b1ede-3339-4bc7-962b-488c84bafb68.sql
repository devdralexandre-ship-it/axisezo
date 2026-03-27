
DROP POLICY IF EXISTS "Authenticated users can delete patients" ON public.patients;
CREATE POLICY "Authenticated users can delete patients"
ON public.patients FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete checklist items"
ON public.preop_checklist_items FOR DELETE TO authenticated USING (true);
