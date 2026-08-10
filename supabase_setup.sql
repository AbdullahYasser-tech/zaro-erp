-- شغّل الكود ده كامل في Supabase SQL Editor مرة واحدة

create table zaro_state (
  id int primary key default 1,
  data jsonb not null,
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);

insert into zaro_state (id, data) values (1, '{}'::jsonb);

alter table zaro_state enable row level security;

create policy "allow all read" on zaro_state
  for select using (true);

create policy "allow all update" on zaro_state
  for update using (true);
