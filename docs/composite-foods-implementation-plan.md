# Composite Foods — Implementation Plan

**Purpose:** Execution-grade checklist for building composite ("recipe") foods. An engineer or agent can follow this document phase-by-phase without re-deriving scope.

**Audience:** Implementing engineer / agent.

**Depends on:**
- Option B (structural meal slots) complete — migrations 001–035 applied
- `create_meal_with_items` / `update_meal_with_items` live in current migration chain (through `035_restore_meal_from_snapshot_standard_slot_append.sql`)
- No nested composites in v1

**Canonical references:**
- **Build spec (normative for math, schema SQL, RPC signatures):** [composite-food-build-spec.md](./composite-food-build-spec.md) v1.3
- **Prep / locked rules:** [composite-food-implementation-notes.md](./composite-food-implementation-notes.md) §2
- **Meal slots spec §14 (pointer only):** [daily-log-meal-slots-technical-spec.md](./daily-log-meal-slots-technical-spec.md)
- **Gap matrix (CF1–CF6):** [daily-log-meal-centric-gap-matrix.md](./daily-log-meal-centric-gap-matrix.md) §10

---

## 1. Prerequisites

Before starting any phase:

1. Local Supabase migrations applied in order through `035_restore_meal_from_snapshot_standard_slot_append.sql`.
2. `create_meal_with_items` and `update_meal_with_items` RPCs functioning (standard-slot append + merge-on-append).
3. `npm run lint && npm run test && npm run build` all pass on `main`.

---

## 2. Phased Execution

### Phase 1 — Migration 036: Schema Extensions

**Inputs:** Clean main branch with migrations 001–035 applied.

**Deliverables:**
- `supabase/migrations/036_composite_foods_schema.sql` containing:
  - `product_kind` enum (`'simple'`, `'composite'`)
  - `products` table extensions (kind, total_mass_g, per-100g columns, piece_count, piece_label)
  - `product_recipe_ingredients` table with XOR constraint + no-self-reference constraint
  - RLS policies for `product_recipe_ingredients`
  - Deletion-blocking trigger on `products`

**Primary files:**
| File | Action |
|---|---|
| `supabase/migrations/036_composite_foods_schema.sql` | **Create** — full SQL per build spec §3.1–§3.4 |

**Exit gate:**
- `supabase db reset` succeeds
- All existing queries still work (new columns are nullable / have defaults)
- `npm run lint && npm run test && npm run build` pass
- **AC coverage:** None yet (schema only)

---

### Phase 2 — TypeScript Type Updates

**Inputs:** Phase 1 merged.

**Deliverables:**
- Extended `ProductRow` with composite columns
- New `ProductRecipeIngredientRow` interface
- New domain types (`RecipeIngredient`, `CompositeProduct`)
- Extended `MealItemInput` with `compositeQuantityMode`

**Primary files:**
| File | Action |
|---|---|
| `src/types/database.ts` | **Edit** — extend `ProductRow`; add `ProductRecipeIngredientRow`; add RPC entries for `upsert_composite_product`, `get_composite_product` to `Database` type |
| `src/types/domain.ts` (or equivalent) | **Edit/Create** — add `RecipeIngredient`, `CompositeProduct` per build spec §6.3 |

**Exit gate:**
- `npm run lint && npm run test && npm run build` pass
- No UI changes; app behaves identically
- **AC coverage:** None yet (types only)

---

### Phase 3 — RPCs: `upsert_composite_product` + `get_composite_product`

**Inputs:** Phase 2 merged.

**Deliverables:**
- New RPC `upsert_composite_product` — creates/updates composite product with ingredient list and rollup math (build spec §5.1)
- New RPC `get_composite_product` — fetches composite + ingredients for builder UI (build spec §5.2)
- Migration file for the RPCs (e.g. `037_composite_food_rpcs.sql` or included in 036)

**Primary files:**
| File | Action |
|---|---|
| `supabase/migrations/037_composite_food_rpcs.sql` (or append to 036) | **Create** — RPC definitions per build spec §5.1, §5.2 |

**Exit gate:**
- RPCs callable via Supabase client; manual SQL verification on local/staging
- Rollup math matches build spec §4.1 formulas
- Ownership check (`auth.uid()`) enforced
- Nested composite rejection works
- `npm run lint && npm run test && npm run build` pass
- **AC coverage:** AC1 (server-side — create composite, verify rollup)

---

### Phase 4 — RPC: Extend Meal RPCs for Composite Quantity Mode

**Inputs:** Phase 3 merged.

**Deliverables:**
- `create_meal_with_items` extended with `composite_quantity_mode` handling (build spec §5.3)
- `update_meal_with_items` extended similarly
- Gram-mode normalization (quantity → 100g units) and piece-mode snapshot computation
- Merge-key extension: gram vs piece modes must not merge into each other

**Primary files:**
| File | Action |
|---|---|
| `supabase/migrations/038_meal_rpcs_composite_extension.sql` (or append) | **Create/Edit** — extend existing meal RPCs per build spec §5.3, §3.5, §4.2 |

**Exit gate:**
- Log composite by grams → `meal_items.quantity` = grams/100, correct snapshots
- Log composite by pieces → `meal_items.quantity` = piece count, correct snapshots
- Gram and piece entries for same composite do **not** merge
- Existing simple-product logging unchanged
- `npm run lint && npm run test && npm run build` pass
- **AC coverage:** AC2, AC3 (server-side verification); AC7 partial (composite line distinct from simple)

---

### Phase 5 — Foods API Module

**Inputs:** Phases 3–4 merged.

**Deliverables:**
- New `src/features/foods/api.ts` wrapping composite RPCs
- Functions: `upsertCompositeProduct`, `getCompositeProduct`, `getUserProducts`, `deleteProduct`

**Primary files:**
| File | Action |
|---|---|
| `src/features/foods/api.ts` | **Create** — per build spec §7.1 |
| `src/features/logging/api.ts` | **Edit** — add `compositeQuantityMode` to `MealItemInput` and pass through to RPC JSONB payload per build spec §7.2 |
| `src/features/logging/mealPayloads.ts` | **Edit** — extend payload builder to include `composite_quantity_mode` field when present |

**Exit gate:**
- API functions callable; TypeScript compiles
- `npm run lint && npm run test && npm run build` pass
- **AC coverage:** AC1 (end-to-end via API); AC6 partial (deleteProduct throws on ingredient-in-use)

---

### Phase 6 — `/app/my-food` Route + MyFoodScreen

**Inputs:** Phase 5 merged.

**Deliverables:**
- New route `/app/my-food` with lazy route module
- `MyFoodScreen` — list of user products (simple + composite), sorted by `use_count DESC`
- Client-side search filter
- FAB / "New food" → `FoodTypePickerSheet`
- Tap existing → opens appropriate sheet (simple or composite) in edit mode
- Swipe-to-delete with ingredient-in-use error handling

**Primary files:**
| File | Action |
|---|---|
| `src/app/router/index.tsx` | **Edit** — add `/app/my-food` lazy route |
| `src/app/router/route-modules/my-food.ts` | **Create** — lazy route module (pattern matches `profile.ts`) |
| `src/pages/app/MyFoodPage.tsx` | **Create** — page component |
| `src/features/foods/MyFoodScreen.tsx` | **Create** — list + search + FAB |
| `src/features/foods/FoodTypePickerSheet.tsx` | **Create** — simple two-option bottom sheet (build spec §8.2) |

**Exit gate:**
- Route navigable; list renders user products
- Search filters client-side by name
- FAB opens type picker
- Delete blocked with toast when product is ingredient in recipe
- `npm run lint && npm run test && npm run build` pass
- **AC coverage:** AC6 (full — UI error toast); AC10 (list with composite badge)

---

### Phase 7 — Composite Builder UI

**Inputs:** Phase 6 merged.

**Deliverables:**
- `CompositeFoodSheet` — full authoring (name, total mass, piece count/label, ingredient list, rollup preview)
- `IngredientPickerSheet` — reuses food search; tabs for My foods (simple only) + Catalog
- Client-side rollup preview using `computeRollup` from build spec §9
- Edit mode pre-fills from `getCompositeProduct`

**Primary files:**
| File | Action |
|---|---|
| `src/features/foods/CompositeFoodSheet.tsx` | **Create** — per build spec §8.4 |
| `src/features/foods/IngredientPickerSheet.tsx` | **Create** — per build spec §8.5 |
| `src/features/foods/compositeRollup.ts` | **Create** — `computeRollup` function per build spec §9 |
| `src/features/foods/SimpleFoodSheet.tsx` | **Create/Refactor** — rename/refactor from `ProductForm.tsx`; add `kind = 'simple'` on save (build spec §8.3) |

**Exit gate:**
- Create composite with ingredients → correct rollup preview
- Edit existing composite → pre-filled, save updates
- Ingredient picker excludes composites (v1)
- Catalog items with non-gram units rejected
- `npm run lint && npm run test && npm run build` pass
- **AC coverage:** AC1 (full end-to-end); AC4 (edit recipe, verify); AC9 (no piece toggle when piece_count null)

---

### Phase 8 — MealSheet Composite Quantity Selector

**Inputs:** Phase 7 merged.

**Deliverables:**
- When adding composite product to meal: gram/piece toggle (if `piece_count` set)
- Gram-only input when `piece_count` is null
- Live calorie preview using §4.2 math
- `compositeQuantityMode` passed through to `createMealWithItems` / `updateMealWithItems`

**Primary files:**
| File | Action |
|---|---|
| `src/features/logging/MealSheet.tsx` | **Edit** — composite quantity selector per build spec §8.6 |
| `src/features/logging/mealPayloads.ts` | **Edit** — ensure `composite_quantity_mode` flows to RPC |

**Exit gate:**
- Log composite by pieces → correct `meal_items` snapshot (AC2)
- Log composite by grams → correct `meal_items` snapshot (AC3)
- No piece toggle when `piece_count` is null (AC9)
- Simple product logging unchanged
- `npm run lint && npm run test && npm run build` pass
- **AC coverage:** AC2, AC3, AC5, AC7, AC8, AC9 (full)

---

### Phase 9 — Profile Migration

**Inputs:** Phase 8 merged.

**Deliverables:**
- Remove foods list from `ProfilePage`
- Add "My food →" navigation link in account/settings section

**Primary files:**
| File | Action |
|---|---|
| `src/pages/app/ProfilePage.tsx` | **Edit** — remove embedded products list; add nav link to `/app/my-food` per build spec §8.7 |

**Exit gate:**
- Profile no longer shows food list
- "My food" link navigates to `/app/my-food`
- `npm run lint && npm run test && npm run build` pass
- **AC coverage:** AC10 (My food accessible from Profile)

---

### Phase 10 — QA Pass Against AC1–AC10

**Inputs:** All phases merged.

**Deliverables:**
- Full manual verification of all acceptance criteria
- Any bug fixes discovered during QA

**Exit gate:** All AC1–AC10 pass. See QA matrix below (§4).

---

## 3. Repository File Map

### Database
| Path | Status | Notes |
|---|---|---|
| `supabase/migrations/036_composite_foods_schema.sql` | New | Schema extensions per build spec §3 |
| `supabase/migrations/037_composite_food_rpcs.sql` | New | `upsert_composite_product`, `get_composite_product` per build spec §5 |
| `supabase/migrations/038_meal_rpcs_composite_extension.sql` | New | Extend meal RPCs per build spec §5.3 |

### Types / Contracts
| Path | Status | Notes |
|---|---|---|
| `src/types/database.ts` | Edit | Extend `ProductRow`, add `ProductRecipeIngredientRow`, RPC entries |
| `src/types/domain.ts` | Edit/Create | `RecipeIngredient`, `CompositeProduct` |

### API Layer
| Path | Status | Notes |
|---|---|---|
| `src/features/foods/api.ts` | New | Composite RPCs + product CRUD per build spec §7.1 |
| `src/features/logging/api.ts` | Edit | `compositeQuantityMode` on `MealItemInput` per build spec §7.2 |
| `src/features/logging/mealPayloads.ts` | Edit | Pass `composite_quantity_mode` to RPC payload |

### Router
| Path | Status | Notes |
|---|---|---|
| `src/app/router/index.tsx` | Edit | Add `/app/my-food` lazy route |
| `src/app/router/route-modules/my-food.ts` | New | Lazy route module |

### Pages / Features
| Path | Status | Notes |
|---|---|---|
| `src/pages/app/MyFoodPage.tsx` | New | Page component for My food |
| `src/pages/app/ProfilePage.tsx` | Edit | Remove foods list; add "My food →" link |
| `src/features/foods/MyFoodScreen.tsx` | New | List + search + FAB |
| `src/features/foods/FoodTypePickerSheet.tsx` | New | Simple / composite picker |
| `src/features/foods/CompositeFoodSheet.tsx` | New | Composite builder UI |
| `src/features/foods/IngredientPickerSheet.tsx` | New | Ingredient search + selection |
| `src/features/foods/compositeRollup.ts` | New | Client-side `computeRollup` |
| `src/features/foods/SimpleFoodSheet.tsx` | New/Refactor | Rename/refactor of `ProductForm.tsx` |
| `src/features/logging/MealSheet.tsx` | Edit | Composite quantity selector |

### Tests
| Path | Status | Notes |
|---|---|---|
| `src/features/foods/__tests__/compositeRollup.test.ts` | New | Unit tests for rollup math |
| `src/features/logging/__tests__/mealPayloads.test.ts` | New/Edit | Payload shape tests for composite branch |
| `src/pages/app/__tests__/DailyLogPage.test.tsx` | Edit (if needed) | Only if logging entry points change |

> **SQL-level tests:** The repo does not have an established pattern for SQL tests. Use **manual SQL verification** on local Supabase / staging for RPC correctness.

---

## 4. QA Matrix — AC1–AC10

| AC | Scenario | Verification | Phase |
|---|---|---|---|
| **AC1** | Create composite "Spaghetti" with 3 ingredients, 400g total, 4 pieces | Manual: verify per-100g rollup matches §4.1 math; piece math = total ÷ 4. Automated: `compositeRollup.test.ts` | P3 (server), P7 (UI) |
| **AC2** | Log "Spaghetti" by pieces: 1 piece | Manual: `meal_items` has `quantity=1`, `serving_unit_snapshot=piece_label`, `serving_amount_snapshot=grams_per_piece`, `calories_per_serving_snapshot=ROUND(cal_per_100g × grams_per_piece / 100)`. `line_total_calories ≈ ¼ total ±1 kcal`. | P4 (server), P8 (UI) |
| **AC3** | Log "Spaghetti" by grams: 150g | Manual: `meal_items` has `quantity=1.5`, `serving_amount_snapshot=100`, `serving_unit_snapshot='g'`, `calories_per_serving_snapshot=ROUND(cal_per_100g)`. | P4 (server), P8 (UI) |
| **AC4** | Edit "Spaghetti" recipe (add ingredient) | Manual: previous `meal_items` rows unchanged. New log shows updated nutrition. | P7 |
| **AC5** | Log Monday. Edit recipe. Check Monday's log. | Manual: Monday's `line_total_calories` and snapshots unchanged. | P8 |
| **AC6** | Delete simple product used as ingredient | Manual: error toast "Used in recipe [name]. Remove it first." | P6 |
| **AC7** | Log simple + composite in same Breakfast slot | Manual: composite is own line; `meal.total_calories` = sum of all lines. | P8 |
| **AC8** | Create composite, log, verify `daily_logs.total_calories` | Manual: matches sum of all `meal.total_calories` for that day. | P8 |
| **AC9** | Composite with `piece_count=null`, log via MealSheet | Manual: only grams input shown; no piece toggle. | P8 |
| **AC10** | My food list: simple + composite, sorted by use_count | Manual: composite shows "Recipe" badge; simple shows none. | P6 |

**Merge cases (build spec §5.3):** Gram and piece modes for the same composite must **not** merge — verify `serving_unit_snapshot` differs (`'g'` vs `piece_label`).

---

## 5. PR / Merge Strategy

Suggested PR slices aligned with safe rollout:

| PR | Scope | Risk | Phases |
|---|---|---|---|
| **PR1** | Migration 036 + TypeScript types only | Low — app unchanged; new columns unused | P1, P2 |
| **PR2** | `upsert_composite_product` + `get_composite_product` + `src/features/foods/api.ts` | Low — no MealSheet change; RPCs unused by UI | P3, P5 (partial) |
| **PR3** | Extend meal RPCs + `MealItemInput` + `api.ts` composite payload | **Medium–High** — touches core logging path. Feature-flag optional if the codebase uses flags. | P4, P5 (remainder) |
| **PR4** | `/app/my-food` route + list + move Profile section | Low — new route; Profile change is cosmetic | P6, P9 |
| **PR5** | `CompositeFoodSheet` + `IngredientPickerSheet` + rollup | Medium — new UI only; no logging change | P7 |
| **PR6** | `MealSheet` composite selector + full AC sweep | Medium — final integration; all AC1–AC10 must pass | P8, P10 |

---

## 6. Risks / Rollback

| Risk | Mitigation |
|---|---|
| **Migration 036 breaks existing queries** | All new columns are nullable or have defaults; existing queries are unaffected. Test with `supabase db reset`. |
| **Meal RPC extension breaks simple-product logging** | `composite_quantity_mode` is optional; omitted = existing behavior. Regression test simple products after PR3. |
| **Rollup math mismatch (client vs server)** | `computeRollup` (§9) mirrors server math exactly. Unit test both. Any discrepancy beyond ±1 kcal floating-point rounding is a bug. |
| **Migration down strategy** | Repo does not use down-migrations. Forward-only: if rollback needed, deploy a new migration that reverts schema changes. Document the revert SQL but do not commit a down file unless the pattern changes. |
| **RPC deploy order** | Migrations must be applied **before** deploying client code that sends new JSON fields (`composite_quantity_mode`). Deploy sequence: migration → edge function redeploy → client deploy. |
| **Catalog ingredient freshness staleness** | Documented in build spec §2 (resolved decision). Users re-save recipe to pick up catalog changes. No runtime mitigation needed for v1. |

---

## 7. Revision

| Date | Notes |
|---|---|
| 2026-04-18 | v1.0 — initial implementation plan from build spec v1.3 |
