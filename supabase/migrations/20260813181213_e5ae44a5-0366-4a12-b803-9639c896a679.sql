
-- 1. Remove shared, unscoped Kanban realtime topic policies (per-user topic policies remain)
DROP POLICY IF EXISTS "Kanban realtime read" ON realtime.messages;
DROP POLICY IF EXISTS "Kanban realtime send" ON realtime.messages;

-- 2. Restrict document template reads to roles that generate documents
DROP POLICY IF EXISTS "Authenticated can view templates" ON public.document_templates;
CREATE POLICY "Roled users can view templates"
ON public.document_templates FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'surgeon')
  OR public.has_role(auth.uid(), 'concierge')
);

-- 3. Restrict procedure default billing codes to the same roles
DROP POLICY IF EXISTS "Authenticated view default codes" ON public.procedure_default_codes;
CREATE POLICY "Roled users view default codes"
ON public.procedure_default_codes FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'surgeon')
  OR public.has_role(auth.uid(), 'concierge')
);
