-- migration 036_composite_foods_schema.sql
-- Composite foods schema extensions (build spec §3.1–§3.4)

-- §3.1 — Enum for product kind
CREATE TYPE public.product_kind AS ENUM ('simple', 'composite');

ALTER TABLE public.products
  ADD COLUMN kind          public.product_kind NOT NULL DEFAULT 'simple',
  ADD COLUMN total_mass_g  numeric(10,2) NULL CHECK (total_mass_g IS NULL OR total_mass_g > 0),
  ADD COLUMN calories_per_100g  numeric(8,4) NULL CHECK (calories_per_100g IS NULL OR calories_per_100g >= 0),
  ADD COLUMN protein_per_100g   numeric(8,4) NULL CHECK (protein_per_100g  IS NULL OR protein_per_100g >= 0),
  ADD COLUMN carbs_per_100g     numeric(8,4) NULL CHECK (carbs_per_100g    IS NULL OR carbs_per_100g >= 0),
  ADD COLUMN fat_per_100g       numeric(8,4) NULL CHECK (fat_per_100g      IS NULL OR fat_per_100g >= 0),
  ADD COLUMN piece_count        integer      NULL CHECK (piece_count IS NULL OR piece_count > 0),
  ADD COLUMN piece_label        text         NULL;  -- e.g. "slice", "sandwich", "cookie"

-- Constraint: per-100g fields and total_mass_g are required for composite products
-- Enforced at RPC level (not DB-level, to allow partial saves in authoring UI flow)

COMMENT ON COLUMN public.products.kind IS 'simple: flat nutrition entry; composite: built from recipe_ingredients';
COMMENT ON COLUMN public.products.total_mass_g IS 'Total cooked/prepared mass of the full recipe (grams). Required for composites.';
COMMENT ON COLUMN public.products.calories_per_100g IS 'Rolled-up from recipe ingredients. Derived field — do not edit directly.';
COMMENT ON COLUMN public.products.piece_count IS 'Number of equal-sized pieces in the full recipe (e.g. 8 for a pizza). NULL = weight-only logging.';
COMMENT ON COLUMN public.products.piece_label IS 'Human label for a single piece, e.g. "slice" or "sandwich".';

-- §3.2 — product_recipe_ingredients table
CREATE TABLE public.product_recipe_ingredients (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  composite_product_id uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  -- exactly one of the following two columns is non-null:
  ingredient_product_id      uuid NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  ingredient_catalog_item_id text NULL REFERENCES public.food_catalog_items(id) ON DELETE RESTRICT,
  mass_g               numeric(10,2) NOT NULL CHECK (mass_g > 0),
  sort_order           integer      NOT NULL DEFAULT 0,
  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT ingredient_source_xor CHECK (
    (ingredient_product_id IS NOT NULL)::int +
    (ingredient_catalog_item_id IS NOT NULL)::int = 1
  ),
  CONSTRAINT no_self_reference CHECK (
    ingredient_product_id IS DISTINCT FROM composite_product_id
  )
);

CREATE INDEX idx_recipe_ingredients_composite ON public.product_recipe_ingredients (composite_product_id);

COMMENT ON TABLE public.product_recipe_ingredients IS
  'Ingredient rows for composite products. Each row is one ingredient with a mass_g. '
  'Exactly one of ingredient_product_id or ingredient_catalog_item_id must be set. '
  'Nested composites (composite-as-ingredient) are blocked in v1 at RPC level.';

-- §3.3 — RLS for product_recipe_ingredients
ALTER TABLE public.product_recipe_ingredients ENABLE ROW LEVEL SECURITY;

-- Read: user can read ingredients of their own composites
CREATE POLICY "owner can read recipe ingredients"
  ON public.product_recipe_ingredients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = composite_product_id AND p.user_id = auth.uid()
    )
  );

-- Write: user can insert/update/delete ingredients of their own composites
CREATE POLICY "owner can write recipe ingredients"
  ON public.product_recipe_ingredients FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = composite_product_id AND p.user_id = auth.uid()
    )
  );

-- §3.4 — Block deletion of ingredient products
CREATE OR REPLACE FUNCTION public.check_product_not_used_as_ingredient()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.product_recipe_ingredients
    WHERE ingredient_product_id = OLD.id
  ) THEN
    RAISE EXCEPTION
      'Cannot delete product "%" — it is used as an ingredient in one or more recipes. Remove it from those recipes first.',
      OLD.name;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_block_ingredient_product_delete
  BEFORE DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.check_product_not_used_as_ingredient();
