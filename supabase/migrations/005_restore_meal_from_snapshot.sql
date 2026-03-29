-- 005_restore_meal_from_snapshot.sql
-- Restores a deleted meal using only cached snapshot data so undo works
-- even when the original products have been hard-deleted.

create or replace function public.restore_meal_from_snapshot(
  p_log_date  date,
  p_logged_at timestamptz,
  p_items     jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id   uuid;
  v_log       daily_logs;
  v_meal      meals;
  v_item      jsonb;
  v_meal_item meal_items;
  v_items_out jsonb := '[]'::jsonb;
  v_qty       numeric;
  v_line_cal  integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one item is required to restore a meal';
  end if;

  insert into public.daily_logs (user_id, log_date)
  values (v_user_id, p_log_date)
  on conflict (user_id, log_date) do nothing;

  select * into v_log
  from public.daily_logs
  where user_id = v_user_id and log_date = p_log_date;

  if v_log.is_finalized then
    raise exception 'Daily log is finalized for date %', p_log_date;
  end if;

  insert into public.meals (user_id, daily_log_id, logged_at)
  values (v_user_id, v_log.id, p_logged_at)
  returning * into v_meal;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::numeric;
    v_line_cal := round(v_qty * (v_item->>'calories_per_serving_snapshot')::integer);

    insert into public.meal_items (
      meal_id, product_id, quantity,
      product_name_snapshot, calories_per_serving_snapshot,
      protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
      serving_amount_snapshot, serving_unit_snapshot,
      line_total_calories
    ) values (
      v_meal.id, null, v_qty,
      v_item->>'product_name_snapshot',
      (v_item->>'calories_per_serving_snapshot')::integer,
      nullif(v_item->>'protein_g_snapshot', '')::numeric,
      nullif(v_item->>'carbs_g_snapshot', '')::numeric,
      nullif(v_item->>'fat_g_snapshot', '')::numeric,
      nullif(v_item->>'serving_amount_snapshot', '')::numeric,
      nullif(v_item->>'serving_unit_snapshot', ''),
      v_line_cal
    ) returning * into v_meal_item;

    v_items_out := v_items_out || jsonb_build_object(
      'id', v_meal_item.id,
      'product_id', v_meal_item.product_id,
      'quantity', v_meal_item.quantity,
      'product_name_snapshot', v_meal_item.product_name_snapshot,
      'calories_per_serving_snapshot', v_meal_item.calories_per_serving_snapshot,
      'line_total_calories', v_meal_item.line_total_calories
    );
  end loop;

  update public.meals
  set total_calories = (select coalesce(sum(line_total_calories), 0) from public.meal_items where meal_id = v_meal.id),
      item_count     = (select count(*) from public.meal_items where meal_id = v_meal.id),
      updated_at     = now()
  where id = v_meal.id
  returning * into v_meal;

  update public.daily_logs
  set total_calories = (select coalesce(sum(total_calories), 0) from public.meals where daily_log_id = v_log.id),
      meal_count     = (select count(*) from public.meals where daily_log_id = v_log.id),
      updated_at     = now()
  where id = v_log.id
  returning * into v_log;

  return json_build_object(
    'meal', row_to_json(v_meal),
    'meal_items', v_items_out,
    'daily_log', row_to_json(v_log)
  );
end;
$$;
