-- Migration 067: dev_set_level helper
--
-- Allows a dev account to jump to any target level for testing.
-- Inserts a synthetic creature_battle_snapshots row with enough xp_gained
-- to bring creature_total_xp to exactly (target_level - 1)^3, then
-- updates creature_companions.level to match.
--
-- No-ops if the account is not flagged is_dev_account.
-- No-ops if the companion is already at or above the target level.

create or replace function public.dev_set_level(p_target_level integer)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id      uuid;
  v_is_dev       boolean;
  v_current_xp   integer;
  v_target_xp    integer;
  v_xp_delta     integer;
  v_new_level    integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select is_dev_account into v_is_dev
  from public.profiles
  where user_id = v_user_id;

  if not coalesce(v_is_dev, false) then
    raise exception 'dev_set_level: dev account required';
  end if;

  if p_target_level < 1 then
    raise exception 'dev_set_level: target_level must be >= 1';
  end if;

  v_current_xp := public.creature_total_xp(v_user_id);
  -- Cubic XP floor for target level: (target_level - 1)^3
  v_target_xp  := (p_target_level - 1) * (p_target_level - 1) * (p_target_level - 1);
  v_xp_delta   := v_target_xp - v_current_xp;

  if v_xp_delta > 0 then
    -- Inject a synthetic snapshot record to carry the extra XP.
    -- Uses a sentinel prep_date/battle_date far in the future so it never
    -- collides with real finalization rows.
    insert into public.creature_battle_snapshots (
      user_id, prep_date, battle_date,
      strength, resilience, momentum, vitality,
      readiness_score, readiness_band, condition,
      level, stage,
      source_daily_evaluation_id,
      xp_gained
    )
    values (
      v_user_id, '2099-01-01', '2099-01-02',
      100, 100, 100, 100,
      100, 'peak', 'thriving',
      p_target_level, 'champion',
      null,
      v_xp_delta
    )
    on conflict do nothing;
  end if;

  v_new_level := public.creature_level_for_xp(public.creature_total_xp(v_user_id));

  update public.creature_companions
  set    level = v_new_level
  where  user_id = v_user_id;

  return json_build_object(
    'previous_xp',  v_current_xp,
    'target_xp',    v_target_xp,
    'xp_added',     greatest(0, v_xp_delta),
    'new_level',    v_new_level
  );
end;
$$;
