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
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
VITE_APP_BASE_PATH=/
VITE_ROUTER_MODE=browser
```

GitHub Pages project-site example:

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
VITE_APP_BASE_PATH=/NutriMon/
VITE_ROUTER_MODE=hash
```

4. Apply database migrations to your Supabase project in order:

- [001_schema.sql](/Users/bemoy/Developer/NutriMon/supabase/migrations/001_schema.sql)
- [002_rls.sql](/Users/bemoy/Developer/NutriMon/supabase/migrations/002_rls.sql)
- [003_triggers.sql](/Users/bemoy/Developer/NutriMon/supabase/migrations/003_triggers.sql)
- [004_rpcs.sql](/Users/bemoy/Developer/NutriMon/supabase/migrations/004_rpcs.sql)
- [005_restore_meal_from_snapshot.sql](/Users/bemoy/Developer/NutriMon/supabase/migrations/005_restore_meal_from_snapshot.sql)
- [006_shared_food_catalog.sql](/Users/bemoy/Developer/NutriMon/supabase/migrations/006_shared_food_catalog.sql)

If you use the Supabase CLI, a clean local reset is typically:

```bash
supabase db reset
```

## Built-in Food Catalog

NutriMon now supports a shared built-in food catalog alongside user-created products.

- Shared catalog rows live in `food_catalog_items`
- Per-user usage summaries live in `catalog_item_usage`
- Logging/search surfaces merge:
  - user products
  - built-in catalog items
- Profile product management remains scoped to user-created products only

The committed normalized catalog artifact is:

- [data/food_catalog_items.matvaretabellen_2026.json](/Users/bemoy/Developer/NutriMon/data/food_catalog_items.matvaretabellen_2026.json)

To rebuild the artifact from the source spreadsheet:

```bash
npm run build:food-catalog -- /path/to/alle-matvarer.xlsx
```

To import the artifact into Supabase:

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key npm run import:food-catalog
```

The import script reads:

- `SUPABASE_URL` or `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

and upserts the catalog in batches of `500`.

## Edge Functions

The repo includes two Edge Functions:

- [finalize-day](/Users/bemoy/Developer/NutriMon/supabase/functions/finalize-day/index.ts): finalizes a single user day and calculates derived records
- [auto-finalize-day](/Users/bemoy/Developer/NutriMon/supabase/functions/auto-finalize-day/index.ts): scheduled backfill/finalization for eligible users via internal secret-header auth

Hosted Edge Functions already receive `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` from Supabase. Do not try to set reserved `SUPABASE_*` secrets manually for hosted deployment.

Additional required hosted function secret:

```bash
CRON_SHARED_SECRET=choose-a-long-random-secret
```

For local server-side tools and local function serving, use [.env.server.example](/Users/bemoy/Developer/NutriMon/.env.server.example) as the template for non-frontend secrets.

Serve functions locally with the Supabase CLI if you have it installed:

```bash
supabase functions serve finalize-day
supabase functions serve auto-finalize-day
```

Function auth settings are defined in [supabase/config.toml](/Users/bemoy/Developer/NutriMon/supabase/config.toml):

- `finalize-day` uses in-function JWT auth with `verify_jwt = false`
- `auto-finalize-day` uses `verify_jwt = false` plus required `x-cron-secret` header validation

## Public Auth Setup

For a public release:

- enable confirm-email in Supabase Auth
- keep public signup open
- expect users without an immediate session to land on `/signup/pending`

If you expect meaningful signup volume, configure custom SMTP rather than relying on the default hosted email limits.

If you deploy on a GitHub Pages project-site subpath:

- `Site URL` should be the public project URL, for example:
  - `https://yourname.github.io/NutriMon/`
- add redirect URLs for:
  - `https://yourname.github.io/NutriMon/`
  - `https://yourname.github.io/NutriMon/#/login`

The app supports hash routing for this hosting mode via:

```bash
VITE_APP_BASE_PATH=/NutriMon/
VITE_ROUTER_MODE=hash
```

## GitHub Pages Deployment

This repo includes a GitHub Actions workflow for GitHub Pages at:

- [.github/workflows/deploy-pages.yml](/Users/bemoy/Developer/NutriMon/.github/workflows/deploy-pages.yml)

The workflow builds the app for a project-site deployment using:

```bash
VITE_APP_BASE_PATH=/NutriMon/
VITE_ROUTER_MODE=hash
```

Before it can deploy successfully:

1. In GitHub repository settings, enable:
   - `Pages -> Source -> GitHub Actions`
2. Add repository secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Keep the repository name aligned with the configured base path:
   - current workflow assumes the Pages subpath is `/NutriMon/`

After deployment, the expected public URLs are:

- `https://yourname.github.io/NutriMon/`
- `https://yourname.github.io/NutriMon/#/login`

## Scheduler Setup

To make `auto-finalize-day` operational in production:

1. Deploy the functions.
2. Set `CRON_SHARED_SECRET` for the project.
3. Create an hourly schedule that calls `auto-finalize-day`.
4. Include the header:

```text
x-cron-secret: <CRON_SHARED_SECRET>
```

5. Manually invoke once and verify the JSON payload includes:
   - `processed`
   - `processedIds`
   - `errors`

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
2. Confirm-email flow sends unverified users to `/signup/pending` and verified users can sign in.
3. Open today’s Daily Log and verify an empty day shows quick-add content immediately.
4. Create a product, edit it, hard-delete it, and confirm historical meals still render from snapshots.
5. Search for a built-in catalog food, log it directly, and confirm no new row is created in `products`.
6. Add a meal, edit a meal, delete a meal, and verify each action offers undo.
7. Use `Repeat last meal` on the current day.
8. Finalize the current day after logging at least one meal.
9. Invoke `auto-finalize-day` with `x-cron-secret` and verify it finalizes eligible backfill dates oldest-first.

The release acceptance checklist lives at [docs/release-readiness-checklist.md](/Users/bemoy/Developer/NutriMon/docs/release-readiness-checklist.md).

## Source Documents

- Product intent: [PRODUCT_PRD.md](/Users/bemoy/Developer/NutriMon/PRODUCT_PRD.md)
- Frozen implementation handoff: [IMPLEMENTATION_PLAN.md](/Users/bemoy/Developer/NutriMon/IMPLEMENTATION_PLAN.md)

Archived historical PRDs live under [docs/archive/README.md](/Users/bemoy/Developer/NutriMon/docs/archive/README.md) and should not be used as implementation sources.
