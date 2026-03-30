# NutriMon Release Readiness Checklist

Use this checklist for each release candidate.

## Candidate

- Release candidate date:
- Environment / Supabase project ref:
- Reviewer:

## Deployment

- [x] Migrations applied through `006_shared_food_catalog.sql`
- [x] Shared catalog imported into `food_catalog_items`
- [x] `finalize-day` deployed
- [x] `auto-finalize-day` deployed
- [x] `CRON_SHARED_SECRET` set for hosted functions
- [x] Hourly schedule created for `auto-finalize-day`
- [x] `supabase/config.toml` deployed with:
  - [ ] `finalize-day verify_jwt = false`
  - [ ] `auto-finalize-day verify_jwt = false`

## Public Auth

- [x] Confirm-email enabled in Supabase
- [x] Sign up sends user to the pending-confirmation state when no session is returned
- [x] Confirmation email arrives
- [x] Verification link completes successfully
- [x] Verified user can sign in

## Product Flows

- [x] Onboarding completes and populates `profiles`
- [x] User can create/edit/delete a custom product
- [x] User can search and log a built-in catalog food
- [x] Logging a built-in item does not create a `products` row
- [x] Logging a built-in item updates `catalog_item_usage`
- [x] Add/edit/delete meal undo works
- [x] Repeat last meal works
- [x] Finalize day works
- [x] Finalized day becomes read-only

## Runtime Verification

- [x] `npm run lint` passes
- [x] `npm run test` passes
- [x] `npm run build` passes
- [ ] Manual invoke of `auto-finalize-day` succeeds with `x-cron-secret`
- [ ] Supabase logs show no unexpected function auth failures

## Outcome

- Release recommendation: `GO / NO-GO`
- Blocking issues:
- Non-blocking issues:
