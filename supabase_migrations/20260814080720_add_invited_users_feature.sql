-- Pre-assign a role to an email before the user creates an account.
-- Only owners can create, update, read, or delete invitations.

create table if not exists public.invited_users (
  email text primary key check (email = lower(email)),
  role text not null check (role in ('owner', 'accountant', 'viewer')),
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists invited_users_invited_by_idx
  on public.invited_users (invited_by);

alter table public.invited_users enable row level security;

drop policy if exists "owner manages invites" on public.invited_users;
create policy "owner manages invites" on public.invited_users
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invited_role text;
begin
  select role into v_invited_role
  from public.invited_users
  where email = lower(new.email);

  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', coalesce(v_invited_role, 'pending'))
  on conflict (id) do nothing;

  if v_invited_role is not null then
    delete from public.invited_users where email = lower(new.email);
  end if;

  return new;
end;
$$;
