-- 008_meal_templates.sql
-- Named reusable meal templates

-- 1. meal_name on meals
ALTER TABLE public.meals ADD COLUMN meal_name text;

-- 2. meal_templates table
CREATE TABLE public.meal_templates (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  default_meal_type text,
  use_count        integer     NOT NULL DEFAULT 0,
  last_used_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX meal_templates_user_use ON public.meal_templates (user_id, use_count DESC, last_used_at DESC NULLS LAST);

-- 3. meal_template_items table
CREATE TABLE public.meal_template_items (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id            uuid        NOT NULL REFERENCES public.meal_templates(id) ON DELETE CASCADE,
  product_id             uuid        REFERENCES public.products(id) ON DELETE SET NULL,
  catalog_item_id        text        REFERENCES public.food_catalog_items(id) ON DELETE SET NULL,
  quantity               numeric(8,2) NOT NULL CHECK (quantity > 0),
  name_snapshot          text        NOT NULL,
  calories_snapshot      integer     NOT NULL,
  serving_amount_snapshot numeric(8,2),
  serving_unit_snapshot  text,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX meal_template_items_template ON public.meal_template_items (template_id);

-- 4. RLS
ALTER TABLE public.meal_templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_templates_select" ON public.meal_templates
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "meal_templates_insert" ON public.meal_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meal_templates_update" ON public.meal_templates
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "meal_templates_delete" ON public.meal_templates
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "meal_template_items_select" ON public.meal_template_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.meal_templates t WHERE t.id = template_id AND t.user_id = auth.uid())
  );
CREATE POLICY "meal_template_items_insert" ON public.meal_template_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.meal_templates t WHERE t.id = template_id AND t.user_id = auth.uid())
  );
CREATE POLICY "meal_template_items_delete" ON public.meal_template_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.meal_templates t WHERE t.id = template_id AND t.user_id = auth.uid())
  );

-- 5. Trigger
CREATE TRIGGER meal_templates_updated_at
  BEFORE UPDATE ON public.meal_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 6. create_meal_with_items — add p_meal_name + p_template_id
CREATE OR REPLACE FUNCTION public.create_meal_with_items(
  p_log_date    date,
  p_logged_at   timestamptz,
  p_items       jsonb,
  p_meal_type   text default null,
  p_meal_name   text default null,
  p_template_id uuid default null
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_has_product := v_item ? 'product_id' AND coalesce(v_item->>'product_id', '') <> '';
    v_has_catalog := v_item ? 'catalog_item_id' AND coalesce(v_item->>'catalog_item_id', '') <> '';

    IF (CASE WHEN v_has_product THEN 1 ELSE 0 END) + (CASE WHEN v_has_catalog THEN 1 ELSE 0 END) <> 1 THEN
      RAISE EXCEPTION 'Each item must include exactly one of product_id or catalog_item_id';
    END IF;

    IF v_has_product THEN
      SELECT * INTO v_product FROM public.products
      WHERE id = (v_item->>'product_id')::uuid AND user_id = v_user_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found or not owned: %', v_item->>'product_id';
      END IF;
    ELSE
      SELECT * INTO v_catalog_item FROM public.food_catalog_items
      WHERE id = v_item->>'catalog_item_id';
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Catalog item not found: %', v_item->>'catalog_item_id';
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.daily_logs (user_id, log_date)
  VALUES (v_user_id, p_log_date)
  ON CONFLICT (user_id, log_date) DO NOTHING;

  SELECT * INTO v_log FROM public.daily_logs
  WHERE user_id = v_user_id AND log_date = p_log_date;

  IF v_log.is_finalized THEN
    RAISE EXCEPTION 'Daily log is finalized for date %', p_log_date;
  END IF;

  INSERT INTO public.meals (user_id, daily_log_id, logged_at, meal_type, meal_name)
  VALUES (v_user_id, v_log.id, p_logged_at, p_meal_type, p_meal_name)
  RETURNING * INTO v_meal;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::numeric;
    v_has_product := v_item ? 'product_id' AND coalesce(v_item->>'product_id', '') <> '';

    IF v_has_product THEN
      SELECT * INTO v_product FROM public.products
      WHERE id = (v_item->>'product_id')::uuid AND user_id = v_user_id;

      v_line_cal := round(v_qty * v_product.calories);

      INSERT INTO public.meal_items (
        meal_id, product_id, catalog_item_id, quantity,
        product_name_snapshot, calories_per_serving_snapshot,
        protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        serving_amount_snapshot, serving_unit_snapshot, line_total_calories
      ) VALUES (
        v_meal.id, v_product.id, null, v_qty,
        v_product.name, v_product.calories,
        v_product.protein_g, v_product.carbs_g, v_product.fat_g,
        v_product.default_serving_amount, v_product.default_serving_unit, v_line_cal
      ) RETURNING * INTO v_meal_item;

      UPDATE public.products SET use_count = use_count + 1, last_used_at = now(), updated_at = now()
      WHERE id = v_product.id;
    ELSE
      SELECT * INTO v_catalog_item FROM public.food_catalog_items
      WHERE id = v_item->>'catalog_item_id';

      v_line_cal := round(v_qty * v_catalog_item.calories);

      INSERT INTO public.meal_items (
        meal_id, product_id, catalog_item_id, quantity,
        product_name_snapshot, calories_per_serving_snapshot,
        protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        serving_amount_snapshot, serving_unit_snapshot, line_total_calories
      ) VALUES (
        v_meal.id, null, v_catalog_item.id, v_qty,
        v_catalog_item.name, v_catalog_item.calories,
        v_catalog_item.protein_g, v_catalog_item.carbs_g, v_catalog_item.fat_g,
        v_catalog_item.default_serving_amount, v_catalog_item.default_serving_unit, v_line_cal
      ) RETURNING * INTO v_meal_item;

      INSERT INTO public.catalog_item_usage (user_id, catalog_item_id, use_count, last_used_at)
      VALUES (v_user_id, v_catalog_item.id, 1, now())
      ON CONFLICT (user_id, catalog_item_id) DO UPDATE
      SET use_count = catalog_item_usage.use_count + 1, last_used_at = excluded.last_used_at, updated_at = now();
    END IF;

    v_items_out := v_items_out || jsonb_build_object(
      'id', v_meal_item.id,
      'product_id', v_meal_item.product_id,
      'catalog_item_id', v_meal_item.catalog_item_id,
      'quantity', v_meal_item.quantity,
      'product_name_snapshot', v_meal_item.product_name_snapshot,
      'calories_per_serving_snapshot', v_meal_item.calories_per_serving_snapshot,
      'line_total_calories', v_meal_item.line_total_calories
    );
  END LOOP;

  UPDATE public.meals
  SET total_calories = (SELECT coalesce(sum(line_total_calories), 0) FROM public.meal_items WHERE meal_id = v_meal.id),
      item_count     = (SELECT count(*) FROM public.meal_items WHERE meal_id = v_meal.id),
      updated_at     = now()
  WHERE id = v_meal.id
  RETURNING * INTO v_meal;

  UPDATE public.daily_logs
  SET total_calories = (SELECT coalesce(sum(total_calories), 0) FROM public.meals WHERE daily_log_id = v_log.id),
      meal_count     = (SELECT count(*) FROM public.meals WHERE daily_log_id = v_log.id),
      updated_at     = now()
  WHERE id = v_log.id
  RETURNING * INTO v_log;

  -- increment template use count if logging from a template
  IF p_template_id IS NOT NULL THEN
    UPDATE public.meal_templates
    SET use_count = use_count + 1, last_used_at = now(), updated_at = now()
    WHERE id = p_template_id AND user_id = v_user_id;
  END IF;

  RETURN json_build_object(
    'meal', row_to_json(v_meal),
    'meal_items', v_items_out,
    'daily_log', row_to_json(v_log)
  );
END;
$$;

-- 7. update_meal_with_items — add p_meal_name
CREATE OR REPLACE FUNCTION public.update_meal_with_items(
  p_meal_id   uuid,
  p_logged_at timestamptz,
  p_items     jsonb,
  p_meal_type text default null,
  p_meal_name text default null
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_meal FROM public.meals WHERE id = p_meal_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meal not found or not owned: %', p_meal_id;
  END IF;

  SELECT * INTO v_log FROM public.daily_logs WHERE id = v_meal.daily_log_id;
  IF v_log.is_finalized THEN
    RAISE EXCEPTION 'Daily log is finalized for this meal';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_has_product  := v_item ? 'product_id'   AND coalesce(v_item->>'product_id',   '') <> '';
    v_has_catalog  := v_item ? 'catalog_item_id' AND coalesce(v_item->>'catalog_item_id', '') <> '';
    v_has_snapshot := v_item ? 'meal_item_id'  AND coalesce(v_item->>'meal_item_id',  '') <> '';

    IF (CASE WHEN v_has_product THEN 1 ELSE 0 END)
       + (CASE WHEN v_has_catalog THEN 1 ELSE 0 END)
       + (CASE WHEN v_has_snapshot THEN 1 ELSE 0 END) <> 1 THEN
      RAISE EXCEPTION 'Each item must include exactly one of product_id, catalog_item_id, or meal_item_id';
    END IF;

    IF v_has_product THEN
      SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::uuid AND user_id = v_user_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Product not found or not owned: %', v_item->>'product_id'; END IF;
    ELSIF v_has_catalog THEN
      SELECT * INTO v_catalog_item FROM public.food_catalog_items WHERE id = v_item->>'catalog_item_id';
      IF NOT FOUND THEN RAISE EXCEPTION 'Catalog item not found: %', v_item->>'catalog_item_id'; END IF;
    END IF;
  END LOOP;

  DELETE FROM public.meal_items WHERE meal_id = p_meal_id;

  UPDATE public.meals
  SET logged_at = p_logged_at, meal_type = p_meal_type, meal_name = p_meal_name, updated_at = now()
  WHERE id = p_meal_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_has_product := v_item ? 'product_id' AND coalesce(v_item->>'product_id', '') <> '';
    v_has_catalog := v_item ? 'catalog_item_id' AND coalesce(v_item->>'catalog_item_id', '') <> '';

    IF v_has_product THEN
      SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::uuid AND user_id = v_user_id;
      v_qty := (v_item->>'quantity')::numeric;
      v_line_cal := round(v_qty * v_product.calories);
      INSERT INTO public.meal_items (
        meal_id, product_id, catalog_item_id, quantity,
        product_name_snapshot, calories_per_serving_snapshot,
        protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        serving_amount_snapshot, serving_unit_snapshot, line_total_calories
      ) VALUES (
        p_meal_id, v_product.id, null, v_qty,
        v_product.name, v_product.calories,
        v_product.protein_g, v_product.carbs_g, v_product.fat_g,
        v_product.default_serving_amount, v_product.default_serving_unit, v_line_cal
      ) RETURNING * INTO v_meal_item;
    ELSIF v_has_catalog THEN
      SELECT * INTO v_catalog_item FROM public.food_catalog_items WHERE id = v_item->>'catalog_item_id';
      v_qty := (v_item->>'quantity')::numeric;
      v_line_cal := round(v_qty * v_catalog_item.calories);
      INSERT INTO public.meal_items (
        meal_id, product_id, catalog_item_id, quantity,
        product_name_snapshot, calories_per_serving_snapshot,
        protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        serving_amount_snapshot, serving_unit_snapshot, line_total_calories
      ) VALUES (
        p_meal_id, null, v_catalog_item.id, v_qty,
        v_catalog_item.name, v_catalog_item.calories,
        v_catalog_item.protein_g, v_catalog_item.carbs_g, v_catalog_item.fat_g,
        v_catalog_item.default_serving_amount, v_catalog_item.default_serving_unit, v_line_cal
      ) RETURNING * INTO v_meal_item;
    ELSE
      v_qty := (v_item->>'quantity')::numeric;
      v_line_cal := round(v_qty * (v_item->>'calories_per_serving_snapshot')::integer);
      INSERT INTO public.meal_items (
        meal_id, product_id, catalog_item_id, quantity,
        product_name_snapshot, calories_per_serving_snapshot,
        protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        serving_amount_snapshot, serving_unit_snapshot, line_total_calories
      ) VALUES (
        p_meal_id, null, null, v_qty,
        v_item->>'product_name_snapshot',
        (v_item->>'calories_per_serving_snapshot')::integer,
        nullif(v_item->>'protein_g_snapshot', '')::numeric,
        nullif(v_item->>'carbs_g_snapshot', '')::numeric,
        nullif(v_item->>'fat_g_snapshot', '')::numeric,
        nullif(v_item->>'serving_amount_snapshot', '')::numeric,
        nullif(v_item->>'serving_unit_snapshot', ''),
        v_line_cal
      ) RETURNING * INTO v_meal_item;
    END IF;

    v_items_out := v_items_out || jsonb_build_object(
      'id', v_meal_item.id,
      'product_id', v_meal_item.product_id,
      'catalog_item_id', v_meal_item.catalog_item_id,
      'quantity', v_meal_item.quantity,
      'product_name_snapshot', v_meal_item.product_name_snapshot,
      'calories_per_serving_snapshot', v_meal_item.calories_per_serving_snapshot,
      'line_total_calories', v_meal_item.line_total_calories
    );
  END LOOP;

  UPDATE public.meals
  SET total_calories = (SELECT coalesce(sum(line_total_calories), 0) FROM public.meal_items WHERE meal_id = p_meal_id),
      item_count     = (SELECT count(*) FROM public.meal_items WHERE meal_id = p_meal_id),
      updated_at     = now()
  WHERE id = p_meal_id
  RETURNING * INTO v_meal;

  UPDATE public.daily_logs
  SET total_calories = (SELECT coalesce(sum(total_calories), 0) FROM public.meals WHERE daily_log_id = v_log.id),
      meal_count     = (SELECT count(*) FROM public.meals WHERE daily_log_id = v_log.id),
      updated_at     = now()
  WHERE id = v_log.id
  RETURNING * INTO v_log;

  RETURN json_build_object(
    'meal', row_to_json(v_meal),
    'meal_items', v_items_out,
    'daily_log', row_to_json(v_log)
  );
END;
$$;

-- 8. save_meal_as_template
CREATE OR REPLACE FUNCTION public.save_meal_as_template(
  p_meal_id uuid,
  p_name    text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid;
  v_meal     meals;
  v_item     meal_items;
  v_template meal_templates;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_meal FROM public.meals WHERE id = p_meal_id AND user_id = v_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Meal not found or not owned: %', p_meal_id; END IF;

  INSERT INTO public.meal_templates (user_id, name, default_meal_type)
  VALUES (v_user_id, p_name, v_meal.meal_type)
  RETURNING * INTO v_template;

  FOR v_item IN SELECT * FROM public.meal_items WHERE meal_id = p_meal_id LOOP
    INSERT INTO public.meal_template_items (
      template_id, product_id, catalog_item_id, quantity,
      name_snapshot, calories_snapshot, serving_amount_snapshot, serving_unit_snapshot
    ) VALUES (
      v_template.id, v_item.product_id, v_item.catalog_item_id, v_item.quantity,
      v_item.product_name_snapshot, v_item.calories_per_serving_snapshot,
      v_item.serving_amount_snapshot, v_item.serving_unit_snapshot
    );
  END LOOP;

  RETURN row_to_json(v_template);
END;
$$;

-- 9. delete_meal_template
CREATE OR REPLACE FUNCTION public.delete_meal_template(p_template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM public.meal_templates WHERE id = p_template_id AND user_id = v_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Template not found or not owned: %', p_template_id; END IF;
END;
$$;

-- 10. get_meal_templates — returns templates with nested items as JSON
CREATE OR REPLACE FUNCTION public.get_meal_templates()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  RETURN (
    SELECT coalesce(json_agg(t ORDER BY t.use_count DESC, t.last_used_at DESC NULLS LAST), '[]'::json)
    FROM (
      SELECT
        mt.id, mt.name, mt.default_meal_type, mt.use_count, mt.last_used_at,
        mt.created_at, mt.updated_at,
        (
          SELECT coalesce(json_agg(json_build_object(
            'id',                     mti.id,
            'product_id',             mti.product_id,
            'catalog_item_id',        mti.catalog_item_id,
            'quantity',               mti.quantity,
            'name_snapshot',          mti.name_snapshot,
            'calories_snapshot',      mti.calories_snapshot,
            'serving_amount_snapshot', mti.serving_amount_snapshot,
            'serving_unit_snapshot',  mti.serving_unit_snapshot
          )), '[]'::json)
          FROM public.meal_template_items mti WHERE mti.template_id = mt.id
        ) AS items
      FROM public.meal_templates mt
      WHERE mt.user_id = v_user_id
    ) t
  );
END;
$$;

-- 11. restore_meal_from_snapshot — add p_meal_name parameter
CREATE OR REPLACE FUNCTION public.restore_meal_from_snapshot(
  p_log_date  date,
  p_logged_at timestamptz,
  p_items     jsonb,
  p_meal_type text default null,
  p_meal_name text default null
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid;
  v_log       daily_logs;
  v_meal      meals;
  v_item      jsonb;
  v_meal_item meal_items;
  v_items_out jsonb := '[]'::jsonb;
  v_qty       numeric;
  v_line_cal  integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item is required to restore a meal';
  END IF;

  INSERT INTO public.daily_logs (user_id, log_date)
  VALUES (v_user_id, p_log_date)
  ON CONFLICT (user_id, log_date) DO NOTHING;

  SELECT * INTO v_log
  FROM public.daily_logs
  WHERE user_id = v_user_id AND log_date = p_log_date;

  IF v_log.is_finalized THEN
    RAISE EXCEPTION 'Daily log is finalized for date %', p_log_date;
  END IF;

  INSERT INTO public.meals (user_id, daily_log_id, logged_at, meal_type, meal_name)
  VALUES (v_user_id, v_log.id, p_logged_at, p_meal_type, p_meal_name)
  RETURNING * INTO v_meal;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::numeric;
    v_line_cal := round(v_qty * (v_item->>'calories_per_serving_snapshot')::integer);

    INSERT INTO public.meal_items (
      meal_id, product_id, quantity,
      product_name_snapshot, calories_per_serving_snapshot,
      protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
      serving_amount_snapshot, serving_unit_snapshot,
      line_total_calories
    ) VALUES (
      v_meal.id, null, v_qty,
      v_item->>'product_name_snapshot',
      (v_item->>'calories_per_serving_snapshot')::integer,
      nullif(v_item->>'protein_g_snapshot', '')::numeric,
      nullif(v_item->>'carbs_g_snapshot', '')::numeric,
      nullif(v_item->>'fat_g_snapshot', '')::numeric,
      nullif(v_item->>'serving_amount_snapshot', '')::numeric,
      nullif(v_item->>'serving_unit_snapshot', ''),
      v_line_cal
    ) RETURNING * INTO v_meal_item;

    v_items_out := v_items_out || jsonb_build_object(
      'id', v_meal_item.id,
      'product_id', v_meal_item.product_id,
      'quantity', v_meal_item.quantity,
      'product_name_snapshot', v_meal_item.product_name_snapshot,
      'calories_per_serving_snapshot', v_meal_item.calories_per_serving_snapshot,
      'line_total_calories', v_meal_item.line_total_calories
    );
  END LOOP;

  UPDATE public.meals
  SET total_calories = (SELECT coalesce(sum(line_total_calories), 0) FROM public.meal_items WHERE meal_id = v_meal.id),
      item_count     = (SELECT count(*) FROM public.meal_items WHERE meal_id = v_meal.id),
      updated_at     = now()
  WHERE id = v_meal.id
  RETURNING * INTO v_meal;

  UPDATE public.daily_logs
  SET total_calories = (SELECT coalesce(sum(total_calories), 0) FROM public.meals WHERE daily_log_id = v_log.id),
      meal_count     = (SELECT count(*) FROM public.meals WHERE daily_log_id = v_log.id),
      updated_at     = now()
  WHERE id = v_log.id
  RETURNING * INTO v_log;

  RETURN json_build_object(
    'meal', row_to_json(v_meal),
    'meal_items', v_items_out,
    'daily_log', row_to_json(v_log)
  );
END;
$$;
