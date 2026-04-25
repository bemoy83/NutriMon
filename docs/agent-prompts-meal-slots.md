# Agent prompts: structural meal slots (Option B)

> **Purpose:** Copy-paste prompts for implementation agents — **one slice per run** / one PR-sized unit.  
> **Contract:** [daily-log-meal-slots-technical-spec.md](./daily-log-meal-slots-technical-spec.md) (v1.1+) + product locks in [daily-log-meal-centric-scope.md](./daily-log-meal-centric-scope.md) §7.1.

**Order:** A → B → C → D → E → F. Do not skip **A** if the database may already contain duplicate standard-slot rows.

---

## Slice A — DB: merge duplicates + partial unique index

```text
You are implementing Slice A only for NutriMon meal slots (Option B).

Read first (repo):
- docs/daily-log-meal-slots-technical-spec.md — §4.2 (partial unique index), §6 (migration), §6.3–6.4 (finalized + idempotency), §16 risks
- docs/daily-log-meal-centric-scope.md — §7.1 Q2 (v1: no second standard slot; migration must support that invariant)

Goal:
1. Add a new Supabase migration (next sequential file in supabase/migrations/) that:
   - For each daily_logs row, for meal_type IN ('Breakfast','Lunch','Dinner','Snack'), if multiple meals rows exist for the same (daily_log_id, meal_type): pick keeper = min(created_at), tie-break min(id); reassign all meal_items from duplicates to keeper; delete duplicate meals; recompute keeper total_calories and item_count; recompute daily_logs.total_calories and meal_count.
   - Then create: CREATE UNIQUE INDEX meals_one_row_per_standard_slot ON public.meals (daily_log_id, meal_type) WHERE meal_type IN ('Breakfast','Lunch','Dinner','Snack');
2. Migration must preserve per-day total consumed calories (sum of meal_items.line_total_calories for that daily_log) — invariant before/after.
3. Safe for finalized days (spec §6.3) and idempotent or single-run clear (§6.4).

Constraints:
- Do NOT change create_meal_with_items yet (Slice B).
- Do NOT add composite/recipe food tables (Phase 2).
- No unrelated refactors.

Verify locally:
- supabase db reset OR apply migration on a DB with fixture duplicate Lunch rows; index creates; no duplicate (daily_log_id, meal_type) for standard types.

Output: migration SQL only (+ any tiny comments in migration file). Brief note in commit message body listing invariant checked.
```

---

## Slice B — RPC: `create_meal_with_items` get-or-create + append (standard slots)

```text
You are implementing Slice B only for NutriMon meal slots (Option B).

Read first:
- docs/daily-log-meal-slots-technical-spec.md — §7.1 (create_meal_with_items behavior), §4.3 (Other/NULL unchanged), §5 (meal_count), §7.8 (finalize / side effects)
- Current RPC: latest migration that defines create_meal_with_items (e.g. supabase/migrations/010_battle_system.sql) — implement changes via a NEW migration that CREATE OR REPLACE the function

Goal:
1. Replace `public.create_meal_with_items` so that when p_meal_type is one of 'Breakfast','Lunch','Dinner','Snack':
   - If a meals row already exists for (daily_log_id, meal_type): FOR UPDATE lock it, append new meal_items to that meal id (same insert logic as today for products/catalog), recompute that meal’s totals; optionally update logged_at per §7.1 default; do NOT insert a second meals row.
   - If none exists: INSERT meals as today, then items.
2. When p_meal_type is Other, NULL, or anything outside the four standard strings: keep current behavior (always new meals row) per §4.3.
3. Still reject finalized daily_logs. Still bump catalog usage / product use_count as today. Still return JSON shape { meal, meal_items, daily_log, creature_preview } — meal_items should list ONLY newly inserted rows for this call (§7.1); if that breaks callers, document and adjust TypeScript callers minimally in this slice only if necessary.

Constraints:
- New migration must CREATE OR REPLACE the function (do not edit old migration files in place).
- No merge-on-append yet (Slice C).
- No client changes required in this slice unless types break compile.

Verify:
- Two successive create_meal_with_items calls same log_date + Lunch → single meals.id, item_count sums; daily_logs.total_calories correct.
```

---

## Slice C — RPC: merge-on-append (duplicate identical lines)

```text
You are implementing Slice C only for NutriMon meal slots.

Read first:
- docs/daily-log-meal-slots-technical-spec.md — §8 (merge key)
- docs/daily-log-meal-centric-scope.md — §7.1 Q1 (two milks → one summary line)

Goal:
When appending each new meal_item in create_meal_with_items (and anywhere else items are appended in Slice B path): if an existing meal_item on the same meal_id matches the merge key in §8 (same product_id XOR same catalog_item_id, and identical snapshot fields listed there), UPDATE that row’s quantity and line_total_calories (and any dependent fields) instead of INSERTing a second row. Otherwise INSERT as today.

Constraints:
- Do not change merge key without updating spec — use exact §8.
- Do not implement “split line” or UI-only rollups.

Verify:
- Append same catalog item twice with identical snapshots → one row, quantity = sum.
- Append same product with different snapshot → two rows.
```

---

## Slice D — RPC + types: `delete_meal_item` + `inserted_meal_item_ids` on `create_meal_with_items`

```text
You are implementing Slice D only for NutriMon meal slots.

Read first:
- docs/daily-log-meal-slots-technical-spec.md — §7.4 delete_meal_item, §9 (undo + `inserted_meal_item_ids` semantics), §7.1 return shape

Goal:
1. Add RPC `delete_meal_item(p_meal_item_id uuid) returns json` (security definer, auth.uid()) that deletes one meal_item owned via meal→user, recomputes parent meal totals and daily_logs; if item_count becomes 0, DELETE parent meals row per §7.4 v1 policy.
2. Extend create_meal_with_items (and update_meal_with_items if it inserts new lines without ids in return — only if needed) JSON response to include `inserted_meal_item_ids`: uuid[] of **meal_items rows INSERTed** in that call only (merge UPDATEs excluded). Optional for client; not for toast undo on add (§9).
3. Update src/types/database.ts (MealMutationResult or equivalent) and src/features/logging/api.ts typings to match.

Constraints:
- Client wiring is separate; this slice is RPC + types. If compile requires minimal DailyLogPage change, keep it tiny.

Verify:
- RPC returns inserted ids on real inserts (including append with new lines); empty or partial when lines merged; delete_meal_item removes one line and fixes totals; deleting last item removes meal row.
```

---

## Slice E — RPC: `restore_meal_from_snapshot` + repeat append into existing slot

```text
You are implementing Slice E only for NutriMon meal slots.

Read first:
- docs/daily-log-meal-slots-technical-spec.md — §7.5 restore_meal_from_snapshot, §7.6 repeat_last_meal / repeat_last_meal_of_type
- src/features/logging/api.ts — repeatLastMealOfType → restore_meal_from_snapshot

Goal:
1. Change `restore_meal_from_snapshot` so if p_meal_type is a standard slot type AND a meals row already exists for that daily_log + type: append snapshot items to that meal (same inserts as today’s snapshot restore), do NOT insert a second standard meals row. Else: keep insert-new-meal behavior.
2. Update `repeat_last_meal` in SQL if needed so it does not violate unique index when target day already has that slot (should flow through restore behavior or equivalent append).
3. Ensure client path repeatLastMealOfType still works without duplicate standard rows.

Constraints:
- Do not change unrelated battle RPCs.
- Migration already applied (Slice A) — code must assume index exists.

Verify:
- Day already has Lunch; restore/repeat into Lunch → items appended, one Lunch row.
```

---

## Slice F — Client: slot-aware UI, always-visible meal subtotals, destructive-only undo

```text
You are implementing Slice F only for NutriMon Daily Log client.

Read first:
- docs/daily-log-meal-slots-technical-spec.md — §10 (files), §10.4 (always-visible kcal + P/C/F per meal), §9 undo (toast only for delete meal → restore snapshot)
- docs/daily-log-meal-centric-scope.md — §7.1 Q3–Q4
- src/features/logging/MealSlots.tsx, DailyLogPage.tsx, MealSheet.tsx, useDailyLogCore.ts, api.ts

Goal:
1. MealSlots / slot card: show meal total calories AND protein/carbs/fat in the default (non-expanded) view per §10.4 (adjust layout; line list can still expand).
2. useDailyLogCore: order meals predictably (e.g. Breakfast → Lunch → Dinner → Snack → then Other/null by logged_at).
3. DailyLogPage: **no** toast undo after add/append/edit. **Do** offer toast undo after **delete entire meal** using `restore_meal_from_snapshot` + client-held meal snapshot (§9, §7.5).
4. Copy/labels: FAB/sheet should read as adding to the meal slot (minimal string changes OK).

Constraints:
- No composite food / recipe UI (Phase 2).
- No large unrelated refactors.

Verify:
- Manual: two adds to Lunch → one card, subtotals visible without expand; corrections via per-line delete/edit, not toast undo on add; delete meal → undo restores meal; finalized day unchanged.
- npm run lint && npm run test && npm run build
```

---

## Revision history

| Date | Notes |
| --- | --- |
| 2026-04-18 | Initial prompts (slices A–F) |
| 2026-04-18 | Slice D/F: `inserted_meal_item_ids` = insert ledger only; Slice F destructive-only toast undo (align §9 v1.3) |
