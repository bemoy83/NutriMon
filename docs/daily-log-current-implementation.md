# Daily Log: Current Implementation Map

> **Purpose:** Baseline description of how the Daily Log works today, for **gap analysis** against [daily-log-meal-centric-scope.md](./daily-log-meal-centric-scope.md).  
> **Gap matrix:** [daily-log-meal-centric-gap-matrix.md](./daily-log-meal-centric-gap-matrix.md) (**Option B** structural meal slots + §10 composite foods).  
> **Technical spec (target build):** [daily-log-meal-slots-technical-spec.md](./daily-log-meal-slots-technical-spec.md).  
> **Status:** As implemented in the codebase at authoring time; update when behavior changes.  
> **Target product model (not yet built):** [scope](./daily-log-meal-centric-scope.md) **§4.4** (mass, piece/weight servings, composites) and **§8.1** decision log (structural meal slots, **Option B**).

---

## 1. Mental model (what the code treats as “a meal”)

- **One row in `meals` = one diary card** (one `Meal` in the client). There is **no** parent “meal slot” or grouping key beyond what the UI labels with `meal_type` / `meal_name`.
- **`meal_items`** are children of that single `meals` row. Line items and per-card calories/macros roll up from those rows.
- **`daily_logs`** holds the day (`log_date`), **day-level** `total_calories`, `meal_count`, `is_finalized`, etc.

Domain shape (`Meal`):

```72:84:src/types/domain.ts
export interface Meal {
  id: string
  userId: string
  dailyLogId: string
  loggedAt: string
  mealType: string | null
  mealName: string | null
  totalCalories: number
  itemCount: number
  createdAt: string
  updatedAt: string
  items?: MealItem[]
}
```

**Gap anchor (vs. meal-centric scope):** The product goal assumes **one header per meal slot (e.g. Lunch)** with many lines under it. The persistent unit today is **one card per `meals` row**, so **many Lunches = many rows**, not one grouped section.

---

## 2. Page composition (`DailyLogPage`)

- **Route:** `/app/log/:date` → `DailyLogPage` reads `date`, loads profile (timezone, calorie target).
- **Core data:** `useDailyLogCore(logDate)` → `dailyLog` + `meals[]`.
- **Derived data:** `useDailyLogDerived(logDate)` → evaluations, feedback, creature stats, habit metrics (separate from the meal list).
- **Header:** `DailyLogHeader` — day navigation, calorie ring vs target, streak, **day-level** macro sums (computed on the page by flattening **all** items across **all** meals).

```113:117:src/pages/app/DailyLogPage.tsx
  // Macro totals from meal item snapshots
  const allItems = meals.flatMap((m) => m.items ?? [])
  const totalProteinG = allItems.reduce((s, i) => s + (i.proteinGSnapshot ?? 0) * i.quantity, 0)
  const totalCarbsG = allItems.reduce((s, i) => s + (i.carbsGSnapshot ?? 0) * i.quantity, 0)
  const totalFatG = allItems.reduce((s, i) => s + (i.fatGSnapshot ?? 0) * i.quantity, 0)
```

- **Slots:** `MealSlots` groups the loaded `meals` by `mealType` into fixed Breakfast / Lunch / Dinner / Snack cards (several `Meal` rows can appear under the same slot).
- **Sheets:** `MealSheet` is the add-food flow (from FAB or **+** on a slot). Serving amounts are edited per line via `ServingEditSheet` on the slot’s expanded list (there is no separate full-page meal editor).
- **Empty day:** `InlineQuickAdd` when the day is not finalized and `mealCount === 0`.
- **Bottom bar:** `+` opens the add sheet; **Repeat last …** vs **Finalize** depends on time of day and whether **any** meal today already uses the **current default meal type** (see §6).

**Gap anchor:** Day totals are correct at **day** scope. Slot cards show **per-slot** kcal (and expanded macro detail). Server shape is still one `meals` row per logged meal, not a single merged row per slot.

---

## 3. Loading and ordering (`useDailyLogCore`)

- Loads `daily_logs` for user + `log_date` (or returns empty if missing).
- Loads **all** `meals` for that `daily_log_id`, ordered by **`logged_at` descending** (newest cards first).
- Loads **all** `meal_items` for those meal IDs, groups in memory, maps to `Meal[]`.

```31:49:src/features/logging/useDailyLogCore.ts
      const { data: mealRows } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', uid)
        .eq('daily_log_id', logRow.id)
        .order('logged_at', { ascending: false })

      const mealIds = (mealRows ?? []).map((meal) => meal.id)
      const { data: itemRows } = mealIds.length > 0
        ? await supabase
            .from('meal_items')
            .select('*')
            .in('meal_id', mealIds)
        : { data: [] }
      const itemsByMealId = groupMealItemsByMealId(itemRows)

      return {
        dailyLog: mapDailyLog(logRow),
        meals: (mealRows ?? []).map((meal) => mapMeal(meal, itemsByMealId[meal.id] ?? [])),
      }
```

**Gap anchor:** No `GROUP BY meal_type`, no “open meal session,” no merge of rows—**flat list of meal entities**.

---

## 4. Presentation (`MealSlots` / `SlotCard` / `LoggedMealRow`)

- **One row per meal type slot:** `MealSlots` maps Breakfast–Snack; each `SlotCard` shows combined kcal for all `Meal` rows with that `mealType`, and expands to list each logged meal and its line items.
- **Collapsed header** shows slot name, item preview, and **combined** slot calories when any items exist.
- **Expanded:** per-meal label when multiple meals share a slot, then `LoggedMealItemRow` lines (serving label, macros, kcal). Tapping a line opens `ServingEditSheet` for `updateMealWithItems` (not a separate route).
- **Overflow menu** on an expanded slot: save-as-template, clear all.

**Gap anchor:** The UI **groups** by `mealType`, but persistence is still **many `meals` rows** for the same type—the “parallel Lunch cards” case remains at the data layer until **Option B** append/merge.

---

## 5. How food gets onto the day (writes)

All primary “add” paths create a **new `meals` row** (or replace one meal’s items on edit), via Supabase RPCs from `src/features/logging/api.ts`.

| Entry point | Behavior |
|-------------|----------|
| **`InlineQuickAdd`** | `createMealWithItems` with **one** item and `getDefaultMealType(loggedAt)` → **new meal** per tap. Shown only when the day is **empty** (`mealCount === 0`). |
| **`MealSheet` add** | Default `mealType` comes from the slot (or time-based default from FAB). Pending items are staged in a **Pending** tab; submit → **`create_meal_with_items`** → **new meal** row. |
| **Line serving edit** | From an expanded slot, **`update_meal_with_items`** for **that** meal’s id via `ServingEditSheet`—does not merge with another same-type card. |
| **Repeat last meal** | `repeatLastMealOfType` copies a prior meal’s snapshot into **a new meal** on the target day. |
| **Delete / undo** | `delete_meal` / `restoreMealFromSnapshot` at **meal** granularity. |

```14:27:src/features/logging/api.ts
export async function createMealWithItems(
  logDate: string,
  loggedAt: string,
  items: MealItemInput[],
  mealType?: string | null,
  mealName?: string | null,
): Promise<MealMutationResult> {
  const { data, error } = await supabase.rpc('create_meal_with_items', {
```

**Gap anchor:** There is no first-class **“append line items to today’s Lunch”** operation—only **create meal with items** and **replace items on one meal**. Repeated “add” gestures naturally yield **multiple `meals` rows** with the same `meal_type`.

---

## 6. Meal type defaults (not the same as “one slot per type”)

- **`getDefaultMealType(loggedAt)`** (`src/lib/mealType.ts`) maps clock hour → Breakfast / Lunch / Snack / Dinner.
- Used for: empty-day quick add, **Repeat last …** type filter/preview, and **whether** to show repeat vs finalize.

`DailyLogPage` tracks which **meal types** appear in **any** meal today:

```86:98:src/pages/app/DailyLogPage.tsx
  const currentMealType = getDefaultMealType(loggedAt)
  const isEveningOrLater = new Date().getHours() >= 17
  const repeatLastMealPreviewQuery = useRepeatLastMealPreview(logDate, currentMealType)
  ...
  const loggedMealTypes = new Set(meals.map((m) => m.mealType).filter(Boolean))
```

```262:268:src/pages/app/DailyLogPage.tsx
            {repeatLastMealPreviewQuery.data && !loggedMealTypes.has(currentMealType) ? (
              <DailyLogRepeatCta
                preview={repeatLastMealPreviewQuery.data}
                repeating={repeating}
                repeatError={repeatError}
                onRepeat={handleRepeatLastMeal}
```

**Gap anchor:** This gates **Repeat** vs **Finalize**; it does **not** prevent multiple **Lunch** cards (user can tap `+` and add Lunch repeatedly).

---

## 7. Server / persistence (high level)

- **`create_meal_with_items`:** ensure `daily_logs` for date → insert **one** `meals` row → insert **`meal_items`** → recompute **that meal’s** `total_calories` / `item_count` → update **`daily_logs.total_calories`** and **`meal_count`**.
- **`update_meal_with_items`:** replace items for **one** meal, recompute meal + daily log.
- Schema evolution (see `supabase/migrations/`): **`meals` does not enforce uniqueness on `(daily_log_id, meal_type)`** — multiple same-type meals per day are allowed by design.

**Gap anchor:** Database and RPCs **encode “card = meal entity.”** Meal-centric “slots” need new structures, new write rules, and/or **presentation-layer grouping** with clear append semantics.

---

## 8. Duplicates (merge vs multiple lines)

- **Across cards:** No automatic merge—same food logged in two separate submits typically yields **two meals** (or duplicate lines on two cards), depending on flow.
- **Within one card:** The sheet can produce **multiple `meal_items`** for the same product if the user adds it twice; **gap analysis** should confirm whether any path merges by `product_id` / `catalog_item_id` (not assumed here).

**Gap anchor:** “Merge compatible duplicates into quantity” from the scope doc is **not** a first-class product rule in the current model.

---

## 9. Tests and related surfaces

- **`src/pages/app/__tests__/DailyLogPage.test.tsx`** — mocks `useDailyLogCore` / `useDailyLogDerived`; extend when grouping or CTAs change.
- **Finalize / creature preview** — tied to mutations and day finalization, not to meal-slot grouping.

---

## 10. Summary gap matrix (one glance)

| Product concept (meal-centric scope) | Current implementation |
|--------------------------------------|-------------------------|
| Meal **slot** (one Lunch header per day) | **Not modeled** — multiple `meals` rows with `meal_type = 'Lunch'` allowed |
| Line items under one header | **Yes**, but header = **one DB meal**, not “all Lunch lines for the day” |
| Meal-level subtotal for “all of Lunch” | **Per card only**; summing “all Lunch” needs new logic or user mental math |
| Incremental “add to same lunch” | **No** — primary adds use **`create_meal_with_items`** → new `meals` row |
| Duplicate foods merge to quantity | **Not** as a global rule |
| **Structural meal slots (Option B)** | **Not implemented** — see gap matrix §9 |
| **Composite foods** (ingredients → one food; piece or weigh log) | **Not implemented** — templates ≠ composite product; see gap matrix §10 and consolidated prep [composite-food-implementation-notes.md](./composite-food-implementation-notes.md) |
| **Mass roll-up + per-100g log path** (scope §4.4) | **Partial** — snapshots and products exist; no full food/meal mass model in logging |

---

## Revision history

| Date | Notes |
| --- | --- |
| 2026-04-18 | Initial map from codebase review |
| 2026-04-18 | Links to scope §4.4 / §8.1; gap matrix §10; summary rows for B + composites |
