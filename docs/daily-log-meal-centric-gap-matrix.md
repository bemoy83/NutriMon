# Daily Log: Meal-Centric Gap Matrix

> **Sources:** [daily-log-meal-centric-scope.md](./daily-log-meal-centric-scope.md) (goal, scope, **§4.4 food model**, **§8.1 decision log**), [daily-log-current-implementation.md](./daily-log-current-implementation.md) (as-built).  
> **Technical spec:** [daily-log-meal-slots-technical-spec.md](./daily-log-meal-slots-technical-spec.md).  
> **Purpose:** Trace each requirement to **current behavior**, **gap**, and **owning layer**.  
> **Implementation fork:** **Option B — structural meal slots** (decided 2026-04-18, scope §8.1). Rows formerly tagged **Fork** are now **B** (expect schema/RPC + coordinated client work).

**Status legend**

| Status | Meaning |
| --- | --- |
| **Met** | Already satisfies the requirement (possibly differently than the final UX). |
| **Partial** | Delivers part of the intent; remainder depends on **Option B** build-out or product calls. |
| **Gap** | Missing or contrary to requirement. |
| **Pending** | Blocked on product decision (see scope §7). |

**Owner legend**

| Owner | Meaning |
| --- | --- |
| **Client** | React/UI/state only. |
| **RPC / DB** | Supabase functions, schema, migrations. |
| **Both** | Coordinated UI + API changes. |
| **B** | **Structural meal slots (Option B)** — expect **RPC / DB**-heavy work, often **Both** for UX. |

---

## 1. Product goal & success criteria

| ID | Requirement | Current state | Status | Gap (if any) | Owner |
| --- | --- | --- | --- | --- | --- |
| G1 | **Single coherent unit per meal slot** — one header (e.g. Lunch) with line items underneath for a normal day. | One **header per `meals` row**. Same `meal_type` can appear on **many cards**. | **Gap** | Enforce **one persisted slot** (or one parent meal per `(daily_log, meal_type[, instance])`) + UI that reflects it. | **B** |
| G2 | **Success criterion 1:** Each default meal type appears **at most once** as a top-level section, unless user **explicitly** creates another instance. | Any number of rows per `meal_type` per day; no “explicit second lunch” flow. | **Gap** | Unique constraint / slot table + **Pending** policy for second instance (scope §7). | **B** + **Pending** |
| G3 | **Success criterion 2:** **N** add actions into Lunch → **one** Lunch section, **N** (or fewer if merged) lines—not **N** Lunch sections. | Each **`create_meal_with_items`** creates a **new** meal; FAB add always new card. | **Gap** | **Append to slot** RPC + get-or-create slot; stop creating parallel same-type parents by default. | **B** |
| G4 | **Success criterion 3:** Meal **subtotals** = sum of lines in that **meal** (MFP-style). | Subtotals are correct **per `meals` row**; **not** aggregated across same `meal_type`. | **Partial** | Subtotal = **all lines on the slot’s meal row** (after B). | **B** |
| G5 | **Success criterion 4:** **Day totals** stay consistent with logged nutrition. | `daily_logs.total_calories`; header macros from `flatMap` items. | **Met** | Re-verify after slot migration / `meal_count` semantics. | **Both** |
| G6 | **Success criterion 5:** **Edit / remove** line items; optionally **move**; keep “one lunch” mental model. | **Edit** replaces items on **one** meal via `MealSheet` + `update_meal_with_items`. **Delete** whole meal. No **move line to another meal type**. | **Partial** | Line-level delete/move between slots; slot-aware edit. | **B** |
| G7 | **Scannable meals** — “what did I eat for lunch?” one place. | User must scan **all cards** whose title/type is Lunch (or similar). | **Gap** | One section per slot in UI backed by B. | **B** |
| G8 | **Low-friction multi-step logging** — many steps should not create duplicate **sections**. | Multi-step logging via repeated **add** → duplicate **cards** for same type. | **Gap** | Append + meal targeting (scope §4.1). | **B** |
| G9 | **Per-food consumption without scanning duplicate rows** — default **merge compatible duplicates** to quantity. | Duplicate lines **possible** within one meal; **no** merge across cards; line-merge rules still **Pending** (scope §7) for “compatible.” | **Gap** | Merge on append + policy; distinct composite foods are **not** “duplicates.” | **Both** |
| G10 | **MFP pattern:** never **accidental** multiple parallel “Lunch” **containers** from normal logging. | Accidental multiple Lunch **cards** are the default failure mode. | **Gap** | Same as G3 + slot enforcement. | **B** |

---

## 2. Scope: presentation & workflow (scope §4.1)

| ID | Requirement | Current state | Status | Gap | Owner |
| --- | --- | --- | --- | --- | --- |
| P1 | **Meal sections** with line items + **meal** subtotals + day total. | Meal **card** = section; day header has day totals. | **Partial** | One card **per slot** after B. | **B** |
| P2 | **Eliminate accidental duplicate meal-type cards** from repeated adds. | Each add → new row. | **Gap** | Append-to-slot writes; migrate legacy duplicate rows if needed. | **B** |
| P3 | **Meal targeting** — explicit or reliable inference of **which slot** receives the item. | User picks `mealType` in sheet; `InlineQuickAdd` uses **clock default** only; FAB does not “continue last slot.” | **Partial** | Active slot / explicit picker aligned with B. | **Both** |
| P4 | **Composition-friendly** — “add another” without fragmented diary between items. | After save, user returns to list of **separate** cards if they add again with same type. | **Gap** | FAB opens append-to **current slot** or last-used slot. | **B** |
| P5 | **Duplicate line handling** — inventory **possible / likely** duplicates and **keys**. | Duplicates: same product twice in one sheet → two `meal_items`; two submits → two meals or duplicate lines. Keys: `product_id` / `catalog_item_id` + snapshots per line; **no** merge key in app logic documented. | **Gap** | Document merge key; implement on append (scope §7 for edge cases). | **Both** |
| P6 | **Migration / compatibility** — historical days, undo, repeat, snapshots. | All **meal-row** granular; undo restore uses **snapshot per meal**. | **Partial** | **Migrate** duplicate same-type rows into slot meal; repeat/restore **target slot** (scope §8.1). | **B** |

---

## 3. User journeys (scope §6.1)

| ID | Journey | Current state | Status | Gap | Owner |
| --- | --- | --- | --- | --- | --- |
| J1 | Add **first** item to Lunch | Works: `create_meal_with_items` with chosen or default type. | **Met** / **Partial** | First add should **get-or-create slot meal** then append lines. | **B** |
| J2 | Add **second** item to Lunch **immediately after** | Creates **second meal** if user uses FAB add again (same type). | **Gap** | Append lines to same slot meal. | **B** |
| J3 | Weigh → log → search → recents **in sequence** for **one** lunch | Same as J2 unless user edits first card and adds lines inside **one** `MealSheet` session. | **Gap** | All paths resolve to **append to slot**. | **B** |
| J4 | Edit **quantity** on a **merged** duplicate line | No guaranteed merged line; user may edit one of several lines in sheet. | **Gap** | Merge policy + line editor (after merge rules in scope §7). | **Both** |
| J5 | **Delete one line** vs **delete entire meal** | **Delete** removes **whole** `meals` row (all items). Line-level delete only inside **edit sheet** (replace full item set). | **Partial** | Line-delete RPC + slot UX. | **B** |
| J6 | **Change meal assignment** for a line (move Breakfast → Lunch) | Change `meal_type` on **whole meal** in edit sheet; cannot move **single item** to another meal row. | **Gap** | Move `meal_item` between slot meals (or delete+append). | **B** |
| J7 | **Repeat meal** / copy prior day | `repeatLastMealOfType` → **new** meal on target day. Fits “new card” model. | **Partial** | **Append items into target day’s slot** (or replace slot per product policy). | **B** |
| J8 | **Undo** after add | Undo deletes **last created meal** (`deleteMeal`). | **Partial** | Undo **last append** vs. whole slot — define stack semantics. | **B** |

---

## 4. Surfaces (scope §6.2)

| ID | Surface | Current state | Status | Gap | Owner |
| --- | --- | --- | --- | --- | --- |
| S1 | **Daily Log layout / grouping** | `MealSlots`: one **slot** (Breakfast…Snack); multiple `Meal` rows can share a `mealType`. | **Partial** / **Gap** | One section per **slot** (fixed ordering per day), merged subtotals. | **B** |
| S2 | **MealSheet / quick-add / copy** | Sheet title “Add meal”; primary CTA “Add to meal” in add mode; FAB `aria-label` “Add meal”. | **Partial** | Copy/behavior: **add to [slot]** / append. | **Client** + **B** |
| S3 | **Empty / first-meal states** | `InlineQuickAdd` only when `mealCount === 0`. | **Met** / **Partial** | `meal_count` may mean “slot count” after B; quick-add targets slot. | **Both** |
| S4 | **Finalized day** | Same `MealSlots`; read-only actions hidden. | **Met** | Same slot UI when finalized. | **B** |

---

## 5. Data model & integrity (scope §6.3)

| ID | Topic | Current state | Status | Gap | Owner |
| --- | --- | --- | --- | --- | --- |
| D1 | **Meal record vs. log line** | **`meals`** = parent; **`meal_items`** = lines. | **Met** structurally | **One parent `meals` row per slot** (or dedicated slot entity) under B. | **RPC / DB** |
| D2 | **Uniqueness** | No unique `(daily_log_id, meal_type)`. | **Gap** | Enforce per **B** (+ optional `instance` for second lunch — scope §7). | **RPC / DB** |
| D3 | **Duplicate detection** | No app-level merge key documented. | **Gap** | Define key for **line** merge on append (scope §7). | **Both** |
| D4 | **Snapshots / restore** | `restore_meal_from_snapshot` / undo paths meal-scoped. | **Partial** | Restore **into slot meal id**; composite food edits remain **future-only** (scope §4.4). | **B** |
| D5 | **Server contracts** | `create_meal_with_items`, `update_meal_with_items`, `delete_meal`, repeat/restore RPCs. | **Met** today | Add **get-or-create slot + append**; narrow `create_meal_with_items` for accidental duplicates. | **RPC / DB** |
| D6 | **RLS** | Policies on `meals` / `meal_items` via parent ownership. | **Met** | New tables/constraints stay RLS-safe. | **RPC / DB** |

---

## 6. Derived calculations & downstream (scope §6.4)

| ID | Topic | Current state | Status | Gap | Owner |
| --- | --- | --- | --- | --- | --- |
| C1 | **Meal subtotal vs. day total** | Day = sum of meals/items in DB; per-card subtotals from row aggregates. | **Partial** | Slot meal = single subtotal source. Optional **meal-level mass + kcal/100g** (product follow-on). | **B** |
| C2 | **Finalize-day / evaluations** | Driven by logged nutrition for the day (not reviewed line-by-line in this matrix). | **Met** assumption | Re-verify after slot migration / `meal_count` semantics. | **Both** |

---

## 7. Analytics (scope §6.5)

| ID | Topic | Current state | Status | Gap | Owner |
| --- | --- | --- | --- | --- | --- |
| A1 | Events: “meal created” vs “item added” | Not inventoried in implementation map. | **Pending** | Audit analytics (if any) when append/slot exists. | **TBD** |

---

## 8. Product decisions Q1–Q4 (resolved 2026-04-18; scope §7.1)

| ID | Decision | Engineering notes |
| --- | --- | --- |
| Q1 | **Merge** compatible duplicate lines **in the same slot** (e.g. two glasses of **same** milk → **one line**, quantity summed) so the diary shows one **summary** row. Distinct products or incompatible snapshots → separate lines. | Implement merge-on-append per [technical spec](./daily-log-meal-slots-technical-spec.md) §8. Affects G9, J4, D3. |
| Q2 | **v1:** No second **standard** slot (e.g. two `Lunch` rows). Second occasion → `Snack` / `Other` / **future** user-defined meals or `slot_instance`. | Matches technical spec §17; D2 unique index unchanged for v1. |
| Q3 | **Meal subtotals always visible:** kcal **and** carbs, fat, protein for each meal section (not expand-only). | **Client:** e.g. `MealSlots` / slot card header always shows macro strip + calories. |
| Q4 | **v1 default:** target slot by **time of day** (same idea as `getDefaultMealType`). Stronger rules **later**, after usage. | **Client** + copy; optional future “continue last slot.” |

---

## 9. Implementation fork (**decided**)

| Option | Status | Notes |
| --- | --- | --- |
| **A. Presentation-first** | **Not selected** for this initiative | Useful reference for phased UI experiments only. |
| **B. Structural meal slots** | **Selected** (2026-04-18; scope §8.1) | Enforce **one parent meal per slot** per day (± explicit second instance when product defines it); append lines; migration from legacy duplicate same-type rows. |

All **Owner** values **B** in §§1–6 assume this fork. **Next engineering step:** schema + RPC design (unique key / slot entity, append RPC, migration), then client `MealSlots` + logging flows.

---

## 10. Composite foods, mass, and servings (scope §4.4)

**Single prep / build-spec handoff** (merged product rules, CF table, as-built snapshot, Option B notes, schema sketch): [composite-food-implementation-notes.md](./composite-food-implementation-notes.md). The **CF** table below stays for matrix navigation and diffs.

| ID | Requirement | Current state | Status | Gap | Owner |
| --- | --- | --- | --- | --- | --- |
| CF1 | **Mass primary** — all foods contribute mass for aggregation and per-100g-style scaling. | `meal_items` store snapshots; products have serving fields; **no** unified “food total mass” or meal-level mass roll-up in logging UX. | **Gap** | Food schema: total mass + optional volume→mass rules; meal roll-up if product exposes it. | **Both** |
| CF2 | **Servings at food creation** — weight and/or **pieces** (e.g. 8 slices, 1 sandwich). | User products: single `quantity` on log lines; templates snapshot; **no** composite recipe entity or piece fractions in core flow. | **Gap** | Product model: `reference_mass`, piece count, per-slice nutrition derivation. | **RPC / DB** + **Client** |
| CF3 | **Log by piece count** — e.g. 1 sandwich = 1/1, 1 slice = 1/8. | Logging is effectively **quantity × line snapshots**; no first-class “1/N of this food.” | **Gap** | Line quantity semantics vs. food serving definition. | **Both** |
| CF4 | **Log by weighed portion** — scale arbitrary grams → nutrition from food **per 100 g** (and macros). | Weight-first UX partial elsewhere; **no** guaranteed per-100g from composite total ÷ total mass at log time. | **Gap** | Derive and snapshot per line from food definition. | **Both** |
| CF5 | **Composite food** — ingredients roll up to **one selectable food** (e.g. pizza). | **Meal templates** exist; **not** the same as a versioned composite **product** with ingredient list. | **Gap** | Recipe/composite `products` (or new table) + builder UI. | **RPC / DB** + **Client** |
| CF6 | **Edit ingredients → future logs only**; past lines stay on **snapshots**. | `meal_items` already snapshot nutrition at log time; **editing a product** likely affects display depending on implementation — verify. | **Partial** / **Gap** | Composite foods: **version** or “live product” with explicit **historical line never updates** rule. | **Both** |

---

## 11. Revision history

| Date | Notes |
| --- | --- |
| 2026-04-18 | Initial gap matrix from scope + implementation docs |
| 2026-04-18 | Fork **B** locked; **Fork** column → **B**; §9 decision table; §10 composite/mass/serving rows (scope §4.4); Q1 wording aligned with scope §7 |
| 2026-04-18 | §8: Q1–Q4 **resolved** (merge in-slot; v1 no second standard slot; visible meal subtotals; time-of-day slot default) |
| 2026-04-18 | §10: intro link — composite prep merged into [composite-food-implementation-notes.md](./composite-food-implementation-notes.md) |
