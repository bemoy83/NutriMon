# Composite Foods — Implementation Build Spec

**Status:** Build spec — v1.3  
**Date:** 2026-04-18  
**Phase:** Ready for implementation  
**Depends on:** Option B (meal slots) complete, migrations 001–035 in place

**Related docs:**
- Prep doc / locked rules: [composite-food-implementation-notes.md](./composite-food-implementation-notes.md)
- Meal slots spec: [daily-log-meal-slots-technical-spec.md](./daily-log-meal-slots-technical-spec.md)
- Gap matrix: [daily-log-meal-centric-gap-matrix.md](./daily-log-meal-centric-gap-matrix.md)

---

## 1. Scope (this spec)

This spec covers **composite food definition, authoring, and logging** — the minimum slice required to close gaps CF1–CF6. It does not include meal planning, shopping lists, or social features.

**In scope:**
- `products` schema extension: `kind`, `total_mass_g`, `piece_count`, `piece_label`, per-100g rollup columns
- New `product_recipe_ingredients` table
- Snapshot contract on `meal_items` for composite products (no schema change needed)
- Two new RPCs: `upsert_composite_product`, `get_composite_product`
- Extension of `create_meal_with_items` and `update_meal_with_items` to handle composite quantity semantics (grams or piece fraction)
- **My food** route and authoring UI: simple food CRUD + composite builder
- Logging UX: composite quantity selection (grams or pieces) in `MealSheet`

**Out of scope (v1):**
- Nested composites (composite as ingredient of another composite)
- Shopping lists, meal planning, social recipe feeds
- Catalog ingredient units other than grams (v1 restricts catalog ingredients to `default_serving_unit = 'g'`; see §4.1)

---

## 2. Resolved open decisions

| Decision | Resolution | Rationale |
|---|---|---|
| **Nested composites** | **Not allowed in v1.** A composite ingredient must be a `products` row with `kind = 'simple'` or a `food_catalog_items` row. | Simplifies rollup math and RLS; can unlock in v2. |
| **Ingredient deletion** | **Block.** Deleting a `products` row that is an active ingredient in any composite is rejected with a descriptive error. The user must remove the ingredient from all composites first, or the deletion soft-deletes (archive flag). Pick **block with clear error** for v1. | Avoids orphaned ingredient rows invalidating rollup math. |
| **Piece vs weight UX** | **Both available per food.** At definition time the user sets whether piece-based logging is offered (by providing `piece_count > 0`). Gram-based logging is always available. | Maximises flexibility without forcing the user to choose. |
| **`p_total_mass_g` vs SUM of ingredients** | **Post-cook weight; may differ from ingredient sum.** `p_total_mass_g` is the user-measured prepared/cooked weight (what you actually serve from). `SUM(ingredient_mass_g)` is raw input weight, used only to compute ingredient-contributed nutrition. The two can differ (cooking loss, added water). Only `p_total_mass_g > 0` is validated. | Matches real-world culinary use; per-100g math must use the weight you actually eat from, not raw ingredient weight. |
| **Composite definition versioning** | **Deferred (v1).** `meal_items` will not store a `composite_definition_id` or recipe revision marker. Snapshot immutability is the sole correctness guard: the RPC writes all nutrition fields at log time from the current product rollup, and those rows are never rewritten. Versioning can be added in v2 if audit or support requirements arise. | Eliminates a schema column and join on every meal-write without sacrificing the "future edits only" invariant. |
| **Catalog ingredient freshness** | **Live until recipe-save.** Catalog nutrition is read from `food_catalog_items` when the recipe is saved (not snapshotted on the ingredient row). The resulting rollup (`products.calories_per_100g` etc.) is used at log time. A catalog change between recipe-save and logging uses the stale rollup until the user re-saves the recipe. Past `meal_items` rows retain their existing snapshots unchanged. | Catalog items rarely change; staleness surprise between saves is lower than the complexity of re-reading catalog items at every log event. |

---

## 3. Schema — migrations

### 3.1 Migration 036 — `products` table extensions

```sql
-- migration 036_composite_foods_schema.sql

-- Enum for product kind
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
```

### 3.2 Migration 036 — `product_recipe_ingredients` table

```sql
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
```

### 3.3 Migration 036 — RLS for `product_recipe_ingredients`

```sql
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
```

### 3.4 Migration 036 — block deletion of ingredient products

```sql
-- Prevent deleting a products row that is an active composite ingredient
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
```

> **Note — soft-delete future-proofing:** This trigger fires on physical `DELETE` only. If a soft-delete mechanism (e.g. an `archived_at` column) is added to `products` in the future, `product_recipe_ingredients` will still hold a live FK reference to a soft-deleted row. At that point, add a parallel check that soft-deleting an ingredient product also blocks (or warns) when it is referenced by any composite. Do not rely solely on this trigger for soft-delete paths.

### 3.5 `meal_items` — no column schema change; merge branch must be extended

No new columns are needed. The existing snapshot contract already supports composite products **if** the RPC writes fields with consistent semantics. The critical invariant that the merge formula relies on is:

> **`line_total_calories = ROUND(quantity × calories_per_serving_snapshot)` must hold for every row.**

All existing RPCs maintain this invariant for simple products. The composite extension must maintain it too. At log time the RPC resolves and writes:

**Gram mode** (client input: `logged_grams`):
- `quantity` = `logged_grams / 100.0` (stored as a fractional 100g-unit count, e.g. 150g → 1.5)
- `calories_per_serving_snapshot` = `ROUND(calories_per_100g)` (kcal per 100g, integer)
- `serving_amount_snapshot` = `100` (fixed 100g reference)
- `serving_unit_snapshot` = `'g'`
- Macro snapshots (`protein_g_snapshot`, etc.) = macros per 100g of composite

**Piece mode** (client input: `piece_count_logged`):
- `grams_per_piece = total_mass_g / piece_count`
- `quantity` = `piece_count_logged` (stored directly, e.g. 2)
- `calories_per_serving_snapshot` = `ROUND(calories_per_100g * grams_per_piece / 100)` (kcal per piece)
- `serving_amount_snapshot` = `grams_per_piece` (grams per piece, for display)
- `serving_unit_snapshot` = `piece_label` (e.g. `'slice'`)
- Macro snapshots = macros per 1 piece of composite

**Why 100g as the gram-mode reference (not 1g):** `calories_per_serving_snapshot` is an integer column. Storing kcal-per-gram would lose all fractional precision for low-calorie foods. Using 100g as the reference keeps the same convention as gram-based simple products in the existing codebase.

**Merge-branch extension:** The merge path in `create_meal_with_items` must be extended to handle composites. When the merge condition is met (same `product_id`, compatible snapshots), the existing formula `ROUND((mi.quantity + v_qty) * mi.calories_per_serving_snapshot)` remains valid without modification, because the per-100g reference semantics are identical to the existing simple-product merge path. However, the **insert path** for composite items must normalize the client-supplied raw grams into `quantity = grams / 100` and build the snapshot before applying the merge check. Add an explicit branch for `v_product.kind = 'composite'` in both the merge-check block and the insert block.

---

## 4. Nutrition rollup math

### 4.1 At recipe save time (computed server-side in `upsert_composite_product`)

#### Catalog ingredient normalization (v1 restriction)

Before any rollup math, each ingredient's nutrition must be expressed as kcal / macros per 100g.

- **User `products` ingredients:** use `products.calories_per_100g` directly if the product is composite, or derive from flat fields: `per_100g = calories * 100 / default_serving_amount` when `default_serving_unit = 'g'`. If `default_serving_unit` is not `'g'` (or is NULL), the RPC rejects the ingredient with an error — the user must define the product with a gram-based serving.
- **Catalog `food_catalog_items` ingredients:** `default_serving_unit` is `'g'` for the vast majority of rows (the canonical source uses grams). Normalization: `per_100g = calories * 100 / default_serving_amount`. **V1 restriction:** if `default_serving_unit != 'g'`, reject with an error. The `IngredientPickerSheet` must also filter out non-gram catalog items to prevent the error reaching the RPC.

#### Rollup computation

```
-- For each ingredient i:
-- ing_cal_per_100g  = derived per normalization rule above
-- ing_mass_g        = product_recipe_ingredients.mass_g  (raw ingredient mass)

total_ingredient_calories = SUM(ing_cal_per_100g_i  * ing_mass_g_i / 100)
total_ingredient_protein  = SUM(ing_prot_per_100g_i * ing_mass_g_i / 100)
total_ingredient_carbs    = SUM(ing_carb_per_100g_i * ing_mass_g_i / 100)
total_ingredient_fat      = SUM(ing_fat_per_100g_i  * ing_mass_g_i / 100)

-- p_total_mass_g is the POST-COOK/PREPARED weight provided by the user.
-- It is NOT required to equal SUM(ing_mass_g) and typically differs (cooking
-- evaporation, added water, etc.). Validate only that p_total_mass_g > 0.
-- Per-100g figures are derived from total ingredient nutrition ÷ prepared weight
-- because that is the weight the user actually portions from.

products.total_mass_g    = p_total_mass_g             -- user-measured prepared weight

products.calories_per_100g  = total_ingredient_calories / p_total_mass_g * 100
products.protein_per_100g   = total_ingredient_protein  / p_total_mass_g * 100
products.carbs_per_100g     = total_ingredient_carbs    / p_total_mass_g * 100
products.fat_per_100g       = total_ingredient_fat      / p_total_mass_g * 100

-- Convenience totals stored on the products row (= "whole recipe" nutrition):
products.calories  = ROUND(products.calories_per_100g * p_total_mass_g / 100)
products.protein_g = products.protein_per_100g * p_total_mass_g / 100
products.carbs_g   = products.carbs_per_100g   * p_total_mass_g / 100
products.fat_g     = products.fat_per_100g     * p_total_mass_g / 100
```

The UI should display both "raw ingredient total" (`SUM(ing_mass_g)`) and "prepared weight" (`p_total_mass_g`) in the builder so the user understands the difference (raw vs cooked).

Catalog ingredient calories/macros are read from `food_catalog_items` at recipe-save time and rolled up into `products.calories_per_100g` (not snapshotted on the ingredient row). The product's stored rollup is what the log-time RPC uses — catalog items are not re-read at log time. See resolved decision in §2.

### 4.2 At log time — resolving RPC input to `meal_items` snapshot

The client sends raw user input (grams or piece count). The RPC normalises to the **100g reference convention** for grams mode to satisfy `line_total_calories = ROUND(quantity × calories_per_serving_snapshot)` and keep compatibility with the merge formula. See §3.5 for the rationale.

**RPC item input (what the client sends):**

| Log mode | `quantity` in JSONB | `composite_quantity_mode` |
|---|---|---|
| By grams | raw grams (e.g. `150`) | `"grams"` |
| By pieces | piece count (e.g. `2`) | `"pieces"` |

**RPC normalisation → what gets stored in `meal_items`:**

**A. Gram mode**

```
-- Client sends: quantity = logged_grams (e.g. 150)
stored_quantity               = logged_grams / 100.0          -- e.g. 1.5
calories_per_serving_snapshot = ROUND(calories_per_100g)       -- kcal per 100g (integer)
protein_g_snapshot            = protein_per_100g               -- macros per 100g
carbs_g_snapshot              = carbs_per_100g
fat_g_snapshot                = fat_per_100g
serving_amount_snapshot       = 100                            -- fixed 100g reference
serving_unit_snapshot         = 'g'

-- Verify: ROUND(1.5 × ROUND(calories_per_100g)) ≈ calories for 150g ✓
```

**B. Piece mode**

```
-- Client sends: quantity = piece_count_logged (e.g. 2)
grams_per_piece               = total_mass_g / piece_count
stored_quantity               = piece_count_logged             -- e.g. 2
calories_per_serving_snapshot = ROUND(calories_per_100g * grams_per_piece / 100)  -- kcal per 1 piece
protein_g_snapshot            = protein_per_100g * grams_per_piece / 100          -- macros per 1 piece
carbs_g_snapshot              = carbs_per_100g   * grams_per_piece / 100
fat_g_snapshot                = fat_per_100g     * grams_per_piece / 100
serving_amount_snapshot       = grams_per_piece  -- grams per piece (display only)
serving_unit_snapshot         = piece_label       -- e.g. 'slice'

-- Verify: ROUND(2 × kcal_per_piece) = calories for 2 pieces ✓
```

**Merge formula compatibility:** The existing `ROUND((mi.quantity + v_qty) * mi.calories_per_serving_snapshot)` works unchanged for both modes because `calories_per_serving_snapshot` = kcal per 1 unit of `quantity` in both cases.

---

## 5. RPCs

### 5.1 `upsert_composite_product`

**Purpose:** Create or update a composite product and its ingredient list. Recomputes rollup fields atomically.

```sql
CREATE OR REPLACE FUNCTION public.upsert_composite_product(
  p_product_id           uuid,             -- null → create; non-null → update
  p_name                 text,
  p_total_mass_g         numeric,          -- provided by user (post-cook weight)
  p_piece_count          integer,          -- null if weight-only
  p_piece_label          text,             -- null if weight-only
  p_ingredients          jsonb             -- array of ingredient objects (see below)
) RETURNS jsonb
```

**Ingredient object shape:**
```jsonb
{
  "product_id":        "<uuid>|null",
  "catalog_item_id":   "<text>|null",
  "mass_g":            <number>,
  "sort_order":        <int>
}
```

**Security:** This RPC must be `SECURITY DEFINER` to write across tables (products, product_recipe_ingredients). Because `SECURITY DEFINER` bypasses RLS, the RPC must **explicitly check `auth.uid()`** for all ownership assertions — do not rely on RLS being applied. Pattern: verify `products.user_id = auth.uid()` in the first step and `RAISE EXCEPTION` if not. Client-facing RPCs in this codebase use RPC-only writes (the anon/authenticated role does not INSERT directly), so this is the standard pattern.

**Server-side logic:**
1. Validate `auth.uid()` is non-null; validate caller owns `p_product_id` (if update, `products.user_id = auth.uid()`).
2. Validate `p_total_mass_g > 0` and `ARRAY_LENGTH(p_ingredients) >= 1`.
3. Validate each ingredient: exactly one source; no nested composites (`kind != 'composite'`); ingredient `default_serving_unit = 'g'` (catalog) or user product has gram-based serving (see §4.1 normalization rules).
4. Resolve each ingredient's nutrition and normalise to per-100g (§4.1).
5. Compute rollup totals and per-100g fields using `p_total_mass_g` as the denominator.
6. Upsert `products` row with `kind = 'composite'`, all rollup fields.
7. Delete-and-reinsert `product_recipe_ingredients` rows (reordering is clean this way).
8. Return full product row + ingredient list.

**Returns:**
```jsonb
{
  "product": { ...ProductRow with new composite columns },
  "ingredients": [ { "id", "ingredient_product_id", "ingredient_catalog_item_id", "mass_g", "sort_order", "name", "calories" }, ... ]
}
```

### 5.2 `get_composite_product`

**Purpose:** Fetch a composite product with its current ingredient list and per-ingredient nutrition for the builder UI.

```sql
CREATE OR REPLACE FUNCTION public.get_composite_product(
  p_product_id uuid
) RETURNS jsonb
```

**Returns:** Same shape as `upsert_composite_product` return. Validates ownership. Returns `null` if not found or not owned by caller.

### 5.3 `create_meal_with_items` / `update_meal_with_items` — composite quantity extension

No new RPC. Extend the existing `p_items` JSONB item object with two optional fields:

```jsonb
{
  "product_id": "<uuid>",
  "quantity": <number>,                              // raw user input: grams OR piece count (see below)
  "composite_quantity_mode": "grams" | "pieces"      // NEW — only meaningful for composite products
}
```

**Quantity semantics per mode (client sends raw input; RPC normalises before storing):**

| `composite_quantity_mode` | client `quantity` | stored `meal_items.quantity` |
|---|---|---|
| `"grams"` | raw grams (e.g. `150`) | `logged_grams / 100.0` (e.g. `1.5`) |
| `"pieces"` | piece count (e.g. `2`) | piece count unchanged (`2`) |
| omitted / simple product | existing semantics | unchanged |

- For **simple** products: `composite_quantity_mode` is ignored; existing `quantity` × snapshot logic unchanged.
- For **composite** products: the RPC applies the normalization in §4.2 to produce the correct snapshot fields before inserting or merging.
- If `composite_quantity_mode` is omitted for a composite product: default to `'grams'`.

**Merge branch — explicit extension required:** The merge-check block in `create_meal_with_items` (the `FOUND` branch on matching `product_id` + compatible snapshots) currently assumes `v_qty = input.quantity` and `v_line_cal = ROUND(v_qty * v_product.calories)`. For composite items, `v_qty` must instead be the **normalised** stored quantity (grams→100g-units or piece count) computed before the merge check is evaluated. Add a dedicated `IF v_product.kind = 'composite' THEN ... END IF;` block in both the **normalisation step** and the **insert step**. The merge formula itself (`ROUND((mi.quantity + v_qty) * mi.calories_per_serving_snapshot)`) requires no change once `v_qty` is normalised.

**Merge key** for standard-slot append: composite products merge on `product_id` + matching `serving_unit_snapshot` (gram vs piece modes must not merge into each other). Distinct composites are never merged with each other or with their ingredient lines.

---

## 6. TypeScript types

### 6.1 `ProductRow` extension

```typescript
// src/types/database.ts — extend existing ProductRow
export interface ProductRow {
  // ... existing fields unchanged ...
  kind: 'simple' | 'composite'
  total_mass_g: number | null
  calories_per_100g: number | null
  protein_per_100g: number | null
  carbs_per_100g: number | null
  fat_per_100g: number | null
  piece_count: number | null
  piece_label: string | null
}
```

### 6.2 New `ProductRecipeIngredientRow`

```typescript
// src/types/database.ts
export interface ProductRecipeIngredientRow {
  id: string
  composite_product_id: string
  ingredient_product_id: string | null
  ingredient_catalog_item_id: string | null
  mass_g: number
  sort_order: number
  created_at: string
  updated_at: string
}
```

### 6.3 `CompositeProductWithIngredients` (domain + UI)

```typescript
// src/types/domain.ts
export interface RecipeIngredient {
  id: string                            // ingredient row id
  sourceType: 'product' | 'catalog'
  sourceId: string                      // product_id or catalog_item_id
  name: string                          // resolved name (for display)
  massG: number
  sortOrder: number
  // nutrition per 100g of this ingredient (resolved at fetch time)
  caloriesPer100g: number
  proteinPer100g: number | null
  carbsPer100g: number | null
  fatPer100g: number | null
}

export interface CompositeProduct extends Product {
  kind: 'composite'
  totalMassG: number
  caloriesPer100g: number
  proteinPer100g: number | null
  carbsPer100g: number | null
  fatPer100g: number | null
  pieceCount: number | null
  pieceLabel: string | null
  ingredients: RecipeIngredient[]
}
```

### 6.4 Logging item extension

```typescript
// Extend the internal Item type in MealSheet.tsx
interface Item {
  // ... existing fields ...
  compositeQuantityMode?: 'grams' | 'pieces'  // only set for composite products
}
```

---

## 7. API layer (`src/features/logging/api.ts` and new `src/features/foods/api.ts`)

### 7.1 New: `src/features/foods/api.ts`

```typescript
// Create or update a composite product
upsertCompositeProduct(params: UpsertCompositeProductParams): Promise<CompositeProduct>

// Fetch composite product + ingredients for editor
getCompositeProduct(productId: string): Promise<CompositeProduct | null>

// Fetch all user products (simple + composite) for My food list
getUserProducts(userId: string): Promise<Product[]>

// Delete a product (throws if used as ingredient)
deleteProduct(productId: string): Promise<void>
```

### 7.2 Modify: `createMealWithItems` / `updateMealWithItems`

Add `compositeQuantityMode?: 'grams' | 'pieces'` to the `MealItemInput` type and pass through to the RPC JSONB payload.

---

## 8. UI — component map

### 8.1 Route: `/app/my-food`

New dedicated route. Replaces the foods section currently on Profile.

**Screen: `MyFoodScreen`**
- List of user's products (simple + composite), sorted by `use_count DESC`
- Search bar (client-side filter on name)
- FAB / "New food" → opens `FoodTypePickerSheet` (see §8.2)
- Tap existing food → opens `SimpleFoodSheet` (simple) or `CompositeFoodSheet` (composite) in edit mode
- Swipe-to-delete (blocked with error toast if ingredient in active recipe)

### 8.2 `FoodTypePickerSheet` (new)

Simple two-option bottom sheet:
- **"Simple food"** — flat macros entry (existing `ProductForm` flow)
- **"Recipe / composite"** — opens `CompositeFoodSheet` in create mode

Follows existing bottom sheet token/structural standard (see feedback memory).

### 8.3 `SimpleFoodSheet` (rename/refactor of existing `ProductForm`)

Minimal change: add `kind = 'simple'` on save, expose route from My food and from MealSheet "Create new food" CTA.

### 8.4 `CompositeFoodSheet` (new)

Full-screen or tall bottom sheet. Sections:

**Header fields:**
- Recipe name (required)
- Total prepared mass (g) — required, labeled "Total weight after cooking"
- Piece count (optional) — labeled "Number of servings/pieces (optional)"
- Piece label (optional) — labeled e.g. "slice", "sandwich" — shown only when piece count > 0

**Ingredient list:**
- Reorderable list of ingredients (drag handle)
- Each row: ingredient name + mass (g) + inline delete
- "Add ingredient" → opens `IngredientPickerSheet` (§8.5)
- Live rollup preview panel (updates as ingredients/masses change): total calories, protein, carbs, fat; per-100g values; per-piece values if piece_count > 0

**Footer actions:**
- Cancel, Save (validates: name, total_mass_g, ≥1 ingredient)

**Edit mode:** Pre-filled from `getCompositeProduct`. Save calls `upsertCompositeProduct`.

### 8.5 `IngredientPickerSheet` (new)

Reuses food search infrastructure from `MealSheet`. Tabs:
- **My foods** (simple products only — composites excluded in v1)
- **Catalog**

On selection → inline mass input (grams, required) → confirm → ingredient added to list.

### 8.6 `MealSheet` — composite quantity selector

When a user adds a composite product to a meal:

- If `piece_count` is set: show toggle "By weight (g) / By piece count"
  - By weight: quantity input in grams
  - By piece count: stepper with `piece_label` unit (e.g. "2 slices")
- If `piece_count` is null: quantity input in grams only (no toggle)

Live calorie preview on the item row reflects resolved calories using §4.2 math.

### 8.7 Profile page

Remove foods list from Profile. Add "My food →" navigation link in the account/settings section.

---

## 9. Rollup preview computation (client-side, for builder UI)

The `CompositeFoodSheet` must show live nutrition preview without a server round-trip. Client computes:

**Prerequisite — ingredient per-100g values:** The `RecipeIngredient` type (§6.3) carries `caloriesPer100g` etc., which are resolved by `get_composite_product` (edit mode) or by `IngredientPickerSheet` at selection time (create mode). For catalog items, the picker normalises: `caloriesPer100g = calories * 100 / defaultServingAmount` before adding to the draft list, and must reject items where `defaultServingUnit !== 'g'`. This keeps the client rollup math identical to the server.

```typescript
function computeRollup(ingredients: DraftIngredient[], totalMassG: number, pieceCount: number | null) {
  const totals = ingredients.reduce((acc, ing) => ({
    calories: acc.calories + (ing.caloriesPer100g * ing.massG / 100),
    protein:  acc.protein  + ((ing.proteinPer100g  ?? 0) * ing.massG / 100),
    carbs:    acc.carbs    + ((ing.carbsPer100g    ?? 0) * ing.massG / 100),
    fat:      acc.fat      + ((ing.fatPer100g      ?? 0) * ing.massG / 100),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  const per100g = totalMassG > 0 ? {
    calories: totals.calories / totalMassG * 100,
    protein:  totals.protein  / totalMassG * 100,
    carbs:    totals.carbs    / totalMassG * 100,
    fat:      totals.fat      / totalMassG * 100,
  } : null

  const perPiece = (per100g && pieceCount && pieceCount > 0) ? {
    calories: per100g.calories * (totalMassG / pieceCount) / 100,
    protein:  per100g.protein  * (totalMassG / pieceCount) / 100,
    carbs:    per100g.carbs    * (totalMassG / pieceCount) / 100,
    fat:      per100g.fat      * (totalMassG / pieceCount) / 100,
  } : null

  return { totals, per100g, perPiece }
}
```

The server recomputes identically when saving — client and server should agree. Any discrepancy beyond floating point rounding is a bug.

---

## 10. Data integrity rules

| Rule | Enforcement |
|---|---|
| `kind = 'composite'` requires `total_mass_g` | RPC (`upsert_composite_product`) |
| `kind = 'composite'` requires ≥ 1 ingredient | RPC |
| Ingredient source XOR | DB constraint |
| No nested composites (ingredient `kind != 'composite'`) | RPC |
| No self-reference ingredient | DB constraint |
| Block delete of ingredient products | DB trigger |
| Past `meal_items` never rewritten on recipe edit | RPC (upsert only touches `products` + `product_recipe_ingredients`) |
| Standard-slot merge: composite is its own identity | Same **formula** as today (`ROUND((qty_sum) × calories_per_serving_snapshot)`); merge **predicate** gains composite handling (normalize `v_qty` first) and must treat **gram vs piece** as non-mergeable via `serving_unit_snapshot` (and compatible snapshots) per §5.3 |

---

## 11. Acceptance criteria (testable)

| ID | Scenario | Expected |
|---|---|---|
| AC1 | Create composite food "Spaghetti" with 3 ingredients, total 400g, 4 pieces. | Saved with correct per-100g rollup; piece math = total ÷ 4. |
| AC2 | Log "Spaghetti" by pieces: 1 piece (e.g. 4 pieces, 400g prepared → `grams_per_piece = 100`). | `meal_items`: `quantity = 1`, `serving_unit_snapshot = piece_label` (e.g. `'slice'`), `serving_amount_snapshot = grams_per_piece` (100), `calories_per_serving_snapshot = ROUND(calories_per_100g * grams_per_piece / 100)` (kcal per piece). `line_total_calories = ROUND(1 × calories_per_serving_snapshot)` ≈ ¼ total recipe calories (within ±1 kcal rounding). |
| AC3 | Log "Spaghetti" by grams: 150g. | `meal_items`: `quantity = 1.5`, `serving_amount_snapshot = 100`, `serving_unit_snapshot = 'g'`, `calories_per_serving_snapshot = ROUND(calories_per_100g)`. `line_total_calories = ROUND(1.5 × ROUND(calories_per_100g))` within ±1 kcal. |
| AC4 | Edit "Spaghetti" recipe (add ingredient). | Previous `meal_items` rows unchanged. New log shows updated nutrition. |
| AC5 | Log "Spaghetti" on Monday. Edit recipe. Check Monday's log. | Monday's `line_total_calories` and snapshots unchanged. |
| AC6 | Attempt to delete a simple product used as ingredient. | Error toast: "Used in recipe [name]. Remove it from the recipe first." |
| AC7 | Log simple product and composite in same Breakfast slot. | Composite appears as its own line item, not merged with ingredient rows. `total_calories` on meal is sum of all lines. |
| AC8 | Create composite, log, verify `daily_logs.total_calories` | Matches sum of all `meal.total_calories` for that day. |
| AC9 | Composite with `piece_count = null`. Log via MealSheet. | Only grams input shown; no piece toggle. |
| AC10 | My food list: shows simple and composite, sorted by use_count. | Composite shows "Recipe" badge. Simple shows no badge. |

---

## 12. Implementation order

Work should be sequenced to keep the app functional at each step:

1. **Migration 036** — schema extensions (non-breaking: all new columns are nullable or have defaults; no existing query breaks).
2. **TypeScript type updates** — `ProductRow`, new `ProductRecipeIngredientRow`, domain types. No UI changes yet.
3. **RPC: `upsert_composite_product` + `get_composite_product`** — server-side build and validate in isolation.
4. **RPC: extend `create_meal_with_items` / `update_meal_with_items`** for composite quantity mode.
5. **`src/features/foods/api.ts`** — new API module wrapping the new RPCs.
6. **`/app/my-food` route + `MyFoodScreen`** — list view only (simple foods first, composites stubbed).
7. **`CompositeFoodSheet` + `IngredientPickerSheet`** — full authoring UI.
8. **`MealSheet` composite quantity selector** — piece/gram toggle for composite items.
9. **Profile migration** — remove foods list, add "My food →" link.
10. **QA pass against all AC1–AC10.**

---

## 13. Cross-document links

- **Prep doc → this spec:** [composite-food-implementation-notes.md](./composite-food-implementation-notes.md) §7 lists this file as the build-spec destination.
- **This spec → prep doc:** Locked product rules (§2 of prep doc) are authoritative for any rule not explicitly overridden here.
- **Meal slots spec §14:** pointer only — detail lives here.
- **Execution checklist:** [composite-foods-implementation-plan.md](./composite-foods-implementation-plan.md) — phased milestones, file map, PR slices, QA matrix.

---

## 14. Revision

| Date | Notes |
|---|---|
| 2026-04-18 | v1.0 — initial build spec |
| 2026-04-18 | v1.1 — resolved: `calories_per_serving_snapshot` semantics (100g reference for gram mode); `serving_unit_snapshot` conflict (piece_label for piece mode, 'g' for gram mode); catalog normalization rule (g-only v1); `p_total_mass_g` vs ingredient sum (post-cook weight, may differ); merge-branch extension made explicit; SECURITY DEFINER + auth.uid() noted; soft-delete trigger caveat added; catalog freshness moved from "out of scope" to resolved decisions |
| 2026-04-18 | v1.2 — pre-implementation review fixes: catalog freshness decision relabeled ("live until recipe-save", not log time); composite definition versioning added to resolved decisions as explicitly deferred; §4.1 catalog freshness note aligned with §2 decision; CF1 confirmed fully closed (per-100g on product row is the meal-level mass mechanism — no separate meals.total_mass_g needed) |
| 2026-04-18 | v1.3 — AC2 aligned with §4.2 piece-mode snapshots; §10 merge row clarified (formula vs predicate) |
