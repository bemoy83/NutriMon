-- Slice C (deploy): merge-on-append per docs/daily-log-meal-slots-technical-spec.md §8.
-- Re-applies the full create_meal_with_items body so environments that already ran an
-- earlier 032 (append-only) pick up line merge without editing a recorded migration file.
-- Fresh db reset: 032 then 033 both REPLACE the same function — idempotent end state.

create or replace function public.create_meal_with_items(
  p_log_date    date,
  p_logged_at   timestamptz,
  p_items       jsonb,
  p_meal_type   text default null,
  p_meal_name   text default null,
  p_template_id uuid default null
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
  v_preview           json;
  v_is_standard       boolean;
  v_merge_target_id   uuid;
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
      select *
      into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid
        and user_id = v_user_id;

      if not found then
        raise exception 'Product not found or not owned: %', v_item->>'product_id';
      end if;
    else
      select *
      into v_catalog_item
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
    v_merge_target_id := null;
    v_has_product := v_item ? 'product_id' and coalesce(v_item->>'product_id', '') <> '';

    if v_has_product then
      select *
      into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid
        and user_id = v_user_id;

      select mi.id
      into v_merge_target_id
      from public.meal_items mi
      where mi.meal_id = v_meal.id
        and mi.product_id = v_product.id
        and mi.catalog_item_id is null
        and mi.product_name_snapshot = v_product.name
        and mi.calories_per_serving_snapshot = v_product.calories
        and mi.protein_g_snapshot is not distinct from v_product.protein_g
        and mi.carbs_g_snapshot is not distinct from v_product.carbs_g
        and mi.fat_g_snapshot is not distinct from v_product.fat_g
        and mi.serving_amount_snapshot is not distinct from v_product.default_serving_amount
        and mi.serving_unit_snapshot is not distinct from v_product.default_serving_unit
      limit 1
      for update;

      if v_merge_target_id is not null then
        update public.meal_items mi
        set quantity = mi.quantity + v_qty,
            line_total_calories = round((mi.quantity + v_qty) * mi.calories_per_serving_snapshot::numeric)::integer
        where mi.id = v_merge_target_id
        returning * into v_meal_item;
      else
        v_line_cal := round(v_qty * v_product.calories);

        insert into public.meal_items (
          meal_id, product_id, catalog_item_id, quantity,
          product_name_snapshot, calories_per_serving_snapshot,
          protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
          serving_amount_snapshot, serving_unit_snapshot, line_total_calories
        ) values (
          v_meal.id, v_product.id, null, v_qty,
          v_product.name, v_product.calories,
          v_product.protein_g, v_product.carbs_g, v_product.fat_g,
          v_product.default_serving_amount, v_product.default_serving_unit, v_line_cal
        ) returning * into v_meal_item;
      end if;

      update public.products
      set use_count = use_count + 1,
          last_used_at = now(),
          updated_at = now()
      where id = v_product.id;
    else
      select *
      into v_catalog_item
      from public.food_catalog_items
      where id = v_item->>'catalog_item_id';

      select mi.id
      into v_merge_target_id
      from public.meal_items mi
      where mi.meal_id = v_meal.id
        and mi.product_id is null
        and mi.catalog_item_id = v_catalog_item.id
        and mi.product_name_snapshot = v_catalog_item.name
        and mi.calories_per_serving_snapshot = v_catalog_item.calories
        and mi.protein_g_snapshot is not distinct from v_catalog_item.protein_g
        and mi.carbs_g_snapshot is not distinct from v_catalog_item.carbs_g
        and mi.fat_g_snapshot is not distinct from v_catalog_item.fat_g
        and mi.serving_amount_snapshot is not distinct from v_catalog_item.default_serving_amount
        and mi.serving_unit_snapshot is not distinct from v_catalog_item.default_serving_unit
      limit 1
      for update;

      if v_merge_target_id is not null then
        update public.meal_items mi
        set quantity = mi.quantity + v_qty,
            line_total_calories = round((mi.quantity + v_qty) * mi.calories_per_serving_snapshot::numeric)::integer
        where mi.id = v_merge_target_id
        returning * into v_meal_item;
      else
        v_line_cal := round(v_qty * v_catalog_item.calories);

        insert into public.meal_items (
          meal_id, product_id, catalog_item_id, quantity,
          product_name_snapshot, calories_per_serving_snapshot,
          protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
          serving_amount_snapshot, serving_unit_snapshot, line_total_calories
        ) values (
          v_meal.id, null, v_catalog_item.id, v_qty,
          v_catalog_item.name, v_catalog_item.calories,
          v_catalog_item.protein_g, v_catalog_item.carbs_g, v_catalog_item.fat_g,
          v_catalog_item.default_serving_amount, v_catalog_item.default_serving_unit, v_line_cal
        ) returning * into v_meal_item;
      end if;

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

  if p_template_id is not null then
    update public.meal_templates
    set use_count = use_count + 1,
        last_used_at = now(),
        updated_at = now()
    where id = p_template_id
      and user_id = v_user_id;
  end if;

  v_preview := public.calculate_creature_preview(v_user_id, p_log_date);

  return json_build_object(
    'meal', row_to_json(v_meal),
    'meal_items', v_items_out,
    'daily_log', row_to_json(v_log),
    'creature_preview', v_preview
  );
end;
$$;
