-- Migration 073: restamp submit_battle_action with durable counter_stance death ordering
--
-- Counter Stance must not retaliate after the incoming hit reduces the player
-- to 0 HP. Earlier migrations suppressed parts of the symptom. This migration
-- restamps the resolver so survival is a hard precondition for counter damage,
-- counter log entries, and counter-win resolution.

create or replace function public.submit_battle_action(
  p_battle_run_id uuid,
  p_action        text,
  p_skill_id      text default null
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

  v_player_focus_pips  integer;
  v_enemy_focus_pips   integer;

  v_player_is_crit     boolean := false;
  v_player_crit_mult   numeric := 1.0;
  v_enemy_is_crit      boolean := false;
  v_enemy_crit_mult    numeric := 1.0;

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

  v_skill_pip_cost      integer;
  v_skill_unlock_level  integer;
  v_regen_heal_amount   integer := 0;
  v_defender_level      integer := 1;
  v_pip_cap             integer;
  v_focus_gain          integer;
  v_counter_pending     boolean := false;
  v_counter_triggered   boolean := false;
  v_pips_before_skill   integer := 0;
  v_counter_hit_damage  integer := 0;

  v_battle_complete     boolean := false;
  v_status              text;
  v_outcome             text;
  v_turn_count          integer;
  v_remaining_hp_pct    integer;
  v_xp_awarded          integer := 0;
  v_arena_progress      integer := 0;
  v_reward_claimed      boolean := false;
  v_rewardable          boolean := false;
  v_completed_at        timestamptz;
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

  if v_run.player_current_hp <= 0 and v_run.status = 'active' then
    update public.battle_runs
    set status = 'completed', outcome = 'loss', completed_at = now()
    where id = p_battle_run_id;
    return public.battle_session_payload(p_battle_run_id);
  end if;

  if v_run.status <> 'active' then
    return public.battle_session_payload(p_battle_run_id);
  end if;

  v_player_focus_pips := v_run.player_focus_pips;
  v_enemy_focus_pips  := v_run.enemy_focus_pips;

  if p_action = 'skill' then
    if p_skill_id is null then
      raise exception 'p_skill_id is required when action = ''skill''';
    end if;
    if p_skill_id not in ('triple_hit', 'power_strike', 'regen', 'charge_strike', 'counter_stance', 'overdrive') then
      raise exception 'Unknown skill: %', p_skill_id;
    end if;
    v_skill_pip_cost := case p_skill_id
      when 'triple_hit'     then 1
      when 'power_strike'   then 1
      when 'regen'          then 2
      when 'charge_strike'  then 2
      when 'counter_stance' then 1
      when 'overdrive'      then 3
      else 0
    end;
    if v_player_focus_pips < v_skill_pip_cost then
      raise exception 'Not enough focus pips for % (need %, have %)',
        p_skill_id, v_skill_pip_cost, v_player_focus_pips;
    end if;
  end if;

  select * into v_snapshot from public.creature_battle_snapshots where id = v_run.snapshot_id;
  select * into v_opponent from public.battle_opponents where id = v_run.opponent_id;

  v_counter_pending := v_run.counter_pending;

  if p_action = 'skill' then
    v_skill_unlock_level := case p_skill_id
      when 'triple_hit'     then 1
      when 'power_strike'   then 4
      when 'regen'          then 8
      when 'charge_strike'  then 15
      when 'counter_stance' then 18
      when 'overdrive'      then 20
      else 99
    end;
    if v_snapshot.level < v_skill_unlock_level then
      raise exception 'Skill % requires level % (current level: %)',
        p_skill_id, v_skill_unlock_level, v_snapshot.level;
    end if;
  end if;

  v_pip_cap    := case when v_snapshot.level >= 20 then 5
                       when v_snapshot.level >= 10 then 4
                       else 3 end;
  v_focus_gain := case when v_snapshot.level >= 12 then 2 else 1 end;

  select coalesce(name, 'Your companion') into v_companion_name
  from public.creature_companions where user_id = v_user_id;

  v_current_round   := v_run.current_round;
  v_new_log         := v_run.battle_log;
  v_player_action   := p_action;
  v_new_player_hp   := v_run.player_current_hp;
  v_new_opponent_hp := v_run.opponent_current_hp;

  v_player_momentum_boost := v_run.player_momentum_boost;
  v_enemy_momentum_boost  := v_run.enemy_momentum_boost;

  v_enemy_action := null;
  if v_opponent.special_action is not null then
    v_special_weight := coalesce((v_opponent.special_action->>'weight')::integer, 0);
    v_preempt_roll   := abs(hashtext(p_battle_run_id::text || v_current_round::text || 'special_preempt')) % 100;
    if v_preempt_roll < v_special_weight then
      v_enemy_action := 'special';
    end if;
  end if;

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

  v_player_init := v_snapshot.momentum
    + (abs(hashtext(p_battle_run_id::text || v_current_round::text || 'pinit')) % 11) - 5;
  v_enemy_init := v_opponent.momentum
    + (abs(hashtext(p_battle_run_id::text || v_current_round::text || 'einit')) % 11) - 5;
  v_player_goes_first := v_player_init >= v_enemy_init;
  -- counter_stance: always wins initiative - ensures the stance is set before
  -- the opponent can attack this turn, regardless of momentum.
  if p_action = 'skill' and p_skill_id = 'counter_stance' then
    v_player_goes_first := true;
  end if;

  v_new_log := v_new_log || jsonb_build_object(
    'id', gen_random_uuid(), 'round', v_current_round, 'phase', 'initiative',
    'actor', 'system', 'action', 'initiative',
    'first_actor', case when v_player_goes_first then 'player' else 'opponent' end,
    'player_initiative', v_player_init,
    'opponent_initiative', v_enemy_init,
    'player_action', v_player_action,
    'opponent_action', v_enemy_action,
    'damage', 0, 'target', null, 'target_hp_after', null,
    'crit', false, 'defended', false,
    'consumed_momentum_boost', false, 'consumed_next_attack_bonus', false,
    'message', case
      when v_player_goes_first then v_companion_name || ' acts first!'
      else v_opponent.name || ' acts first!'
    end
  );

  v_player_is_crit   := (abs(hashtext(p_battle_run_id::text || v_current_round::text || 'player' || 'crit')) % 10000) < (v_snapshot.momentum * 15);
  v_player_crit_mult := case when v_player_is_crit then 1.5 else 1.0 end;
  v_enemy_is_crit    := (abs(hashtext(p_battle_run_id::text || v_current_round::text || 'opponent' || 'crit')) % 10000) < (v_opponent.momentum * 15);
  v_enemy_crit_mult  := case when v_enemy_is_crit then 1.5 else 1.0 end;

  v_actors := case when v_player_goes_first
    then array['player', 'opponent']
    else array['opponent', 'player']
  end;

  foreach v_actor in array v_actors loop
    if v_battle_complete then exit; end if;

    v_regen_heal_amount  := 0;
    v_counter_triggered  := false;
    v_counter_hit_damage := 0;
    v_pips_before_skill  := 0;

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
      v_defender_level     := v_opponent.recommended_level;
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
      v_defender_level     := v_snapshot.level;
    end if;

    v_act_damage := 0;
    v_act_consumed_mb := false;

    case v_actor_action
      when 'attack' then
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
        v_act_damage := greatest(1, round(v_act_damage * greatest(0.50, 1.0 - v_defender_level * 0.003))::integer);
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
          'actor', v_act_actor_label, 'action', 'attack',
          'damage', v_act_damage, 'target', v_act_target_label,
          'target_hp_after', v_act_target_hp_after,
          'crit', v_act_is_crit, 'defended', (v_opponent_action = 'defend'),
          'consumed_momentum_boost', v_act_consumed_mb,
          'consumed_next_attack_bonus', false,
          'message', v_act_name || ' ' || v_act_attack_verb || ' for ' || v_act_damage || ' damage!'
            || case when v_act_is_crit then ' (Critical Hit!)' else '' end
            || case when v_opponent_action = 'defend' then ' (Blocked!)' else '' end
            || case when v_opponent_action = 'focus' then ' (Exposed!)' else '' end
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
        if v_actor = 'player' then
          v_player_focus_pips := least(v_pip_cap, v_player_focus_pips + v_focus_gain);
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
        v_act_consumed_mb := v_act_momentum_boost > 0;

        case p_skill_id
          when 'triple_hit' then
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
            v_act_damage := 0;
            v_hit_messages := '';
            for v_hit_i in 1..v_hit_count loop
              v_hit_is_crit := (abs(hashtext(
                p_battle_run_id::text || v_current_round::text || v_act_actor_label || 'skill_hit' || v_hit_i::text
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

          when 'power_strike' then
            v_act_damage := greatest(1, round(public.battle_compute_damage(
              p_battle_run_id => p_battle_run_id, p_round => v_current_round,
              p_actor => v_act_actor_label,
              p_strength => v_act_strength, p_momentum => v_act_momentum,
              p_resilience => v_act_resilience,
              p_momentum_boost => v_act_momentum_boost,
              p_next_attack_bonus => 0,
              p_crit_multiplier => v_act_crit_mult,
              p_level => v_act_level, p_stage => v_act_stage
            ) * 2.0)::integer);

          when 'regen' then
            v_regen_heal_amount := least(
              v_run.player_max_hp - v_new_player_hp,
              round(v_run.player_max_hp * 0.30)::integer
            );
            v_new_player_hp := v_new_player_hp + v_regen_heal_amount;
            v_act_damage := 0;
            v_act_is_crit := false;

          when 'charge_strike' then
            v_pips_before_skill := v_player_focus_pips;
            v_act_damage := greatest(1, round(
              public.battle_compute_damage(
                p_battle_run_id => p_battle_run_id, p_round => v_current_round,
                p_actor => v_act_actor_label,
                p_strength => v_act_strength, p_momentum => v_act_momentum,
                p_resilience => v_act_resilience,
                p_momentum_boost => v_act_momentum_boost,
                p_next_attack_bonus => 0,
                p_crit_multiplier => v_act_crit_mult,
                p_level => v_act_level, p_stage => v_act_stage
              ) * v_pips_before_skill * 1.2
            )::integer);

          when 'counter_stance' then
            v_counter_pending := true;
            v_act_damage := 0;
            v_act_is_crit := false;

          when 'overdrive' then
            v_hit_count       := 5;
            v_hit_fraction    := 0.60;
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
            v_act_damage := 0;
            v_hit_messages := '';
            for v_hit_i in 1..v_hit_count loop
              v_hit_is_crit := (abs(hashtext(
                p_battle_run_id::text || v_current_round::text || v_act_actor_label || 'skill_hit' || v_hit_i::text
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

        v_player_focus_pips := case p_skill_id
          when 'charge_strike' then 0
          else greatest(0, v_player_focus_pips - v_skill_pip_cost)
        end;
        v_act_momentum_boost := 0;

        if p_skill_id = 'counter_stance' then
          v_log_entry := jsonb_build_object(
            'id', gen_random_uuid(), 'round', v_current_round, 'phase', 'action',
            'actor', 'player', 'action', 'skill',
            'skill_id', p_skill_id,
            'damage', 0, 'target', 'player',
            'target_hp_after', v_new_player_hp,
            'crit', false, 'defended', false,
            'consumed_momentum_boost', v_act_consumed_mb,
            'consumed_next_attack_bonus', false,
            'message', v_act_name || ' takes Counter Stance - ready to deflect and retaliate!'
          );
        elsif v_regen_heal_amount > 0 then
          v_log_entry := jsonb_build_object(
            'id', gen_random_uuid(), 'round', v_current_round, 'phase', 'action',
            'actor', 'player', 'action', 'skill',
            'skill_id', p_skill_id,
            'damage', 0, 'target', 'player',
            'target_hp_after', v_new_player_hp,
            'crit', false, 'defended', false,
            'consumed_momentum_boost', v_act_consumed_mb,
            'consumed_next_attack_bonus', false,
            'message', v_act_name || ' recovers ' || v_regen_heal_amount::text || ' HP!'
          );
        else
          v_act_damage := greatest(1, round(v_act_damage * greatest(0.50, 1.0 - v_defender_level * 0.003))::integer);
          if v_opponent_action = 'defend' then
            v_act_damage := greatest(1, round(v_act_damage * 0.5)::integer);
          end if;
          if v_opponent_action = 'focus' then
            v_act_damage := round(v_act_damage * 1.3)::integer;
          end if;
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
              when 'power_strike' then
                v_act_name || ' unleashes Power Strike for ' || v_act_damage || ' damage!'
                || case when v_act_is_crit then ' (Critical Hit!)' else '' end
              when 'charge_strike' then
                v_act_name || ' unleashes Charge Strike (' || v_pips_before_skill::text || ' pips) for '
                || v_act_damage::text || ' damage!'
                || case when v_act_is_crit then ' (Critical Hit!)' else '' end
              when 'overdrive' then
                v_act_name || ' unleashes Overdrive! '
                || v_hit_count::text || ' hits: ' || v_hit_messages
                || ' = ' || v_act_damage::text || ' total!'
              else v_act_name || ' uses ' || p_skill_id || '!'
            end
              || case when v_opponent_action = 'defend' then ' (Blocked!)' else '' end
              || case when v_opponent_action = 'focus' then ' (Exposed!)' else '' end
          );
        end if;

      when 'special' then
        v_act_consumed_mb := v_act_momentum_boost > 0;
        v_special_type := coalesce(v_opponent.special_action->>'type', 'damage_boost');

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
            v_hit_count := coalesce((v_opponent.special_action->'params'->>'hits')::integer, 3);
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
            v_act_damage := 0;
            v_hit_messages := '';
            for v_hit_i in 1..v_hit_count loop
              v_hit_is_crit := (abs(hashtext(
                p_battle_run_id::text || v_current_round::text || v_act_actor_label || 'hit' || v_hit_i::text
              )) % 10000) < (v_act_momentum * 15);
              v_hit_crit_mult := case when v_hit_is_crit then 1.5 else 1.0 end;
              v_single_hit_damage := greatest(1, round(v_single_hit_base * v_hit_fraction * v_hit_crit_mult)::integer);
              v_act_damage := v_act_damage + v_single_hit_damage;
              if v_hit_is_crit then v_any_hit_critted := true; end if;
              v_hit_messages := v_hit_messages
                || v_single_hit_damage::text
                || case when v_hit_is_crit then ' (CRIT!)' else '' end
                || case when v_hit_i < v_hit_count then ', ' else '' end;
            end loop;
        end case;

        v_act_damage := greatest(1, round(v_act_damage * greatest(0.50, 1.0 - v_defender_level * 0.003))::integer);
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
          'crit', case when v_special_type = 'multi_hit' then v_any_hit_critted else v_act_is_crit end,
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
            || case when v_opponent_action = 'focus' then ' (Exposed!)' else '' end
        );
    end case;

    if v_actor = 'player' then
      v_player_momentum_boost := v_act_momentum_boost;
      v_new_opponent_hp := greatest(0, v_new_opponent_hp - v_act_damage);
    else
      v_enemy_momentum_boost := v_act_momentum_boost;
      -- Counter Stance deflects before damage lands, but retaliation is only
      -- legal after the player survives the resulting hit.
      if v_counter_pending and v_actor_action in ('attack', 'special') then
        v_act_damage := greatest(1, round(v_act_damage * 0.5)::integer);
        v_counter_triggered := true;
        v_counter_pending := false;
      elsif v_actor_action not in ('attack', 'special') then
        v_counter_pending := false;
      end if;

      v_new_player_hp := greatest(0, v_new_player_hp - v_act_damage);

      if v_counter_triggered then
        v_log_entry := jsonb_set(v_log_entry, '{damage}', to_jsonb(v_act_damage), false);
        v_log_entry := jsonb_set(v_log_entry, '{target_hp_after}', to_jsonb(v_new_player_hp), false);
        v_log_entry := jsonb_set(
          v_log_entry,
          '{message}',
          to_jsonb(
            case
              when v_actor_action = 'attack' then
                v_act_name || ' ' || v_act_attack_verb || ' for ' || v_act_damage || ' damage!'
                || case when v_act_is_crit then ' (Critical Hit!)' else '' end
                || case when v_opponent_action = 'defend' then ' (Blocked!)' else '' end
                || case when v_opponent_action = 'focus' then ' (Exposed!)' else '' end
              else
                v_act_name || ' unleashes '
                || coalesce(v_opponent.special_action->>'label', 'a special attack') || '!'
                || ' ' || v_act_damage::text || ' damage!'
                || case when v_opponent_action = 'defend' then ' (Blocked!)' else '' end
                || case when v_opponent_action = 'focus' then ' (Exposed!)' else '' end
            end
          ),
          false
        );
      end if;

      if v_counter_triggered and v_new_player_hp > 0 then
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
    end if;

    v_new_log := v_new_log || v_log_entry;

    if v_counter_hit_damage > 0 and v_new_player_hp > 0 then
      v_new_log := v_new_log || jsonb_build_object(
        'id', gen_random_uuid(), 'round', v_current_round, 'phase', 'action',
        'actor', 'player', 'action', 'counter',
        'skill_id', 'counter_stance',
        'damage', v_counter_hit_damage, 'target', 'opponent',
        'target_hp_after', v_new_opponent_hp,
        'crit', false, 'defended', false,
        'consumed_momentum_boost', false,
        'consumed_next_attack_bonus', false,
        'message', v_companion_name || ' counter-attacks for ' || v_counter_hit_damage::text || ' damage!'
      );
    end if;

    if v_actor_action in ('attack', 'skill', 'special') then
      if v_actor = 'player' and v_new_opponent_hp <= 0 then
        v_battle_complete := true;
        v_outcome := v_act_win_outcome;
      elsif v_actor = 'opponent' then
        if v_new_player_hp <= 0 then
          v_battle_complete := true;
          v_outcome := v_act_win_outcome;
        elsif v_new_opponent_hp <= 0 then
          v_battle_complete := true;
          v_outcome := 'win';
        end if;
      end if;
    end if;
  end loop;

  if v_battle_complete then
    v_status := 'completed';
    v_completed_at := now();
    v_turn_count := v_current_round;

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
    v_status := 'active';
    v_outcome := v_run.outcome;
    v_completed_at := null;
    v_turn_count := v_run.turn_count;
    v_remaining_hp_pct := v_run.remaining_hp_pct;
    v_current_round := v_current_round + 1;
  end if;

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
end;
$$;
