-- Explicitly remove anonymous execution from every exposed write RPC.
-- The application uses authenticated sessions; each SECURITY DEFINER function
-- performs its own role check before changing data.
revoke execute on function public.zaro_apply_inventory_movement(text, text, integer, text, date) from public, anon;
revoke execute on function public.zaro_seed(jsonb) from public, anon;
revoke execute on function public.zaro_update_section(text, jsonb) from public, anon;
revoke execute on function public.zaro_set_user_role(uuid, text) from public, anon;

-- This legacy helper is not used by the application and should not be exposed.
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'current_user_role' and pg_get_function_identity_arguments(p.oid) = '') then
    revoke all on function public.current_user_role() from public, anon, authenticated;
  end if;
end $$;

-- Re-grant only the authenticated calls that the application actually uses.
grant execute on function public.zaro_apply_inventory_movement(text, text, integer, text, date) to authenticated;
grant execute on function public.zaro_seed(jsonb) to authenticated;
grant execute on function public.zaro_update_section(text, jsonb) to authenticated;
grant execute on function public.zaro_set_user_role(uuid, text) to authenticated;
