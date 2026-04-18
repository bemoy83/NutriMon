# Composite foods — consolidated prep for implementation spec

**Purpose:** Single engineering document to evolve into a **build spec** for composite (“recipe”) foods. It merges product rules, gap analysis, Option B interactions, schema/API direction, UX, and acceptance material that was previously spread across scope, gap matrix, meal-slots spec §14, as-built notes, and this file.

**Status:** Prep / handoff — not yet a versioned implementation spec.

**Still authoritative elsewhere:** High-level product intent remains in [daily-log-meal-centric-scope.md](./daily-log-meal-centric-scope.md) **§4.4** (locked decisions). Structural meal slots (Option B) remain in [daily-log-meal-slots-technical-spec.md](./daily-log-meal-slots-technical-spec.md). Traceability rows for composites also appear in [daily-log-meal-centric-gap-matrix.md](./daily-log-meal-centric-gap-matrix.md) **§10**.

---

## 1. Relationship to Option B (meal slots)

- **Orthogonal:** Option B defines **one `meals` row per standard slot** and append/merge **line** semantics. Composites are a **food-library** concern: one **selectable food** built from ingredients, logged as **one `meal_item` line** (same as a simple `products` row today).
- **Merge / duplicates (scope §7.1):** In-slot merge treats a **composite as its own product identity**. A composite is **not** a “duplicate” of its ingredient lines for merge purposes.
- **Meal-slots technical spec:** Phase 2 composites are **out of scope** for meal-slots v1; [§14](./daily-log-meal-slots-technical-spec.md) in that doc is a short pointer — detail lives **here**.

---

## 2. Locked product rules (scope §4.4)

These rules apply to **simple and composite (“recipe”) foods** and are intended to drive schema, logging UX, and export/import.

### 2.1 Mass

- **Mass is the primary input** for ingredients and for calorie and nutrient derivation where the model ties nutrients to amount consumed.
- **All foods contribute mass** to the food’s (and, when logged, the meal’s) total mass basis for aggregation and for **per-100g** (or density-style) math, unless a future edge case is explicitly excluded in implementation (e.g. pure volume-only entries should still resolve to a mass basis for consistency).

### 2.2 Servings at food creation

- Each food is created with a **defined serving model**: **by weight** (relationship to total recipe / product mass) and/or **by pieces** (e.g. this pizza is **8 slices**; one sandwich is **1 unit**).

### 2.3 Logging (two paths, both valid)

1. **Discrete serving count** — e.g. **1 sandwich** = **1/1** of that food’s reference; **1 slice of pizza** = **1/8** of that food when the food was defined as 8 slices.
2. **Weigh an arbitrary portion** — e.g. a slice (if user weighs it), a plate, or a portion of spaghetti: **scale nutrition from that food’s totals using mass**, typically via **calories and nutrients per 100 g** (and the same basis for macros), derived from the food’s total nutrition and total mass at definition time.

### 2.4 Composite foods and recipes

- A composite food is built from **ingredients** (each ingredient has mass as primary input); rolled-up nutrition and total mass define the **single selectable food** (e.g. a specific pizza).
- **Changing ingredients updates the composite food definition for future use only.** Past log lines keep **snapshot** nutrition (and mass basis as stored on the line) so history does not rewrite when the recipe changes.

### 2.5 Scope boundary (product)

- **Full recipe-builder / meal-planning product** (shopping lists, weekly plans, social recipe feeds) is **not** the same as **composite food definition** in §4.4, which **is in scope** where it supports **logging, reuse, and export/import** (scope §82).

### 2.6 Competitive pattern (relevant slice)

From scope §5: **meal header once per meal slot**, **line items beneath**; duplicate foods merged or separate only when justified — **never** accidental multiple same-slot containers from normal logging (aligns with Option B).

---

## 3. Ingredient sources (engineering clarification)

Each recipe line references **exactly one** source:

- a **built-in** row in **`food_catalog_items`**, or  
- a **user-owned** row in **`products`**.

**v1 default:** ingredients are **simple** `products` (or catalog items). Whether a composite may reference **another composite** as an ingredient is a **separate product decision** (nested recipes).

---

## 4. Gap matrix — composite / mass / servings (CF1–CF6)

| ID | Requirement | Current state (as of prep doc) | Status | Gap | Owner |
| --- | --- | --- | --- | --- | --- |
| **CF1** | **Mass primary** — all foods contribute mass for aggregation and per-100g-style scaling. | `meal_items` store snapshots; `products` have serving fields; **no** unified “food total mass” or meal-level mass roll-up in logging UX. | **Gap** | Food schema: total mass + optional volume→mass rules; meal roll-up if product exposes it. | **Both** |
| **CF2** | **Servings at food creation** — weight and/or **pieces** (e.g. 8 slices, 1 sandwich). | User products: flat macros + optional default serving; **no** composite recipe entity or piece fractions in core flow. | **Gap** | Product model: reference mass, piece count, per-slice (or per-piece) nutrition derivation. | **RPC / DB** + **Client** |
| **CF3** | **Log by piece count** — e.g. 1 sandwich = 1/1, 1 slice = 1/8. | Logging is **quantity × line snapshots**; no first-class “1/N of this food.” | **Gap** | Line quantity semantics vs. food serving definition. | **Both** |
| **CF4** | **Log by weighed portion** — scale arbitrary grams → nutrition from food **per 100 g** (and macros). | No guaranteed per-100g from composite total ÷ total mass at log time in product flows. | **Gap** | Derive and snapshot per line from food definition. | **Both** |
| **CF5** | **Composite food** — ingredients roll up to **one selectable food** (e.g. pizza). | **Meal templates** exist; **not** the same as a versioned composite **product** with ingredient list. | **Gap** | Recipe/composite `products` (or new table) + builder UI. | **RPC / DB** + **Client** |
| **CF6** | **Edit ingredients → future logs only**; past lines stay on **snapshots**. | `meal_items` already snapshot nutrition at log time; editing a **simple** product may need explicit “never rewrite historical lines” verification. | **Partial** / **Gap** | Composites: **version** or definition id; explicit rule that historical lines never update from live recipe. | **Both** |

**Related gap (merge policy):** G9 — merge compatible duplicates to quantity; **distinct composite foods are not “duplicates”** of their ingredients ([gap matrix §1](./daily-log-meal-centric-gap-matrix.md)).

---

## 5. Current implementation snapshot (relevant to composites)

- **`products`:** Flat user-defined food: name, calories, macros, optional `default_serving_*` — **no** recipe graph, **no** `kind` / composite flag ([`001_schema.sql`](../supabase/migrations/001_schema.sql), `ProductForm`, Profile list today).
- **`meal_items`:** Snapshots at log time (`product_name_snapshot`, `calories_per_serving_snapshot`, macros, serving snapshots, `line_total_calories`). **Good foundation** for “recipe edits → future only.”
- **Logging:** `create_meal_with_items` / `update_meal_with_items` accept item payloads; merge-on-append applies to **line** identity (product/catalog + compatible snapshots) — see meal-slots spec **§8**.
- **Meal templates:** Reusable **saved meals**, not versioned **composite products** ([as-built summary](./daily-log-current-implementation.md) §10).

---

## 6. UX / navigation — “My food” (not Profile)

- **User-facing language:** **My food** / **foods** / **your foods** in UI and nav. Avoid **“products”** in copy — that name maps to the **`products`** table only.
- **Database:** Table name **`products`** can remain until a deliberate rename migration (RPCs, RLS, types).
- **Dedicated route:** **My food** (path TBD, e.g. `/app/my-food`) owns **list + search + create/edit** for **simple** and **composite** foods. **Composite authoring** (ingredients, masses, roll-up preview, save) lives here, **not** on Profile.
- **Profile:** Account / targets / settings only; optional link to My food. Move the foods list off Profile when this ships (or split earlier).
- **Logging flows:** “Create new food” from meal sheet / quick-add should **navigate or reuse** the same authoring components as My food.

---

## 7. Technical direction (for build spec)

### 7.1 Meal-slots spec §14 — engineering likely adds

- `products` **kind** (or boolean) plus child table **`recipe_ingredients`** (name TBD) with rolled-up **total mass** and **per-100g** nutrients.
- Logging UX: quantity as **grams** or **fractional piece** (e.g. ⅛ pizza).
- **Versioning:** recipe edit bumps product **definition version**; `meal_items` keep historical **snapshots** (already matches “future only” intent).

### 7.2 Implementation pillars (suggested order)

1. **Model** — Simple vs **composite** `products`; **ingredient rows** (`catalog_item_id` **XOR** `product_id` + `mass_g`), **total recipe mass**, rolled macros + calories, **per-100g** and optional **per-piece** fields for log-time math.
2. **Versioning** — Definition version or revision id; `meal_items` optionally store `composite_definition_id` / version for support; **never** rewrite snapshots from live recipe.
3. **Authoring UX** — On **My food**: composite builder + validation + preview; same surface for simple food CRUD.
4. **Logging** — Resolve composite + quantity → **snapshots** on insert (server-side resolution vs client-built + server validation — **pick one** in build spec).
5. **Merge** — One `product_id` per composite; merge key unchanged in spirit (scope §7.1).

### 7.3 Schema sketch (illustrative)

- `products`: `kind` / `is_composite`, `total_mass_g`, rollups, `piece_count` + optional piece label.
- `product_recipe_ingredients` (TBD): `composite_product_id`, catalog **or** user product reference (one non-null), `mass_g`, sort order; optional **% mass** inputs with closure rule.
- **RLS** — Same ownership model as `products`; secure child-table policies.

### 7.4 APIs / RPCs

- **Create/update composite** (validate ingredients, recompute rollups).
- **Logging** — Extend or complement **`create_meal_with_items`** for composite quantity semantics; **no** change to “one standard slot row per day.”

---

## 8. User journeys to cover (from scope §6.1)

- Create food from ingredients; log by **piece** (e.g. ⅛ slice) or **weighed portion**; edit recipe affects **future logs only** (snapshots on past lines).

---

## 9. Acceptance criteria (draft for build spec)

- Log composite by **1 slice** and by **N grams**; totals match rolled math within agreed numeric rules (align with existing snapshot decimals).
- Edit recipe after log → **prior days unchanged**; new logs use new definition.
- **Finalize / creature preview / `daily_logs.total_calories`** remain correct.
- **Distinct composite ≠ duplicate of ingredients** for merge (scope §7.1, G9).

---

## 10. Explicit non-goals (near-term composite slice)

- Full **meal-planning**, shopping lists, social recipe feeds.
- **Meal-level-only** log rows with no `meal_items` semantics (separate from composite **food**).
- Replacing **Option B** work — composites **layer on** existing slot + append model.

---

## 11. Open decisions (record in build spec)

- **Nested composites** — composite-as-ingredient allowed in v1 or not?
- **Catalog ingredient updates** — does composite definition **snapshot** catalog nutrition at recipe-save time, or always “live” until log? (Impacts repeatability vs surprise.)
- **Ingredient deletion** — user deletes a `product` that is an ingredient elsewhere: block, orphan, or cascade rule?
- **Piece vs weight** — single primary UX per food or always offer both?

---

## 12. Revision

| Date | Notes |
| --- | --- |
| 2026-04-18 | Initial implementation notes; My food vs Profile; `products` naming |
| 2026-04-18 | **Consolidated prep doc:** merged §4.4 rules, gap CF1–CF6 + G9, §14 direction, as-built snapshot, journeys, acceptance, non-goals, open decisions |
