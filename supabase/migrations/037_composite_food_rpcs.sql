-- migration 037_composite_food_rpcs.sql
-- RPCs for composite food management (build spec §5.1, §5.2)

-- §5.1 — upsert_composite_product
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
  v_whole_cal          integer;
  v_whole_prot         numeric;
  v_whole_carb         numeric;
  v_whole_fat          numeric;
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
      -- User product ingredient
      select * into v_ing_product from products where id = v_ing_product_id;
      if not found then
        raise exception 'Ingredient product not found: %', v_ing_product_id;
      end if;

      -- No nested composites in v1
      if v_ing_product.kind = 'composite' then
        raise exception 'Nested composites are not allowed in v1. Product "%" is a composite.', v_ing_product.name;
      end if;

      -- No self-reference
      if v_ing_product_id = p_product_id then
        raise exception 'A composite product cannot be its own ingredient';
      end if;

      -- Normalize to per-100g (simple product: derive from flat fields)
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
      -- Catalog ingredient
      select * into v_ing_catalog from food_catalog_items where id = v_ing_catalog_id;
      if not found then
        raise exception 'Catalog item not found: %', v_ing_catalog_id;
      end if;

      -- V1 restriction: gram-only catalog items
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

    -- Accumulate totals
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

  -- Convenience whole-recipe totals
  v_whole_cal  := round(v_cal_per_100g  * p_total_mass_g / 100.0);
  v_whole_prot := v_prot_per_100g * p_total_mass_g / 100.0;
  v_whole_carb := v_carb_per_100g * p_total_mass_g / 100.0;
  v_whole_fat  := v_fat_per_100g  * p_total_mass_g / 100.0;

  -- 6. Upsert products row
  if p_product_id is null then
    -- Create
    insert into products (
      user_id, name, calories, protein_g, carbs_g, fat_g,
      kind, total_mass_g, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
      piece_count, piece_label, default_serving_amount, default_serving_unit
    ) values (
      v_user_id, p_name, v_whole_cal, v_whole_prot, v_whole_carb, v_whole_fat,
      'composite', p_total_mass_g, v_cal_per_100g, v_prot_per_100g, v_carb_per_100g, v_fat_per_100g,
      p_piece_count, p_piece_label, 100, 'g'
    )
    returning * into v_product;
  else
    -- Update
    update products set
      name = p_name,
      calories = v_whole_cal,
      protein_g = v_whole_prot,
      carbs_g = v_whole_carb,
      fat_g = v_whole_fat,
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

    -- Resolve name for return value
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

  -- 8. Return
  return jsonb_build_object(
    'product', to_jsonb(v_product),
    'ingredients', v_ingredients_out
  );
end;
$$;


-- §5.2 — get_composite_product
create or replace function public.get_composite_product(
  p_product_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id        uuid;
  v_product        products;
  v_ing            product_recipe_ingredients;
  v_ing_name       text;
  v_ing_calories   numeric;
  v_ingredients_out jsonb := '[]'::jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_product from products where id = p_product_id;
  if not found then
    return null;
  end if;

  if v_product.user_id != v_user_id then
    return null;
  end if;

  -- Fetch ingredients with resolved names
  for v_ing in
    select * from product_recipe_ingredients
    where composite_product_id = p_product_id
    order by sort_order, created_at
  loop
    if v_ing.ingredient_product_id is not null then
      select name, calories into v_ing_name, v_ing_calories from products where id = v_ing.ingredient_product_id;
    else
      select name, calories into v_ing_name, v_ing_calories from food_catalog_items where id = v_ing.ingredient_catalog_item_id;
    end if;

    v_ingredients_out := v_ingredients_out || jsonb_build_object(
      'id', v_ing.id,
      'ingredient_product_id', v_ing.ingredient_product_id,
      'ingredient_catalog_item_id', v_ing.ingredient_catalog_item_id,
      'mass_g', v_ing.mass_g,
      'sort_order', v_ing.sort_order,
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
