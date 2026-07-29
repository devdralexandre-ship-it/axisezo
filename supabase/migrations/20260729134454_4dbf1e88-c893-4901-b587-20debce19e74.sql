
-- 1) Restrict profiles SELECT to self + admins
DROP POLICY IF EXISTS "Authenticated view profiles minimal" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles self or admin read" ON public.profiles;

CREATE POLICY "Profiles self or admin read"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 2) Security-definer lookup used by public professional-profile pages
CREATE OR REPLACE FUNCTION public.get_user_id_by_surgeon_name(_surgeon_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.profiles
   WHERE surgeon_name = _surgeon_name AND active = true
   LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_surgeon_name(text) TO authenticated, anon;

-- 3) Scope Kanban realtime topic per-user
DROP POLICY IF EXISTS "Authenticated users can read realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can send realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Kanban realtime read own topic" ON realtime.messages;
DROP POLICY IF EXISTS "Kanban realtime write own topic" ON realtime.messages;

CREATE POLICY "Kanban realtime read own topic"
ON realtime.messages FOR SELECT TO authenticated
USING (realtime.topic() = 'kanban-realtime:' || auth.uid()::text);

CREATE POLICY "Kanban realtime write own topic"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (realtime.topic() = 'kanban-realtime:' || auth.uid()::text);
