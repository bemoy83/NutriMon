-- 004_rpcs.sql
-- Postgres RPC functions for meal mutations

-- ensure_daily_log: creates daily log for auth.uid() if missing, returns the row
create or replace function public.ensure_daily_log(p_log_date date)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_log     daily_logs;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.daily_logs (user_id, log_date)
  values (v_user_id, p_log_date)
  on conflict (user_id, log_date) do nothing;

  select * into v_log
  from public.daily_logs
  where user_id = v_user_id and log_date = p_log_date;

  return row_to_json(v_log);
end;
$$;

-- create_meal_with_items
create or replace function public.create_meal_with_items(
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
  v_product   products;
  v_meal_item meal_items;
  v_items_out jsonb := '[]'::jsonb;
  v_qty       numeric;
  v_line_cal  integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- verify ownership of all referenced products
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid and user_id = v_user_id;
    if not found then
      raise exception 'Product not found or not owned: %', v_item->>'product_id';
    end if;
  end loop;

  -- ensure daily log exists
  insert into public.daily_logs (user_id, log_date)
  values (v_user_id, p_log_date)
  on conflict (user_id, log_date) do nothing;

  select * into v_log
  from public.daily_logs
  where user_id = v_user_id and log_date = p_log_date;

  if v_log.is_finalized then
    raise exception 'Daily log is finalized for date %', p_log_date;
  end if;

  -- insert meal
  insert into public.meals (user_id, daily_log_id, logged_at)
  values (v_user_id, v_log.id, p_logged_at)
  returning * into v_meal;

  -- insert meal items
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid and user_id = v_user_id;

    v_qty := (v_item->>'quantity')::numeric;
    v_line_cal := round(v_qty * v_product.calories);

    insert into public.meal_items (
      meal_id, product_id, quantity,
      product_name_snapshot, calories_per_serving_snapshot,
      protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
      serving_amount_snapshot, serving_unit_snapshot,
      line_total_calories
    ) values (
      v_meal.id, v_product.id, v_qty,
      v_product.name, v_product.calories,
      v_product.protein_g, v_product.carbs_g, v_product.fat_g,
      v_product.default_serving_amount, v_product.default_serving_unit,
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

    -- increment product use_count and last_used_at
    update public.products
    set use_count = use_count + 1,
        last_used_at = now(),
        updated_at = now()
    where id = v_product.id;
  end loop;

  -- recalculate meal totals
  update public.meals
  set total_calories = (select coalesce(sum(line_total_calories), 0) from public.meal_items where meal_id = v_meal.id),
      item_count     = (select count(*) from public.meal_items where meal_id = v_meal.id),
      updated_at     = now()
  where id = v_meal.id
  returning * into v_meal;

  -- recalculate daily log totals
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

-- update_meal_with_items
create or replace function public.update_meal_with_items(
  p_meal_id   uuid,
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
  v_meal      meals;
  v_log       daily_logs;
  v_item      jsonb;
  v_product   products;
  v_meal_item meal_items;
  v_items_out jsonb := '[]'::jsonb;
  v_qty       numeric;
  v_line_cal  integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- verify meal ownership
  select * into v_meal from public.meals where id = p_meal_id and user_id = v_user_id;
  if not found then
    raise exception 'Meal not found or not owned: %', p_meal_id;
  end if;

  -- verify daily log is not finalized
  select * into v_log from public.daily_logs where id = v_meal.daily_log_id;
  if v_log.is_finalized then
    raise exception 'Daily log is finalized for this meal';
  end if;

  -- delete existing meal items
  delete from public.meal_items where meal_id = p_meal_id;

  -- update logged_at
  update public.meals set logged_at = p_logged_at, updated_at = now() where id = p_meal_id;

  -- insert new items
  for v_item in select * from jsonb_array_elements(p_items) loop
    if v_item ? 'product_id' then
      -- active product item
      select * into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid and user_id = v_user_id;
      if not found then
        raise exception 'Product not found or not owned: %', v_item->>'product_id';
      end if;

      v_qty := (v_item->>'quantity')::numeric;
      v_line_cal := round(v_qty * v_product.calories);

      insert into public.meal_items (
        meal_id, product_id, quantity,
        product_name_snapshot, calories_per_serving_snapshot,
        protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        serving_amount_snapshot, serving_unit_snapshot,
        line_total_calories
      ) values (
        p_meal_id, v_product.id, v_qty,
        v_product.name, v_product.calories,
        v_product.protein_g, v_product.carbs_g, v_product.fat_g,
        v_product.default_serving_amount, v_product.default_serving_unit,
        v_line_cal
      ) returning * into v_meal_item;

    elsif v_item ? 'meal_item_id' then
      -- reuse deleted-product snapshot from same meal (before deletion)
      -- We need to read the snapshot from the item that was just deleted.
      -- To support this, callers must pass the full snapshot fields for deleted-product items.
      -- The update RPC accepts: meal_item_id (for identification) + quantity + snapshot fields.
      v_qty := (v_item->>'quantity')::numeric;
      v_line_cal := round(v_qty * (v_item->>'calories_per_serving_snapshot')::integer);

      insert into public.meal_items (
        meal_id, product_id, quantity,
        product_name_snapshot, calories_per_serving_snapshot,
        protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        serving_amount_snapshot, serving_unit_snapshot,
        line_total_calories
      ) values (
        p_meal_id, null, v_qty,
        v_item->>'product_name_snapshot',
        (v_item->>'calories_per_serving_snapshot')::integer,
        nullif(v_item->>'protein_g_snapshot', '')::numeric,
        nullif(v_item->>'carbs_g_snapshot', '')::numeric,
        nullif(v_item->>'fat_g_snapshot', '')::numeric,
        nullif(v_item->>'serving_amount_snapshot', '')::numeric,
        nullif(v_item->>'serving_unit_snapshot', ''),
        v_line_cal
      ) returning * into v_meal_item;
    else
      raise exception 'Each item must have product_id or meal_item_id';
    end if;

    v_items_out := v_items_out || jsonb_build_object(
      'id', v_meal_item.id,
      'product_id', v_meal_item.product_id,
      'quantity', v_meal_item.quantity,
      'product_name_snapshot', v_meal_item.product_name_snapshot,
      'calories_per_serving_snapshot', v_meal_item.calories_per_serving_snapshot,
      'line_total_calories', v_meal_item.line_total_calories
    );
  end loop;

  -- recalculate meal totals
  update public.meals
  set total_calories = (select coalesce(sum(line_total_calories), 0) from public.meal_items where meal_id = p_meal_id),
      item_count     = (select count(*) from public.meal_items where meal_id = p_meal_id),
      updated_at     = now()
  where id = p_meal_id
  returning * into v_meal;

  -- recalculate daily log totals
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

-- delete_meal
create or replace function public.delete_meal(p_meal_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_meal    meals;
  v_log     daily_logs;
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
    raise exception 'Daily log is finalized';
  end if;

  -- cascade deletes meal_items
  delete from public.meals where id = p_meal_id;

  -- recalculate daily log totals
  update public.daily_logs
  set total_calories = (select coalesce(sum(total_calories), 0) from public.meals where daily_log_id = v_log.id),
      meal_count     = (select count(*) from public.meals where daily_log_id = v_log.id),
      updated_at     = now()
  where id = v_log.id
  returning * into v_log;

  return json_build_object(
    'deleted_meal_id', p_meal_id,
    'daily_log', row_to_json(v_log)
  );
end;
$$;

-- repeat_last_meal
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

  -- get user timezone
  select timezone into v_tz from public.profiles where user_id = v_user_id;

  -- find most recent meal from any prior date
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

  -- ensure daily log exists and check not finalized
  insert into public.daily_logs (user_id, log_date)
  values (v_user_id, p_log_date)
  on conflict (user_id, log_date) do nothing;

  select * into v_log from public.daily_logs where user_id = v_user_id and log_date = p_log_date;
  if v_log.is_finalized then
    raise exception 'Daily log is finalized for date %', p_log_date;
  end if;

  -- determine logged_at
  v_logged_at := (p_log_date || ' ' || to_char(now() at time zone coalesce(v_tz, 'UTC'), 'HH24:MI:SS'))::timestamptz
                 at time zone coalesce(v_tz, 'UTC');

  -- create new meal
  insert into public.meals (user_id, daily_log_id, logged_at)
  values (v_user_id, v_log.id, v_logged_at)
  returning * into v_new_meal;

  -- copy meal items using original snapshots
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

  -- recalculate meal totals
  update public.meals
  set total_calories = (select coalesce(sum(line_total_calories), 0) from public.meal_items where meal_id = v_new_meal.id),
      item_count     = (select count(*) from public.meal_items where meal_id = v_new_meal.id),
      updated_at     = now()
  where id = v_new_meal.id
  returning * into v_new_meal;

  -- recalculate daily log totals
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
