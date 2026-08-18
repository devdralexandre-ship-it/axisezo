REVOKE EXECUTE ON FUNCTION public.current_is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_assigned_only() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_broad_scope() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_scope_surgeon_name() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_assigned_only() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_broad_scope() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_scope_surgeon_name() TO authenticated;