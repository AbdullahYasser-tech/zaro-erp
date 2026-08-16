-- Fix the JSON array alias used when locating an inventory item.
create or replace function public.zaro_apply_inventory_movement(
  p_code text,
  p_type text,
  p_qty integer,
  p_reason text,
  p_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_data jsonb;
  v_inventory jsonb;
  v_item jsonb;
  v_index integer;
  v_available integer;
  v_next integer;
  v_movement_id text;
begin
  select role into v_role from public.profiles where id = (select auth.uid());
  if v_role is distinct from 'owner' then
    raise exception 'فقط الأونر يقدر يسجل حركة مخزون';
  end if;
  if p_type not in ('إضافة','خصم') or p_qty is null or p_qty < 1 or coalesce(trim(p_reason), '') = '' or p_date is null then
    raise exception 'بيانات حركة المخزون غير صالحة';
  end if;

  select data into v_data from public.zaro_state where id = 1 for update;
  select (items.ordinality - 1)::integer, items.elem
    into v_index, v_item
  from jsonb_array_elements(coalesce(v_data->'inventory', '[]'::jsonb)) with ordinality as items(elem, ordinality)
  where items.elem->>'code' = p_code
  limit 1;

  if v_index is null then
    raise exception 'المنتج غير موجود في المخزون';
  end if;

  v_available := coalesce((v_item->>'available')::integer, 0);
  v_next := v_available + case when p_type = 'إضافة' then p_qty else -p_qty end;
  if v_next < 0 then
    raise exception 'لا يمكن خصم كمية أكبر من الرصيد الحالي';
  end if;

  v_item := jsonb_set(v_item, '{available}', to_jsonb(v_next), true);
  v_inventory := jsonb_set(v_data->'inventory', array[v_index::text], v_item, true);
  v_data := jsonb_set(v_data, '{inventory}', v_inventory, true);
  v_movement_id := md5(clock_timestamp()::text || random()::text);
  v_data := jsonb_set(
    v_data,
    '{inventoryMovements}',
    coalesce(v_data->'inventoryMovements', '[]'::jsonb) || jsonb_build_object(
      'id', v_movement_id,
      'date', p_date,
      'code', p_code,
      'type', p_type,
      'qty', p_qty,
      'reason', trim(p_reason)
    ),
    true
  );

  update public.zaro_state set data = v_data, updated_at = now() where id = 1;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'inventory_movement', 'inventory', p_code, jsonb_build_object('type', p_type, 'qty', p_qty, 'reason', trim(p_reason)));
end;
$$;

revoke execute on function public.zaro_apply_inventory_movement(text, text, integer, text, date) from public, anon;
grant execute on function public.zaro_apply_inventory_movement(text, text, integer, text, date) to authenticated;
