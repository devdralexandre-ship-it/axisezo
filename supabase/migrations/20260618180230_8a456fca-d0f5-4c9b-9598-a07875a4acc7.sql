-- Concierges sem 'assigned_only' passam a ver todos os pacientes (portfólio compartilhado),
-- equiparando o acesso de Íris ao de Margô.
CREATE OR REPLACE FUNCTION public.can_access_patient(_patient_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        OR public.has_role(auth.uid(), 'concierge')
        OR EXISTS (
          SELECT 1 FROM public.patients p
          WHERE p.id = _patient_id AND (
            public.has_role(auth.uid(), 'surgeon') AND p.surgeon = public.current_surgeon_name()
          )
        )
      )
    )
$function$;