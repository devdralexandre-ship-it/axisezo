CREATE TABLE public.task_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  max_hours integer NOT NULL DEFAULT 48,
  default_tolerance_hours integer NOT NULL DEFAULT 24,
  active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.task_types TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.task_types TO authenticated;
GRANT ALL ON public.task_types TO service_role;

ALTER TABLE public.task_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_types_select_authenticated" ON public.task_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "task_types_insert_admin" ON public.task_types
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "task_types_update_admin" ON public.task_types
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "task_types_delete_admin" ON public.task_types
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_task_types_updated_at
  BEFORE UPDATE ON public.task_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.task_types (name, max_hours, default_tolerance_hours, position) VALUES
  ('Ligar para o paciente', 24, 24, 10),
  ('Enviar orçamento / material', 24, 24, 20),
  ('Confirmar agendamento', 24, 24, 30),
  ('Atualizar etapa no follow-up', 24, 24, 40),
  ('Consultar convênio', 48, 24, 50),
  ('Consultar hospital', 48, 24, 60),
  ('Checar documentos', 48, 24, 70),
  ('Emitir documentos', 48, 24, 80),
  ('Solicitar exames / laudos', 72, 24, 90),
  ('Outro (genérico)', 48, 24, 100);

ALTER TABLE public.tasks
  ADD COLUMN task_type_id uuid REFERENCES public.task_types(id) ON DELETE SET NULL,
  ADD COLUMN deadline_override_reason text,
  ADD COLUMN deadline_override_by uuid,
  ADD COLUMN deadline_override_at timestamptz;

CREATE OR REPLACE FUNCTION public.enforce_task_deadline_cap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  _max_hours integer;
  _tolerance integer;
  _deadline timestamptz;
  _base timestamptz;
  _cap timestamptz;
  _reason text;
BEGIN
  IF NEW.task_type_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT max_hours, default_tolerance_hours INTO _max_hours, _tolerance
  FROM public.task_types WHERE id = NEW.task_type_id;

  IF _max_hours IS NULL THEN
    RETURN NEW;
  END IF;

  _deadline := ((NEW.due_date::text || ' ' || COALESCE(NEW.due_time::text, '10:00:00'))::timestamp AT TIME ZONE 'America/Sao_Paulo');
  _base := COALESCE(NEW.created_at, now());
  _cap := _base + (_max_hours || ' hours')::interval;

  _reason := NULLIF(btrim(COALESCE(NEW.deadline_override_reason, '')), '');

  IF _deadline > _cap THEN
    IF _reason IS NULL THEN
      RAISE EXCEPTION 'Prazo acima do limite de % horas para este tipo de ação. Informe uma justificativa para estender o prazo.', _max_hours;
    END IF;
    NEW.deadline_override_reason := _reason;
    IF NEW.deadline_override_by IS NULL THEN
      NEW.deadline_override_by := auth.uid();
    END IF;
    IF NEW.deadline_override_at IS NULL THEN
      NEW.deadline_override_at := now();
    END IF;
  ELSE
    NEW.deadline_override_reason := NULL;
    NEW.deadline_override_by := NULL;
    NEW.deadline_override_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_task_deadline_cap
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_task_deadline_cap();