-- Reset one NutriMon test account in Supabase by email.
--
-- Usage:
-- 1. Open the Supabase SQL editor for your project.
-- 2. Paste this file.
-- 3. Replace the email below.
-- 4. Run it.
--
-- Default behavior:
-- - keeps the auth account
-- - keeps the profile row
-- - deletes user-owned app data (logs, meals, templates, products, weights, creature, battles)
--
-- Optional:
-- - uncomment the profile reset block if you also want to rerun onboarding from scratch

begin;

do $$
declare
  v_email text := 'replace-with-test-user@example.com';
  v_user_id uuid;
begin
  select id
  into v_user_id
  from auth.users
  where email = v_email;

  if v_user_id is null then
    raise exception 'No auth user found for email: %', v_email;
  end if;

  -- Battle + creature state
  delete from public.battle_runs
  where user_id = v_user_id;

  delete from public.creature_battle_snapshots
  where user_id = v_user_id;

  delete from public.creature_companions
  where user_id = v_user_id;

  -- Derived daily state
  delete from public.daily_feedback
  where user_id = v_user_id;

  delete from public.creature_stats
  where user_id = v_user_id;

  delete from public.behavior_attributes
  where user_id = v_user_id;

  delete from public.habit_metrics
  where user_id = v_user_id;

  delete from public.daily_evaluations
  where user_id = v_user_id;

  -- Raw logging state
  delete from public.daily_logs
  where user_id = v_user_id;

  delete from public.weight_entries
  where user_id = v_user_id;

  delete from public.catalog_item_usage
  where user_id = v_user_id;

  delete from public.meal_templates
  where user_id = v_user_id;

  delete from public.products
  where user_id = v_user_id;

  -- Optional: also reset onboarding/profile fields
  -- update public.profiles
  -- set
  --   height_cm = null,
  --   starting_weight_kg = null,
  --   age_years = null,
  --   sex_for_tdee = null,
  --   activity_level = null,
  --   timezone = null,
  --   calorie_target = null,
  --   goal_weight_kg = null,
  --   onboarding_completed_at = null,
  --   updated_at = now()
  -- where user_id = v_user_id;

  raise notice 'Reset complete for % (%)', v_email, v_user_id;
end
$$;

commit;
