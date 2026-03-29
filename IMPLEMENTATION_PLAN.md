# NutriMon - Coding Agent Handoff Spec

> **Goal:** This document is the implementation source of truth for the implemented MVP baseline.
> **Product intent reference:** `PRODUCT_PRD.md`
> **Status:** Current implementation baseline. Use this for implementation and deployment.

---

## 1. Purpose

This document replaces the previous roadmap-style implementation plan with an execution-grade handoff spec for a coding agent.

Use this document as the canonical implementation reference for:

- architecture decisions
- database schema
- backend contracts
- UI routes and screens
- business logic formulas
- acceptance criteria
- test coverage requirements

If this document conflicts with `nutrimon_master_prd_v1_9.md`, prefer this document.
If this document conflicts with `nutrimon_master_prd_v2_0.md`, preserve the product intent from `v2.0` but follow the implementation details here unless explicitly revised.

---

## 2. Product Summary

NutriMon is a behavior-driven nutrition tracker with light gamification.

The MVP loop is:

1. User logs food quickly.
2. App evaluates the day against the calorie target.
3. App updates behavior metrics and creature stats.
4. App gives immediate, supportive feedback that reinforces consistency.

The MVP is not a macro-optimization app and it is not a battle game yet.
The primary product success criterion is low-friction, repeatable logging with visible progression.

---

## 3. MVP Scope

The MVP must include:

- email/password auth
- onboarding with TDEE-based calorie target suggestion
- user product creation and reuse
- shared built-in food catalog search and logging
- meal logging
- daily logs
- weight logging for reference only
- day finalization
- daily evaluation
- streaks and habit metrics
- behavior attributes
- creature stats display

The MVP must not include:

- battles
- social or couple features
- push notifications
- app-store packaging
- offline sync
- OAuth

---

## 4. Locked Implementation Decisions

The previous plan left several choices open. They are now fixed for implementation.

### 4.1 Frontend

- Use `Vite + React + TypeScript`.
- Use `Tailwind CSS`.
- Use `shadcn/ui` for primitive components only.
- Use `TanStack Query` for server-state caching and mutations.
- Use `React Router` for routing.
- Use `date-fns` and `date-fns-tz` for all date/time handling.
- Use `Zod` for client-side validation.
- Use `React Hook Form` for multi-step forms.
- Use `Recharts` for the weight chart.

### 4.2 Backend

- Use Supabase as the only backend.
- Do not build a separate custom REST API server.
- Use direct Supabase table access for simple CRUD.
- Use Postgres RPC functions for multi-record meal mutations.
- Use Supabase Edge Functions for trusted business logic that must not live in the client:
  - `finalize-day`
  - `auto-finalize-day`

### 4.3 State Management

- Use TanStack Query for server data.
- Use React context for auth state.
- Use local component state for ephemeral UI state.
- Do not add Zustand for the MVP.

### 4.4 Logging UX Decisions

- The daily log uses a flat chronological meal list, newest first.
- The quick-add interface is a bottom sheet on mobile and a modal on desktop.
- Product deletion in the UI is implemented as hard delete.
- Meal history must remain intact after a product is edited or deleted.
- Logging/search surfaces merge two food sources:
  - user-created products
  - built-in shared catalog items
- Profile product management remains scoped to user-created products only.

### 4.5 Progression Decisions

- Phase 1 creature stage is always `baby`.
- Phase 2 progression is locked to:
  - `baby -> adult` at 7 qualifying streak days
  - `adult -> champion` at 30 qualifying streak days
- Ignore the more granular multi-stage example in `nutrimon_master_prd_v2_0.md` for now.

### 4.6 Weight Tracking Decisions

- Weight tracking is optional and low-emphasis.
- Do not require ongoing weigh-ins anywhere in the MVP.
- Support one weight entry per day.
- Support an optional free-text note on each weight entry.
- Keep the feature simple: manual entry plus graph view.

---

## 5. Required Dependencies

Install these packages unless equivalent workspace standards already exist:

- `react-router-dom`
- `@tanstack/react-query`
- `@supabase/supabase-js`
- `date-fns`
- `date-fns-tz`
- `zod`
- `react-hook-form`
- `@hookform/resolvers`
- `recharts`
- `vite-plugin-pwa`

---

## 6. Project Structure

Use this structure unless a stronger repo convention already exists:

```text
src/
  app/
    providers/
    router/
  components/
  features/
    auth/
    onboarding/
    logging/
    creature/
    weight/
    profile/
  lib/
    supabase.ts
    date.ts
    tdee.ts
    scoring.ts
    constants.ts
  types/
    domain.ts
    database.ts
  pages/
    auth/
    app/
supabase/
  migrations/
  functions/
    finalize-day/
    auto-finalize-day/
```

---

## 7. Route Map

Implement these routes:

- `/login`
- `/signup`
- `/signup/pending`
- `/reset-password`
- `/onboarding`
- `/app`
- `/app/log/:date`
- `/app/creature`
- `/app/weight`
- `/app/profile`

Route behavior:

- Unauthenticated users may only access auth routes.
- Authenticated users who have not completed onboarding are redirected to `/onboarding`.
- `/app` redirects to `/app/log/:todayInUserTimezone`.
- Previous days are viewable from the daily log route but are read-only if finalized.

---

## 8. Domain Model

### 8.1 Product

A reusable food item defined per default serving.

Fields:

- name
- calories per default serving
- protein grams per default serving, optional
- carbs grams per default serving, optional
- fat grams per default serving, optional
- default serving amount, optional
- default serving unit, optional
- use count
- last used at

### 8.2 Built-in Catalog Item

A read-only shared food item defined per default serving.

Fields:

- source
- source item id
- name
- calories per default serving
- protein grams per default serving, optional
- carbs grams per default serving, optional
- fat grams per default serving, optional
- default serving amount
- default serving unit
- edible portion percent, optional

### 8.3 Food Source

The logging UI works with a unified food-source model.

A food source is either:

- a user product
- a built-in catalog item

### 8.4 Meal

A meal is a timestamped log entry belonging to one daily log.
Meal names are not required in MVP.

### 8.5 Meal Item

A meal item may reference a product or a catalog item, but it always stores a nutritional snapshot.
This preserves historical meal accuracy if a product later changes or is deleted.

### 8.6 Daily Log

One daily log exists per user per date.
It stores aggregate totals for that day and whether the day is finalized.

### 8.7 Daily Evaluation

One row per user per finalized date.
This stores the scoring results used for habit metrics and attributes.

### 8.8 Habit Metrics

One snapshot row per user per finalized date.
The latest row is the current state shown in the UI.

### 8.9 Behavior Attributes

One snapshot row per user per finalized date.
Calculated from recent evaluation history.

### 8.10 Creature Stats

One snapshot row per user per finalized date.
Calculated after habit metrics and behavior attributes.

### 8.11 Daily Feedback

One row per user per finalized date.
Stores a short supportive message and a small recommendation.

---

## 9. Database Schema

Use UUID primary keys unless otherwise noted.
Enable RLS on every user-owned table.
All tables must include `created_at timestamptz default now()` unless explicitly stated otherwise.

### 9.1 `profiles`

Purpose: Extends `auth.users` with app-specific fields.

Columns:

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `height_cm numeric(5,2) null`
- `starting_weight_kg numeric(6,2) null`
- `age_years integer null check (age_years is null or (age_years >= 13 and age_years <= 120))`
- `sex_for_tdee text null check (sex_for_tdee is null or sex_for_tdee in ('male','female'))`
- `activity_level text null check (activity_level is null or activity_level in ('sedentary','lightly_active','moderately_active','very_active'))`
- `timezone text null`
- `calorie_target integer null check (calorie_target is null or (calorie_target >= 800 and calorie_target <= 6000))`
- `goal_weight_kg numeric(6,2) null`
- `onboarding_completed_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:

- primary key only

Notes:

- A minimal `profiles` row is created at sign-up with only `user_id`, timestamps, and nullable onboarding fields.
- Onboarding completion requires `height_cm`, `starting_weight_kg`, `age_years`, `sex_for_tdee`, `activity_level`, `timezone`, and `calorie_target` to be non-null before `onboarding_completed_at` is set.
- `timezone` is required for all users with completed onboarding because auto-finalization depends on it.
- Store weight internally in kilograms. Convert from pounds in the UI as needed.

### 9.2 `products`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `name text not null`
- `calories integer not null check (calories >= 0 and calories <= 5000)`
- `protein_g numeric(6,2) null check (protein_g >= 0)`
- `carbs_g numeric(6,2) null check (carbs_g >= 0)`
- `fat_g numeric(6,2) null check (fat_g >= 0)`
- `default_serving_amount numeric(8,2) null check (default_serving_amount > 0)`
- `default_serving_unit text null`
- `use_count integer not null default 0 check (use_count >= 0)`
- `last_used_at timestamptz null`
- `updated_at timestamptz not null default now()`
- `created_at timestamptz not null default now()`

Indexes:

- `(user_id, last_used_at desc)`
- `(user_id, use_count desc)`
- `(user_id, lower(name))`

Notes:

- Product values are per one default serving.
- Product deletion is a true delete from `products`.
- Historical meals remain intact because meal items store snapshots and `product_id` is nullable with `on delete set null`.

### 9.2a `food_catalog_items`

Columns:

- `id text primary key`
- `source text not null`
- `source_item_id text not null`
- `name text not null`
- `calories integer not null check (calories >= 0 and calories <= 5000)`
- `protein_g numeric(6,2) null check (protein_g is null or protein_g >= 0)`
- `carbs_g numeric(6,2) null check (carbs_g is null or carbs_g >= 0)`
- `fat_g numeric(6,2) null check (fat_g is null or fat_g >= 0)`
- `default_serving_amount numeric(8,2) not null default 100 check (default_serving_amount > 0)`
- `default_serving_unit text not null default 'g'`
- `edible_portion_percent numeric(5,2) null`
- `updated_at timestamptz not null default now()`
- `created_at timestamptz not null default now()`

Constraints:

- `unique (source, source_item_id)`

Indexes:

- `lower(name)`

Notes:

- This is a shared read-only catalog, not a user-owned table.
- Current source is Matvaretabellen 2026 imported from the normalized artifact in `data/food_catalog_items.matvaretabellen_2026.json`.

### 9.2b `catalog_item_usage`

Columns:

- `user_id uuid not null references auth.users(id) on delete cascade`
- `catalog_item_id text not null references food_catalog_items(id) on delete cascade`
- `use_count integer not null default 0 check (use_count >= 0)`
- `last_used_at timestamptz null`
- `updated_at timestamptz not null default now()`
- `created_at timestamptz not null default now()`

Constraints:

- `primary key (user_id, catalog_item_id)`

Indexes:

- `(user_id, last_used_at desc nulls last)`
- `(user_id, use_count desc, last_used_at desc nulls last)`

### 9.3 `daily_logs`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `log_date date not null`
- `total_calories integer not null default 0`
- `meal_count integer not null default 0`
- `is_finalized boolean not null default false`
- `finalized_at timestamptz null`
- `updated_at timestamptz not null default now()`
- `created_at timestamptz not null default now()`

Constraints:

- `unique (user_id, log_date)`

Indexes:

- `(user_id, log_date desc)`

### 9.4 `meals`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `daily_log_id uuid not null references daily_logs(id) on delete cascade`
- `logged_at timestamptz not null`
- `total_calories integer not null default 0`
- `item_count integer not null default 0`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:

- `(user_id, daily_log_id, logged_at desc)`

### 9.5 `meal_items`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `meal_id uuid not null references meals(id) on delete cascade`
- `product_id uuid null references products(id) on delete set null`
- `catalog_item_id text null references food_catalog_items(id) on delete set null`
- `quantity numeric(8,2) not null check (quantity > 0)`
- `product_name_snapshot text not null`
- `calories_per_serving_snapshot integer not null`
- `protein_g_snapshot numeric(6,2) null`
- `carbs_g_snapshot numeric(6,2) null`
- `fat_g_snapshot numeric(6,2) null`
- `serving_amount_snapshot numeric(8,2) null`
- `serving_unit_snapshot text null`
- `line_total_calories integer not null`
- `created_at timestamptz not null default now()`

Indexes:

- `(meal_id)`

Notes:

- `line_total_calories = round(quantity * calories_per_serving_snapshot)`
- Quantity is a serving multiplier.
- Exactly one of `product_id` or `catalog_item_id` is populated for active referenced items.
- Snapshot-only restored/deleted items may have both reference columns null.

### 9.6 `weight_entries`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `entry_date date not null`
- `weight_kg numeric(6,2) not null check (weight_kg > 0 and weight_kg < 500)`
- `source_unit text not null check (source_unit in ('kg','lb'))`
- `source_value numeric(6,2) not null`
- `notes text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `unique (user_id, entry_date)`

Indexes:

- `(user_id, entry_date desc)`

### 9.7 `daily_evaluations`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `daily_log_id uuid not null references daily_logs(id) on delete cascade`
- `log_date date not null`
- `target_calories integer not null`
- `consumed_calories integer not null`
- `calorie_delta integer not null`
- `adherence_score numeric(5,2) not null check (adherence_score >= 0 and adherence_score <= 100)`
- `adjusted_adherence numeric(5,2) not null check (adjusted_adherence >= 0 and adjusted_adherence <= 100)`
- `status text not null check (status in ('optimal','acceptable','poor','no_data'))`
- `calculation_version text not null default 'v1'`
- `finalized_at timestamptz not null`
- `created_at timestamptz not null default now()`

Constraints:

- `unique (user_id, log_date)`

Indexes:

- `(user_id, log_date desc)`

### 9.8 `habit_metrics`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `log_date date not null`
- `current_streak integer not null default 0`
- `longest_streak integer not null default 0`
- `days_logged_last_7 integer not null default 0`
- `last_log_date date null`
- `created_at timestamptz not null default now()`

Constraints:

- `unique (user_id, log_date)`

Indexes:

- `(user_id, log_date desc)`

### 9.9 `behavior_attributes`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `log_date date not null`
- `consistency_score numeric(5,2) not null`
- `stability_score numeric(5,2) not null`
- `momentum_score numeric(5,2) not null`
- `discipline_score numeric(5,2) not null`
- `calculation_version text not null default 'v1'`
- `calculated_at timestamptz not null`
- `created_at timestamptz not null default now()`

Constraints:

- `unique (user_id, log_date)`

Indexes:

- `(user_id, log_date desc)`

### 9.10 `creature_stats`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `log_date date not null`
- `strength integer not null`
- `resilience integer not null`
- `momentum integer not null`
- `vitality integer not null`
- `stage text not null check (stage in ('baby','adult','champion'))`
- `created_at timestamptz not null default now()`

Constraints:

- `unique (user_id, log_date)`

Indexes:

- `(user_id, log_date desc)`

### 9.11 `daily_feedback`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `log_date date not null`
- `daily_evaluation_id uuid not null references daily_evaluations(id) on delete cascade`
- `status text not null check (status in ('optimal','acceptable','poor','no_data'))`
- `message text not null`
- `recommendation text not null`
- `created_at timestamptz not null default now()`

Constraints:

- `unique (user_id, log_date)`

Indexes:

- `(user_id, log_date desc)`

---

## 10. RLS Policies

Apply RLS to all user-owned tables.

Minimum policy shape:

- authenticated users can `select`, `insert`, `update`, `delete` only rows where `user_id = auth.uid()`
- service role bypasses RLS for edge functions

Special handling:

- `meal_items` does not have `user_id`
- enforce access through parent `meals` ownership
- `food_catalog_items` is shared and read-only to authenticated users
- `catalog_item_usage` is user-owned and should allow only per-user `select`, `insert`, and `update`

Required helper behavior:

- create a `profiles` row when a new auth user is created
- use a SQL trigger or auth hook to ensure profile bootstrap

---

## 11. Backend Contracts

### 11.1 Direct Table CRUD From Frontend

Allow direct Supabase access for:

- auth
- `profiles` read/update
- `products` create/update/delete/list
- `food_catalog_items` read only through RPC-backed logging/search surfaces
- `weight_entries` create/update/list
- querying `daily_logs`, `meals`, `meal_items`, `daily_evaluations`, `habit_metrics`, `behavior_attributes`, `creature_stats`, `daily_feedback`

### 11.2 Postgres RPC Functions

Implement these RPCs because meal mutations affect multiple tables and must stay consistent.

#### `ensure_daily_log`

Input:

- `p_log_date date`

Behavior:

- creates the daily log for `auth.uid()` if missing
- returns the `daily_logs` row

Return shape:

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "log_date": "YYYY-MM-DD",
  "total_calories": 0,
  "meal_count": 0,
  "is_finalized": false,
  "finalized_at": null
}
```

#### `create_meal_with_items`

Input:

- `p_log_date date`
- `p_logged_at timestamptz`
- `p_items jsonb`

`p_items` shape:

```json
[
  { "product_id": "uuid", "quantity": 1.0 }
]
```

Allowed item variants:

```json
[
  { "product_id": "uuid", "quantity": 1.0 },
  { "catalog_item_id": "matvaretabellen_2026:01.344", "quantity": 1.0 }
]
```

Behavior:

- verifies ownership of referenced products
- verifies existence of referenced catalog items
- ensures daily log exists
- rejects the mutation if the target daily log is finalized
- inserts meal
- inserts meal items using product or catalog snapshot values
- recalculates `meals.total_calories`
- recalculates `daily_logs.total_calories` and `meal_count`
- increments product `use_count`
- updates product `last_used_at`
- increments `catalog_item_usage.use_count`
- updates `catalog_item_usage.last_used_at`
- returns:
  - meal id
  - daily log totals

Return shape:

```json
{
  "meal": {
    "id": "uuid",
    "daily_log_id": "uuid",
    "logged_at": "timestamptz",
    "total_calories": 450,
    "item_count": 2
  },
  "meal_items": [
    {
      "id": "uuid",
      "product_id": "uuid",
      "catalog_item_id": null,
      "quantity": 1.0,
      "product_name_snapshot": "Chicken Wrap",
      "calories_per_serving_snapshot": 450,
      "line_total_calories": 450
    }
  ],
  "daily_log": {
    "id": "uuid",
    "log_date": "YYYY-MM-DD",
    "total_calories": 1450,
    "meal_count": 3,
    "is_finalized": false,
    "finalized_at": null
  }
}
```

#### `update_meal_with_items`

Input:

- `p_meal_id uuid`
- `p_logged_at timestamptz`
- `p_items jsonb`

`p_items` shape:

```json
[
  { "product_id": "uuid", "quantity": 1.0 },
  { "catalog_item_id": "matvaretabellen_2026:01.344", "quantity": 1.0 },
  { "meal_item_id": "uuid", "quantity": 0.5 }
]
```

Item rules:

- use `{ "product_id": ..., "quantity": ... }` for active products
- use `{ "catalog_item_id": ..., "quantity": ... }` for active built-in catalog items
- use `{ "meal_item_id": ..., "quantity": ... }` only when preserving an existing deleted-product snapshot already attached to the target meal
- exactly one of `product_id`, `catalog_item_id`, or `meal_item_id` must be provided for each item

Behavior:

- verifies meal ownership
- rejects the mutation if the parent daily log is finalized
- replaces meal items atomically
- if an item contains `meal_item_id`, it must belong to the target meal and the RPC must reuse that existing snapshot data with the new quantity
- recalculates meal totals
- recalculates daily log totals
- returns updated meal id and daily log totals

Implementation note:

- For MVP, `use_count` is historical lifetime usage.
- Do not increment or decrement `use_count` during meal edits.
- Only increment `use_count` when creating a new meal or repeating a meal.
- Deleted-product items remain editable by quantity through their existing meal-item snapshot reference, but cannot be newly searched or added once the underlying product record is gone.
- Built-in catalog usage counts increment only on explicit create-meal selection, not on repeat-last-meal or snapshot restore.

Return shape:

```json
{
  "meal": {
    "id": "uuid",
    "daily_log_id": "uuid",
    "logged_at": "timestamptz",
    "total_calories": 600,
    "item_count": 2
  },
  "meal_items": [
    {
      "id": "uuid",
      "product_id": null,
      "catalog_item_id": null,
      "quantity": 0.5,
      "product_name_snapshot": "Deleted Product Snapshot",
      "calories_per_serving_snapshot": 300,
      "line_total_calories": 150
    }
  ],
  "daily_log": {
    "id": "uuid",
    "log_date": "YYYY-MM-DD",
    "total_calories": 1600,
    "meal_count": 3,
    "is_finalized": false,
    "finalized_at": null
  }
}
```

#### `delete_meal`

Input:

- `p_meal_id uuid`

Behavior:

- verifies meal ownership
- rejects the mutation if the parent daily log is finalized
- deletes meal and cascade-deletes meal items
- recalculates daily log totals
- returns updated daily log totals

Return shape:

```json
{
  "deleted_meal_id": "uuid",
  "daily_log": {
    "id": "uuid",
    "log_date": "YYYY-MM-DD",
    "total_calories": 1200,
    "meal_count": 2,
    "is_finalized": false,
    "finalized_at": null
  }
}
```

#### `repeat_last_meal`

Input:

- `p_log_date date`

Behavior:

- finds the user's most recent meal from any prior date
- duplicates the meal into the target date
- rejects the mutation if the target daily log is finalized
- keeps the same items with fresh snapshots from the original meal item snapshots, not current product or catalog values
- if `p_log_date` is the user's local current date, sets `logged_at` to the current timestamp in the user's timezone
- if `p_log_date` is a prior editable date, sets `logged_at` to that date combined with the current local time-of-day in the user's timezone
- recalculates daily log totals
- does not increment `catalog_item_usage`
- returns new meal id and daily log totals

Return shape:

```json
{
  "meal": {
    "id": "uuid",
    "daily_log_id": "uuid",
    "logged_at": "timestamptz",
    "total_calories": 700,
    "item_count": 2
  },
  "meal_items": [
    {
      "id": "uuid",
      "product_id": null,
      "quantity": 1.0,
      "product_name_snapshot": "Snapshot Item",
      "calories_per_serving_snapshot": 350,
      "line_total_calories": 350
    }
  ],
  "daily_log": {
    "id": "uuid",
    "log_date": "YYYY-MM-DD",
    "total_calories": 1700,
    "meal_count": 4,
    "is_finalized": false,
    "finalized_at": null
  }
}
```

### 11.3 Edge Functions

#### `finalize-day`

Method:

- POST

Input:

```json
{
  "user_id": "uuid",
  "date": "YYYY-MM-DD"
}
```

Auth rules:

- manual calls from the client must be authenticated
- for client-initiated calls, the function must derive the acting user from the JWT and ignore any mismatched `user_id` in the request body
- service-role scheduled calls may supply `user_id` directly

Behavior:

- idempotent
- loads the target user's profile and daily log
- creates the daily log first if none exists for the date
- if already finalized, returns existing outputs without duplication
- calculates evaluation
- upserts `daily_evaluations`
- upserts `habit_metrics`
- upserts `behavior_attributes`
- upserts `creature_stats`
- upserts `daily_feedback`
- marks `daily_logs.is_finalized = true`
- sets `daily_logs.finalized_at = now()`
- writes matching timestamps and calculation versions into derived outputs where applicable
- returns the full finalized payload for immediate UI refresh

Output:

```json
{
  "daily_log": {
    "id": "uuid",
    "log_date": "YYYY-MM-DD",
    "total_calories": 1800,
    "meal_count": 3,
    "is_finalized": true,
    "finalized_at": "timestamptz"
  },
  "evaluation": {
    "id": "uuid",
    "log_date": "YYYY-MM-DD",
    "target_calories": 2000,
    "consumed_calories": 1800,
    "calorie_delta": -200,
    "adherence_score": 100,
    "adjusted_adherence": 100,
    "status": "optimal",
    "calculation_version": "v1",
    "finalized_at": "timestamptz"
  },
  "habit_metrics": {
    "id": "uuid",
    "log_date": "YYYY-MM-DD",
    "current_streak": 4,
    "longest_streak": 6,
    "days_logged_last_7": 5,
    "last_log_date": "YYYY-MM-DD"
  },
  "behavior_attributes": {
    "id": "uuid",
    "log_date": "YYYY-MM-DD",
    "consistency_score": 82.14,
    "stability_score": 74.22,
    "momentum_score": 88.33,
    "discipline_score": 57.14,
    "calculation_version": "v1",
    "calculated_at": "timestamptz"
  },
  "creature_stats": {
    "id": "uuid",
    "log_date": "YYYY-MM-DD",
    "strength": 82,
    "resilience": 74,
    "momentum": 88,
    "vitality": 70,
    "stage": "baby"
  },
  "daily_feedback": {
    "id": "uuid",
    "log_date": "YYYY-MM-DD",
    "status": "optimal",
    "message": "You stayed on target today. Keep the streak alive.",
    "recommendation": "Repeat what worked today."
  }
}
```

#### `auto-finalize-day`

Trigger:

- scheduled hourly via Supabase cron

Behavior:

- requires `x-cron-secret` to match `CRON_SHARED_SECRET`
- scans profiles
- identifies users whose local time is between `00:05` and `01:00`
- computes the backfill window from the later of:
  - the user's onboarding-completed local date
  - the day after the user's latest finalized date
- ensures a `daily_logs` row exists for every missing date in that window, even if no meals were logged
- finalizes every unfinalized date in that window through the previous local date, oldest first
- skips users without completed onboarding
- calls the same internal finalization logic as `finalize-day`

Reasoning:

- Supabase cron is not per-user timezone aware
- hourly scan with local timezone filtering is sufficient for MVP

### 11.4 Read RPCs For Logging/Search

Implement these RPCs for unified food-source surfaces:

- `get_recent_food_sources`
- `get_frequent_food_sources`
- `search_food_sources`

Unified return shape:

```json
{
  "source_type": "user_product | catalog_item",
  "source_id": "string",
  "name": "string",
  "calories": 123,
  "protein_g": 10.5,
  "carbs_g": 12.0,
  "fat_g": 5.0,
  "default_serving_amount": 100,
  "default_serving_unit": "g",
  "use_count": 3,
  "last_used_at": "timestamptz"
}
```

Sorting rules:

- recent: `last_used_at desc`, then user products before catalog items, then `name asc`
- frequent: `use_count desc`, then `last_used_at desc nulls last`, then user products before catalog items, then `name asc`
- search: user products before catalog items, then `use_count desc`, then `last_used_at desc nulls last`, then `name asc`

---

## 12. Business Logic

### 12.1 TDEE Calculation

Implement in `src/lib/tdee.ts`.

Formula:

- Male: `10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5`
- Female: `10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161`

Activity multipliers:

- `sedentary = 1.2`
- `lightly_active = 1.375`
- `moderately_active = 1.55`
- `very_active = 1.725`

Suggested calorie target:

- `round(tdee - 500)`

Clamp suggestion to:

- minimum `1200`
- maximum `4000`

The user may override the suggested target during onboarding.

### 12.2 Daily Evaluation

Definitions:

- `target = profiles.calorie_target`
- `consumed = daily_logs.total_calories`
- `delta = consumed - target`

#### Raw Adherence Score

Use this exact formula:

- if `consumed = 0`, set `adherence_score = 0`
- if `delta <= 0`, set `adherence_score = 100`
- if `delta between 1 and 200`, set `adherence_score = 100 - (delta * 0.10)`
- if `delta between 201 and 500`, set `adherence_score = 80 - ((delta - 200) * 0.10)`
- if `delta > 500`, set `adherence_score = max(0, 50 - ((delta - 500) * 0.10))`

Round to 2 decimals.

#### Adjusted Adherence

Purpose:

- preserve the "staying under target is good" behavior
- penalize extreme undereating so it does not create fake perfection

Use this exact formula:

- start with `adjusted_adherence = adherence_score`
- if `delta < -500`, subtract `abs(delta + 500) * 0.10`
- clamp to `0..100`
- round to 2 decimals

Examples:

- target `2000`, consumed `1900` -> raw `100`, adjusted `100`
- target `2000`, consumed `1400` -> raw `100`, adjusted `90`
- target `2000`, consumed `1000` -> raw `100`, adjusted `50`

#### No-Data Logic

If `consumed = 0` and there are no meals for that date:

- set `status = 'no_data'`
- set `adherence_score = 0`
- set `adjusted_adherence = previous_day_adjusted_adherence * 0.9`
- if no previous evaluation exists, use `0`
- round to 2 decimals

This decayed value is used for behavior attributes but must not count as a qualifying streak day.

#### Status Buckets

Use `adjusted_adherence` for status classification.

- `no_data` if no meals were logged
- `optimal` if `adjusted_adherence >= 90`
- `acceptable` if `adjusted_adherence >= 70 and < 90`
- `poor` if `adjusted_adherence < 70`

### 12.3 Habit Metrics

One row is written per finalized date.

Definitions:

- qualifying day: `status != 'no_data'` and `adjusted_adherence >= 70`
- last 7 days: inclusive rolling window ending on the finalized date

Rules:

- `current_streak`
  - increment previous streak by 1 if current day qualifies and the previous snapshot row is for the immediately preceding calendar date and that previous day also qualified
  - otherwise set to `1` if current day qualifies
  - otherwise set to `0`
- `longest_streak`
  - `max(previous_longest_streak, current_streak)`
- `days_logged_last_7`
  - count finalized days in the window where there is at least one meal
- `last_log_date`
  - set to current date if the day had at least one meal
  - otherwise preserve the previous value

### 12.4 Behavior Attributes

Use finalized `daily_evaluations` in the rolling window ending on the finalized date.

Lookback windows:

- consistency: last 7 finalized dates
- stability: last 7 finalized dates
- momentum: last 3 finalized dates
- discipline: last 7 finalized dates

Formulas:

- `consistency_score = avg(adjusted_adherence over last 7 finalized dates)`
- `stability_score = clamp(100 - stddev_pop(adjusted_adherence over last 7 finalized dates), 20, 100)`
- `momentum_score = avg(adjusted_adherence over last 3 finalized dates)`
- `discipline_score = qualifying_days_in_last_7 / 7 * 100`

Rules:

- use available data if fewer than 7 finalized dates exist
- `discipline_score` denominator stays `7` even with partial history
- round all scores to 2 decimals

### 12.5 Creature Stats

Formulas:

- `strength = round(consistency_score)`
- `resilience = round(stability_score)`
- `momentum = round(momentum_score)`
- `vitality = 50 + (current_streak * 5)`
- `stage = 'baby'`

Clamp:

- `strength`, `resilience`, `momentum` to `0..100`
- `vitality` to `50..999`

### 12.6 Daily Feedback

Use these message templates for MVP:

- `optimal`
  - message: `You stayed on target today. Keep the streak alive.`
  - recommendation: `Repeat what worked today.`
- `acceptable`
  - message: `Close to target today. Small adjustments keep momentum strong.`
  - recommendation: `Use a recent meal tomorrow to make logging easy.`
- `poor`
  - message: `Today drifted off target. Reset with one simple win at your next meal.`
  - recommendation: `Log the next meal even if the day is not perfect.`
- `no_data`
  - message: `No meals logged today. One logged meal tomorrow is enough to restart momentum.`
  - recommendation: `Use quick add as early as possible tomorrow.`

---

## 13. Screen Requirements

### 13.1 Auth

Required screens:

- sign up
- sign in
- reset password

Requirements:

- email and password only
- standard validation and error states
- sign out from profile screen

### 13.2 Onboarding

Four steps:

1. Profile input
2. TDEE calculation
3. Target confirmation
4. Creature introduction

Fields:

- height
- current weight
- age
- sex for TDEE
- activity level
- timezone
- calorie target
- optional goal weight

Requirements:

- timezone defaults from browser guess
- user can edit timezone
- onboarding cannot be skipped before required fields are saved
- once onboarding is completed, it should not be shown again unless the user profile is explicitly reset
- completion sets `onboarding_completed_at`

### 13.3 Daily Log Screen

This is the primary screen and the highest-priority UX target.

Must show:

- date
- calories consumed
- calories remaining
- progress bar
- streak indicator
- meal list
- persistent add button

Behavior:

- if current date has no log yet, create it lazily on first write or via `ensure_daily_log`
- if no meals exist, show quick-add content rather than an empty illustration
- any date with `is_finalized = true` is read-only
- any date with `is_finalized = false` is editable
- manual finalize is shown only for the user's local current date
- past unfinalized dates remain editable, but manual finalize is not shown for them because auto-finalization is the recovery path

Meal list behavior:

- show meals newest first
- show each meal's timestamp and total calories
- expanding a meal shows meal items and quantities

Quick-add behavior:

- section order:
  1. recent food sources
  2. frequent food sources
  3. search results
  4. create new product shortcut
- default quantity is `1`
- quantity can be adjusted before confirm
- show a source badge on food rows:
  - `My product`
  - `Built-in`

Undo behavior:

- after add, edit, or delete meal, show toast with undo for 5 seconds
- if undo is clicked, reverse the last mutation
- if page reloads, undo state is lost

### 13.4 Product Form

Fields:

- name, required
- calories, required
- protein, optional
- carbs, optional
- fat, optional
- default serving amount, optional
- default serving unit, optional

Requirements:

- autofocus the name field
- use numeric inputs for numeric fields
- support `Save` and `Save & Add`
- `Save & Add` closes the form and immediately inserts the product into the current pending meal flow

### 13.5 Creature Screen

Must show:

- baby creature placeholder asset
- strength bar
- resilience bar
- momentum bar
- vitality bar
- current streak
- teaser text: `Next evolution at 7-day streak`

### 13.6 Weight Screen

Must show:

- weight entry form
- 30-day and 90-day chart views
- optional notes field on manual entries
- no connection to scoring or progression
- no streaks, nudges, or required prompts tied to weight entry

---

## 14. Query and Sorting Requirements

### 14.1 Recent Food Sources

Definition:

- latest 20 merged food sources ordered by `last_used_at desc`, then user products before catalog items, then `name asc`

### 14.2 Frequent Food Sources

Definition:

- top 10 merged food sources ordered by `use_count desc`, then `last_used_at desc nulls last`, then user products before catalog items

### 14.3 Food Source Search

Definition:

- case-insensitive substring match on `name` across user products and built-in catalog items
- user products rank above built-in catalog items
- limit 20 results

### 14.4 Default Daily Log Fetch

For a given date, fetch:

- daily log
- meals ordered by `logged_at desc`
- meal items grouped by meal
- date-matched `daily_evaluations`, `habit_metrics`, `behavior_attributes`, `creature_stats`, and `daily_feedback` where `log_date = requested date`
- if the requested date is not finalized and has no derived rows yet, also fetch the latest finalized `habit_metrics` and latest finalized `creature_stats` overall for persistent header widgets

Historical display rules:

- on finalized dates, show the derived rows for that exact date
- on unfinalized dates, do not fabricate date-specific derived values
- if fallback header widgets are shown on an unfinalized date, label them as current values rather than values for the requested date

---

## 15. Acceptance Criteria

### 15.1 Logging

- user can create a product and log it to today's daily log
- user can search for a built-in catalog item and log it without creating a `products` row
- user can log a meal in under 10 seconds using a recent product
- daily calories update immediately after meal mutation
- deleted products no longer appear in pickers but historical meals still render correctly
- built-in catalog items appear in recent/frequent after explicit logging

### 15.2 Evaluation

- manual finalization creates exactly one row each in:
  - `daily_evaluations`
  - `habit_metrics`
  - `behavior_attributes`
  - `creature_stats`
  - `daily_feedback`
- repeated finalization for the same date is idempotent
- finalized logs become read-only in the UI

### 15.3 Streaks and Attributes

- a day with adjusted adherence `>= 70` and at least one meal increments streak
- no-data days break streak
- behavior attributes reflect rolling windows using finalized dates only

### 15.4 Weight Logging

- user can log one weight entry per date
- existing entry for the same date is edited, not duplicated
- weight entry remains optional and is not required to unlock any other app feature

---

## 16. Test Requirements

Use `Vitest` for unit tests. Add integration tests where practical.

### 16.1 Unit Tests

Required for:

- `tdee.ts`
- scoring formulas
- no-data decay
- habit metric calculation
- behavior attribute calculation
- creature stat calculation
- unit conversion kg/lb
- meal payload building for user products, built-in catalog items, and snapshot-only items
- food catalog normalization from source spreadsheet rows
- merged food-source ranking and mapping behavior where practical

### 16.2 Integration Tests

Required for:

- `create_meal_with_items`
- `update_meal_with_items`
- `delete_meal`
- `repeat_last_meal`
- `get_recent_food_sources`
- `get_frequent_food_sources`
- `search_food_sources`
- `finalize-day` idempotency
- finalized daily log becomes read-only

### 16.3 Manual QA Checklist

- sign up and sign in work
- onboarding saves profile and redirects correctly
- creating a meal updates totals immediately
- recent and frequent lists behave as defined
- built-in catalog foods can be searched and logged without creating `products` rows
- catalog-item logging updates `catalog_item_usage`
- finalize-day produces visible feedback and creature updates
- navigating to prior finalized days is read-only
- weight chart renders for at least 3 sample entries

---

## 17. Deployment Notes

These notes reflect the currently working Supabase deployment.

### 17.1 Migrations

The deployed MVP baseline includes these migrations in order:

- `001_schema.sql`
- `002_rls.sql`
- `003_triggers.sql`
- `004_rpcs.sql`
- `005_restore_meal_from_snapshot.sql`
- `006_shared_food_catalog.sql`

### 17.2 Shared Catalog Import

The built-in catalog is sourced from `alle-matvarer.xlsx` and normalized into:

- `data/food_catalog_items.matvaretabellen_2026.json`

Operational commands:

```bash
npm run build:food-catalog -- /path/to/alle-matvarer.xlsx
SUPABASE_SERVICE_ROLE_KEY=... npm run import:food-catalog
```

Import target:

- `food_catalog_items`

### 17.3 Edge Function Auth Setting

`finalize-day` is deployed with platform JWT verification disabled in `supabase/config.toml`:

```toml
[functions.finalize-day]
verify_jwt = false
```

Reason:

- Supabase platform-level JWT verification returned a bare `401` before the function's own auth logic ran
- the function already performs its own JWT-based user verification internally

Do not remove this setting unless the function auth model is intentionally revised and re-tested.

### 17.4 Scheduled Finalization Auth

`auto-finalize-day` is not a public endpoint.

Required production setup:

- deploy with `verify_jwt = false`
- require `x-cron-secret`
- set hosted secret `CRON_SHARED_SECRET`
- configure the hourly scheduler to include:

```text
x-cron-secret: <CRON_SHARED_SECRET>
```

### 17.5 Public Auth Release Setting

For general public release:

- enable confirm-email in Supabase Auth
- keep the signup pending-confirmation route available
- verify the release environment can send confirmation emails reliably

---

## 18. Seed Evaluation Scenarios

Use these examples in tests:

### Scenario A

- target `2000`
- consumed `1900`
- delta `-100`
- adherence `100`
- adjusted `100`
- status `optimal`

### Scenario B

- target `2000`
- consumed `2100`
- delta `100`
- adherence `90`
- adjusted `90`
- status `optimal`

### Scenario C

- target `2000`
- consumed `2300`
- delta `300`
- adherence `70`
- adjusted `70`
- status `acceptable`

### Scenario D

- target `2000`
- consumed `2600`
- delta `600`
- adherence `40`
- adjusted `40`
- status `poor`

### Scenario E

- target `2000`
- consumed `1400`
- delta `-600`
- adherence `100`
- adjusted `90`
- status `optimal`

### Scenario F

- no meals logged
- previous adjusted adherence `80`
- adherence `0`
- adjusted `72`
- status `no_data`

---

## 19. Delivery Order

Build in this order:

1. project scaffold and dependencies
2. database migrations and RLS
3. auth and profile bootstrap
4. onboarding
5. product system
6. meal RPCs and daily log UI
7. finalize-day edge function
8. creature and feedback UI
9. weight logging
10. polish, accessibility, PWA

Do not start Phase 2 or Phase 3 work during MVP execution.
