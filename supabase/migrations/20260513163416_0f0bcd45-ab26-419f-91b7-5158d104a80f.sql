
-- SLA columns on tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS sla_hours integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_breached_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalate_after_hours integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalated_to text,
  ADD COLUMN IF NOT EXISTS escalation_reason text;

-- Backfill sla_due_at
UPDATE public.tasks
SET sla_due_at = created_at + (sla_hours || ' hours')::interval
WHERE sla_due_at IS NULL;

-- Trigger to auto-set sla_due_at on insert/update of sla_hours
CREATE OR REPLACE FUNCTION public.set_task_sla_due_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.sla_due_at IS NULL OR (TG_OP = 'UPDATE' AND NEW.sla_hours IS DISTINCT FROM OLD.sla_hours) THEN
    NEW.sla_due_at := COALESCE(NEW.created_at, now()) + (NEW.sla_hours || ' hours')::interval;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_sla_due_at ON public.tasks;
CREATE TRIGGER trg_task_sla_due_at
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_task_sla_due_at();

CREATE INDEX IF NOT EXISTS idx_tasks_sla_open
  ON public.tasks (sla_due_at)
  WHERE completed = false;

-- SLA policies table
CREATE TABLE IF NOT EXISTS public.sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preset text NOT NULL,
  responsible text,
  sla_hours integer NOT NULL DEFAULT 24,
  escalate_after_hours integer NOT NULL DEFAULT 24,
  escalate_to_role text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (preset, responsible)
);

ALTER TABLE public.sla_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read sla_policies"
ON public.sla_policies FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admin manage sla_policies"
ON public.sla_policies FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_sla_policies_updated_at
BEFORE UPDATE ON public.sla_policies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
