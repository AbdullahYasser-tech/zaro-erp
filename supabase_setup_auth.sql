-- شغّل الكود ده كامل في Supabase SQL Editor (بعد supabase_setup.sql) —
-- ده اللي بيضيف تسجيل الدخول بجوجل ونظام الصلاحيات (أونر / محاسب / مشاهدة فقط)

-- 1) profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'pending' check (role in ('pending','owner','accountant','viewer')),
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "owner reads all profiles" on public.profiles;
create policy "owner reads all profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner')
  );

-- لا تسمح بتعديل profiles مباشرة من المتصفح. تغيير الصلاحيات يتم فقط عبر RPC
-- تتحقق من أن المستدعي هو Owner.
drop policy if exists "owner updates profiles" on public.profiles;
drop policy if exists "profiles are viewable by any authenticated user" on public.profiles;

-- 2) optional pre-invitations: an owner can assign a role before signup
create table if not exists public.invited_users (
  email text primary key check (email = lower(email)),
  role text not null check (role in ('owner','accountant','viewer')),
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists invited_users_invited_by_idx on public.invited_users(invited_by);
alter table public.invited_users enable row level security;
drop policy if exists "owner manages invites" on public.invited_users;
create policy "owner manages invites" on public.invited_users
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner'));

-- 3) auto-create a profile row whenever someone signs in for the first time
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_invited_role text;
begin
  select role into v_invited_role from public.invited_users where email = lower(new.email);
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', coalesce(v_invited_role, 'pending'))
  on conflict (id) do nothing;
  if v_invited_role is not null then
    delete from public.invited_users where email = lower(new.email);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3) lock down zaro_state: only approved users can read; no direct client-side update allowed
drop policy if exists "allow all read" on public.zaro_state;
drop policy if exists "allow all update" on public.zaro_state;

create policy "approved users read state" on public.zaro_state
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner','accountant','viewer')
    )
  );

-- 4) section-based write RPC — this is what actually enforces "accountant can only touch orders/collections"
create or replace function public.zaro_update_section(p_section text, p_payload jsonb)
returns void as $$
declare
  v_role text;
  v_allowed boolean := false;
begin
  select role into v_role from public.profiles where id = auth.uid();

  if v_role = 'owner' then
    v_allowed := true;
  elsif v_role = 'accountant' and p_section in ('orders','collections') then
    v_allowed := true;
  end if;

  if not v_allowed then
    raise exception 'ليس لديك صلاحية لتعديل هذا القسم';
  end if;

  update public.zaro_state
  set data = jsonb_set(data, array[p_section], p_payload),
      updated_at = now()
  where id = 1;
end;
$$ language plpgsql security definer set search_path = public;

-- 5) owner-only seed RPC (used once to populate default data)
create or replace function public.zaro_seed(p_data jsonb)
returns void as $$
declare
  v_role text;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role <> 'owner' then
    raise exception 'فقط الأونر يقدر يعمل seed للبيانات';
  end if;
  update public.zaro_state
  set data = p_data, updated_at = now()
  where id = 1 and (data = '{}'::jsonb or data is null);
end;
$$ language plpgsql security definer set search_path = public;

-- 6) owner-only RPC to approve users / change roles
create or replace function public.zaro_set_user_role(p_user_id uuid, p_role text)
returns void as $$
declare
  v_caller_role text;
begin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role <> 'owner' then
    raise exception 'فقط الأونر يقدر يغيّر صلاحيات المستخدمين';
  end if;
  if p_role not in ('pending','owner','accountant','viewer') then
    raise exception 'صلاحية غير معروفة';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
end;
$$ language plpgsql security definer set search_path = public;

-- لا تمنح التنفيذ تلقائياً لأي دور؛ فقط المستخدم المسجل يحتاج هذه الدوال.
revoke execute on function public.zaro_update_section(text, jsonb) from public;
revoke execute on function public.zaro_seed(jsonb) from public;
revoke execute on function public.zaro_set_user_role(uuid, text) from public;
grant execute on function public.zaro_update_section(text, jsonb) to authenticated;
grant execute on function public.zaro_seed(jsonb) to authenticated;
grant execute on function public.zaro_set_user_role(uuid, text) to authenticated;
