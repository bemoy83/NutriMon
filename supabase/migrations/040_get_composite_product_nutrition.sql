-- 040_get_composite_product_nutrition.sql
-- Fix get_composite_product to return per-100g nutrition for each ingredient,
-- so the CompositeFoodSheet edit-mode rollup preview can reconstruct correct values.

create or replace function public.get_composite_product(
  p_product_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id            uuid;
  v_product            products;
  v_ing                product_recipe_ingredients;
  v_ing_product        products;
  v_ing_catalog        food_catalog_items;
  v_ing_name           text;
  v_ing_calories       numeric;
  v_ing_cal_per_100g   numeric;
  v_ing_prot_per_100g  numeric;
  v_ing_carb_per_100g  numeric;
  v_ing_fat_per_100g   numeric;
  v_ingredients_out    jsonb := '[]'::jsonb;
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

  -- Fetch ingredients with resolved names and per-100g nutrition
  for v_ing in
    select * from product_recipe_ingredients
    where composite_product_id = p_product_id
    order by sort_order, created_at
  loop
    if v_ing.ingredient_product_id is not null then
      select * into v_ing_product from products where id = v_ing.ingredient_product_id;

      v_ing_name     := v_ing_product.name;
      v_ing_calories := v_ing_product.calories;

      -- Derive per-100g from flat fields (same logic as upsert_composite_product)
      if v_ing_product.default_serving_amount is not null and v_ing_product.default_serving_amount > 0 then
        v_ing_cal_per_100g  := v_ing_product.calories * 100.0 / v_ing_product.default_serving_amount;
        v_ing_prot_per_100g := coalesce(v_ing_product.protein_g, 0) * 100.0 / v_ing_product.default_serving_amount;
        v_ing_carb_per_100g := coalesce(v_ing_product.carbs_g, 0) * 100.0 / v_ing_product.default_serving_amount;
        v_ing_fat_per_100g  := coalesce(v_ing_product.fat_g, 0) * 100.0 / v_ing_product.default_serving_amount;
      else
        v_ing_cal_per_100g  := 0;
        v_ing_prot_per_100g := 0;
        v_ing_carb_per_100g := 0;
        v_ing_fat_per_100g  := 0;
      end if;
    else
      select * into v_ing_catalog from food_catalog_items where id = v_ing.ingredient_catalog_item_id;

      v_ing_name     := v_ing_catalog.name;
      v_ing_calories := v_ing_catalog.calories;

      if v_ing_catalog.default_serving_amount > 0 then
        v_ing_cal_per_100g  := v_ing_catalog.calories * 100.0 / v_ing_catalog.default_serving_amount;
        v_ing_prot_per_100g := coalesce(v_ing_catalog.protein_g, 0) * 100.0 / v_ing_catalog.default_serving_amount;
        v_ing_carb_per_100g := coalesce(v_ing_catalog.carbs_g, 0) * 100.0 / v_ing_catalog.default_serving_amount;
        v_ing_fat_per_100g  := coalesce(v_ing_catalog.fat_g, 0) * 100.0 / v_ing_catalog.default_serving_amount;
      else
        v_ing_cal_per_100g  := 0;
        v_ing_prot_per_100g := 0;
        v_ing_carb_per_100g := 0;
        v_ing_fat_per_100g  := 0;
      end if;
    end if;

    v_ingredients_out := v_ingredients_out || jsonb_build_object(
      'id', v_ing.id,
      'ingredient_product_id', v_ing.ingredient_product_id,
      'ingredient_catalog_item_id', v_ing.ingredient_catalog_item_id,
      'mass_g', v_ing.mass_g,
      'sort_order', v_ing.sort_order,
      'name', v_ing_name,
      'calories', v_ing_calories,
      'calories_per_100g', v_ing_cal_per_100g,
      'protein_per_100g', v_ing_prot_per_100g,
      'carbs_per_100g', v_ing_carb_per_100g,
      'fat_per_100g', v_ing_fat_per_100g
    );
  end loop;

  return jsonb_build_object(
    'product', to_jsonb(v_product),
    'ingredients', v_ingredients_out
  );
end;
$$;
