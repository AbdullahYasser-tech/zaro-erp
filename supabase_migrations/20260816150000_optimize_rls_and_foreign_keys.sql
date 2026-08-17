-- Consolidate profile SELECT policies to avoid repeated permissive policy evaluation.
drop policy if exists "read own profile" on public.profiles;
drop policy if exists "owner reads all profiles" on public.profiles;
drop policy if exists "profiles are viewable by any authenticated user" on public.profiles;
create policy "authenticated reads own or owner-visible profiles" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'owner'
    )
  );

-- Keep invitation management owner-only while avoiding per-row auth re-evaluation.
drop policy if exists "owner manages invites" on public.invited_users;
create policy "owner manages invites" on public.invited_users
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'owner'
    )
  );

create index if not exists invited_users_invited_by_idx
  on public.invited_users (invited_by);
