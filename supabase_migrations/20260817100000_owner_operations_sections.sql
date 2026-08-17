-- Owner operations sections: customers, suppliers, returns, daily closures,
-- and expense approvals. Data remains inside the existing JSON state to preserve
-- backward compatibility while all writes remain guarded by the RPC.
create or replace function public.zaro_validate_section_payload(p_section text, p_payload jsonb)
returns void
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_section = 'cpp' then
    if jsonb_typeof(p_payload) <> 'object' then raise exception 'بيانات Max CPP غير صالحة'; end if;
    if coalesce(p_payload->>'salePrice','') !~ '^[0-9]+([.][0-9]+)?$'
      or coalesce(p_payload->>'cost','') !~ '^[0-9]+([.][0-9]+)?$'
      or coalesce(p_payload->>'shipFwd','') !~ '^[0-9]+([.][0-9]+)?$'
      or coalesce(p_payload->>'shipRet','') !~ '^[0-9]+([.][0-9]+)?$'
      or coalesce(p_payload->>'expectedOrders','') !~ '^[0-9]+([.][0-9]+)?$'
      or coalesce(p_payload->>'actualCpp','') !~ '^[0-9]+([.][0-9]+)?$' then
      raise exception 'قيم Max CPP غير صالحة';
    end if;
    if (p_payload->>'codFeePct')::numeric < 0 or (p_payload->>'codFeePct')::numeric > 1
      or (p_payload->>'confRate')::numeric < 0 or (p_payload->>'confRate')::numeric > 1
      or (p_payload->>'delRate')::numeric < 0 or (p_payload->>'delRate')::numeric > 1
      or (p_payload->>'marginPct')::numeric < 0 or (p_payload->>'marginPct')::numeric > 1 then
      raise exception 'نسب Max CPP يجب أن تكون بين صفر وواحد';
    end if;
    return;
  end if;

  if p_section not in ('orders','products','inventory','shippingCompanies','collections','ads','fixedCosts','inventoryMovements','customers','suppliers','returns','dailyClosures','expenseApprovals') then
    raise exception 'القسم غير مسموح بتعديله';
  end if;
  if jsonb_typeof(p_payload) <> 'array' then raise exception 'بيانات القسم يجب أن تكون قائمة'; end if;

  if p_section = 'orders' then
    if exists (select 1 from jsonb_array_elements(p_payload) x where coalesce(x->>'id','') = '' or coalesce(x->>'date','') = '' or coalesce(x->>'customer','') = '' or coalesce(x->>'product','') = '' or coalesce(x->>'company','') = '' or coalesce(x->>'qty','') !~ '^[1-9][0-9]*$' or x->>'status' not in ('قيد المعالجة','مؤكد','تم الشحن','تم التسليم','مرتجع','ملغي')) then raise exception 'يوجد أوردر ببيانات غير صالحة'; end if;
    if exists (select 1 from (select x->>'id' as id, count(*) as total from jsonb_array_elements(p_payload) x group by x->>'id' having count(*) > 1) duplicates) then raise exception 'لا يمكن تكرار رقم الأوردر'; end if;
  elsif p_section = 'products' then
    if exists (select 1 from jsonb_array_elements(p_payload) x where coalesce(x->>'code','') = '' or coalesce(x->>'name','') = '' or coalesce(x->>'price','') !~ '^[0-9]+([.][0-9]+)?$' or coalesce(x->>'cost','') !~ '^[0-9]+([.][0-9]+)?$' or coalesce(x->>'reorderPoint','0') !~ '^[0-9]+([.][0-9]+)?$') then raise exception 'يوجد منتج ببيانات غير صالحة'; end if;
    if exists (select 1 from (select x->>'code' as code, count(*) as total from jsonb_array_elements(p_payload) x group by x->>'code' having count(*) > 1) duplicates) then raise exception 'لا يمكن تكرار كود المنتج'; end if;
  elsif p_section = 'inventory' then
    if exists (select 1 from jsonb_array_elements(p_payload) x where coalesce(x->>'code','') = '' or coalesce(x->>'available','') !~ '^[0-9]+([.][0-9]+)?$') then raise exception 'يوجد رصيد مخزون غير صالح'; end if;
  elsif p_section = 'shippingCompanies' then
    if exists (select 1 from jsonb_array_elements(p_payload) x where coalesce(x->>'name','') = '' or coalesce(x->>'cost','') !~ '^[0-9]+([.][0-9]+)?$' or coalesce(x->>'feePct','') !~ '^(0([.][0-9]+)?|1([.]0+)?)$') then raise exception 'بيانات شركة الشحن غير صالحة'; end if;
  elsif p_section = 'collections' then
    if exists (select 1 from jsonb_array_elements(p_payload) x where coalesce(x->>'date','') = '' or coalesce(x->>'company','') = '' or coalesce(x->>'received','') !~ '^[0-9]+([.][0-9]+)?$') then raise exception 'بيانات التحصيل غير صالحة'; end if;
  elsif p_section = 'ads' then
    if exists (select 1 from jsonb_array_elements(p_payload) x where coalesce(x->>'date','') = '' or coalesce(x->>'platform','') = '' or coalesce(x->>'amount','') !~ '^[0-9]+([.][0-9]+)?$' or coalesce(x->>'orders','') !~ '^[0-9]+$') then raise exception 'بيانات الإعلان غير صالحة'; end if;
  elsif p_section = 'fixedCosts' then
    if exists (select 1 from jsonb_array_elements(p_payload) x where coalesce(x->>'month','') = '' or coalesce(x->>'item','') = '' or coalesce(x->>'amount','') !~ '^[0-9]+([.][0-9]+)?$') then raise exception 'بيانات المصروف الثابت غير صالحة'; end if;
  elsif p_section = 'inventoryMovements' then
    if exists (select 1 from jsonb_array_elements(p_payload) x where coalesce(x->>'date','') = '' or coalesce(x->>'code','') = '' or coalesce(x->>'reason','') = '' or coalesce(x->>'qty','') !~ '^[1-9][0-9]*$' or x->>'type' not in ('إضافة','خصم')) then raise exception 'بيانات حركة المخزون غير صالحة'; end if;
  elsif p_section in ('customers','suppliers') then
    if exists (select 1 from jsonb_array_elements(p_payload) x where coalesce(x->>'id','') = '' or coalesce(x->>'name','') = '') then raise exception 'كل سجل يحتاج معرفًا واسمًا'; end if;
    if exists (select 1 from (select x->>'id' as id, count(*) as total from jsonb_array_elements(p_payload) x group by x->>'id' having count(*) > 1) duplicates) then raise exception 'لا يمكن تكرار معرف السجل'; end if;
  elsif p_section = 'returns' then
    if exists (select 1 from jsonb_array_elements(p_payload) x where coalesce(x->>'id','') = '' or coalesce(x->>'orderId','') = '' or coalesce(x->>'date','') = '' or coalesce(x->>'product','') = '' or coalesce(x->>'qty','') !~ '^[1-9][0-9]*$' or coalesce(x->>'refundAmount','') !~ '^[0-9]+([.][0-9]+)?$' or x->>'status' not in ('pending','approved','refunded','rejected')) then raise exception 'بيانات المرتجع غير صالحة'; end if;
  elsif p_section = 'dailyClosures' then
    if exists (select 1 from jsonb_array_elements(p_payload) x where coalesce(x->>'id','') = '' or coalesce(x->>'date','') = '' or coalesce(x->>'totalOrders','') !~ '^[0-9]+$' or coalesce(x->>'totalSales','') !~ '^[0-9]+([.][0-9]+)?$' or x->>'status' not in ('closed')) then raise exception 'بيانات إغلاق اليوم غير صالحة'; end if;
    if exists (select 1 from (select x->>'date' as date, count(*) as total from jsonb_array_elements(p_payload) x group by x->>'date' having count(*) > 1) duplicates) then raise exception 'لا يمكن إغلاق نفس اليوم أكثر من مرة'; end if;
  elsif p_section = 'expenseApprovals' then
    if exists (select 1 from jsonb_array_elements(p_payload) x where coalesce(x->>'id','') = '' or coalesce(x->>'date','') = '' or coalesce(x->>'type','') = '' or coalesce(x->>'amount','') !~ '^[0-9]+([.][0-9]+)?$' or x->>'status' not in ('pending','approved','rejected')) then raise exception 'بيانات اعتماد المصروف غير صالحة'; end if;
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

revoke execute on function public.zaro_validate_section_payload(text, jsonb) from public, anon;
revoke execute on function public.zaro_update_section(text, jsonb) from public, anon;
grant execute on function public.zaro_update_section(text, jsonb) to authenticated;
