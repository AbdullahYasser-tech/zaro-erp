-- Apply to the hosted Supabase project. Keeps existing users and roles intact.
drop policy if exists "profiles are viewable by any authenticated user" on public.profiles;
drop policy if exists "owner updates profiles" on public.profiles;
drop policy if exists "owner and accountant insert state" on public.zaro_state;
drop policy if exists "owner and accountant update state" on public.zaro_state;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'pending')
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.zaro_seed(jsonb) from public;
revoke execute on function public.zaro_set_user_role(uuid, text) from public;
revoke execute on function public.zaro_update_section(text, jsonb) from public;
grant execute on function public.zaro_seed(jsonb) to authenticated;
grant execute on function public.zaro_set_user_role(uuid, text) to authenticated;
grant execute on function public.zaro_update_section(text, jsonb) to authenticated;
