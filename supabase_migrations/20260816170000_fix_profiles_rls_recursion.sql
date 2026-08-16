-- Fix infinite recursion in profiles SELECT policy.
-- The policy must not query public.profiles directly. This helper runs as
-- the function owner, then the policy calls the helper without self-reference.
create or replace function public.is_current_user_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'owner'
  );
$$;

revoke all on function public.is_current_user_owner() from public, anon;
grant execute on function public.is_current_user_owner() to authenticated;

alter table public.profiles enable row level security;
drop policy if exists "authenticated reads own or owner-visible profiles" on public.profiles;
drop policy if exists "read own profile" on public.profiles;
drop policy if exists "owner reads all profiles" on public.profiles;
drop policy if exists "profiles are viewable by any authenticated user" on public.profiles;

create policy "authenticated reads own or owner-visible profiles"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or public.is_current_user_owner()
);
