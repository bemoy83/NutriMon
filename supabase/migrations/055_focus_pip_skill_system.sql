-- 055_focus_pip_skill_system.sql
-- Introduces a pip-based Focus economy and an explicit Skill action.
--
-- Changes:
--   Schema    — player_special_meter → player_focus_pips
--               enemy_special_meter  → enemy_focus_pips
--   Focus     — increments player_focus_pips (max 3); no longer sets next_attack_bonus.
--               Actor remains exposed to 1.3× incoming damage this turn.
--   Attack    — always a normal attack. The NAB-triggered 3-hit auto-combo is removed.
--   Skill     — new 4th action. Costs focus pips; dispatches on p_skill_id.
--               First skill: 'triple_hit' (costs 1 pip — same 3×75% combo, now explicit).
--               Future skills added here as new when-clauses; unlocked via stage/level.
--   AI        — Rule 5 updated: react to player pip count (≥1) instead of stale NAB.
--   Payload   — adds player_focus_pips and player_last_action to session JSON so the
--               frontend can gate the Skill button and show charge state.
--
-- next_attack_bonus columns are kept in the schema and written as 0 on every turn.
-- They no longer influence combat. A future migration can drop them.
--
-- Tuning:
--   PIP_MAX              3    (range 2–5; higher = bigger build-up potential)
--   TRIPLE_HIT_COST      1    (range 1–2; cost 2 would require 2 Focus turns to fire)
--   TRIPLE_HIT_HITS      3    (range 2–4)
--   TRIPLE_HIT_FRACTION  0.75 (per-hit fraction of base; 3×0.75 = 2.25× normal)
--   FOCUSED_CRIT_CAP     3500 (35% per-hit crit ceiling)


-- ─── 1. Rename meter columns ──────────────────────────────────────────────────

alter table public.battle_runs
  rename column player_special_meter to player_focus_pips;

alter table public.battle_runs
  rename column enemy_special_meter to enemy_focus_pips;

comment on column public.battle_runs.player_focus_pips is
  'Focus pip counter for the player (0–3). Incremented by Focus, consumed by Skill.';
comment on column public.battle_runs.enemy_focus_pips is
  'Focus pip counter for the enemy (0–3). Reserved for future enemy skill support.';


-- ─── 2. battle_session_payload — expose pip count + last action ───────────────
-- Frontend needs player_focus_pips to gate the Skill button, and player_last_action
-- to render "charged" visual state after a Focus turn.

create or replace function public.battle_session_payload(p_battle_run_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'id',                     r.id,
    'user_id',                r.user_id,
    'battle_date',            r.battle_date,
    'snapshot_id',            r.snapshot_id,
    'opponent_id',            r.opponent_id,
    'outcome',                r.outcome,
    'turn_count',             r.turn_count,
    'remaining_hp_pct',       r.remaining_hp_pct,
    'xp_awarded',             r.xp_awarded,
    'arena_progress_awarded', r.arena_progress_awarded,
    'reward_claimed',         r.reward_claimed,
    'created_at',             r.created_at,
    'status',                 r.status,
    'player_max_hp',          r.player_max_hp,
    'player_current_hp',      r.player_current_hp,
    'opponent_max_hp',        r.opponent_max_hp,
    'opponent_current_hp',    r.opponent_current_hp,
    'current_round',          r.current_round,
    'battle_log',             r.battle_log,
    'completed_at',           r.completed_at,
    'player_focus_pips',      r.player_focus_pips,
    'player_last_action',     r.player_last_action,
    'snapshot',               row_to_json(s),
    'opponent',               row_to_json(o),
    'companion',              row_to_json(cc)
  )
  from public.battle_runs r
  join  public.creature_battle_snapshots s on s.id       = r.snapshot_id
  join  public.battle_opponents          o on o.id       = r.opponent_id
  left join public.creature_companions  cc on cc.user_id = r.user_id
  where r.id      = p_battle_run_id
    and r.user_id = auth.uid()
$$;


-- ─── 3. Drop old battle_pick_enemy_action (signature change) ─────────────────
-- p_player_nab (numeric) is replaced by p_player_focus_pips (integer).
-- PostgreSQL cannot alter parameter type in-place.

drop function if exists public.battle_pick_enemy_action(
  uuid, integer, jsonb, integer, integer, numeric, text, text, numeric
);


-- ─── 4. battle_pick_enemy_action — Rule 5 updated ────────────────────────────
-- Rule 5 was: player_nab > 0 → brace for incoming powered hit.
-- Now:        player_focus_pips ≥ 1 → player can fire a skill this turn; brace.
-- Weight shift and everything else unchanged.

create or replace function public.battle_pick_enemy_action(
  p_battle_run_id      uuid,
  p_current_round      integer,
  p_action_weights     jsonb,
  p_enemy_hp           integer,
  p_enemy_max_hp       integer,
  p_enemy_nab          numeric,       -- kept for signature compat; always 0 post-055
  p_player_last_action text,
  p_enemy_last_action  text    default null,
  p_player_focus_pips  integer default 0
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
  v_atk    := coalesce((p_action_weights->>'attack')::integer, 100);
  v_def    := coalesce((p_action_weights->>'defend')::integer, 0);
  v_foc    := greatest(0, 100 - v_atk - v_def);
  v_hp_pct := p_enemy_hp::numeric / greatest(p_enemy_max_hp, 1)::numeric;

  -- ── Primary rules (mutually exclusive; first match wins) ──────────────────

  -- Rule 1: Desperation — HP ≤ 25% → commit fully to attack.
  if v_hp_pct <= 0.25 then
    v_atk := 100; v_def := 0; v_foc := 0;

  -- Rule 2: Spend Buff — next-attack bonus loaded → spend it (95/5/0).
  -- p_enemy_nab is always 0 post-055; rule kept as dead-but-harmless insurance.
  elsif p_enemy_nab > 0 then
    v_atk := 95; v_def := 5; v_foc := 0;

  -- Rule 4: Caution Band — HP 25–50% → shift 20% attack to defend.
  elsif v_hp_pct <= 0.50 then
    v_shift := greatest(0, round(v_atk * 0.20)::integer);
    v_atk   := v_atk - v_shift;
    v_def   := v_def + v_shift;

  -- Rule 5: Anti-Skill — player has ≥1 pip (can use Triple Hit this turn).
  -- Tuning: shift 0.15–0.35; raise pip threshold to 2 for less reactive enemies.
  elsif p_player_focus_pips >= 1 then
    v_shift := greatest(0, round(v_atk * 0.20)::integer);
    v_atk   := v_atk - v_shift;
    v_def   := v_def + v_shift;

  -- Rule 3: Counter-Read — player defended last turn → build power.
  elsif p_player_last_action = 'defend' then
    v_shift := greatest(0, round(v_atk * 0.35)::integer);
    v_atk   := v_atk - v_shift;
    v_foc   := v_foc + v_shift;
  end if;

  -- Rule 6: Aggression Cooldown — after enemy focused, redirect 40% of focus weight
  -- to attack. Prevents back-to-back Focus spam; creates a charge-then-spend rhythm.
  if p_enemy_last_action = 'focus' and v_foc > 0 then
    v_shift := greatest(0, round(v_foc * 0.40)::integer);
    v_foc   := v_foc - v_shift;
    v_atk   := v_atk + v_shift;
  end if;

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


-- ─── 5. submit_battle_action — Focus→pips, Skill action ──────────────────────

create or replace function public.submit_battle_action(
  p_battle_run_id uuid,
  p_action        text,
  p_skill_id      text default null   -- required when p_action = 'skill'
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

  v_player_momentum_boost  numeric;
  v_enemy_momentum_boost   numeric;

  -- Focus pips
  v_player_focus_pips  integer;
  v_enemy_focus_pips   integer;

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
  v_act_target_hp_after integer;
  v_act_win_outcome     text;

  -- Special action vars (enemy boss specials)
  v_special_weight      integer;
  v_preempt_roll        integer;
  v_special_type        text;
  v_boost_multiplier    numeric;

  -- Multi-hit vars (shared by Triple Hit skill and enemy multi_hit special)
  v_hit_count           integer;
  v_hit_fraction        numeric;
  v_single_hit_base     integer;
  v_hit_i               integer;
  v_hit_is_crit         boolean;
  v_hit_crit_mult       numeric;
  v_single_hit_damage   integer;
  v_hit_messages        text;
  v_any_hit_critted     boolean;
  v_focused_crit_threshold integer;

  -- Skill vars
  v_skill_pip_cost      integer;

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

  if p_action not in ('attack', 'defend', 'focus', 'skill') then
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

  -- ── Pip init ───────────────────────────────────────────────────────────────
  v_player_focus_pips := v_run.player_focus_pips;
  v_enemy_focus_pips  := v_run.enemy_focus_pips;

  -- ── Skill preconditions (fast-fail before acquiring more state) ────────────
  if p_action = 'skill' then
    if p_skill_id is null then
      raise exception 'p_skill_id is required when action = ''skill''';
    end if;
    if p_skill_id not in ('triple_hit') then
      raise exception 'Unknown skill: %', p_skill_id;
    end if;
    -- triple_hit costs 1 pip; extend this block as new skills are added
    v_skill_pip_cost := case p_skill_id when 'triple_hit' then 1 else 0 end;
    if v_player_focus_pips < v_skill_pip_cost then
      raise exception 'Not enough focus pips for % (need %, have %)',
        p_skill_id, v_skill_pip_cost, v_player_focus_pips;
    end if;
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

  v_player_momentum_boost := v_run.player_momentum_boost;
  v_enemy_momentum_boost  := v_run.enemy_momentum_boost;

  -- ── Special action pre-empt ───────────────────────────────────────────────
  v_enemy_action := null;
  if v_opponent.special_action is not null then
    v_special_weight := coalesce((v_opponent.special_action->>'weight')::integer, 0);
    v_preempt_roll   := abs(hashtext(p_battle_run_id::text || v_current_round::text || 'special_preempt')) % 100;
    if v_preempt_roll < v_special_weight then
      v_enemy_action := 'special';
    end if;
  end if;

  -- ── Enemy action ──────────────────────────────────────────────────────────
  if v_enemy_action is null then
    v_enemy_action := public.battle_pick_enemy_action(
      p_battle_run_id      => p_battle_run_id,
      p_current_round      => v_current_round,
      p_action_weights     => v_opponent.action_weights,
      p_enemy_hp           => v_run.opponent_current_hp,
      p_enemy_max_hp       => v_run.opponent_max_hp,
      p_enemy_nab          => 0,
      p_player_last_action => v_run.player_last_action,
      p_enemy_last_action  => v_run.enemy_last_action,
      p_player_focus_pips  => v_player_focus_pips
    );
  end if;

  -- ── Initiative ─────────────────────────────────────────────────────────────
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
  -- For multi-hit actions (Triple Hit, enemy multi_hit) these are not used;
  -- each hit rolls its crit independently inside the hit loop.
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

    -- ── Route actor state into v_act_* working vars ───────────────────────
    if v_actor = 'player' then
      v_actor_action       := v_player_action;
      v_opponent_action    := v_enemy_action;
      v_act_strength       := v_snapshot.strength;
      v_act_momentum       := v_snapshot.momentum;
      v_act_resilience     := v_opponent.resilience;
      v_act_momentum_boost := v_player_momentum_boost;
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

    v_act_damage := 0; v_act_consumed_mb := false;

    -- ── Action dispatch ───────────────────────────────────────────────────
    case v_actor_action

      when 'attack' then
        -- Normal attack. No auto-trigger from pip state; that was removed.
        v_act_consumed_mb := v_act_momentum_boost > 0;
        v_act_damage := public.battle_compute_damage(
          p_battle_run_id => p_battle_run_id, p_round => v_current_round,
          p_actor => v_act_actor_label,
          p_strength => v_act_strength, p_momentum => v_act_momentum,
          p_resilience => v_act_resilience,
          p_momentum_boost => v_act_momentum_boost,
          p_next_attack_bonus => 0,
          p_crit_multiplier => v_act_crit_mult,
          p_level => v_act_level, p_stage => v_act_stage
        );
        if v_opponent_action = 'defend' then
          v_act_damage := greatest(1, round(v_act_damage * 0.5)::integer);
        end if;
        if v_opponent_action = 'focus' then
          v_act_damage := round(v_act_damage * 1.3)::integer;
        end if;
        v_act_momentum_boost  := 0;
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
          'consumed_next_attack_bonus', false,
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
        -- Pure charge turn. +1 pip (capped at 3). No damage. Actor exposed 1.3×.
        -- Tuning: pip cap controlled here; raise to 4-5 for deeper charge strategies.
        if v_actor = 'player' then
          v_player_focus_pips := least(3, v_player_focus_pips + 1);
        else
          v_enemy_focus_pips := least(3, v_enemy_focus_pips + 1);
        end if;
        v_act_momentum_boost := 0;
        v_log_entry := jsonb_build_object(
          'id', gen_random_uuid(), 'round', v_current_round, 'phase', 'action',
          'actor', v_act_actor_label, 'action', 'focus',
          'damage', 0, 'target', null, 'target_hp_after', null,
          'crit', false, 'defended', false,
          'consumed_momentum_boost', false, 'consumed_next_attack_bonus', false,
          'message', v_act_name || ' focuses their power!'
            || case when v_actor = 'player'
                 then ' (' || v_player_focus_pips::text || ' pip'
                   || case when v_player_focus_pips <> 1 then 's' else '' end || ')'
                 else ''
               end
        );

      when 'skill' then
        -- ── Player skill dispatch ───────────────────────────────────────────
        -- Only the player reaches this branch; enemy actions come from battle_pick_enemy_action
        -- which never returns 'skill'. The precondition check above already validated
        -- p_skill_id and pip availability before the actor loop.
        v_act_consumed_mb := v_act_momentum_boost > 0;

        case p_skill_id

          when 'triple_hit' then
            -- 3 hits × 75% base damage. Each hit crits independently at +50% relative
            -- chance (normal chance × 1.5), capped at 35%.
            -- Total without crits: 3 × 0.75 = 2.25× a normal hit.
            -- Tuning: hit_count 2–4; hit_fraction 0.60–0.90.
            v_hit_count       := 3;
            v_hit_fraction    := 0.75;
            v_any_hit_critted := false;
            v_focused_crit_threshold := least(3500, round(v_act_momentum * 15 * 1.5)::integer);
            v_single_hit_base := public.battle_compute_damage(
              p_battle_run_id => p_battle_run_id, p_round => v_current_round,
              p_actor => v_act_actor_label,
              p_strength => v_act_strength, p_momentum => v_act_momentum,
              p_resilience => v_act_resilience,
              p_momentum_boost => v_act_momentum_boost,
              p_next_attack_bonus => 0,
              p_crit_multiplier => 1.0,
              p_level => v_act_level, p_stage => v_act_stage
            );
            v_act_damage   := 0;
            v_hit_messages := '';
            for v_hit_i in 1..v_hit_count loop
              v_hit_is_crit := (abs(hashtext(
                p_battle_run_id::text || v_current_round::text
                || v_act_actor_label || 'skill_hit' || v_hit_i::text
              )) % 10000) < v_focused_crit_threshold;
              v_hit_crit_mult     := case when v_hit_is_crit then 1.5 else 1.0 end;
              v_single_hit_damage := greatest(1, round(v_single_hit_base * v_hit_fraction * v_hit_crit_mult)::integer);
              v_act_damage        := v_act_damage + v_single_hit_damage;
              if v_hit_is_crit then v_any_hit_critted := true; end if;
              v_hit_messages := v_hit_messages
                || v_single_hit_damage::text
                || case when v_hit_is_crit then ' (CRIT!)' else '' end
                || case when v_hit_i < v_hit_count then ', ' else '' end;
            end loop;
            v_act_is_crit := v_any_hit_critted;

        end case;

        -- Deduct pip cost (validated pre-loop; safe to subtract directly).
        v_player_focus_pips := v_player_focus_pips - v_skill_pip_cost;

        if v_opponent_action = 'defend' then
          v_act_damage := greatest(1, round(v_act_damage * 0.5)::integer);
        end if;
        if v_opponent_action = 'focus' then
          v_act_damage := round(v_act_damage * 1.3)::integer;
        end if;
        v_act_momentum_boost  := 0;
        v_act_target_hp_after := greatest(0, v_new_opponent_hp - v_act_damage);
        v_log_entry := jsonb_build_object(
          'id', gen_random_uuid(), 'round', v_current_round, 'phase', 'action',
          'actor', v_act_actor_label, 'action', 'skill',
          'skill_id', p_skill_id,
          'damage', v_act_damage, 'target', v_act_target_label,
          'target_hp_after', v_act_target_hp_after,
          'crit', v_act_is_crit, 'defended', (v_opponent_action = 'defend'),
          'consumed_momentum_boost', v_act_consumed_mb,
          'consumed_next_attack_bonus', false,
          'message', case p_skill_id
            when 'triple_hit' then
              v_act_name || ' unleashes Triple Hit! '
              || v_hit_count::text || ' hits: ' || v_hit_messages
              || ' = ' || v_act_damage::text || ' total!'
            else v_act_name || ' uses ' || p_skill_id || '!'
          end
            || case when v_opponent_action = 'defend' then ' (Blocked!)' else '' end
            || case when v_opponent_action = 'focus'  then ' (Exposed!)' else '' end
        );

      when 'special' then
        -- ── Enemy boss special action ────────────────────────────────────────
        v_act_consumed_mb := v_act_momentum_boost > 0;
        v_special_type    := coalesce(v_opponent.special_action->>'type', 'damage_boost');

        case v_special_type

          when 'damage_boost' then
            v_boost_multiplier := coalesce((v_opponent.special_action->'params'->>'multiplier')::numeric, 1.5);
            v_act_damage := public.battle_compute_damage(
              p_battle_run_id => p_battle_run_id, p_round => v_current_round,
              p_actor => v_act_actor_label,
              p_strength => v_act_strength, p_momentum => v_act_momentum,
              p_resilience => v_act_resilience,
              p_momentum_boost => v_act_momentum_boost,
              p_next_attack_bonus => 0,
              p_crit_multiplier => v_act_crit_mult,
              p_level => v_act_level, p_stage => v_act_stage
            );
            v_act_damage := greatest(1, round(v_act_damage * v_boost_multiplier)::integer);

          when 'multi_hit' then
            v_hit_count    := coalesce((v_opponent.special_action->'params'->>'hits')::integer, 3);
            v_hit_fraction := coalesce((v_opponent.special_action->'params'->>'damage_fraction')::numeric, 0.40);
            v_any_hit_critted := false;
            v_single_hit_base := public.battle_compute_damage(
              p_battle_run_id => p_battle_run_id, p_round => v_current_round,
              p_actor => v_act_actor_label,
              p_strength => v_act_strength, p_momentum => v_act_momentum,
              p_resilience => v_act_resilience,
              p_momentum_boost => v_act_momentum_boost,
              p_next_attack_bonus => 0,
              p_crit_multiplier => 1.0,
              p_level => v_act_level, p_stage => v_act_stage
            );
            v_act_damage   := 0;
            v_hit_messages := '';
            for v_hit_i in 1..v_hit_count loop
              v_hit_is_crit := (abs(hashtext(
                p_battle_run_id::text || v_current_round::text
                || v_act_actor_label || 'hit' || v_hit_i::text
              )) % 10000) < (v_act_momentum * 15);
              v_hit_crit_mult     := case when v_hit_is_crit then 1.5 else 1.0 end;
              v_single_hit_damage := greatest(1, round(v_single_hit_base * v_hit_fraction * v_hit_crit_mult)::integer);
              v_act_damage        := v_act_damage + v_single_hit_damage;
              if v_hit_is_crit then v_any_hit_critted := true; end if;
              v_hit_messages := v_hit_messages
                || v_single_hit_damage::text
                || case when v_hit_is_crit then ' (CRIT!)' else '' end
                || case when v_hit_i < v_hit_count then ', ' else '' end;
            end loop;

        end case;

        if v_opponent_action = 'defend' then
          v_act_damage := greatest(1, round(v_act_damage * 0.5)::integer);
        end if;
        if v_opponent_action = 'focus' then
          v_act_damage := round(v_act_damage * 1.3)::integer;
        end if;
        v_act_momentum_boost  := 0;
        v_act_target_hp_after := greatest(0,
          case when v_actor = 'player' then v_new_opponent_hp else v_new_player_hp end
          - v_act_damage
        );
        v_log_entry := jsonb_build_object(
          'id', gen_random_uuid(), 'round', v_current_round, 'phase', 'action',
          'actor', v_act_actor_label, 'action', 'special',
          'damage', v_act_damage, 'target', v_act_target_label,
          'target_hp_after', v_act_target_hp_after,
          'crit', case
            when v_special_type = 'multi_hit' then v_any_hit_critted
            else v_act_is_crit
          end,
          'defended', (v_opponent_action = 'defend'),
          'consumed_momentum_boost', v_act_consumed_mb,
          'consumed_next_attack_bonus', false,
          'message',
            v_act_name || ' unleashes '
            || coalesce(v_opponent.special_action->>'label', 'a special attack') || '!'
            || case v_special_type
                 when 'multi_hit' then
                   ' ' || v_hit_count::text || ' hits: ' || v_hit_messages
                   || ' = ' || v_act_damage::text || ' total!'
                 else
                   ' ' || v_act_damage::text || ' damage!'
               end
            || case when v_opponent_action = 'defend' then ' (Blocked!)' else '' end
            || case when v_opponent_action = 'focus'  then ' (Exposed!)' else '' end
        );

    end case;

    -- ── Write-back: push v_act_* into canonical vars + apply damage ───────
    if v_actor = 'player' then
      v_player_momentum_boost := v_act_momentum_boost;
      v_new_opponent_hp       := greatest(0, v_new_opponent_hp - v_act_damage);
    else
      v_enemy_momentum_boost := v_act_momentum_boost;
      v_new_player_hp        := greatest(0, v_new_player_hp - v_act_damage);
    end if;

    v_new_log := v_new_log || v_log_entry;

    -- ── Battle completion check ────────────────────────────────────────────
    if v_actor_action in ('attack', 'skill', 'special') then
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
        v_xp_awarded     := 10 + v_opponent.recommended_level * 4;
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
    outcome                  = case when v_battle_complete then v_outcome          else outcome               end,
    player_current_hp        = v_new_player_hp,
    opponent_current_hp      = v_new_opponent_hp,
    current_round            = v_current_round,
    battle_log               = v_new_log,
    player_last_action       = v_player_action,
    enemy_last_action        = v_enemy_action,
    player_momentum_boost    = v_player_momentum_boost,
    enemy_momentum_boost     = v_enemy_momentum_boost,
    player_next_attack_bonus = 0,   -- deprecated post-055; drained to 0 each turn
    enemy_next_attack_bonus  = 0,   -- deprecated post-055; drained to 0 each turn
    player_focus_pips        = v_player_focus_pips,
    enemy_focus_pips         = v_enemy_focus_pips,
    turn_count               = case when v_battle_complete then v_turn_count       else turn_count            end,
    remaining_hp_pct         = case when v_battle_complete then v_remaining_hp_pct else remaining_hp_pct      end,
    xp_awarded               = case when v_battle_complete then v_xp_awarded       else xp_awarded            end,
    arena_progress_awarded   = case when v_battle_complete then v_arena_progress   else arena_progress_awarded end,
    reward_claimed           = case when v_battle_complete then v_reward_claimed   else reward_claimed         end,
    completed_at             = case when v_battle_complete then v_completed_at     else completed_at           end
  where id = p_battle_run_id;

  return public.battle_session_payload(p_battle_run_id);
end;
$$;
