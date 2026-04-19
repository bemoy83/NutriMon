-- 041_fix_composite_serving_consistency.sql
-- Fix composite products to store per-100g values in calories/protein_g/carbs_g/fat_g
-- (consistent with default_serving_amount = 100), and fix meal RPCs to not double-divide quantity.
--
-- Root cause: upsert_composite_product stored whole-recipe totals in calories/protein_g/etc.
-- while setting default_serving_amount = 100. This breaks the per-serving contract that
-- simple products follow, causing wrong kcal previews in MealSheet and double-division
-- when the meal RPCs normalize quantity by /100 again.

-- 1. Fix existing composite product data
update public.products
set calories       = round(calories_per_100g),
    protein_g      = protein_per_100g,
    carbs_g        = carbs_per_100g,
    fat_g          = fat_per_100g
where kind = 'composite'
  and calories_per_100g is not null;


-- 2. Fix upsert_composite_product to store per-100g values in the flat fields
create or replace function public.upsert_composite_product(
  p_product_id     uuid,
  p_name           text,
  p_total_mass_g   numeric,
  p_piece_count    integer default null,
  p_piece_label    text    default null,
  p_ingredients    jsonb   default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id            uuid;
  v_product            products;
  v_ingredient         jsonb;
  v_ing_product        products;
  v_ing_catalog        food_catalog_items;
  v_ing_cal_per_100g   numeric;
  v_ing_prot_per_100g  numeric;
  v_ing_carb_per_100g  numeric;
  v_ing_fat_per_100g   numeric;
  v_ing_mass_g         numeric;
  v_total_cal          numeric := 0;
  v_total_prot         numeric := 0;
  v_total_carb         numeric := 0;
  v_total_fat          numeric := 0;
  v_cal_per_100g       numeric;
  v_prot_per_100g      numeric;
  v_carb_per_100g      numeric;
  v_fat_per_100g       numeric;
  v_ing_count          integer;
  v_ing_product_id     uuid;
  v_ing_catalog_id     text;
  v_ing_sort           integer;
  v_inserted_ing       product_recipe_ingredients;
  v_ingredients_out    jsonb := '[]'::jsonb;
  v_ing_name           text;
  v_ing_calories       numeric;
begin
  -- 1. Auth check
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- 2. Validate inputs
  if p_total_mass_g is null or p_total_mass_g <= 0 then
    raise exception 'Total mass must be greater than 0';
  end if;

  v_ing_count := jsonb_array_length(p_ingredients);
  if v_ing_count < 1 then
    raise exception 'At least one ingredient is required';
  end if;

  -- 3. Ownership check for update
  if p_product_id is not null then
    select * into v_product from products where id = p_product_id;
    if not found then
      raise exception 'Product not found';
    end if;
    if v_product.user_id != v_user_id then
      raise exception 'Not authorized to edit this product';
    end if;
  end if;

  -- 4. Validate each ingredient and compute rollup
  for i in 0 .. v_ing_count - 1 loop
    v_ingredient := p_ingredients -> i;
    v_ing_product_id := (v_ingredient ->> 'product_id')::uuid;
    v_ing_catalog_id := v_ingredient ->> 'catalog_item_id';
    v_ing_mass_g     := (v_ingredient ->> 'mass_g')::numeric;
    v_ing_sort       := coalesce((v_ingredient ->> 'sort_order')::integer, i);

    -- XOR check
    if (v_ing_product_id is not null)::int + (v_ing_catalog_id is not null)::int != 1 then
      raise exception 'Each ingredient must have exactly one of product_id or catalog_item_id';
    end if;

    if v_ing_mass_g is null or v_ing_mass_g <= 0 then
      raise exception 'Ingredient mass_g must be greater than 0';
    end if;

    if v_ing_product_id is not null then
      select * into v_ing_product from products where id = v_ing_product_id;
      if not found then
        raise exception 'Ingredient product not found: %', v_ing_product_id;
      end if;

      if v_ing_product.kind = 'composite' then
        raise exception 'Nested composites are not allowed in v1. Product "%" is a composite.', v_ing_product.name;
      end if;

      if v_ing_product_id = p_product_id then
        raise exception 'A composite product cannot be its own ingredient';
      end if;

      if v_ing_product.default_serving_unit is null or v_ing_product.default_serving_unit != 'g' then
        raise exception 'Ingredient product "%" must have default_serving_unit = ''g''', v_ing_product.name;
      end if;
      if v_ing_product.default_serving_amount is null or v_ing_product.default_serving_amount <= 0 then
        raise exception 'Ingredient product "%" must have a positive default_serving_amount', v_ing_product.name;
      end if;

      v_ing_cal_per_100g  := v_ing_product.calories * 100.0 / v_ing_product.default_serving_amount;
      v_ing_prot_per_100g := coalesce(v_ing_product.protein_g, 0) * 100.0 / v_ing_product.default_serving_amount;
      v_ing_carb_per_100g := coalesce(v_ing_product.carbs_g, 0) * 100.0 / v_ing_product.default_serving_amount;
      v_ing_fat_per_100g  := coalesce(v_ing_product.fat_g, 0) * 100.0 / v_ing_product.default_serving_amount;

      v_ing_name     := v_ing_product.name;
      v_ing_calories := v_ing_product.calories;
    else
      select * into v_ing_catalog from food_catalog_items where id = v_ing_catalog_id;
      if not found then
        raise exception 'Catalog item not found: %', v_ing_catalog_id;
      end if;

      if v_ing_catalog.default_serving_unit != 'g' then
        raise exception 'Catalog item "%" must have default_serving_unit = ''g'' (v1 restriction)', v_ing_catalog.name;
      end if;
      if v_ing_catalog.default_serving_amount <= 0 then
        raise exception 'Catalog item "%" must have a positive default_serving_amount', v_ing_catalog.name;
      end if;

      v_ing_cal_per_100g  := v_ing_catalog.calories * 100.0 / v_ing_catalog.default_serving_amount;
      v_ing_prot_per_100g := coalesce(v_ing_catalog.protein_g, 0) * 100.0 / v_ing_catalog.default_serving_amount;
      v_ing_carb_per_100g := coalesce(v_ing_catalog.carbs_g, 0) * 100.0 / v_ing_catalog.default_serving_amount;
      v_ing_fat_per_100g  := coalesce(v_ing_catalog.fat_g, 0) * 100.0 / v_ing_catalog.default_serving_amount;

      v_ing_name     := v_ing_catalog.name;
      v_ing_calories := v_ing_catalog.calories;
    end if;

    v_total_cal  := v_total_cal  + (v_ing_cal_per_100g  * v_ing_mass_g / 100.0);
    v_total_prot := v_total_prot + (v_ing_prot_per_100g * v_ing_mass_g / 100.0);
    v_total_carb := v_total_carb + (v_ing_carb_per_100g * v_ing_mass_g / 100.0);
    v_total_fat  := v_total_fat  + (v_ing_fat_per_100g  * v_ing_mass_g / 100.0);
  end loop;

  -- 5. Compute per-100g from totals using prepared weight
  v_cal_per_100g  := v_total_cal  / p_total_mass_g * 100.0;
  v_prot_per_100g := v_total_prot / p_total_mass_g * 100.0;
  v_carb_per_100g := v_total_carb / p_total_mass_g * 100.0;
  v_fat_per_100g  := v_total_fat  / p_total_mass_g * 100.0;

  -- 6. Upsert products row
  --    Store per-100g values in calories/protein_g/carbs_g/fat_g (= per-serving,
  --    consistent with default_serving_amount = 100).
  if p_product_id is null then
    insert into products (
      user_id, name, calories, protein_g, carbs_g, fat_g,
      kind, total_mass_g, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
      piece_count, piece_label, default_serving_amount, default_serving_unit
    ) values (
      v_user_id, p_name,
      round(v_cal_per_100g), v_prot_per_100g, v_carb_per_100g, v_fat_per_100g,
      'composite', p_total_mass_g, v_cal_per_100g, v_prot_per_100g, v_carb_per_100g, v_fat_per_100g,
      p_piece_count, p_piece_label, 100, 'g'
    )
    returning * into v_product;
  else
    update products set
      name = p_name,
      calories = round(v_cal_per_100g),
      protein_g = v_prot_per_100g,
      carbs_g = v_carb_per_100g,
      fat_g = v_fat_per_100g,
      kind = 'composite',
      total_mass_g = p_total_mass_g,
      calories_per_100g = v_cal_per_100g,
      protein_per_100g = v_prot_per_100g,
      carbs_per_100g = v_carb_per_100g,
      fat_per_100g = v_fat_per_100g,
      piece_count = p_piece_count,
      piece_label = p_piece_label,
      updated_at = now()
    where id = p_product_id
    returning * into v_product;
  end if;

  -- 7. Delete-and-reinsert ingredient rows
  delete from product_recipe_ingredients where composite_product_id = v_product.id;

  for i in 0 .. v_ing_count - 1 loop
    v_ingredient := p_ingredients -> i;
    v_ing_product_id := (v_ingredient ->> 'product_id')::uuid;
    v_ing_catalog_id := v_ingredient ->> 'catalog_item_id';
    v_ing_mass_g     := (v_ingredient ->> 'mass_g')::numeric;
    v_ing_sort       := coalesce((v_ingredient ->> 'sort_order')::integer, i);

    if v_ing_product_id is not null then
      select name, calories into v_ing_name, v_ing_calories from products where id = v_ing_product_id;
    else
      select name, calories into v_ing_name, v_ing_calories from food_catalog_items where id = v_ing_catalog_id;
    end if;

    insert into product_recipe_ingredients (
      composite_product_id, ingredient_product_id, ingredient_catalog_item_id, mass_g, sort_order
    ) values (
      v_product.id, v_ing_product_id, v_ing_catalog_id, v_ing_mass_g, v_ing_sort
    )
    returning * into v_inserted_ing;

    v_ingredients_out := v_ingredients_out || jsonb_build_object(
      'id', v_inserted_ing.id,
      'ingredient_product_id', v_inserted_ing.ingredient_product_id,
      'ingredient_catalog_item_id', v_inserted_ing.ingredient_catalog_item_id,
      'mass_g', v_inserted_ing.mass_g,
      'sort_order', v_inserted_ing.sort_order,
      'name', v_ing_name,
      'calories', v_ing_calories
    );
  end loop;

  return jsonb_build_object(
    'product', to_jsonb(v_product),
    'ingredients', v_ingredients_out
  );
end;
$$;


-- 3. Fix create_meal_with_items: use v_qty directly as stored quantity for composites
--    (client already normalizes: quantity = pendingGrams / servingAmount = grams / 100)
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
        end if;
      else
        -- Simple product: existing behavior unchanged
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
        -- Simple product: existing behavior
        v_line_cal := round(v_qty * v_product.calories);

        insert into public.meal_items (
          meal_id, product_id, catalog_item_id, quantity,
          product_name_snapshot, calories_per_serving_snapshot,
          protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
          serving_amount_snapshot, serving_unit_snapshot, line_total_calories
        ) values (
          p_meal_id, v_product.id, null, v_qty,
          v_product.name, v_product.calories,
          v_product.protein_g, v_product.carbs_g, v_product.fat_g,
          v_product.default_serving_amount, v_product.default_serving_unit, v_line_cal
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
