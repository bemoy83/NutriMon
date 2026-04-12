-- 026_refactor_submit_battle_action.sql
-- Pure refactor of submit_battle_action: eliminates duplicated FIRST/SECOND ACTOR blocks
-- by replacing them with a single FOREACH loop over an initiative-ordered actor array.
--
-- No schema changes. No behavior changes. Log entry shapes and payload format are identical.

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

  -- ── Enemy action (state-aware) ─────────────────────────────────────────────
  v_enemy_action := public.battle_pick_enemy_action(
    p_battle_run_id      => p_battle_run_id,
    p_current_round      => v_current_round,
    p_action_weights     => v_opponent.action_weights,
    p_enemy_hp           => v_run.opponent_current_hp,
    p_enemy_max_hp       => v_run.opponent_max_hp,
    p_enemy_nab          => v_enemy_next_attack_bonus,
    p_player_last_action => v_run.player_last_action
  );

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
        v_act_damage := greatest(1, round(v_act_damage * 0.75)::integer);
        if v_opponent_action = 'defend' then
          v_act_damage := greatest(1, round(v_act_damage * 0.5)::integer);
        end if;
        if v_opponent_action = 'focus' then
          v_act_damage := round(v_act_damage * 1.3)::integer;
        end if;
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
