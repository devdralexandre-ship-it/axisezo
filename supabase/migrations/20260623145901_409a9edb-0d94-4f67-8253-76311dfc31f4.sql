-- Recompute sla_due_at as: deadline (due_date + due_time) + tolerance hours (stored in sla_hours)
-- Previously it was created_at + sla_hours. Now sla_hours represents the GRACE PERIOD ("Tolerância") after the deadline.
CREATE OR REPLACE FUNCTION public.set_task_sla_due_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _deadline timestamptz;
BEGIN
  -- Compose the hard deadline. Treat stored date+time as America/Sao_Paulo wall time.
  _deadline := ((NEW.due_date::text || ' ' || COALESCE(NEW.due_time::text, '10:00:00'))::timestamp AT TIME ZONE 'America/Sao_Paulo');
  NEW.sla_due_at := _deadline + (COALESCE(NEW.sla_hours, 24) || ' hours')::interval;
  -- Force escalation policy to 24h after tolerance expires.
  IF NEW.escalate_after_hours IS DISTINCT FROM 24 THEN
    NEW.escalate_after_hours := 24;
  END IF;
  RETURN NEW;
END;
$function$;

-- Ensure trigger is present on tasks for both INSERT and UPDATE
DROP TRIGGER IF EXISTS trg_set_task_sla_due_at ON public.tasks;
CREATE TRIGGER trg_set_task_sla_due_at
BEFORE INSERT OR UPDATE OF due_date, due_time, sla_hours ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_task_sla_due_at();

-- Backfill open tasks with the new formula
UPDATE public.tasks
SET sla_due_at = (((due_date::text || ' ' || COALESCE(due_time::text, '10:00:00'))::timestamp AT TIME ZONE 'America/Sao_Paulo')
                  + (COALESCE(sla_hours, 24) || ' hours')::interval),
    escalate_after_hours = 24
WHERE completed = false;