-- 042_simple_products_per_100g.sql
-- Simple products: canonical per-100g nutrition, fixed 100g reference for meal quantity (grams/100).
-- Optional label_portion_grams for manufacturer portion UX only.

alter table public.products
  add column if not exists label_portion_grams numeric(8,2) null
  check (label_portion_grams is null or label_portion_grams > 0);

comment on column public.products.label_portion_grams is
  'Optional manufacturer portion size in grams (label). Not the meal quantity divisor; logging uses per-100g density with quantity = grams/100.';

-- Preserve prior non-100g serving size as label portion hint
update public.products p
set label_portion_grams = p.default_serving_amount
where p.kind = 'simple'
  and p.default_serving_amount is not null
  and p.default_serving_amount <> 100;

-- Derive per-100g columns for simple products (respect existing calories_per_100g when set)
update public.products p
set
  calories_per_100g = case
    when p.calories_per_100g is not null then p.calories_per_100g
    else p.calories::numeric * 100.0 / nullif(coalesce(p.default_serving_amount, 100), 0)
  end,
  protein_per_100g = case
    when p.protein_per_100g is not null then p.protein_per_100g
    when p.protein_g is null then null
    else p.protein_g * 100.0 / nullif(coalesce(p.default_serving_amount, 100), 0)
  end,
  carbs_per_100g = case
    when p.carbs_per_100g is not null then p.carbs_per_100g
    when p.carbs_g is null then null
    else p.carbs_g * 100.0 / nullif(coalesce(p.default_serving_amount, 100), 0)
  end,
  fat_per_100g = case
    when p.fat_per_100g is not null then p.fat_per_100g
    when p.fat_g is null then null
    else p.fat_g * 100.0 / nullif(coalesce(p.default_serving_amount, 100), 0)
  end
where p.kind = 'simple';

-- Flat columns mirror per-100g; fixed 100 g reference row-wide
update public.products p
set
  calories = round(p.calories_per_100g),
  protein_g = p.protein_per_100g,
  carbs_g = p.carbs_per_100g,
  fat_g = p.fat_per_100g,
  default_serving_amount = 100,
  default_serving_unit = 'g'
where p.kind = 'simple'
  and p.calories_per_100g is not null;

-- Templates: legacy quantity was multiples of arbitrary serving_amount_snapshot; normalize to grams/100 units
update public.meal_template_items mti
set
  quantity = round((mti.quantity * mti.serving_amount_snapshot / 100.0)::numeric, 8),
  serving_amount_snapshot = 100,
  serving_unit_snapshot = 'g'
where mti.serving_amount_snapshot is not null
  and mti.serving_amount_snapshot > 0
  and mti.serving_amount_snapshot <> 100
  and (mti.serving_unit_snapshot is null or lower(trim(mti.serving_unit_snapshot)) = 'g');

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
  -- composite quantity mode vars
  v_cq_mode           text;
  v_stored_qty        numeric;
  v_snap_cal          integer;
  v_snap_prot         numeric;
  v_snap_carb         numeric;
  v_snap_fat          numeric;
  v_snap_serving_amt  numeric;
  v_snap_serving_unit text;
  v_grams_per_piece   numeric;
  v_inserted_ids      uuid[] := array[]::uuid[];
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Validation pass
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

  -- Ensure daily log
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

  -- Get or create meal
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

  -- Insert items
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

      -- Determine composite quantity mode
      v_cq_mode := coalesce(v_item->>'composite_quantity_mode', '');

      if v_product.kind = 'composite' then
        -- Default to grams if omitted
        if v_cq_mode = '' or v_cq_mode = 'grams' then
          -- Gram mode: quantity is already normalized (grams / 100) by the client
          v_stored_qty        := v_qty;
          v_snap_cal          := v_product.calories;
          v_snap_prot         := v_product.protein_g;
          v_snap_carb         := v_product.carbs_g;
          v_snap_fat          := v_product.fat_g;
          v_snap_serving_amt  := 100;
          v_snap_serving_unit := 'g';
        elsif v_cq_mode = 'pieces' then
          -- Piece mode (§4.2B)
          if v_product.piece_count is null or v_product.piece_count <= 0 then
            raise exception 'Product "%" does not support piece-based logging (piece_count is null)', v_product.name;
          end if;
          v_grams_per_piece   := v_product.total_mass_g / v_product.piece_count;
          v_stored_qty        := v_qty;  -- piece count directly
          v_snap_cal          := round(v_product.calories_per_100g * v_grams_per_piece / 100.0);
          v_snap_prot         := v_product.protein_per_100g * v_grams_per_piece / 100.0;
          v_snap_carb         := v_product.carbs_per_100g * v_grams_per_piece / 100.0;
          v_snap_fat          := v_product.fat_per_100g * v_grams_per_piece / 100.0;
          v_snap_serving_amt  := v_grams_per_piece;
          v_snap_serving_unit := coalesce(v_product.piece_label, 'piece');
        else
          raise exception 'Invalid composite_quantity_mode: %', v_cq_mode;
        end if;

        v_line_cal := round(v_stored_qty * v_snap_cal);

        -- Merge check: same product_id + matching snapshot fields
        select mi.id
        into v_merge_target_id
        from public.meal_items mi
        where mi.meal_id = v_meal.id
          and mi.product_id = v_product.id
          and mi.catalog_item_id is null
          and mi.product_name_snapshot = v_product.name
          and mi.calories_per_serving_snapshot = v_snap_cal
          and mi.protein_g_snapshot is not distinct from v_snap_prot
          and mi.carbs_g_snapshot is not distinct from v_snap_carb
          and mi.fat_g_snapshot is not distinct from v_snap_fat
          and mi.serving_amount_snapshot is not distinct from v_snap_serving_amt
          and mi.serving_unit_snapshot is not distinct from v_snap_serving_unit
        limit 1
        for update;

        if v_merge_target_id is not null then
          update public.meal_items mi
          set quantity = mi.quantity + v_stored_qty,
              line_total_calories = round((mi.quantity + v_stored_qty) * mi.calories_per_serving_snapshot::numeric)::integer
          where mi.id = v_merge_target_id
          returning * into v_meal_item;
        else
          insert into public.meal_items (
            meal_id, product_id, catalog_item_id, quantity,
            product_name_snapshot, calories_per_serving_snapshot,
            protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
            serving_amount_snapshot, serving_unit_snapshot, line_total_calories
          ) values (
            v_meal.id, v_product.id, null, v_stored_qty,
            v_product.name, v_snap_cal,
            v_snap_prot, v_snap_carb, v_snap_fat,
            v_snap_serving_amt, v_snap_serving_unit, v_line_cal
          ) returning * into v_meal_item;
          v_inserted_ids := array_append(v_inserted_ids, v_meal_item.id);
        end if;
      else
        -- Simple product: nutrition per 100 g; client quantity = grams / 100
        v_snap_cal := round(coalesce(v_product.calories_per_100g, v_product.calories::numeric))::integer;
        v_snap_prot := coalesce(v_product.protein_per_100g, v_product.protein_g);
        v_snap_carb := coalesce(v_product.carbs_per_100g, v_product.carbs_g);
        v_snap_fat := coalesce(v_product.fat_per_100g, v_product.fat_g);
        v_snap_serving_amt := 100::numeric;
        v_snap_serving_unit := 'g';
        v_stored_qty := v_qty;

        v_line_cal := round(v_stored_qty * v_snap_cal);

        select mi.id
        into v_merge_target_id
        from public.meal_items mi
        where mi.meal_id = v_meal.id
          and mi.product_id = v_product.id
          and mi.catalog_item_id is null
          and mi.product_name_snapshot = v_product.name
          and mi.calories_per_serving_snapshot = v_snap_cal
          and mi.protein_g_snapshot is not distinct from v_snap_prot
          and mi.carbs_g_snapshot is not distinct from v_snap_carb
          and mi.fat_g_snapshot is not distinct from v_snap_fat
          and mi.serving_amount_snapshot is not distinct from v_snap_serving_amt
          and mi.serving_unit_snapshot is not distinct from v_snap_serving_unit
        limit 1
        for update;

        if v_merge_target_id is not null then
          update public.meal_items mi
          set quantity = mi.quantity + v_stored_qty,
              line_total_calories = round((mi.quantity + v_stored_qty) * mi.calories_per_serving_snapshot::numeric)::integer
          where mi.id = v_merge_target_id
          returning * into v_meal_item;
        else
          insert into public.meal_items (
            meal_id, product_id, catalog_item_id, quantity,
            product_name_snapshot, calories_per_serving_snapshot,
            protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
            serving_amount_snapshot, serving_unit_snapshot, line_total_calories
          ) values (
            v_meal.id, v_product.id, null, v_stored_qty,
            v_product.name, v_snap_cal,
            v_snap_prot, v_snap_carb, v_snap_fat,
            v_snap_serving_amt, v_snap_serving_unit, v_line_cal
          ) returning * into v_meal_item;
          v_inserted_ids := array_append(v_inserted_ids, v_meal_item.id);
        end if;
      end if;

      update public.products
      set use_count = use_count + 1,
          last_used_at = now(),
          updated_at = now()
      where id = v_product.id;
    else
      -- Catalog item: existing behavior unchanged
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
        v_inserted_ids := array_append(v_inserted_ids, v_meal_item.id);
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

  -- Update meal totals
  update public.meals
  set total_calories = (select coalesce(sum(line_total_calories), 0) from public.meal_items where meal_id = v_meal.id),
      item_count = (select count(*) from public.meal_items where meal_id = v_meal.id),
      updated_at = now()
  where id = v_meal.id
  returning * into v_meal;

  -- Update daily log totals
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
    'inserted_meal_item_ids', v_inserted_ids,
    'daily_log', row_to_json(v_log),
    'creature_preview', v_preview
  );
end;
$$;
-- 4. Fix update_meal_with_items: same composite quantity fix
create or replace function public.update_meal_with_items(
  p_meal_id   uuid,
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
  v_preview      json;
  -- composite quantity mode vars
  v_cq_mode           text;
  v_stored_qty        numeric;
  v_snap_cal          integer;
  v_snap_prot         numeric;
  v_snap_carb         numeric;
  v_snap_fat          numeric;
  v_snap_serving_amt  numeric;
  v_snap_serving_unit text;
  v_grams_per_piece   numeric;
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

  -- Validation pass
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
      select * into v_product from public.products where id = (v_item->>'product_id')::uuid and user_id = v_user_id;
      if not found then raise exception 'Product not found or not owned: %', v_item->>'product_id'; end if;
    elsif v_has_catalog then
      select * into v_catalog_item from public.food_catalog_items where id = v_item->>'catalog_item_id';
      if not found then raise exception 'Catalog item not found: %', v_item->>'catalog_item_id'; end if;
    end if;
  end loop;

  -- Delete existing items and rebuild
  delete from public.meal_items where meal_id = p_meal_id;

  update public.meals
  set logged_at = p_logged_at,
      meal_type = p_meal_type,
      meal_name = p_meal_name,
      updated_at = now()
  where id = p_meal_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_has_product := v_item ? 'product_id' and coalesce(v_item->>'product_id', '') <> '';
    v_has_catalog := v_item ? 'catalog_item_id' and coalesce(v_item->>'catalog_item_id', '') <> '';

    if v_has_product then
      select * into v_product from public.products where id = (v_item->>'product_id')::uuid and user_id = v_user_id;
      v_qty := (v_item->>'quantity')::numeric;

      v_cq_mode := coalesce(v_item->>'composite_quantity_mode', '');

      if v_product.kind = 'composite' then
        if v_cq_mode = '' or v_cq_mode = 'grams' then
          -- Gram mode: quantity already normalized by client (grams / 100)
          v_stored_qty        := v_qty;
          v_snap_cal          := v_product.calories;
          v_snap_prot         := v_product.protein_g;
          v_snap_carb         := v_product.carbs_g;
          v_snap_fat          := v_product.fat_g;
          v_snap_serving_amt  := 100;
          v_snap_serving_unit := 'g';
        elsif v_cq_mode = 'pieces' then
          if v_product.piece_count is null or v_product.piece_count <= 0 then
            raise exception 'Product "%" does not support piece-based logging (piece_count is null)', v_product.name;
          end if;
          v_grams_per_piece   := v_product.total_mass_g / v_product.piece_count;
          v_stored_qty        := v_qty;
          v_snap_cal          := round(v_product.calories_per_100g * v_grams_per_piece / 100.0);
          v_snap_prot         := v_product.protein_per_100g * v_grams_per_piece / 100.0;
          v_snap_carb         := v_product.carbs_per_100g * v_grams_per_piece / 100.0;
          v_snap_fat          := v_product.fat_per_100g * v_grams_per_piece / 100.0;
          v_snap_serving_amt  := v_grams_per_piece;
          v_snap_serving_unit := coalesce(v_product.piece_label, 'piece');
        else
          raise exception 'Invalid composite_quantity_mode: %', v_cq_mode;
        end if;

        v_line_cal := round(v_stored_qty * v_snap_cal);

        insert into public.meal_items (
          meal_id, product_id, catalog_item_id, quantity,
          product_name_snapshot, calories_per_serving_snapshot,
          protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
          serving_amount_snapshot, serving_unit_snapshot, line_total_calories
        ) values (
          p_meal_id, v_product.id, null, v_stored_qty,
          v_product.name, v_snap_cal,
          v_snap_prot, v_snap_carb, v_snap_fat,
          v_snap_serving_amt, v_snap_serving_unit, v_line_cal
        ) returning * into v_meal_item;
      else
        -- Simple product: nutrition per 100 g; client quantity = grams / 100
        v_snap_cal := round(coalesce(v_product.calories_per_100g, v_product.calories::numeric))::integer;
        v_snap_prot := coalesce(v_product.protein_per_100g, v_product.protein_g);
        v_snap_carb := coalesce(v_product.carbs_per_100g, v_product.carbs_g);
        v_snap_fat := coalesce(v_product.fat_per_100g, v_product.fat_g);
        v_snap_serving_amt := 100::numeric;
        v_snap_serving_unit := 'g';
        v_stored_qty := v_qty;

        v_line_cal := round(v_stored_qty * v_snap_cal);

        insert into public.meal_items (
          meal_id, product_id, catalog_item_id, quantity,
          product_name_snapshot, calories_per_serving_snapshot,
          protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
          serving_amount_snapshot, serving_unit_snapshot, line_total_calories
        ) values (
          p_meal_id, v_product.id, null, v_stored_qty,
          v_product.name, v_snap_cal,
          v_snap_prot, v_snap_carb, v_snap_fat,
          v_snap_serving_amt, v_snap_serving_unit, v_line_cal
        ) returning * into v_meal_item;
      end if;
    elsif v_has_catalog then
      select * into v_catalog_item from public.food_catalog_items where id = v_item->>'catalog_item_id';
      v_qty := (v_item->>'quantity')::numeric;
      v_line_cal := round(v_qty * v_catalog_item.calories);

      insert into public.meal_items (
        meal_id, product_id, catalog_item_id, quantity,
        product_name_snapshot, calories_per_serving_snapshot,
        protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        serving_amount_snapshot, serving_unit_snapshot, line_total_calories
      ) values (
        p_meal_id, null, v_catalog_item.id, v_qty,
        v_catalog_item.name, v_catalog_item.calories,
        v_catalog_item.protein_g, v_catalog_item.carbs_g, v_catalog_item.fat_g,
        v_catalog_item.default_serving_amount, v_catalog_item.default_serving_unit, v_line_cal
      ) returning * into v_meal_item;
    else
      -- Snapshot-based item (meal_item_id path)
      v_qty := (v_item->>'quantity')::numeric;
      v_line_cal := round(v_qty * (v_item->>'calories_per_serving_snapshot')::integer);

      insert into public.meal_items (
        meal_id, product_id, catalog_item_id, quantity,
        product_name_snapshot, calories_per_serving_snapshot,
        protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        serving_amount_snapshot, serving_unit_snapshot, line_total_calories
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

  -- Update meal totals
  update public.meals
  set total_calories = (select coalesce(sum(line_total_calories), 0) from public.meal_items where meal_id = p_meal_id),
      item_count = (select count(*) from public.meal_items where meal_id = p_meal_id),
      updated_at = now()
  where id = p_meal_id
  returning * into v_meal;

  -- Update daily log totals
  update public.daily_logs
  set total_calories = (select coalesce(sum(total_calories), 0) from public.meals where daily_log_id = v_log.id),
      meal_count = (select count(*) from public.meals where daily_log_id = v_log.id),
      updated_at = now()
  where id = v_log.id
  returning * into v_log;

  v_preview := public.calculate_creature_preview(v_user_id, v_log.log_date);

  return json_build_object(
    'meal', row_to_json(v_meal),
    'meal_items', v_items_out,
    'daily_log', row_to_json(v_log),
    'creature_preview', v_preview
  );
end;
$$;

-- Food sources: expose per-100g density and optional label portion for logging UX
-- Return type (OUT columns) changed — must drop; CREATE OR REPLACE cannot alter it.
drop function if exists public.get_recent_food_sources(integer);
drop function if exists public.get_frequent_food_sources(integer);
drop function if exists public.search_food_sources(text, integer);

create or replace function public.get_recent_food_sources(p_limit integer default 20)
returns table (
  source_type text,
  source_id text,
  name text,
  calories integer,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  default_serving_amount numeric,
  default_serving_unit text,
  use_count integer,
  last_used_at timestamptz,
  kind text,
  piece_count integer,
  piece_label text,
  total_mass_g numeric,
  calories_per_100g numeric,
  label_portion_grams numeric
)
language sql
stable
set search_path = public
as $$
  with merged as (
    select
      'user_product'::text as source_type,
      p.id::text as source_id,
      p.name,
      p.calories,
      p.protein_g,
      p.carbs_g,
      p.fat_g,
      p.default_serving_amount,
      p.default_serving_unit,
      p.use_count,
      p.last_used_at,
      0 as source_rank,
      p.kind::text as kind,
      p.piece_count,
      p.piece_label,
      p.total_mass_g,
      coalesce(p.calories_per_100g, p.calories::numeric) as calories_per_100g,
      p.label_portion_grams
    from public.products p
    where p.user_id = auth.uid()
      and p.last_used_at is not null

    union all

    select
      'catalog_item'::text as source_type,
      c.id::text as source_id,
      c.name,
      c.calories,
      c.protein_g,
      c.carbs_g,
      c.fat_g,
      c.default_serving_amount,
      c.default_serving_unit,
      u.use_count,
      u.last_used_at,
      1 as source_rank,
      'simple'::text as kind,
      null::integer as piece_count,
      null::text as piece_label,
      null::numeric as total_mass_g,
      c.calories::numeric as calories_per_100g,
      null::numeric as label_portion_grams
    from public.catalog_item_usage u
    join public.food_catalog_items c on c.id = u.catalog_item_id
    where u.user_id = auth.uid()
      and u.last_used_at is not null
  )
  select
    source_type,
    source_id,
    name,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    default_serving_amount,
    default_serving_unit,
    use_count,
    last_used_at,
    kind,
    piece_count,
    piece_label,
    total_mass_g,
    calories_per_100g,
    label_portion_grams
  from merged
  order by last_used_at desc, source_rank asc, name asc
  limit greatest(coalesce(p_limit, 20), 0);
$$;

create or replace function public.get_frequent_food_sources(p_limit integer default 10)
returns table (
  source_type text,
  source_id text,
  name text,
  calories integer,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  default_serving_amount numeric,
  default_serving_unit text,
  use_count integer,
  last_used_at timestamptz,
  kind text,
  piece_count integer,
  piece_label text,
  total_mass_g numeric,
  calories_per_100g numeric,
  label_portion_grams numeric
)
language sql
stable
set search_path = public
as $$
  with merged as (
    select
      'user_product'::text as source_type,
      p.id::text as source_id,
      p.name,
      p.calories,
      p.protein_g,
      p.carbs_g,
      p.fat_g,
      p.default_serving_amount,
      p.default_serving_unit,
      p.use_count,
      p.last_used_at,
      0 as source_rank,
      p.kind::text as kind,
      p.piece_count,
      p.piece_label,
      p.total_mass_g,
      coalesce(p.calories_per_100g, p.calories::numeric) as calories_per_100g,
      p.label_portion_grams
    from public.products p
    where p.user_id = auth.uid()
      and p.use_count > 0

    union all

    select
      'catalog_item'::text as source_type,
      c.id::text as source_id,
      c.name,
      c.calories,
      c.protein_g,
      c.carbs_g,
      c.fat_g,
      c.default_serving_amount,
      c.default_serving_unit,
      u.use_count,
      u.last_used_at,
      1 as source_rank,
      'simple'::text as kind,
      null::integer as piece_count,
      null::text as piece_label,
      null::numeric as total_mass_g,
      c.calories::numeric as calories_per_100g,
      null::numeric as label_portion_grams
    from public.catalog_item_usage u
    join public.food_catalog_items c on c.id = u.catalog_item_id
    where u.user_id = auth.uid()
      and u.use_count > 0
  )
  select
    source_type,
    source_id,
    name,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    default_serving_amount,
    default_serving_unit,
    use_count,
    last_used_at,
    kind,
    piece_count,
    piece_label,
    total_mass_g,
    calories_per_100g,
    label_portion_grams
  from merged
  order by use_count desc, last_used_at desc nulls last, source_rank asc, name asc
  limit greatest(coalesce(p_limit, 10), 0);
$$;

create or replace function public.search_food_sources(
  p_query text,
  p_limit integer default 20
)
returns table (
  source_type text,
  source_id text,
  name text,
  calories integer,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  default_serving_amount numeric,
  default_serving_unit text,
  use_count integer,
  last_used_at timestamptz,
  kind text,
  piece_count integer,
  piece_label text,
  total_mass_g numeric,
  calories_per_100g numeric,
  label_portion_grams numeric
)
language sql
stable
set search_path = public
as $$
  with search_input as (
    select trim(coalesce(p_query, '')) as query
  ),
  merged as (
    select
      'user_product'::text as source_type,
      p.id::text as source_id,
      p.name,
      p.calories,
      p.protein_g,
      p.carbs_g,
      p.fat_g,
      p.default_serving_amount,
      p.default_serving_unit,
      p.use_count,
      p.last_used_at,
      0 as source_rank,
      case
        when lower(p.name) = lower(s.query)              then 0
        when lower(p.name) like lower(s.query) || '%'    then 1
        else                                                  2
      end as match_rank,
      p.kind::text as kind,
      p.piece_count,
      p.piece_label,
      p.total_mass_g,
      coalesce(p.calories_per_100g, p.calories::numeric) as calories_per_100g,
      p.label_portion_grams
    from public.products p
    cross join search_input s
    where p.user_id = auth.uid()
      and s.query <> ''
      and p.name ilike '%' || s.query || '%'

    union all

    select
      'catalog_item'::text as source_type,
      c.id::text as source_id,
      c.name,
      c.calories,
      c.protein_g,
      c.carbs_g,
      c.fat_g,
      c.default_serving_amount,
      c.default_serving_unit,
      coalesce(u.use_count, 0) as use_count,
      u.last_used_at,
      1 as source_rank,
      case
        when lower(c.name) = lower(s.query)              then 0
        when lower(c.name) like lower(s.query) || '%'    then 1
        else                                                  2
      end as match_rank,
      'simple'::text as kind,
      null::integer as piece_count,
      null::text as piece_label,
      null::numeric as total_mass_g,
      c.calories::numeric as calories_per_100g,
      null::numeric as label_portion_grams
    from public.food_catalog_items c
    cross join search_input s
    left join public.catalog_item_usage u
      on u.catalog_item_id = c.id and u.user_id = auth.uid()
    where s.query <> ''
      and c.name ilike '%' || s.query || '%'
  )
  select
    source_type,
    source_id,
    name,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    default_serving_amount,
    default_serving_unit,
    use_count,
    last_used_at,
    kind,
    piece_count,
    piece_label,
    total_mass_g,
    calories_per_100g,
    label_portion_grams
  from merged
  order by match_rank asc, source_rank asc, use_count desc, last_used_at desc nulls last, name asc
  limit greatest(coalesce(p_limit, 20), 0);
$$;
