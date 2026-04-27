-- 047_focus_multi_hit_rework.sql
-- Reworks Focus into a pure charge turn. The next Attack consumes that charge
-- as a focused 3-hit attack with boosted per-hit crit chance.
--
-- Keeps the battle_log JSON shape unchanged: focused attacks are still one
-- action='attack' entry with total damage and consumed_next_attack_bonus=true.


-- ─── 1. Meter foundation columns ─────────────────────────────────────────────

alter table public.battle_runs
  add column if not exists player_special_meter integer not null default 0,
  add column if not exists enemy_special_meter  integer not null default 0;

comment on column public.battle_runs.player_special_meter is
  'Limit-break meter for the player (0–100). Always 0 until the meter system ships.';
comment on column public.battle_runs.enemy_special_meter is
  'Limit-break meter for the enemy (0–100). Always 0 until the meter system ships.';


-- ─── 2. submit_battle_action — special action support ────────────────────────

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

  -- Special action vars
  v_special_weight      integer;
  v_preempt_roll        integer;
  v_special_type        text;
  v_boost_multiplier    numeric;
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

  -- ── Special action pre-empt ───────────────────────────────────────────────
  -- Check before normal AI rules so a desperate enemy can still use their special.
  -- Pre-empt probability = special_action.weight (0–100 per-turn % chance).
  -- Deterministic: seeded with 'special_preempt' suffix, independent of action roll.
  v_enemy_action := null;
  if v_opponent.special_action is not null then
    v_special_weight := coalesce((v_opponent.special_action->>'weight')::integer, 0);
    v_preempt_roll   := abs(hashtext(p_battle_run_id::text || v_current_round::text || 'special_preempt')) % 100;
    if v_preempt_roll < v_special_weight then
      v_enemy_action := 'special';
    end if;
  end if;

  -- ── Enemy action (state-aware, 6 rules) — skipped if special pre-empted ──
  if v_enemy_action is null then
    v_enemy_action := public.battle_pick_enemy_action(
      p_battle_run_id      => p_battle_run_id,
      p_current_round      => v_current_round,
      p_action_weights     => v_opponent.action_weights,
      p_enemy_hp           => v_run.opponent_current_hp,
      p_enemy_max_hp       => v_run.opponent_max_hp,
      p_enemy_nab          => v_enemy_next_attack_bonus,
      p_player_last_action => v_run.player_last_action,
      p_enemy_last_action  => v_run.enemy_last_action,
      p_player_nab         => v_player_next_attack_bonus
    );
  end if;

  -- ── Initiative ─────────────────────────────────────────────────────────────
  -- Base = momentum stat; jitter = deterministic ±5 (% 11 → 0–10, minus 5 → -5..+5).
  -- Higher momentum = faster on average but not guaranteed. Player wins ties.
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
  -- For multi_hit: these pre-rolled values are not used; each hit rolls independently.
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

        if v_act_consumed_nab then
          -- Focused Attack: 3 hits × 75% base damage. Each hit rolls crit
          -- independently with +50% relative crit chance, capped at 35%.
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
              || v_act_actor_label || 'focused_hit' || v_hit_i::text
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
        else
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
        end if;
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
          'message', case
            when v_act_consumed_nab then
              v_act_name || ' unleashes a focused attack! '
              || v_hit_count::text || ' hits: ' || v_hit_messages
              || ' = ' || v_act_damage::text || ' total!'
            else
              v_act_name || ' ' || v_act_attack_verb || ' for ' || v_act_damage || ' damage!'
              || case when v_act_is_crit then ' (Critical Hit!)' else '' end
          end
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
        -- Focus is a pure charge turn. It deals no damage, but leaves the
        -- actor exposed to incoming attacks this turn and arms the next attack.
        v_act_momentum_boost := 0; v_act_next_atk_bonus := 1.0;
        v_act_damage := 0;
        v_act_target_hp_after := null;
        v_log_entry := jsonb_build_object(
          'id', gen_random_uuid(), 'round', v_current_round, 'phase', 'action',
          'actor', v_act_actor_label, 'action', 'focus',
          'damage', 0, 'target', null,
          'target_hp_after', v_act_target_hp_after,
          'crit', false, 'defended', false,
          'consumed_momentum_boost', false,
          'consumed_next_attack_bonus', false,
          'message', v_act_name || ' focuses their power!'
        );

      when 'special' then
        -- ── Special action (enemy-only this pass) ────────────────────────
        -- Sub-dispatch on special_action.type from battle_opponents.
        -- Consumes momentum boost the same way attack does. Focus charge is
        -- reserved for the next standard Attack, not special actions.
        v_act_consumed_mb  := v_act_momentum_boost > 0;
        v_act_consumed_nab := false;
        v_special_type     := coalesce(v_opponent.special_action->>'type', 'damage_boost');

        case v_special_type

          when 'damage_boost' then
            -- Compute base damage (crit already baked via v_act_crit_mult), then apply multiplier.
            -- params.multiplier: tuning range 1.3–3.0 (above 3.0 risks one-shot KOs)
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
            -- Strikes N times; each hit rolls crit independently.
            -- params.hits: number of hits (2–5 recommended)
            -- params.damage_fraction: per-hit fraction of base damage
            --   e.g. hits=3, fraction=0.40 → total ~120% of a normal attack (before crits)
            v_hit_count       := coalesce((v_opponent.special_action->'params'->>'hits')::integer, 3);
            v_hit_fraction    := coalesce((v_opponent.special_action->'params'->>'damage_fraction')::numeric, 0.40);
            v_any_hit_critted := false;
            -- Base damage computed once: variance + NAB + stage applied; per-hit crits handled below.
            v_single_hit_base := public.battle_compute_damage(
              p_battle_run_id => p_battle_run_id, p_round => v_current_round,
              p_actor => v_act_actor_label,
              p_strength => v_act_strength, p_momentum => v_act_momentum,
              p_resilience => v_act_resilience,
              p_momentum_boost => v_act_momentum_boost,
              p_next_attack_bonus => 0,
              p_crit_multiplier => 1.0,   -- crits applied per-hit below
              p_level => v_act_level, p_stage => v_act_stage
            );
            v_act_damage   := 0;
            v_hit_messages := '';
            for v_hit_i in 1..v_hit_count loop
              -- Independent crit roll per hit, seeded by hit index.
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

        -- Action modifier interactions (same as attack).
        if v_opponent_action = 'defend' then
          v_act_damage := greatest(1, round(v_act_damage * 0.5)::integer);
        end if;
        if v_opponent_action = 'focus' then
          v_act_damage := round(v_act_damage * 1.3)::integer;
        end if;
        v_act_momentum_boost := 0;
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
          'consumed_next_attack_bonus', v_act_consumed_nab,
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
    if v_actor_action in ('attack', 'focus', 'special') then
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
