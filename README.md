# NutriMon

NutriMon is a behavior-first nutrition tracker. The MVP focuses on fast meal logging, calorie-target adherence, lightweight weight tracking, and creature feedback driven by finalized daily evaluations.

## Stack

- React 19
- TypeScript
- Vite
- Supabase Auth, Postgres, and Edge Functions
- TanStack Query

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local env file from the example:

```bash
cp .env.local.example .env.local
```

3. Set frontend env vars in `.env.local`:

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. Apply database migrations to your Supabase project in order:

- [001_schema.sql](/Users/bemoy/Developer/NutriMon/supabase/migrations/001_schema.sql)
- [002_rls.sql](/Users/bemoy/Developer/NutriMon/supabase/migrations/002_rls.sql)
- [003_triggers.sql](/Users/bemoy/Developer/NutriMon/supabase/migrations/003_triggers.sql)
- [004_rpcs.sql](/Users/bemoy/Developer/NutriMon/supabase/migrations/004_rpcs.sql)
- [005_restore_meal_from_snapshot.sql](/Users/bemoy/Developer/NutriMon/supabase/migrations/005_restore_meal_from_snapshot.sql)

If you use the Supabase CLI, a clean local reset is typically:

```bash
supabase db reset
```

## Edge Functions

The repo includes two Edge Functions:

- [finalize-day](/Users/bemoy/Developer/NutriMon/supabase/functions/finalize-day/index.ts): finalizes a single user day and calculates derived records
- [auto-finalize-day](/Users/bemoy/Developer/NutriMon/supabase/functions/auto-finalize-day/index.ts): scheduled backfill/finalization for eligible users

Required function env vars:

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Serve functions locally with the Supabase CLI if you have it installed:

```bash
supabase functions serve finalize-day
supabase functions serve auto-finalize-day
```

## Development

Run the app:

```bash
npm run dev
```

## Verification

Run the standard checks:

```bash
npm run lint
npm run test
npm run build
```

## MVP Flows To Verify Manually

1. Sign up, complete onboarding, and confirm a profile row is populated.
2. Open today’s Daily Log and verify an empty day shows quick-add content immediately.
3. Create a product, edit it, hard-delete it, and confirm historical meals still render from snapshots.
4. Add a meal, edit a meal, delete a meal, and verify each action offers undo.
5. Use `Repeat last meal` on the current day.
6. Finalize the current day after logging at least one meal.
7. Invoke `auto-finalize-day` and verify it finalizes eligible backfill dates oldest-first.

## Source Documents

- Product intent: [PRODUCT_PRD.md](/Users/bemoy/Developer/NutriMon/PRODUCT_PRD.md)
- Frozen implementation handoff: [IMPLEMENTATION_PLAN.md](/Users/bemoy/Developer/NutriMon/IMPLEMENTATION_PLAN.md)

Archived historical PRDs live under [docs/archive/README.md](/Users/bemoy/Developer/NutriMon/docs/archive/README.md) and should not be used as implementation sources.
