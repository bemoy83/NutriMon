-- Slice E (§7.5–7.6): append snapshot restore / repeat into an existing standard slot row
-- when one already exists for (daily_log_id, meal_type). Assumes partial unique index from Slice A.

create or replace function public.restore_meal_from_snapshot(
  p_log_date  date,
  p_logged_at timestamptz,
  p_items     jsonb,
  p_meal_type text default null,
  p_meal_name text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_log daily_logs;
  v_meal meals;
  v_item jsonb;
  v_meal_item meal_items;
  v_items_out jsonb := '[]'::jsonb;
  v_qty numeric;
  v_line_cal integer;
  v_preview json;
  v_is_standard boolean;
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

  select *
  into v_log
  from public.daily_logs
  where user_id = v_user_id
    and log_date = p_log_date;

  if v_log.is_finalized then
    raise exception 'Daily log is finalized for date %', p_log_date;
  end if;

  v_is_standard := p_meal_type is not null
    and p_meal_type in ('Breakfast', 'Lunch', 'Dinner', 'Snack');

  if v_is_standard then
    select *
    into v_meal
    from public.meals
    where daily_log_id = v_log.id
      and meal_type = p_meal_type
    for update;

    if found then
      update public.meals
      set logged_at = p_logged_at,
          meal_name = coalesce(meals.meal_name, p_meal_name),
          updated_at = now()
      where id = v_meal.id
      returning * into v_meal;
    else
      insert into public.meals (user_id, daily_log_id, logged_at, meal_type, meal_name)
      values (v_user_id, v_log.id, p_logged_at, p_meal_type, p_meal_name)
      returning * into v_meal;
    end if;
  else
    insert into public.meals (user_id, daily_log_id, logged_at, meal_type, meal_name)
    values (v_user_id, v_log.id, p_logged_at, p_meal_type, p_meal_name)
    returning * into v_meal;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::numeric;
    v_line_cal := round(v_qty * (v_item->>'calories_per_serving_snapshot')::integer);

    insert into public.meal_items (
      meal_id, product_id, catalog_item_id, quantity,
      product_name_snapshot, calories_per_serving_snapshot,
      protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
      serving_amount_snapshot, serving_unit_snapshot,
      line_total_calories
    ) values (
      v_meal.id, null, null, v_qty,
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
      'catalog_item_id', v_meal_item.catalog_item_id,
      'quantity', v_meal_item.quantity,
      'product_name_snapshot', v_meal_item.product_name_snapshot,
      'calories_per_serving_snapshot', v_meal_item.calories_per_serving_snapshot,
      'line_total_calories', v_meal_item.line_total_calories
    );
  end loop;

  update public.meals
  set total_calories = (select coalesce(sum(line_total_calories), 0) from public.meal_items where meal_id = v_meal.id),
      item_count = (select count(*) from public.meal_items where meal_id = v_meal.id),
      updated_at = now()
  where id = v_meal.id
  returning * into v_meal;

  update public.daily_logs
  set total_calories = (select coalesce(sum(total_calories), 0) from public.meals where daily_log_id = v_log.id),
      meal_count = (select count(*) from public.meals where daily_log_id = v_log.id),
      updated_at = now()
  where id = v_log.id
  returning * into v_log;

  v_preview := public.calculate_creature_preview(v_user_id, p_log_date);

  return json_build_object(
    'meal', row_to_json(v_meal),
    'meal_items', v_items_out,
    'daily_log', row_to_json(v_log),
    'creature_preview', v_preview
  );
end;
$$;

create or replace function public.repeat_last_meal(p_log_date date)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_tz text;
  v_source_meal meals;
  v_log daily_logs;
  v_logged_at timestamptz;
  v_item_count int;
  v_payload jsonb;
  v_new_meal meals;
  v_preview json;
  v_is_standard boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select timezone into v_tz from public.profiles where user_id = v_user_id;

  select m.*
  into v_source_meal
  from public.meals m
  join public.daily_logs dl on dl.id = m.daily_log_id
  where m.user_id = v_user_id
    and dl.log_date < p_log_date
  order by m.logged_at desc
  limit 1;

  if not found then
    raise exception 'No previous meals found to repeat';
  end if;

  insert into public.daily_logs (user_id, log_date)
  values (v_user_id, p_log_date)
  on conflict (user_id, log_date) do nothing;

  select * into v_log from public.daily_logs where user_id = v_user_id and log_date = p_log_date;
  if v_log.is_finalized then
    raise exception 'Daily log is finalized for date %', p_log_date;
  end if;

  v_logged_at := (p_log_date || ' ' || to_char(now() at time zone coalesce(v_tz, 'UTC'), 'HH24:MI:SS'))::timestamptz
                 at time zone coalesce(v_tz, 'UTC');

  v_item_count := (select count(*)::int from public.meal_items where meal_id = v_source_meal.id);

  if v_item_count > 0 then
    v_payload := (
      select jsonb_agg(
        jsonb_build_object(
          'quantity', mi.quantity,
          'product_name_snapshot', mi.product_name_snapshot,
          'calories_per_serving_snapshot', mi.calories_per_serving_snapshot,
          'protein_g_snapshot', mi.protein_g_snapshot,
          'carbs_g_snapshot', mi.carbs_g_snapshot,
          'fat_g_snapshot', mi.fat_g_snapshot,
          'serving_amount_snapshot', mi.serving_amount_snapshot,
          'serving_unit_snapshot', mi.serving_unit_snapshot
        )
        order by mi.created_at
      )
      from public.meal_items mi
      where mi.meal_id = v_source_meal.id
    );
    return public.restore_meal_from_snapshot(
      p_log_date,
      v_logged_at,
      v_payload,
      v_source_meal.meal_type,
      v_source_meal.meal_name
    );
  end if;

  v_is_standard := v_source_meal.meal_type is not null
    and v_source_meal.meal_type in ('Breakfast', 'Lunch', 'Dinner', 'Snack');

  if v_is_standard then
    select *
    into v_new_meal
    from public.meals
    where daily_log_id = v_log.id
      and meal_type = v_source_meal.meal_type
    for update;

    if found then
      update public.meals
      set logged_at = v_logged_at,
          meal_name = coalesce(meals.meal_name, v_source_meal.meal_name),
          updated_at = now()
      where id = v_new_meal.id
      returning * into v_new_meal;
    else
      insert into public.meals (user_id, daily_log_id, logged_at, meal_type, meal_name)
      values (v_user_id, v_log.id, v_logged_at, v_source_meal.meal_type, v_source_meal.meal_name)
      returning * into v_new_meal;
    end if;
  else
    insert into public.meals (user_id, daily_log_id, logged_at, meal_type, meal_name)
    values (v_user_id, v_log.id, v_logged_at, v_source_meal.meal_type, v_source_meal.meal_name)
    returning * into v_new_meal;
  end if;

  update public.meals
  set total_calories = (select coalesce(sum(line_total_calories), 0) from public.meal_items where meal_id = v_new_meal.id),
      item_count = (select count(*) from public.meal_items where meal_id = v_new_meal.id),
      updated_at = now()
  where id = v_new_meal.id
  returning * into v_new_meal;

  update public.daily_logs
  set total_calories = (select coalesce(sum(total_calories), 0) from public.meals where daily_log_id = v_log.id),
      meal_count = (select count(*) from public.meals where daily_log_id = v_log.id),
      updated_at = now()
  where id = v_log.id
  returning * into v_log;

  v_preview := public.calculate_creature_preview(v_user_id, p_log_date);

  return json_build_object(
    'meal', row_to_json(v_new_meal),
    'meal_items', '[]'::jsonb,
    'daily_log', row_to_json(v_log),
    'creature_preview', v_preview
  );
end;
$$;
