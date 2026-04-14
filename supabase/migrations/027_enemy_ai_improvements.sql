-- 027_enemy_ai_improvements.sql
-- Extends battle_pick_enemy_action with three new reactive rules on top of
-- the existing three from 023:
--
--   Rule 4 — Caution Band      : enemy HP 25–50% → shift 20% attack to defend
--                                (intermediate caution before full desperation kicks in)
--
--   Rule 5 — Anti-Focus        : player has a loaded next-attack bonus → shift 20% attack to defend
--                                (brace for the incoming powered hit)
--
--   Rule 6 — Aggression Cooldown (secondary modifier, stacks):
--             enemy focused last turn → redirect 40% of remaining focus weight to attack
--             (prevents back-to-back Focus spam; fires after the primary rule)
--
-- Priority order (primary rules are mutually exclusive; highest wins):
--   1. Desperation (HP ≤ 25%)      — always overrides
--   2. Spend Buff (enemy_nab > 0)  — cash in loaded bonus
--   3. NEW: Caution Band (HP ≤ 50%)
--   4. NEW: Anti-Focus (player_nab > 0)
--   5. Counter-Read (player defended last turn)
--   + 6. NEW: Aggression Cooldown  — secondary modifier, stacks with 3–5
--
-- Also updates submit_battle_action to pass the two new inputs to the picker.


-- ─── 1. Drop old signature ───────────────────────────────────────────────────
-- Required because PostgreSQL cannot change the parameter list in-place.
-- The new function adds p_enemy_last_action and p_player_nab at the end
-- with defaults so legacy callers still work.

drop function if exists public.battle_pick_enemy_action(uuid, integer, jsonb, integer, integer, numeric, text);


-- ─── 2. Recreate with extended signature and new rules ───────────────────────

create or replace function public.battle_pick_enemy_action(
  p_battle_run_id      uuid,
  p_current_round      integer,
  p_action_weights     jsonb,
  p_enemy_hp           integer,
  p_enemy_max_hp       integer,
  p_enemy_nab          numeric,
  p_player_last_action text,
  p_enemy_last_action  text    default null,  -- Rule 6: aggression cooldown
  p_player_nab         numeric default 0      -- Rule 5: anti-focus
)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_roll   integer;
  v_atk    integer;
  v_def    integer;
  v_foc    integer;
  v_shift  integer;
  v_hp_pct numeric;
begin
  v_atk := coalesce((p_action_weights->>'attack')::integer, 100);
  v_def := coalesce((p_action_weights->>'defend')::integer, 0);
  v_foc := greatest(0, 100 - v_atk - v_def);
  v_hp_pct := p_enemy_hp::numeric / greatest(p_enemy_max_hp, 1)::numeric;

  -- ── Primary rules (mutually exclusive; first match wins) ──────────────────

  -- Rule 1: Desperation — HP ≤ 25% → commit fully to attack.
  -- Threshold 0.25: creates pressure at low HP without firing too early.
  -- Tuning: lower to 0.20 for more predictable enemies; raise to 0.33 for earlier escalation.
  if v_hp_pct <= 0.25 then
    v_atk := 100; v_def := 0; v_foc := 0;

  -- Rule 2: Spend Buff — next-attack bonus loaded → spend it immediately (95/5/0).
  -- 5% defend residual prevents 100% telegraphing.
  -- Tuning: 98/2/0 for more aggressive; 80/20/0 to bluff occasionally.
  elsif p_enemy_nab > 0 then
    v_atk := 95; v_def := 5; v_foc := 0;

  -- Rule 4 (NEW): Caution Band — HP 25–50%, taking damage but not yet desperate.
  -- Shift 20% of attack weight to defend; keeps pressure while reducing reckless aggression.
  -- Tuning: 0.15–0.30 shift; raise HP ceiling to 0.60 for more defensive enemies.
  elsif v_hp_pct <= 0.50 then
    v_shift := greatest(0, round(v_atk * 0.20)::integer);
    v_atk   := v_atk - v_shift;
    v_def   := v_def + v_shift;

  -- Rule 5 (NEW): Anti-Focus — player has a loaded next-attack bonus; incoming hit will hurt.
  -- Shift 20% of attack weight to defend to absorb the powered blow.
  -- Tuning: 0.15–0.35 shift; a larger shift makes the AI feel more reactive/adaptive.
  elsif p_player_nab > 0 then
    v_shift := greatest(0, round(v_atk * 0.20)::integer);
    v_atk   := v_atk - v_shift;
    v_def   := v_def + v_shift;

  -- Rule 3: Counter-Read — player defended last turn → build power rather than attacking a wall.
  -- Shift 35% of attack weight to focus.
  -- Tuning: 0.25–0.50; higher values make the AI more "read"-dependent and less random.
  elsif p_player_last_action = 'defend' then
    v_shift := greatest(0, round(v_atk * 0.35)::integer);
    v_atk   := v_atk - v_shift;
    v_foc   := v_foc + v_shift;
  end if;

  -- ── Rule 6 (NEW): Aggression Cooldown — secondary modifier, stacks with rules 3–5 ──
  -- If the enemy focused last turn and still has focus weight remaining, redirect 40% of
  -- that focus weight to attack.  Prevents back-to-back Focus spam and creates a rhythm
  -- where the AI naturally alternates between charging and spending.
  -- Only fires when there is focus weight to reduce (won't affect desperation/spend-buff outcomes).
  -- Tuning: 0.30–0.60 reduction factor; 0 to disable.
  if p_enemy_last_action = 'focus' and v_foc > 0 then
    v_shift := greatest(0, round(v_foc * 0.40)::integer);
    v_foc   := v_foc - v_shift;
    v_atk   := v_atk + v_shift;
  end if;

  -- ── Deterministic roll seeded by run + round ──────────────────────────────
  v_roll := abs(hashtext(p_battle_run_id::text || p_current_round::text || 'enemy_action')) % 100;

  if v_roll < v_atk then
    return 'attack';
  elsif v_roll < v_atk + v_def then
    return 'defend';
  else
    return 'focus';
  end if;
end;
$$;


-- ─── 3. Update submit_battle_action to pass the two new params ───────────────
-- Only the battle_pick_enemy_action call changes; everything else is identical to 026.

create or replace function public.submit_battle_action(
  p_battle_run_id uuid,
  p_action        text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id            uuid;
  v_run                public.battle_runs;
  v_snapshot           public.creature_battle_snapshots;
  v_opponent           public.battle_opponents;
  v_companion_name     text;

  v_current_round      integer;
  v_new_log            jsonb;
  v_log_entry          jsonb;

  v_player_action      text;
  v_enemy_action       text;

  v_player_init        integer;
  v_enemy_init         integer;
  v_player_goes_first  boolean;

  v_new_player_hp      integer;
  v_new_opponent_hp    integer;

  v_player_momentum_boost      numeric;
  v_enemy_momentum_boost       numeric;
  v_player_next_attack_bonus   numeric;
  v_enemy_next_attack_bonus    numeric;

  v_player_is_crit     boolean := false;
  v_player_crit_mult   numeric := 1.0;
  v_enemy_is_crit      boolean := false;
  v_enemy_crit_mult    numeric := 1.0;

  -- Actor loop routing vars
  v_actors              text[];
  v_actor               text;
  v_actor_action        text;
  v_opponent_action     text;
  v_act_strength        integer;
  v_act_momentum        integer;
  v_act_resilience      integer;
  v_act_momentum_boost  numeric;
  v_act_next_atk_bonus  numeric;
  v_act_crit_mult       numeric;
  v_act_is_crit         boolean;
  v_act_level           integer;
  v_act_stage           text;
  v_act_name            text;
  v_act_actor_label     text;
  v_act_target_label    text;
  v_act_attack_verb     text;
  v_act_defend_message  text;
  v_act_damage          integer;
  v_act_consumed_mb     boolean;
  v_act_consumed_nab    boolean;
  v_act_target_hp_after integer;
  v_act_win_outcome     text;

  v_battle_complete    boolean := false;
  v_status             text;
  v_outcome            text;
  v_turn_count         integer;
  v_remaining_hp_pct   integer;
  v_xp_awarded         integer := 0;
  v_arena_progress     integer := 0;
  v_reward_claimed     boolean := false;
  v_rewardable         boolean := false;
  v_completed_at       timestamptz;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  if p_action not in ('attack', 'defend', 'focus') then
    raise exception 'Unsupported action: %', p_action;
  end if;

  select * into v_run
  from public.battle_runs
  where id = p_battle_run_id and user_id = v_user_id
  for update;

  if not found then raise exception 'Battle run not found'; end if;

  if v_run.status <> 'active' then
    return public.battle_session_payload(p_battle_run_id);
  end if;

  select * into v_snapshot from public.creature_battle_snapshots where id = v_run.snapshot_id;
  select * into v_opponent from public.battle_opponents           where id = v_run.opponent_id;

  select coalesce(name, 'Your companion') into v_companion_name
  from public.creature_companions where user_id = v_user_id;

  v_current_round   := v_run.current_round;
  v_new_log         := v_run.battle_log;
  v_player_action   := p_action;
  v_new_player_hp   := v_run.player_current_hp;
  v_new_opponent_hp := v_run.opponent_current_hp;

  v_player_momentum_boost    := v_run.player_momentum_boost;
  v_enemy_momentum_boost     := v_run.enemy_momentum_boost;
  v_player_next_attack_bonus := v_run.player_next_attack_bonus;
  v_enemy_next_attack_bonus  := v_run.enemy_next_attack_bonus;

  -- ── Enemy action (state-aware, now with 6 rules) ──────────────────────────
  v_enemy_action := public.battle_pick_enemy_action(
    p_battle_run_id      => p_battle_run_id,
    p_current_round      => v_current_round,
    p_action_weights     => v_opponent.action_weights,
    p_enemy_hp           => v_run.opponent_current_hp,
    p_enemy_max_hp       => v_run.opponent_max_hp,
    p_enemy_nab          => v_enemy_next_attack_bonus,
    p_player_last_action => v_run.player_last_action,
    p_enemy_last_action  => v_run.enemy_last_action,       -- Rule 6: aggression cooldown
    p_player_nab         => v_player_next_attack_bonus     -- Rule 5: anti-focus
  );

  -- ── Initiative ─────────────────────────────────────────────────────────────
  -- Base = momentum stat; jitter = deterministic ±5 (% 11 → 0–10, minus 5 → -5..+5).
  -- Higher momentum = faster on average but not guaranteed. Player wins ties.
  -- Tuning: widen jitter (% 21 - 10) for more upsets; narrow (% 3 - 1) for stat-determinism.
  v_player_init := v_snapshot.momentum
    + (abs(hashtext(p_battle_run_id::text || v_current_round::text || 'pinit')) % 11) - 5;
  v_enemy_init  := v_opponent.momentum
    + (abs(hashtext(p_battle_run_id::text || v_current_round::text || 'einit')) % 11) - 5;
  v_player_goes_first := v_player_init >= v_enemy_init;

  v_new_log := v_new_log || jsonb_build_object(
    'id', gen_random_uuid(), 'round', v_current_round, 'phase', 'initiative',
    'actor', 'system', 'action', 'initiative',
    'damage', 0, 'target', null, 'target_hp_after', null,
    'crit', false, 'defended', false,
    'consumed_momentum_boost', false, 'consumed_next_attack_bonus', false,
    'message', case
      when v_player_goes_first then v_companion_name || ' acts first!'
      else v_opponent.name || ' acts first!'
    end
  );

  -- ── Crits ──────────────────────────────────────────────────────────────────
  -- Crit chance = (momentum × 15) / 10000 → momentum=80 → 12%, momentum=100 → 15% max.
  -- Multiplier of 15: tuning range 10–20 (lower = rarer crits; higher = momentum snowballs).
  -- Multiplier 1.5×: see battle_compute_damage comment for tuning guidance.
  v_player_is_crit   := (abs(hashtext(p_battle_run_id::text || v_current_round::text || 'player'   || 'crit')) % 10000) < (v_snapshot.momentum * 15);
  v_player_crit_mult := case when v_player_is_crit  then 1.5 else 1.0 end;
  v_enemy_is_crit    := (abs(hashtext(p_battle_run_id::text || v_current_round::text || 'opponent' || 'crit')) % 10000) < (v_opponent.momentum * 15);
  v_enemy_crit_mult  := case when v_enemy_is_crit   then 1.5 else 1.0 end;


  -- ══════════════════════════════════════════════════════════════════════════
  -- ACTOR LOOP — single pass per actor, initiative-ordered
  -- ══════════════════════════════════════════════════════════════════════════
  v_actors := case when v_player_goes_first
    then array['player', 'opponent']
    else array['opponent', 'player']
  end;

  foreach v_actor in array v_actors loop
    if v_battle_complete then exit; end if;

    -- ── Routing: copy actor state into v_act_* working vars ──────────────
    if v_actor = 'player' then
      v_actor_action       := v_player_action;
      v_opponent_action    := v_enemy_action;
      v_act_strength       := v_snapshot.strength;
      v_act_momentum       := v_snapshot.momentum;
      v_act_resilience     := v_opponent.resilience;
      v_act_momentum_boost := v_player_momentum_boost;
      v_act_next_atk_bonus := v_player_next_attack_bonus;
      v_act_crit_mult      := v_player_crit_mult;
      v_act_is_crit        := v_player_is_crit;
      v_act_level          := v_snapshot.level;
      v_act_stage          := v_snapshot.stage;
      v_act_name           := v_companion_name;
      v_act_actor_label    := 'player';
      v_act_target_label   := 'opponent';
      v_act_attack_verb    := 'attacks';
      v_act_defend_message := v_companion_name || ' takes a defensive stance!';
      v_act_win_outcome    := 'win';
    else
      v_actor_action       := v_enemy_action;
      v_opponent_action    := v_player_action;
      v_act_strength       := v_opponent.strength;
      v_act_momentum       := v_opponent.momentum;
      v_act_resilience     := v_snapshot.resilience;
      v_act_momentum_boost := v_enemy_momentum_boost;
      v_act_next_atk_bonus := v_enemy_next_attack_bonus;
      v_act_crit_mult      := v_enemy_crit_mult;
      v_act_is_crit        := v_enemy_is_crit;
      v_act_level          := v_opponent.recommended_level;
      v_act_stage          := 'baby';
      v_act_name           := v_opponent.name;
      v_act_actor_label    := 'opponent';
      v_act_target_label   := 'player';
      v_act_attack_verb    := 'strikes';
      v_act_defend_message := v_opponent.name || ' braces for impact!';
      v_act_win_outcome    := 'loss';
    end if;

    v_act_damage := 0; v_act_consumed_mb := false; v_act_consumed_nab := false;

    -- ── Shared action CASE (written once) ──────────────────────────────────
    case v_actor_action

      when 'attack' then
        v_act_consumed_mb  := v_act_momentum_boost > 0;
        v_act_consumed_nab := v_act_next_atk_bonus > 0;
        v_act_damage := public.battle_compute_damage(
          p_battle_run_id => p_battle_run_id, p_round => v_current_round,
          p_actor => v_act_actor_label,
          p_strength => v_act_strength, p_momentum => v_act_momentum,
          p_resilience => v_act_resilience,
          p_momentum_boost => v_act_momentum_boost,
          p_next_attack_bonus => v_act_next_atk_bonus,
          p_crit_multiplier => v_act_crit_mult,
          p_level => v_act_level, p_stage => v_act_stage
        );
        if v_opponent_action = 'defend' then
          v_act_damage := greatest(1, round(v_act_damage * 0.5)::integer);
        end if;
        if v_opponent_action = 'focus' then
          v_act_damage := round(v_act_damage * 1.3)::integer;
        end if;
        v_act_momentum_boost := 0; v_act_next_atk_bonus := 0;
        v_act_target_hp_after := greatest(0,
          case when v_actor = 'player' then v_new_opponent_hp else v_new_player_hp end
          - v_act_damage
        );
        v_log_entry := jsonb_build_object(
          'id', gen_random_uuid(), 'round', v_current_round, 'phase', 'action',
          'actor', v_act_actor_label, 'action', 'attack',
          'damage', v_act_damage, 'target', v_act_target_label,
          'target_hp_after', v_act_target_hp_after,
          'crit', v_act_is_crit, 'defended', (v_opponent_action = 'defend'),
          'consumed_momentum_boost', v_act_consumed_mb,
          'consumed_next_attack_bonus', v_act_consumed_nab,
          'message', v_act_name || ' ' || v_act_attack_verb || ' for ' || v_act_damage || ' damage!'
            || case when v_act_is_crit               then ' (Critical Hit!)' else '' end
            || case when v_opponent_action = 'defend' then ' (Blocked!)'      else '' end
            || case when v_opponent_action = 'focus'  then ' (Exposed!)'      else '' end
        );

      when 'defend' then
        v_log_entry := jsonb_build_object(
          'id', gen_random_uuid(), 'round', v_current_round, 'phase', 'action',
          'actor', v_act_actor_label, 'action', 'defend',
          'damage', 0, 'target', null, 'target_hp_after', null,
          'crit', false, 'defended', false,
          'consumed_momentum_boost', false, 'consumed_next_attack_bonus', false,
          'message', v_act_defend_message
        );

      when 'focus' then
        v_act_consumed_mb := v_act_momentum_boost > 0;
        v_act_damage := public.battle_compute_damage(
          p_battle_run_id => p_battle_run_id, p_round => v_current_round,
          p_actor => v_act_actor_label,
          p_strength => v_act_strength, p_momentum => v_act_momentum,
          p_resilience => v_act_resilience,
          p_momentum_boost => v_act_momentum_boost,
          p_next_attack_bonus => 0,   -- bonus applies next turn, not this hit
          p_crit_multiplier => v_act_crit_mult,
          p_level => v_act_level, p_stage => v_act_stage
        );
        -- Focus deals 75% of a normal attack's damage up front (0.75 = tuning range 0.60–0.85).
        -- Below 0.60 the immediate damage is too negligible; above 0.85 the charge payoff is too small.
        v_act_damage := greatest(1, round(v_act_damage * 0.75)::integer);
        if v_opponent_action = 'defend' then
          -- Defend halves incoming damage (0.5). Tuning: same as the attack branch.
          v_act_damage := greatest(1, round(v_act_damage * 0.5)::integer);
        end if;
        if v_opponent_action = 'focus' then
          -- Mutual Focus: both combatants are exposed — damage × 1.3 (mirrors attack branch).
          -- This punishes greedy double-Focus and creates a risk/reward tension.
          v_act_damage := round(v_act_damage * 1.3)::integer;
        end if;
        -- Next-attack bonus: +60% multiplier banked for the following turn.
        -- Tuning range: see battle_compute_damage comment. Stacks with stage multiplier.
        v_act_momentum_boost := 0; v_act_next_atk_bonus := 0.60;
        v_act_target_hp_after := greatest(0,
          case when v_actor = 'player' then v_new_opponent_hp else v_new_player_hp end
          - v_act_damage
        );
        v_log_entry := jsonb_build_object(
          'id', gen_random_uuid(), 'round', v_current_round, 'phase', 'action',
          'actor', v_act_actor_label, 'action', 'focus',
          'damage', v_act_damage, 'target', v_act_target_label,
          'target_hp_after', v_act_target_hp_after,
          'crit', v_act_is_crit, 'defended', (v_opponent_action = 'defend'),
          'consumed_momentum_boost', v_act_consumed_mb,
          'consumed_next_attack_bonus', false,
          'message', v_act_name || ' winds up — deals ' || v_act_damage || ' damage and charges for next turn!'
            || case when v_act_is_crit               then ' (Critical Hit!)' else '' end
            || case when v_opponent_action = 'defend' then ' (Absorbed!)'     else '' end
        );

    end case;

    -- ── Write-back: push v_act_* into canonical vars + apply damage ────────
    if v_actor = 'player' then
      v_player_momentum_boost    := v_act_momentum_boost;
      v_player_next_attack_bonus := v_act_next_atk_bonus;
      v_new_opponent_hp          := greatest(0, v_new_opponent_hp - v_act_damage);
    else
      v_enemy_momentum_boost     := v_act_momentum_boost;
      v_enemy_next_attack_bonus  := v_act_next_atk_bonus;
      v_new_player_hp            := greatest(0, v_new_player_hp - v_act_damage);
    end if;

    v_new_log := v_new_log || v_log_entry;

    -- ── Battle completion check ─────────────────────────────────────────────
    if v_actor_action in ('attack', 'focus') then
      if v_actor = 'player' and v_new_opponent_hp <= 0 then
        v_battle_complete := true; v_outcome := v_act_win_outcome;
      elsif v_actor = 'opponent' and v_new_player_hp <= 0 then
        v_battle_complete := true; v_outcome := v_act_win_outcome;
      end if;
    end if;

  end loop;


  -- ── Battle completion ──────────────────────────────────────────────────────
  if v_battle_complete then
    v_status       := 'completed';
    v_completed_at := now();
    v_turn_count   := v_current_round;

    if v_outcome = 'win' then
      v_remaining_hp_pct := greatest(0, least(100,
        round(v_new_player_hp * 100.0 / v_run.player_max_hp)::integer
      ));
      select not exists (
        select 1 from public.battle_runs prior
        where prior.user_id = v_user_id and prior.battle_date = v_run.battle_date
          and prior.opponent_id = v_run.opponent_id and prior.id <> v_run.id
          and prior.reward_claimed = true
      ) into v_rewardable;
      if v_rewardable then
        v_xp_awarded := 10 + v_opponent.recommended_level * 4;
        v_arena_progress := 1;
        v_reward_claimed := true;
      end if;
      v_log_entry := jsonb_build_object(
        'id', gen_random_uuid(), 'round', v_current_round, 'phase', 'result',
        'actor', 'system', 'action', 'result',
        'damage', 0, 'target', null, 'target_hp_after', null,
        'crit', false, 'defended', false,
        'consumed_momentum_boost', false, 'consumed_next_attack_bonus', false,
        'message', 'Victory!'
      );
    else
      v_remaining_hp_pct := 0;
      v_log_entry := jsonb_build_object(
        'id', gen_random_uuid(), 'round', v_current_round, 'phase', 'result',
        'actor', 'system', 'action', 'result',
        'damage', 0, 'target', null, 'target_hp_after', null,
        'crit', false, 'defended', false,
        'consumed_momentum_boost', false, 'consumed_next_attack_bonus', false,
        'message', 'Defeat...'
      );
    end if;
    v_new_log := v_new_log || v_log_entry;

  else
    v_status           := 'active';
    v_outcome          := v_run.outcome;
    v_completed_at     := null;
    v_turn_count       := v_run.turn_count;
    v_remaining_hp_pct := v_run.remaining_hp_pct;
    v_current_round    := v_current_round + 1;
  end if;

  -- ── Persist ────────────────────────────────────────────────────────────────
  update public.battle_runs set
    status                   = v_status,
    outcome                  = case when v_battle_complete then v_outcome           else outcome               end,
    player_current_hp        = v_new_player_hp,
    opponent_current_hp      = v_new_opponent_hp,
    current_round            = v_current_round,
    battle_log               = v_new_log,
    player_last_action       = v_player_action,
    enemy_last_action        = v_enemy_action,
    player_momentum_boost    = v_player_momentum_boost,
    enemy_momentum_boost     = v_enemy_momentum_boost,
    player_next_attack_bonus = v_player_next_attack_bonus,
    enemy_next_attack_bonus  = v_enemy_next_attack_bonus,
    turn_count               = case when v_battle_complete then v_turn_count        else turn_count            end,
    remaining_hp_pct         = case when v_battle_complete then v_remaining_hp_pct  else remaining_hp_pct      end,
    xp_awarded               = case when v_battle_complete then v_xp_awarded        else xp_awarded            end,
    arena_progress_awarded   = case when v_battle_complete then v_arena_progress    else arena_progress_awarded end,
    reward_claimed           = case when v_battle_complete then v_reward_claimed    else reward_claimed         end,
    completed_at             = case when v_battle_complete then v_completed_at      else completed_at          end
  where id = p_battle_run_id;

  return public.battle_session_payload(p_battle_run_id);
end;
$$;
