-- 007_add_meal_type.sql
-- Add meal_type column and update RPCs to accept/preserve it

ALTER TABLE public.meals ADD COLUMN meal_type text;

-- create_meal_with_items — add p_meal_type parameter
create or replace function public.create_meal_with_items(
  p_log_date  date,
  p_logged_at timestamptz,
  p_items     jsonb,
  p_meal_type text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id      uuid;
  v_log          daily_logs;
  v_meal         meals;
  v_item         jsonb;
  v_product      products;
  v_catalog_item food_catalog_items;
  v_meal_item    meal_items;
  v_items_out    jsonb := '[]'::jsonb;
  v_qty          numeric;
  v_line_cal     integer;
  v_has_product  boolean;
  v_has_catalog  boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_has_product := v_item ? 'product_id' and coalesce(v_item->>'product_id', '') <> '';
    v_has_catalog := v_item ? 'catalog_item_id' and coalesce(v_item->>'catalog_item_id', '') <> '';

    if (case when v_has_product then 1 else 0 end) + (case when v_has_catalog then 1 else 0 end) <> 1 then
      raise exception 'Each item must include exactly one of product_id or catalog_item_id';
    end if;

    if v_has_product then
      select * into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid and user_id = v_user_id;
      if not found then
        raise exception 'Product not found or not owned: %', v_item->>'product_id';
      end if;
    else
      select * into v_catalog_item
      from public.food_catalog_items
      where id = v_item->>'catalog_item_id';
      if not found then
        raise exception 'Catalog item not found: %', v_item->>'catalog_item_id';
      end if;
    end if;
  end loop;

  insert into public.daily_logs (user_id, log_date)
  values (v_user_id, p_log_date)
  on conflict (user_id, log_date) do nothing;

  select * into v_log
  from public.daily_logs
  where user_id = v_user_id and log_date = p_log_date;

  if v_log.is_finalized then
    raise exception 'Daily log is finalized for date %', p_log_date;
  end if;

  insert into public.meals (user_id, daily_log_id, logged_at, meal_type)
  values (v_user_id, v_log.id, p_logged_at, p_meal_type)
  returning * into v_meal;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::numeric;
    v_has_product := v_item ? 'product_id' and coalesce(v_item->>'product_id', '') <> '';

    if v_has_product then
      select * into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid and user_id = v_user_id;

      v_line_cal := round(v_qty * v_product.calories);

      insert into public.meal_items (
        meal_id, product_id, catalog_item_id, quantity,
        product_name_snapshot, calories_per_serving_snapshot,
        protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        serving_amount_snapshot, serving_unit_snapshot,
        line_total_calories
      ) values (
        v_meal.id, v_product.id, null, v_qty,
        v_product.name, v_product.calories,
        v_product.protein_g, v_product.carbs_g, v_product.fat_g,
        v_product.default_serving_amount, v_product.default_serving_unit,
        v_line_cal
      ) returning * into v_meal_item;

      update public.products
      set use_count = use_count + 1,
          last_used_at = now(),
          updated_at = now()
      where id = v_product.id;
    else
      select * into v_catalog_item
      from public.food_catalog_items
      where id = v_item->>'catalog_item_id';

      v_line_cal := round(v_qty * v_catalog_item.calories);

      insert into public.meal_items (
        meal_id, product_id, catalog_item_id, quantity,
        product_name_snapshot, calories_per_serving_snapshot,
        protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        serving_amount_snapshot, serving_unit_snapshot,
        line_total_calories
      ) values (
        v_meal.id, null, v_catalog_item.id, v_qty,
        v_catalog_item.name, v_catalog_item.calories,
        v_catalog_item.protein_g, v_catalog_item.carbs_g, v_catalog_item.fat_g,
        v_catalog_item.default_serving_amount, v_catalog_item.default_serving_unit,
        v_line_cal
      ) returning * into v_meal_item;

      insert into public.catalog_item_usage (user_id, catalog_item_id, use_count, last_used_at)
      values (v_user_id, v_catalog_item.id, 1, now())
      on conflict (user_id, catalog_item_id) do update
      set use_count = catalog_item_usage.use_count + 1,
          last_used_at = excluded.last_used_at,
          updated_at = now();
    end if;

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

-- update_meal_with_items — add p_meal_type parameter
create or replace function public.update_meal_with_items(
  p_meal_id   uuid,
  p_logged_at timestamptz,
  p_items     jsonb,
  p_meal_type text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id      uuid;
  v_meal         meals;
  v_log          daily_logs;
  v_item         jsonb;
  v_product      products;
  v_catalog_item food_catalog_items;
  v_meal_item    meal_items;
  v_items_out    jsonb := '[]'::jsonb;
  v_qty          numeric;
  v_line_cal     integer;
  v_has_product  boolean;
  v_has_catalog  boolean;
  v_has_snapshot boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_meal from public.meals where id = p_meal_id and user_id = v_user_id;
  if not found then
    raise exception 'Meal not found or not owned: %', p_meal_id;
  end if;

  select * into v_log from public.daily_logs where id = v_meal.daily_log_id;
  if v_log.is_finalized then
    raise exception 'Daily log is finalized for this meal';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_has_product := v_item ? 'product_id' and coalesce(v_item->>'product_id', '') <> '';
    v_has_catalog := v_item ? 'catalog_item_id' and coalesce(v_item->>'catalog_item_id', '') <> '';
    v_has_snapshot := v_item ? 'meal_item_id' and coalesce(v_item->>'meal_item_id', '') <> '';

    if (case when v_has_product then 1 else 0 end)
       + (case when v_has_catalog then 1 else 0 end)
       + (case when v_has_snapshot then 1 else 0 end) <> 1 then
      raise exception 'Each item must include exactly one of product_id, catalog_item_id, or meal_item_id';
    end if;

    if v_has_product then
      select * into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid and user_id = v_user_id;
      if not found then
        raise exception 'Product not found or not owned: %', v_item->>'product_id';
      end if;
    elsif v_has_catalog then
      select * into v_catalog_item
      from public.food_catalog_items
      where id = v_item->>'catalog_item_id';
      if not found then
        raise exception 'Catalog item not found: %', v_item->>'catalog_item_id';
      end if;
    end if;
  end loop;

  delete from public.meal_items where meal_id = p_meal_id;

  update public.meals
  set logged_at = p_logged_at, meal_type = p_meal_type, updated_at = now()
  where id = p_meal_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_has_product := v_item ? 'product_id' and coalesce(v_item->>'product_id', '') <> '';
    v_has_catalog := v_item ? 'catalog_item_id' and coalesce(v_item->>'catalog_item_id', '') <> '';

    if v_has_product then
      select * into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid and user_id = v_user_id;

      v_qty := (v_item->>'quantity')::numeric;
      v_line_cal := round(v_qty * v_product.calories);

      insert into public.meal_items (
        meal_id, product_id, catalog_item_id, quantity,
        product_name_snapshot, calories_per_serving_snapshot,
        protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        serving_amount_snapshot, serving_unit_snapshot,
        line_total_calories
      ) values (
        p_meal_id, v_product.id, null, v_qty,
        v_product.name, v_product.calories,
        v_product.protein_g, v_product.carbs_g, v_product.fat_g,
        v_product.default_serving_amount, v_product.default_serving_unit,
        v_line_cal
      ) returning * into v_meal_item;
    elsif v_has_catalog then
      select * into v_catalog_item
      from public.food_catalog_items
      where id = v_item->>'catalog_item_id';

      v_qty := (v_item->>'quantity')::numeric;
      v_line_cal := round(v_qty * v_catalog_item.calories);

      insert into public.meal_items (
        meal_id, product_id, catalog_item_id, quantity,
        product_name_snapshot, calories_per_serving_snapshot,
        protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        serving_amount_snapshot, serving_unit_snapshot,
        line_total_calories
      ) values (
        p_meal_id, null, v_catalog_item.id, v_qty,
        v_catalog_item.name, v_catalog_item.calories,
        v_catalog_item.protein_g, v_catalog_item.carbs_g, v_catalog_item.fat_g,
        v_catalog_item.default_serving_amount, v_catalog_item.default_serving_unit,
        v_line_cal
      ) returning * into v_meal_item;
    else
      v_qty := (v_item->>'quantity')::numeric;
      v_line_cal := round(v_qty * (v_item->>'calories_per_serving_snapshot')::integer);

      insert into public.meal_items (
        meal_id, product_id, catalog_item_id, quantity,
        product_name_snapshot, calories_per_serving_snapshot,
        protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        serving_amount_snapshot, serving_unit_snapshot,
        line_total_calories
      ) values (
        p_meal_id, null, null, v_qty,
        v_item->>'product_name_snapshot',
        (v_item->>'calories_per_serving_snapshot')::integer,
        nullif(v_item->>'protein_g_snapshot', '')::numeric,
        nullif(v_item->>'carbs_g_snapshot', '')::numeric,
        nullif(v_item->>'fat_g_snapshot', '')::numeric,
        nullif(v_item->>'serving_amount_snapshot', '')::numeric,
        nullif(v_item->>'serving_unit_snapshot', ''),
        v_line_cal
      ) returning * into v_meal_item;
    end if;

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
  set total_calories = (select coalesce(sum(line_total_calories), 0) from public.meal_items where meal_id = p_meal_id),
      item_count     = (select count(*) from public.meal_items where meal_id = p_meal_id),
      updated_at     = now()
  where id = p_meal_id
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

-- repeat_last_meal — preserve meal_type from source meal
create or replace function public.repeat_last_meal(p_log_date date)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id    uuid;
  v_tz         text;
  v_source_meal meals;
  v_log        daily_logs;
  v_new_meal   meals;
  v_logged_at  timestamptz;
  v_item       meal_items;
  v_new_item   meal_items;
  v_items_out  jsonb := '[]'::jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select timezone into v_tz from public.profiles where user_id = v_user_id;

  select m.* into v_source_meal
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

  insert into public.meals (user_id, daily_log_id, logged_at, meal_type)
  values (v_user_id, v_log.id, v_logged_at, v_source_meal.meal_type)
  returning * into v_new_meal;

  for v_item in
    select * from public.meal_items where meal_id = v_source_meal.id
  loop
    insert into public.meal_items (
      meal_id, product_id, quantity,
      product_name_snapshot, calories_per_serving_snapshot,
      protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
      serving_amount_snapshot, serving_unit_snapshot,
      line_total_calories
    ) values (
      v_new_meal.id, null, v_item.quantity,
      v_item.product_name_snapshot, v_item.calories_per_serving_snapshot,
      v_item.protein_g_snapshot, v_item.carbs_g_snapshot, v_item.fat_g_snapshot,
      v_item.serving_amount_snapshot, v_item.serving_unit_snapshot,
      v_item.line_total_calories
    ) returning * into v_new_item;

    v_items_out := v_items_out || jsonb_build_object(
      'id', v_new_item.id,
      'product_id', v_new_item.product_id,
      'quantity', v_new_item.quantity,
      'product_name_snapshot', v_new_item.product_name_snapshot,
      'calories_per_serving_snapshot', v_new_item.calories_per_serving_snapshot,
      'line_total_calories', v_new_item.line_total_calories
    );
  end loop;

  update public.meals
  set total_calories = (select coalesce(sum(line_total_calories), 0) from public.meal_items where meal_id = v_new_meal.id),
      item_count     = (select count(*) from public.meal_items where meal_id = v_new_meal.id),
      updated_at     = now()
  where id = v_new_meal.id
  returning * into v_new_meal;

  update public.daily_logs
  set total_calories = (select coalesce(sum(total_calories), 0) from public.meals where daily_log_id = v_log.id),
      meal_count     = (select count(*) from public.meals where daily_log_id = v_log.id),
      updated_at     = now()
  where id = v_log.id
  returning * into v_log;

  return json_build_object(
    'meal', row_to_json(v_new_meal),
    'meal_items', v_items_out,
    'daily_log', row_to_json(v_log)
  );
end;
$$;

-- restore_meal_from_snapshot — add p_meal_type parameter
create or replace function public.restore_meal_from_snapshot(
  p_log_date  date,
  p_logged_at timestamptz,
  p_items     jsonb,
  p_meal_type text default null
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

  insert into public.meals (user_id, daily_log_id, logged_at, meal_type)
  values (v_user_id, v_log.id, p_logged_at, p_meal_type)
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
