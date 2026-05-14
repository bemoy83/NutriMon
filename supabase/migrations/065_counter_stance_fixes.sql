-- Migration 065: counter_stance bug fixes + companion level backfill
--
-- Changes:
--   1. Backfill creature_companions.level using cubic XP formula.
--      (Migration 063 changed the formula but did not update stored levels.)
--   2. Fix counter-after-death: counter-hit now only fires if the player
--      survived the (already-halved) incoming hit. Requires a new local
--      variable v_deflect to capture whether stance was active before we
--      clear the flag.

-- ── 1. Backfill companion levels ─────────────────────────────────────────────
update public.creature_companions
set    level = public.creature_level_for_xp(public.creature_total_xp(user_id))
where  level != public.creature_level_for_xp(public.creature_total_xp(user_id));

-- ── 2. Patch submit_battle_action ────────────────────────────────────────────
do $$
declare
  v_function_sql text;
  v_old_declare  text;
  v_new_declare  text;
  v_old_counter  text;
  v_new_counter  text;
begin
  select pg_get_functiondef(oid)
  into   v_function_sql
  from   pg_proc
  where  proname = 'submit_battle_action'
    and  pronargs = 3;

  -- Idempotency: skip if already patched.
  if position('v_deflect' in v_function_sql) > 0 then return; end if;

  -- ── A: Declare — add v_deflect ──────────────────────────────────────────
  v_old_declare := $old$
  v_counter_pending        boolean := false;
  v_pips_before_skill      integer := 0;
  v_counter_hit_damage     integer := 0;
$old$;

  v_new_declare := $new$
  v_counter_pending        boolean := false;
  v_deflect                boolean := false;
  v_pips_before_skill      integer := 0;
  v_counter_hit_damage     integer := 0;
$new$;

  if position(v_old_declare in v_function_sql) = 0 then
    raise exception 'Migration 065 patch A: declare anchor not found';
  end if;

  v_function_sql := replace(v_function_sql, v_old_declare, v_new_declare);

  -- ── B: Counter block — apply damage before computing counter ────────────
  --
  -- Old: halve → compute counter → apply counter to opponent → clear flag
  --      → THEN apply damage to player
  -- Bug: counter fires even when the halved hit kills the player.
  --
  -- New: halve → clear flag → set v_deflect → apply damage to player
  --      → IF deflect AND player alive → compute counter → apply to opponent
  v_old_counter := $old$
      -- counter_pending: deflect 50% of incoming damage, auto-retaliate for 80% power.
      -- Triggers on any damaging opponent action; clears after the opponent acts.
      if v_counter_pending and v_actor_action in ('attack', 'special') then
        v_act_damage         := greatest(1, round(v_act_damage * 0.5)::integer);
        v_counter_hit_damage := greatest(1, round(
          public.battle_compute_damage(
            p_battle_run_id, v_current_round, 'player',
            v_snapshot.strength, v_snapshot.momentum, v_opponent.resilience,
            0, 0, 1.0, v_snapshot.level, v_snapshot.stage
          ) * 0.80
          * greatest(0.50, 1.0 - v_opponent.recommended_level::numeric * 0.003)
        )::integer);
        v_new_opponent_hp := greatest(0, v_new_opponent_hp - v_counter_hit_damage);
        v_counter_pending := false;
      elsif v_actor_action not in ('attack', 'special') then
        -- Opponent did not attack; stance expires without firing.
        v_counter_pending := false;
      end if;
      v_new_player_hp := greatest(0, v_new_player_hp - v_act_damage);
$old$;

  v_new_counter := $new$
      -- counter_pending: deflect 50% of incoming damage, auto-retaliate for 80% power.
      -- Counter fires only if the player survives the halved incoming hit.
      v_deflect := false;
      if v_counter_pending and v_actor_action in ('attack', 'special') then
        v_act_damage      := greatest(1, round(v_act_damage * 0.5)::integer);
        v_deflect         := true;
        v_counter_pending := false;
      elsif v_actor_action not in ('attack', 'special') then
        -- Opponent did not attack; stance expires without firing.
        v_counter_pending := false;
      end if;
      v_new_player_hp := greatest(0, v_new_player_hp - v_act_damage);
      if v_deflect and v_new_player_hp > 0 then
        v_counter_hit_damage := greatest(1, round(
          public.battle_compute_damage(
            p_battle_run_id, v_current_round, 'player',
            v_snapshot.strength, v_snapshot.momentum, v_opponent.resilience,
            0, 0, 1.0, v_snapshot.level, v_snapshot.stage
          ) * 0.80
          * greatest(0.50, 1.0 - v_opponent.recommended_level::numeric * 0.003)
        )::integer);
        v_new_opponent_hp := greatest(0, v_new_opponent_hp - v_counter_hit_damage);
      end if;
$new$;

  if position(v_old_counter in v_function_sql) = 0 then
    raise exception 'Migration 065 patch B: counter anchor not found';
  end if;

  v_function_sql := replace(v_function_sql, v_old_counter, v_new_counter);

  execute v_function_sql;
end;
$$;
