-- 074_fix_cubic_level_authority.sql
--
-- Keep companion progress derived from authoritative XP totals under the cubic
-- curve, and fix dev_set_level so old synthetic level boosts do not persist
-- forever.

-- 1. Shared companion progress sync

create or replace function public.creature_sync_companion_progress(p_user_id uuid default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_total_xp integer;
  v_level integer;
begin
  v_user_id := coalesce(p_user_id, auth.uid());
  if v_user_id is null then
    raise exception 'creature_sync_companion_progress: user_id required';
  end if;

  v_total_xp := public.creature_total_xp(v_user_id);
  v_level := public.creature_level_for_xp(v_total_xp);

  update public.creature_companions
  set xp = v_total_xp,
      level = v_level
  where user_id = v_user_id;

  return json_build_object(
    'user_id', v_user_id,
    'total_xp', v_total_xp,
    'level', v_level
  );
end;
$$;

-- 2. Normalize stale one-off dev level boosts and resync all companions
--
-- Migrations 067/068 used this sentinel row as an additive XP adjustment. Since
-- it was inserted with "on conflict do nothing", later calls could not replace
-- an accidental higher override. Keep the dev override, but recalculate it to
-- the intended level 20 floor under the cubic curve.

delete from public.creature_battle_snapshots s
using public.profiles p
where s.user_id = p.user_id
  and s.prep_date = date '2099-01-01'
  and s.battle_date = date '2099-01-02'
  and s.source_daily_evaluation_id is null
  and not coalesce(p.is_dev_account, false);

with dev_override_xp as (
  select
    s.id,
    greatest(
      0,
      power(20 - 1, 3)::integer
      -
      (
        coalesce((
          select sum(real_s.xp_gained)
          from public.creature_battle_snapshots real_s
          where real_s.user_id = s.user_id
            and real_s.id <> s.id
        ), 0)
        +
        coalesce((
          select sum(br.xp_awarded)
          from public.battle_runs br
          where br.user_id = s.user_id
            and br.reward_claimed = true
        ), 0)
      )
    ) as xp_gained
  from public.creature_battle_snapshots s
  join public.profiles p on p.user_id = s.user_id
  where s.prep_date = date '2099-01-01'
    and s.battle_date = date '2099-01-02'
    and s.source_daily_evaluation_id is null
    and coalesce(p.is_dev_account, false)
)
update public.creature_battle_snapshots s
set xp_gained = dev_override_xp.xp_gained,
    level = 20,
    stage = 'champion'
from dev_override_xp
where dev_override_xp.id = s.id;

update public.creature_companions c
set xp = public.creature_total_xp(c.user_id),
    level = public.creature_level_for_xp(public.creature_total_xp(c.user_id))
where c.xp != public.creature_total_xp(c.user_id)
   or c.level != public.creature_level_for_xp(public.creature_total_xp(c.user_id));

-- Snapshot levels are denormalized battle inputs. Keep historical rows aligned
-- to the XP that existed by that battle date rather than the user's all-time XP.
with snapshot_levels as (
  select
    s.id,
    public.creature_level_for_xp(
      (
        coalesce((
          select sum(prior_s.xp_gained)
          from public.creature_battle_snapshots prior_s
          where prior_s.user_id = s.user_id
            and prior_s.battle_date <= s.battle_date
        ), 0)
        +
        coalesce((
          select sum(br.xp_awarded)
          from public.battle_runs br
          where br.user_id = s.user_id
            and br.reward_claimed = true
            and br.battle_date <= s.battle_date
        ), 0)
      )::integer
    ) as derived_level
  from public.creature_battle_snapshots s
)
update public.creature_battle_snapshots s
set level = snapshot_levels.derived_level
from snapshot_levels
where snapshot_levels.id = s.id
  and s.level != snapshot_levels.derived_level;

-- 3. Make dev_set_level replace the synthetic adjustment

drop function if exists public.dev_set_level(integer);

create or replace function public.dev_set_level(p_target_level integer, p_user_id uuid default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id      uuid;
  v_is_dev       boolean;
  v_real_xp      integer;
  v_target_xp    integer;
  v_xp_delta     integer;
  v_new_total_xp integer;
  v_new_level    integer;
begin
  v_user_id := coalesce(p_user_id, auth.uid());
  if v_user_id is null then
    raise exception 'dev_set_level: pass a user_id when calling from the SQL editor';
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

  delete from public.creature_battle_snapshots
  where user_id = v_user_id
    and prep_date = date '2099-01-01'
    and battle_date = date '2099-01-02'
    and source_daily_evaluation_id is null;

  v_real_xp := public.creature_total_xp(v_user_id);
  v_target_xp := (p_target_level - 1) * (p_target_level - 1) * (p_target_level - 1);
  v_xp_delta := greatest(0, v_target_xp - v_real_xp);

  if v_xp_delta > 0 then
    insert into public.creature_battle_snapshots (
      user_id, prep_date, battle_date,
      strength, resilience, momentum, vitality,
      readiness_score, readiness_band, condition,
      level, stage,
      source_daily_evaluation_id,
      xp_gained
    )
    values (
      v_user_id, date '2099-01-01', date '2099-01-02',
      100, 100, 100, 100,
      100, 'peak', 'thriving',
      p_target_level, 'champion',
      null,
      v_xp_delta
    );
  end if;

  v_new_total_xp := public.creature_total_xp(v_user_id);
  v_new_level := public.creature_level_for_xp(v_new_total_xp);

  update public.creature_companions
  set xp = v_new_total_xp,
      level = v_new_level
  where user_id = v_user_id;

  return json_build_object(
    'real_xp',      v_real_xp,
    'target_xp',    v_target_xp,
    'xp_added',     v_xp_delta,
    'new_total_xp', v_new_total_xp,
    'new_level',    v_new_level
  );
end;
$$;

-- 4. Sync companion progress immediately when a battle grants XP

do $$
declare
  v_function_sql text;
  v_old_fragment text := $old$
  update public.battle_runs set
    status                   = v_status,
    outcome                  = case when v_battle_complete then v_outcome else outcome end,
    player_current_hp        = v_new_player_hp,
    opponent_current_hp      = v_new_opponent_hp,
    current_round            = v_current_round,
    battle_log               = v_new_log,
    player_last_action       = v_player_action,
    enemy_last_action        = v_enemy_action,
    player_momentum_boost    = v_player_momentum_boost,
    enemy_momentum_boost     = v_enemy_momentum_boost,
    player_next_attack_bonus = 0,
    enemy_next_attack_bonus  = 0,
    player_focus_pips        = v_player_focus_pips,
    enemy_focus_pips         = v_enemy_focus_pips,
    turn_count               = case when v_battle_complete then v_turn_count else turn_count end,
    remaining_hp_pct         = case when v_battle_complete then v_remaining_hp_pct else remaining_hp_pct end,
    xp_awarded               = case when v_battle_complete then v_xp_awarded else xp_awarded end,
    arena_progress_awarded   = case when v_battle_complete then v_arena_progress else arena_progress_awarded end,
    reward_claimed           = case when v_battle_complete then v_reward_claimed else reward_claimed end,
    completed_at             = case when v_battle_complete then v_completed_at else completed_at end,
    counter_pending          = v_counter_pending
  where id = p_battle_run_id;

  return public.battle_session_payload(p_battle_run_id);
$old$;
  v_new_fragment text := $new$
  update public.battle_runs set
    status                   = v_status,
    outcome                  = case when v_battle_complete then v_outcome else outcome end,
    player_current_hp        = v_new_player_hp,
    opponent_current_hp      = v_new_opponent_hp,
    current_round            = v_current_round,
    battle_log               = v_new_log,
    player_last_action       = v_player_action,
    enemy_last_action        = v_enemy_action,
    player_momentum_boost    = v_player_momentum_boost,
    enemy_momentum_boost     = v_enemy_momentum_boost,
    player_next_attack_bonus = 0,
    enemy_next_attack_bonus  = 0,
    player_focus_pips        = v_player_focus_pips,
    enemy_focus_pips         = v_enemy_focus_pips,
    turn_count               = case when v_battle_complete then v_turn_count else turn_count end,
    remaining_hp_pct         = case when v_battle_complete then v_remaining_hp_pct else remaining_hp_pct end,
    xp_awarded               = case when v_battle_complete then v_xp_awarded else xp_awarded end,
    arena_progress_awarded   = case when v_battle_complete then v_arena_progress else arena_progress_awarded end,
    reward_claimed           = case when v_battle_complete then v_reward_claimed else reward_claimed end,
    completed_at             = case when v_battle_complete then v_completed_at else completed_at end,
    counter_pending          = v_counter_pending
  where id = p_battle_run_id;

  if v_battle_complete and v_reward_claimed then
    perform public.creature_sync_companion_progress(v_user_id);
  end if;

  return public.battle_session_payload(p_battle_run_id);
$new$;
begin
  select pg_get_functiondef('public.submit_battle_action(uuid,text,text)'::regprocedure)
  into v_function_sql;

  if v_function_sql is null then
    raise exception 'submit_battle_action(uuid,text,text) not found';
  end if;

  if position('creature_sync_companion_progress(v_user_id)' in v_function_sql) > 0 then
    return;
  end if;

  if position(v_old_fragment in v_function_sql) = 0 then
    raise exception 'Could not locate submit_battle_action reward sync fragment';
  end if;

  execute replace(v_function_sql, v_old_fragment, v_new_fragment);
end;
$$;

-- 5. Dev battle snapshots should use computed progress, not stale columns

do $$
declare
  v_function_sql text;
begin
  select pg_get_functiondef('public.ensure_dev_battle_snapshot(date)'::regprocedure)
  into v_function_sql;

  if v_function_sql is null then
    raise exception 'ensure_dev_battle_snapshot(date) not found';
  end if;

  if position('public.creature_level_for_xp(public.creature_total_xp(v_user_id))' in v_function_sql) > 0 then
    return;
  end if;

  if position('coalesce(v_companion.level, 1)' in v_function_sql) = 0 then
    raise exception 'Could not locate ensure_dev_battle_snapshot level fragment';
  end if;

  execute replace(
    v_function_sql,
    'coalesce(v_companion.level, 1)',
    'public.creature_level_for_xp(public.creature_total_xp(v_user_id))'
  );
end;
$$;
