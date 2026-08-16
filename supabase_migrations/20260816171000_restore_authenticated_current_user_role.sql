-- The current application still calls this helper during data loading.
-- Keep it unavailable to anonymous users, but allow signed-in sessions to use it.
revoke execute on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated;
