
-- Identidades operacionais
UPDATE public.profiles SET surgeon_name='Dr Alexandre Ziomkowski' WHERE user_id='7d20f48e-f27e-45f8-ac4b-285fcd0f6a07';
UPDATE public.profiles SET surgeon_name='Yuri Motta'              WHERE user_id='38486fed-7854-4626-b2b1-12042baf55d4';
UPDATE public.profiles SET surgeon_name='Ramon Campos Nascimento' WHERE user_id='70c19d43-acaf-482c-a28e-e606361800a6';
UPDATE public.profiles SET surgeon_name='Lauro Almeida'           WHERE user_id='b93a8d57-d925-4155-8c09-5e578d499dc3';
UPDATE public.profiles SET surgeon_name='Dr João Estrela'         WHERE user_id='dd3c853b-1873-466c-8839-7b497df40d48';
UPDATE public.profiles SET concierge_name='Margô'                 WHERE user_id='42732a6b-8dac-4b3e-85f3-a0ca9e0f2ef8';
UPDATE public.profiles SET active=false                            WHERE user_id='a79910a3-effa-48de-bc63-e1613e886c48';

-- =====================================================================
-- Restringir mutações em document_templates a admin/surgeon
-- =====================================================================
DROP POLICY IF EXISTS "Authenticated can insert templates" ON public.document_templates;
DROP POLICY IF EXISTS "Authenticated can update templates" ON public.document_templates;
DROP POLICY IF EXISTS "Authenticated can delete templates" ON public.document_templates;

CREATE POLICY "Admin and surgeon can insert templates"
  ON public.document_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'surgeon'));
CREATE POLICY "Admin and surgeon can update templates"
  ON public.document_templates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'surgeon'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'surgeon'));
CREATE POLICY "Admin can delete templates"
  ON public.document_templates FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================================
-- Restringir mutações em procedure_code_suggestions a usuários com papel definido
-- (qualquer cirurgião, concierge, call_center ou admin pode contribuir)
-- =====================================================================
DROP POLICY IF EXISTS "Authenticated can insert suggestions" ON public.procedure_code_suggestions;
DROP POLICY IF EXISTS "Authenticated can update suggestions" ON public.procedure_code_suggestions;
DROP POLICY IF EXISTS "Authenticated can delete suggestions" ON public.procedure_code_suggestions;

CREATE POLICY "Roled users can insert suggestions"
  ON public.procedure_code_suggestions FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'surgeon')
    OR public.has_role(auth.uid(), 'concierge')
    OR public.has_role(auth.uid(), 'call_center')
  );
CREATE POLICY "Roled users can update suggestions"
  ON public.procedure_code_suggestions FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'surgeon')
    OR public.has_role(auth.uid(), 'concierge')
    OR public.has_role(auth.uid(), 'call_center')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'surgeon')
    OR public.has_role(auth.uid(), 'concierge')
    OR public.has_role(auth.uid(), 'call_center')
  );
CREATE POLICY "Admin can delete suggestions"
  ON public.procedure_code_suggestions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
