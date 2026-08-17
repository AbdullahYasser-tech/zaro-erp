create or replace function public.zaro_restore_backup(p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_data jsonb;
  v_section text;
begin
  select role into v_role from public.profiles where id = (select auth.uid());
  if v_role <> 'owner' then raise exception 'استرجاع النسخة الاحتياطية متاح للـOwner فقط'; end if;
  if coalesce(p_data->>'app','') <> 'ZARO ERP' then raise exception 'ملف النسخة الاحتياطية غير معتمد'; end if;
  v_data := p_data->'data';
  if jsonb_typeof(v_data) <> 'object' then raise exception 'بيانات النسخة الاحتياطية غير صالحة'; end if;
  for v_section in select unnest(string_to_array('orders,products,inventory,shippingCompanies,collections,ads,fixedCosts,inventoryMovements,customers,suppliers,returns,dailyClosures,expenseApprovals', ',')) loop
    if v_data ? v_section then perform public.zaro_validate_section_payload(v_section, v_data->v_section); end if;
  end loop;
  if v_data ? 'products' then perform public.zaro_validate_reorder_point(v_data->'products'); end if;
  if v_data ? 'cpp' then perform public.zaro_validate_section_payload('cpp', v_data->'cpp'); end if;
  update public.zaro_state set data = v_data, updated_at = now() where id = 1;
  if not found then raise exception 'تعذر استرجاع النسخة الاحتياطية'; end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'restore_backup', 'zaro_state', '1', jsonb_build_object('payload_bytes', octet_length(v_data::text)));
end;
$$;

revoke execute on function public.zaro_restore_backup(jsonb) from public, anon;
grant execute on function public.zaro_restore_backup(jsonb) to authenticated;
