create or replace function public.zaro_validate_reorder_point(p_payload jsonb)
returns void
language plpgsql
immutable
set search_path = public
as $$
begin
  if jsonb_typeof(p_payload) <> 'array' then
    raise exception 'بيانات المنتجات يجب أن تكون قائمة';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_payload) x
    where coalesce(x->>'reorderPoint','0') !~ '^[0-9]+([.][0-9]+)?$'
  ) then
    raise exception 'حد إعادة الطلب يجب أن يكون رقمًا غير سالب';
  end if;
end;
$$;

create or replace function public.zaro_update_section(p_section text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_allowed boolean := false;
  v_updated integer;
begin
  perform public.zaro_validate_section_payload(p_section, p_payload);
  if p_section = 'products' then perform public.zaro_validate_reorder_point(p_payload); end if;
  select role into v_role from public.profiles where id = (select auth.uid());
  if v_role = 'owner' then
    v_allowed := true;
  elsif v_role = 'accountant' and p_section in ('orders','collections','customers','returns') then
    v_allowed := true;
  end if;
  if not v_allowed then raise exception 'ليس لديك صلاحية لتعديل هذا القسم'; end if;
  update public.zaro_state set data = jsonb_set(coalesce(data, '{}'::jsonb), array[p_section], p_payload, true), updated_at = now() where id = 1;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then raise exception 'تعذر حفظ بيانات النظام'; end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'update_section', p_section, '1', jsonb_build_object('payload_type', jsonb_typeof(p_payload), 'payload_bytes', octet_length(p_payload::text)));
end;
$$;

revoke execute on function public.zaro_validate_reorder_point(jsonb) from public, anon;
revoke execute on function public.zaro_update_section(text, jsonb) from public, anon;
grant execute on function public.zaro_update_section(text, jsonb) to authenticated;
