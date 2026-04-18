---
name: Composite implementation handoff
overview: "Add a new execution-grade document that turns [docs/composite-food-build-spec.md](docs/composite-food-build-spec.md) into a handoff-ready implementation plan: phased work, concrete file paths, exit gates, tests, and doc cross-links—while keeping the build spec as the normative source for math and schema SQL."
todos:
  - id: add-impl-plan-doc
    content: Create docs/composite-foods-implementation-plan.md with phases, file map, PR slices, QA matrix (AC1–AC10), gates, risks
    status: pending
  - id: crosslink-build-spec
    content: Add one-line pointer in composite-food-build-spec.md §13/§14 to the implementation plan
    status: pending
  - id: crosslink-readme-prep
    content: Add README Source Documents bullet + optional one-liner in composite-food-implementation-notes.md
    status: pending
isProject: false
---

# Composite foods: build spec → handoff implementation plan

## Goal

Produce **one new markdown doc** that an engineer or agent can execute **without re-deriving** scope from the build spec: phased milestones, **explicit repo paths**, **exit criteria** per phase, **test/QA mapping** to AC1–AC10, and **PR split** guidance. The build spec remains the **normative** reference for formulas, snapshot semantics, and SQL excerpts ([§3–§5](docs/composite-food-build-spec.md)).

## Deliverable

Create **[`docs/composite-foods-implementation-plan.md`](docs/composite-foods-implementation-plan.md)** (new file) with roughly this structure:

1. **Header** — Purpose, audience, **depends on** (Option B + migrations through 035 per build spec), **canonical references** (build spec v1.3, prep notes, meal-slots §14 pointer).
2. **Prerequisites** — Local Supabase apply order; confirm `create_meal_with_items` / `update_meal_with_items` live in latest migration chain (today: [`034_delete_meal_item_and_inserted_meal_item_ids.sql`](supabase/migrations/034_delete_meal_item_and_inserted_meal_item_ids.sql) and related); no nested composites in v1.
3. **Phased execution** — Expand build spec **§12** into **named phases** with:
   - **Inputs** (what must be true before starting)
   - **Deliverables** (artifacts)
   - **Primary files** (below)
   - **Exit gate** (`npm run lint`, `npm run test`, `npm run build`; plus **which AC ids** are provable after the phase)
4. **Repository file map** (concrete paths)
   - **DB:** new migration file(s) under [`supabase/migrations/`](supabase/migrations/) (e.g. `036_composite_foods_schema.sql` per build spec naming); follow repo’s numeric ordering.
   - **Types / contracts:** [`src/types/database.ts`](src/types/database.ts) — extend `ProductRow` / `products` Row type if present, `MealItemInput` (add optional `composite_quantity_mode`), new ingredient row type, Supabase `Database` RPC entries for new RPCs (same file pattern as existing `create_meal_with_items`).
   - **Logging API:** [`src/features/logging/api.ts`](src/features/logging/api.ts) — extend `createMealWithItems` / `updateMealWithItems` payloads.
   - **New module:** [`src/features/foods/api.ts`](src/features/foods/api.ts) (new) per build spec §7.1.
   - **Router:** [`src/app/router/index.tsx`](src/app/router/index.tsx) — add `/app/my-food` (lazy route module pattern like profile: optional [`src/app/router/route-modules/my-food.ts`](src/app/router/route-modules/my-food.ts) + page under `src/pages/app/`).
   - **Profile:** [`src/pages/app/ProfilePage.tsx`](src/pages/app/ProfilePage.tsx) — remove embedded products list; add nav link to My food (build spec §8.7).
   - **Logging UI:** [`src/features/logging/MealSheet.tsx`](src/features/logging/MealSheet.tsx) + related payloads/builders (e.g. [`src/features/logging/mealPayloads.ts`](src/features/logging/mealPayloads.ts) if used) — composite quantity mode + preview.
   - **Product form:** [`src/features/logging/ProductForm.tsx`](src/features/logging/ProductForm.tsx) — `kind = 'simple'` on save when moved/refactored to My food flow.
   - **Tests:** extend [`src/pages/app/__tests__/DailyLogPage.test.tsx`](src/pages/app/__tests__/DailyLogPage.test.tsx) only where logging entry points change; add **new** tests under `src/features/foods/` or `src/features/logging/__tests__/` for payload shape and composite branches; SQL-level tests only if repo already has a pattern (likely none — call out **manual SQL verification** on staging).
5. **PR / merge strategy** — Suggested slices aligned with safe rollout:
   - **PR1:** Migration 036 + types only (app still behaves; composite columns unused).
   - **PR2:** `upsert_composite_product` + `get_composite_product` + foods API (no MealSheet change).
   - **PR3:** Extend meal RPCs + `MealItemInput` + api.ts (high risk — feature-flag optional if you use flags elsewhere).
   - **PR4:** My food route + list + move Profile section.
   - **PR5:** Composite builder UI + ingredient picker.
   - **PR6:** MealSheet composite selector + AC sweep.
6. **QA matrix** — Table: **AC1–AC10** → manual steps or automated test file; note **merge** cases (gram vs piece must not merge) per build spec §5.3.
7. **Risks / rollback** — Migration down strategy (if not supported, document “forward-only”); RPC deploy order (migrations before edge deploy of client sending new JSON fields).
8. **Doc hygiene** — Small additions only (per “focused diff”):
   - In **[`docs/composite-food-build-spec.md`](docs/composite-food-build-spec.md)** §13 or §14: one line pointing to the new implementation plan as the **execution checklist**.
   - In **[`docs/README.md`](docs/README.md)** “Source Documents”: one bullet linking the implementation plan.
   - Optionally one sentence in **[`docs/composite-food-implementation-notes.md`](docs/composite-food-implementation-notes.md)** pointing implementers: prep → build spec → **implementation plan**.

## What we will not do in this pass

- Implement migrations, RPCs, or UI (plan-only).
- Duplicate the full SQL and TypeScript blocks from the build spec into the plan (link + section anchors instead).
- Rewrite the large [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) MVP handoff; only add a **short cross-link** there if you want a single mega-index (optional; default **skip** unless you ask).

## Implementation todos

After you approve the plan, the work is **documentation only**: add `composite-foods-implementation-plan.md` and the small cross-links above.
