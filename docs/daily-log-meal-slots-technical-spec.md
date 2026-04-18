# Technical specification: structural meal slots (Option B)

> **Status:** Engineering source of truth for implementation (v1.1).  
> **Product sources:** [daily-log-meal-centric-scope.md](./daily-log-meal-centric-scope.md) (§2–5, §4.4 food model, §8.1 decisions), [daily-log-meal-centric-gap-matrix.md](./daily-log-meal-centric-gap-matrix.md).  
> **As-built reference:** [daily-log-current-implementation.md](./daily-log-current-implementation.md).  
> **Implementation agent prompts (slices A–F):** [agent-prompts-meal-slots.md](./agent-prompts-meal-slots.md).  
> **Scope of this spec:** Meal **slot** invariants, persistence, migrations, RPC contracts, client integration, undo, repeat/restore, regression targets. **Composite / recipe foods** (scope §4.4) are **Phase 2** — summarized in §14 only.

---

## 1. Document control

| Version | Date | Author | Summary |
| --- | --- | --- | --- |
| 1.0 | 2026-04-18 | Engineering | Initial full spec from agreed Option B + gap matrix |
| 1.1 | 2026-04-18 | Product + Eng | Q1–Q4 locked: merge-on-append v1, visible meal subtotals, slot defaults, no second standard slot v1 |

---

## 2. Goals and non-goals

### 2.1 Goals

1. **At most one `meals` row per `(daily_log_id, meal_type)`** for standard diary slots: `Breakfast`, `Lunch`, `Dinner`, `Snack` (exact string match as stored today — see §4.1).
2. **Append semantics:** normal logging adds **`meal_items`** to that single row instead of inserting another `meals` row for the same slot.
3. **Invariant enforcement in the database** (partial unique index), not only in the client.
4. **Data migration** that preserves **total day calories and all historical line semantics** (snapshots unchanged on `meal_items` rows; only `meal_id` may change when merging parents).
5. **Downstream correctness:** `daily_logs.total_calories`, `daily_logs.meal_count`, `calculate_creature_preview`, finalize-day inputs remain correct.
6. **Undo / repeat / template / restore** behaviors defined per §9.

### 2.2 Non-goals (this release)

- Full **composite recipe product** schema and builder UI (Phase 2; see §14).
- Changing how **per-line** calories are computed from products (same formulas as today’s `create_meal_with_items`).
- **Offline-first** sync.
- Resolving **every** open UX preference (collapsed cards, etc.) — client may ship minimal UI if invariants hold.

---

## 3. Terminology

| Term | Definition |
| --- | --- |
| **Daily log** | Row in `daily_logs` for `(user_id, log_date)`. |
| **Meal (row)** | Row in `meals`; parent of `meal_items`. |
| **Standard slot** | `meal_type` ∈ `{'Breakfast','Lunch','Dinner','Snack'}` — subject to **one row per daily log**. |
| **Non-slot meal** | `meal_type` is `NULL`, `'Other'`, or any value **not** in the standard set — **not** covered by the partial unique index in v1; behavior defined in §4.3. |
| **Append** | Insert new `meal_items` onto an existing `meals.id` and recompute aggregates. |
| **Merge (line-level)** | Optional v1: combine two lines that match a **merge key** (§8) by increasing `quantity` instead of inserting a second line. |

---

## 4. Database schema

### 4.1 Standard slot types

Canonical set must match client `MEAL_TYPES` excluding `'Other'` for uniqueness:

```text
Breakfast, Lunch, Dinner, Snack
```

**Collation:** use exact equality as currently written by `MealTypeSelector` / `getDefaultMealType` (Pascal-case strings). Do **not** lowercase in DB without migrating existing rows first.

### 4.2 Partial unique index (required)

Enforce at most one meal row per standard type per day:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS meals_one_row_per_standard_slot
ON public.meals (daily_log_id, meal_type)
WHERE meal_type IN ('Breakfast', 'Lunch', 'Dinner', 'Snack');
```

**Precondition:** migration (§6) must run **before** this index is created, or index creation will fail on duplicate data.

### 4.3 `Other`, `NULL` meal_type, and custom `meal_name`

**v1 policy (aligns with gap matrix Pending Q2 deferred):**

- **`meal_type = 'Other'`** or **`meal_type IS NULL`:** **no** partial unique index. Multiple rows remain allowed (current behavior). Product may later fold these into slots or add `slot_instance` (§14 backlog).
- **`meal_name`:** continues to decorate the card; for standard slots, **one row** may still carry a user-defined `meal_name` alongside `meal_type` (e.g. “Working lunch”). Uniqueness is **only** on `(daily_log_id, meal_type)` for the four standard types.

### 4.4 Optional columns (recommended for Phase 1.5+)

Not required for minimal B but useful for analytics and ordering:

| Column | Type | Purpose |
| --- | --- | --- |
| `meals.sort_order` | `smallint` | Stable ordering in UI (Breakfast=0 … Snack=3). |
| `meals.last_item_at` | `timestamptz` | Last append time for “recent activity” without scanning items. |

If omitted, client derives order from `meal_type` enum order.

### 4.5 Tables unchanged (v1)

- `meal_items` — same columns; snapshots remain authoritative for historical nutrition.
- `daily_logs` — same columns; semantics of `meal_count` updated in §7.
- `products`, `food_catalog_items`, `catalog_item_usage` — same write rules on append as today’s `create_meal_with_items`.

---

## 5. `meal_count` semantics

**Today:** `meal_count = COUNT(*)` of `meals` for that `daily_log_id`.

**After B (recommended product semantics):**

- **Option A (minimal code churn):** keep `meal_count` as **count of `meals` rows** (standard days → at most 4 slot rows + any `Other`/NULL rows). **Downstream** treats this as “meal entities,” not “MFP sections.”
- **Option B (clearer UX metric):** redefine to **count of non-empty meals** (`item_count > 0`) or **count of slot sections user sees** — requires auditing all readers of `meal_count` (including finalize-day, habit metrics if any).

**Spec decision for v1:** **Option A** unless product explicitly requests B before implementation. Document in release notes.

---

## 6. Data migration

### 6.1 Objective

For each `daily_logs.id`, for each `meal_type` in `('Breakfast','Lunch','Dinner','Snack')`, if **more than one** `meals` row exists:

- **Pick keeper row** `m_keep`: the row with **minimum `created_at`** (tie-break: minimum `id`).
- **For each duplicate** `m_dup` (same `daily_log_id`, same `meal_type`):
  - `UPDATE meal_items SET meal_id = m_keep.id WHERE meal_id = m_dup.id`.
  - `DELETE FROM meals WHERE id = m_dup.id`.
- **Recompute** `m_keep.total_calories`, `m_keep.item_count` from `meal_items`.
- **Recompute** parent `daily_logs.total_calories`, `daily_logs.meal_count`.

### 6.2 Ordering of `meal_items` after merge

No strict requirement for v1. Optional: `UPDATE ... SET sort_order` if such column is added later; else UI sorts by `meal_items.created_at` ascending for merged history.

### 6.3 Finalized days

**Policy:** migration runs on **all** rows regardless of `is_finalized` so the unique index can be applied. Totals must be **byte-for-byte identical** for `daily_logs.total_calories` before vs after per `log_date` (sum of line calories unchanged).

**Verification query (example):**

```sql
-- Per daily_log_id: compare sum(meal_items.line_total_calories) before merge snapshot vs after
-- Implement as migration test script, not left in production DB.
```

### 6.4 Idempotency

Migration script must be **safe to re-run** (no-op if no duplicates) or run in a transaction once.

---

## 7. RPC and server logic

### 7.1 `create_meal_with_items` (behavior change)

**Current behavior (abridged):** always `INSERT INTO meals …`, then insert items.

**New behavior:**

1. Resolve `v_log` (unchanged); reject if finalized.
2. **If `p_meal_type` is in standard set** (`Breakfast`/`Lunch`/`Dinner`/`Snack`):
   - `SELECT id FROM meals WHERE daily_log_id = v_log.id AND meal_type = p_meal_type FOR UPDATE` (row lock).
   - If **found** (`v_meal`):
     - Optionally update `v_meal.logged_at = p_logged_at` and `meal_name = COALESCE(p_meal_name, meals.meal_name)` per product choice (default: **update `logged_at` only**; merge `meal_name` only if keeper `meal_name` IS NULL).
     - **Append** items: same insert loop as today, targeting `v_meal.id`.
   - If **not found**: `INSERT INTO meals` (same as today), then insert items.
3. **Else** (non-slot: `Other`, NULL, or unknown string): **keep current behavior** — always `INSERT` new `meals` row (unless product later extends uniqueness).

4. Recompute `meals.total_calories`, `item_count`; recompute `daily_logs.total_calories`, `meal_count`.

5. Template bonus: if `p_template_id` is set, same `use_count` bump as today.

6. Return shape **unchanged** for clients: `{ meal, meal_items, daily_log, creature_preview }` where `meal_items` in JSON is **only the newly inserted lines** in append case (today’s client merges via invalidation — verify `MealSheet` / handlers expect full list or partial).

**Breaking change note:** Callers that assumed a **new** `meal.id` on every `create_meal_with_items` for Lunch must be updated to handle **same** `meal.id` on append (React Query invalidation already refetches full day — sufficient).

### 7.2 `update_meal_with_items`

- **Ownership:** still only updates the given `p_meal_id`.
- **Constraint:** must not allow changing `meal_type` on `v_meal` to a standard type that **already exists** on another row for the same `daily_log_id` (swap would violate unique index). **v1 rule:** reject `UPDATE meal_type` if it would create duplicate standard slot; or normalize by merging targets (complex — **reject** with clear error).

### 7.3 `delete_meal`

Unchanged: deletes one `meals` row and cascades `meal_items`. For standard slots, deleting “Lunch” removes **all** lunch lines for that day — acceptable if UI confirms “Delete entire lunch.”

### 7.4 `delete_meal_item` (new, recommended)

**Purpose:** delete a single `meal_item` by id; recompute parent meal + `daily_logs`.

**Signature (proposed):**

```text
delete_meal_item(p_meal_item_id uuid) returns json
```

Returns `{ daily_log, meal, creature_preview }`.

**v1 policy when `item_count` becomes 0:** **delete** the parent `meals` row (and rely on next `create_meal_with_items` to recreate the slot row). Rationale: avoids zero-item orphan rows; matches “no lunch logged yet”; partial unique index does not apply when no row exists.

**Alternative (deferred):** keep an empty `meals` row as a persistent slot shell — only if product insists same `meal.id` across “clear all items” without delete.

### 7.5 `restore_meal_from_snapshot`

**Current:** inserts **new** `meals` row.

**New:** If `p_meal_type` is standard and a row exists for that day:

- **Append** snapshot items to existing row (same inserts as item loop, using snapshot nutrition — mirror repeat behavior).
- Else: insert new meal row (unchanged).

Ensures undo of “delete entire lunch” after migration does not recreate a duplicate slot.

### 7.6 `repeat_last_meal` / `repeat_last_meal_of_type` (client + RPC)

**Client today:** `repeatLastMealOfType` fetches prior meal then calls `restore_meal_from_snapshot` — effectively new meal.

**New:** After `restore_meal_from_snapshot` change (§7.5), repeating into a day that **already has** that slot should **append** lines onto the slot meal.

**Edge case:** prior day’s meal was **non-slot** type but user repeats as Lunch — still uses restore payload; if target day has Lunch row, append.

### 7.7 `calculate_creature_preview`

No change expected if `daily_logs.total_calories` remains correct.

### 7.8 Edge functions (`finalize-day`, etc.)

**Action:** grep Supabase functions and SQL for assumptions on `meal_count` or “one meal per add.” Re-verify consumed calories = sum of `meal_items.line_total_calories` for the day (should match `daily_logs.total_calories`).

---

## 8. Line merge on append (**v1 required**, scope §7.1 Q1)

**Product decision:** When the user logs the **same food** twice into the **same meal slot** with **compatible** data, **merge into one line** (sum `quantity`) so the diary shows one summary row (e.g. total milk at breakfast). Distinct products or incompatible snapshots stay separate lines.

**Merge key (deterministic, v1):**

- Same `daily_log` / same parent `meal_id` (always true on append).
- Same `product_id` **XOR** same `catalog_item_id` (exactly one non-null).
- Same `calories_per_serving_snapshot`, `serving_amount_snapshot`, `serving_unit_snapshot`, `protein_g_snapshot`, `carbs_g_snapshot`, `fat_g_snapshot`, `product_name_snapshot` (byte match or numeric tolerance for floats — prefer exact equality for decimals stored same scale).

**Algorithm on append for each new line:**

- If a row exists in `meal_items` for this `meal_id` with the same key: `UPDATE quantity = quantity + p_qty`, recompute `line_total_calories`, **do not** insert.
- Else: insert new line.

**“Split line” / roll-up without merge** is **out of v1** (scope §7.2).

---

## 9. Undo contract (client + server)

**Today:** Undo after “add meal” calls `deleteMeal(result.meal.id)`.

**After B:**

| User action | Undo behavior |
| --- | --- |
| First items added to **new** slot row | `deleteMeal` still valid if whole row new. |
| **Append** to existing slot | **Cannot** `deleteMeal` without removing others’ items. **v1:** RPC `create_meal_with_items` returns **array of new `meal_item` ids**; undo calls `delete_meal_item` for each id (or new `delete_meal_items(uuid[])` batch RPC). |
| **Delete entire slot** | Restore via `restore_meal_from_snapshot` (unchanged UX) with merged behavior §7.5. |

**Client:** extend `MealMutationResult` type to include `inserted_meal_item_ids?: string[]` (and keep `meal.id`).

---

## 10. Client application changes

### 10.1 Files (expected touch list)

| Area | File(s) |
| --- | --- |
| Core fetch | `src/features/logging/useDailyLogCore.ts` — order: slot order then `Other`/NULL by `logged_at`. |
| List UI | `src/features/logging/MealList.tsx` — optional: hide empty slot rows; section headers. |
| Page | `src/pages/app/DailyLogPage.tsx` — undo handler uses new ids; `loggedMealTypes` / repeat CTA logic may assume multiple lunch rows — **audit**. |
| API | `src/features/logging/api.ts` — new `deleteMealItem`, response typing. |
| Types | `src/types/database.ts` — `MealMutationResult` extended. |
| Sheet | `src/features/logging/MealSheet.tsx` — add flow may call same RPC but expect append; title/copy “Add to [Lunch]”. |
| Quick add | `src/features/logging/InlineQuickAdd.tsx` — after first day meal, may need to target slot (if shown beyond empty day). |
| Tests | `src/pages/app/__tests__/DailyLogPage.test.tsx` + new integration tests for append/undo. |

### 10.2 React Query

- Invalidate `daily-log-core` on success (unchanged).
- Any code that **caches `meal.id`** across sequential adds must expect **stable id** for the same slot.

### 10.3 UX copy (minimal)

- FAB / sheet: reflect **append to Breakfast/Lunch/…**, not always “new meal.”

### 10.4 Meal subtotals always visible (scope §7.1 Q3)

- Each meal section shows **total calories** and **protein / carbs / fat** for that meal **without requiring expand**.
- Line-item list may still use expand/collapse if needed for density; **macro + kcal summary must remain visible** in the collapsed (default) state.

---

## 11. API types (TypeScript)

Extend `MealMutationResult` (or equivalent) returned by Supabase RPC JSON:

```ts
// illustrative — align with actual generated types in codebase
insertedMealItemIds?: string[]
```

Ensure **Supabase RPC typings** in `src/types/database.ts` or inferred JSON stay in sync after migration.

---

## 12. Row Level Security

- No policy change if no new tables.
- New RPCs must use `security definer` with `auth.uid()` checks consistent with existing `create_meal_with_items`.

---

## 13. Testing and acceptance criteria

### 13.1 Automated

- Unit / integration: **two** `create_meal_with_items` with same `log_date` + `Lunch` → **one** `meals` row, **N** items.
- **Undo** second append removes only appended lines.
- **Migration fixture:** duplicate Lunch rows → single row; sum line kcal invariant.
- **Finalized day:** append rejected (existing exception).

### 13.2 Manual / QA

- Repeat last lunch into today that already has lunch → items appended, not second card.
- Delete one line from lunch → totals correct.
- Template from meal → logging still respects slot.

---

## 14. Phase 2: composite foods (scope §4.4) — pointer only

Not implemented in v1 of this spec. Engineering will likely add:

- `products` kind or child table `recipe_ingredients` with rolled-up **total mass** and **per-100g** nutrients.
- Logging UX: quantity as **grams** or **fractional piece** (1/8 pizza).
- **Versioning:** recipe edit bumps `product` version; `meal_items` keep historical snapshots (already match “future only” product rule).

Track in separate epic; unblock meal slots work without this schema.

---

## 15. Rollout

1. Land migration SQL in `supabase/migrations/` with clear version ordering **after** duplicate merge script.
2. Deploy RPC changes in same release or immediately after migration (same maintenance window).
3. Deploy client.
4. Monitor for unique-index violations in staging (should be zero post-migration).

**Feature flag:** optional; if used, flag only **server** path to avoid split-brain. Prefer single cutover in PWA.

---

## 16. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Unique index fails on prod data | Staging dry-run; migration report listing conflicting rows. |
| Client assumes new meal id each add | Search codebase for `createMealWithItems` + undo paths; update tests. |
| `meal_count` semantics confuse users | Release notes; optional UI label change. |
| `Other` duplicates still confuse | Phase 2 product; document limitation in v1. |

---

## 17. Product defaults locked (scope §7.1; no longer open)

| Topic | v1 decision |
| --- | --- |
| Second standard lunch same day | **Not supported** — `Snack` / `Other` / future user-defined meals or `slot_instance` (confirmed product 2026-04-18). |
| Duplicate lines (e.g. two milks) | **Merge** in-slot when merge key matches (**§8**). |
| Meal subtotals (kcal + P/C/F) | **Always visible** per meal section (**§10.4**). |
| Which slot to log into | **Time-of-day** default (same idea as `getDefaultMealType`); iterate after usage data. |
| Merge key edge cases | Exact snapshot match (**§8**); split-line UX **out of v1** (scope §7.2). |
| `meal_name` on append | Keep keeper name unless NULL (**§7.1**). |

---

## 18. Revision history

| Version | Date | Notes |
| --- | --- | --- |
| 1.0 | 2026-04-18 | Initial publication |
| 1.1 | 2026-04-18 | Q1 merge required v1; Q3 visible subtotals §10.4; Q2/Q4 §17; split-line deferred |
