# NutriMon Release Readiness Checklist

Use this checklist for each release candidate.

## Candidate

- Release candidate date:
- Environment / Supabase project ref:
- Reviewer:

## Deployment

- [ ] Migrations applied through `006_shared_food_catalog.sql`
- [ ] Shared catalog imported into `food_catalog_items`
- [ ] `finalize-day` deployed
- [ ] `auto-finalize-day` deployed
- [ ] `CRON_SHARED_SECRET` set for hosted functions
- [ ] Hourly schedule created for `auto-finalize-day`
- [ ] `supabase/config.toml` deployed with:
  - [ ] `finalize-day verify_jwt = false`
  - [ ] `auto-finalize-day verify_jwt = false`

## Public Auth

- [ ] Confirm-email enabled in Supabase
- [ ] Sign up sends user to the pending-confirmation state when no session is returned
- [ ] Confirmation email arrives
- [ ] Verification link completes successfully
- [ ] Verified user can sign in

## Product Flows

- [ ] Onboarding completes and populates `profiles`
- [ ] User can create/edit/delete a custom product
- [ ] User can search and log a built-in catalog food
- [ ] Logging a built-in item does not create a `products` row
- [ ] Logging a built-in item updates `catalog_item_usage`
- [ ] Add/edit/delete meal undo works
- [ ] Repeat last meal works
- [ ] Finalize day works
- [ ] Finalized day becomes read-only

## Runtime Verification

- [ ] `npm run lint` passes
- [ ] `npm run test` passes
- [ ] `npm run build` passes
- [ ] Manual invoke of `auto-finalize-day` succeeds with `x-cron-secret`
- [ ] Supabase logs show no unexpected function auth failures

## Outcome

- Release recommendation: `GO / NO-GO`
- Blocking issues:
- Non-blocking issues:
