-- Battle XP: reward only on the first lifetime win per opponent (not once per calendar day).
-- Prior logic required no rewarded run on the *same battle_date*; that allowed daily XP.
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

  -- Actions
  v_player_action      text;
  v_enemy_action       text;
  v_enemy_action_roll  integer;
  v_attack_weight      integer;
  v_defend_weight      integer;

  -- Initiative
  v_player_init        integer;
  v_enemy_init         integer;
  v_player_goes_first  boolean;

  -- HP tracking
  v_new_player_hp      integer;
  v_new_opponent_hp    integer;

  -- Buff tracking
  v_player_momentum_boost      numeric;
  v_enemy_momentum_boost       numeric;
  v_player_next_attack_bonus   numeric;
  v_enemy_next_attack_bonus    numeric;

  -- Damage and crit flags
  v_player_is_crit          boolean := false;
  v_player_crit_mult        numeric := 1.0;
  v_player_damage           integer := 0;
  v_player_consumed_mb      boolean := false;
  v_player_consumed_nab     boolean := false;

  v_enemy_is_crit           boolean := false;
  v_enemy_crit_mult         numeric := 1.0;
  v_enemy_damage            integer := 0;
  v_enemy_consumed_mb       boolean := false;
  v_enemy_consumed_nab      boolean := false;

  -- Resilience-scaled defend multiplier
  v_defend_mult        numeric;

  -- Completion state
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
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_action not in ('attack', 'defend', 'focus') then
    raise exception 'Unsupported action: %', p_action;
  end if;

  select * into v_run
  from public.battle_runs
  where id      = p_battle_run_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Battle run not found';
  end if;

  if v_run.status <> 'active' then
    return public.battle_session_payload(p_battle_run_id);
  end if;

  select * into v_snapshot from public.creature_battle_snapshots where id = v_run.snapshot_id;
  select * into v_opponent from public.battle_opponents           where id = v_run.opponent_id;

  select coalesce(name, 'Your companion') into v_companion_name
  from public.creature_companions
  where user_id = v_user_id;

  v_current_round   := v_run.current_round;
  v_new_log         := v_run.battle_log;
  v_player_action   := p_action;
  v_new_player_hp   := v_run.player_current_hp;
  v_new_opponent_hp := v_run.opponent_current_hp;

  v_player_momentum_boost    := v_run.player_momentum_boost;
  v_enemy_momentum_boost     := v_run.enemy_momentum_boost;
  v_player_next_attack_bonus := v_run.player_next_attack_bonus;
  v_enemy_next_attack_bonus  := v_run.enemy_next_attack_bonus;

  -- ── Pick enemy action from action_weights ──────────────────────────────────
  v_enemy_action_roll := abs(hashtext(p_battle_run_id::text || v_current_round::text || 'enemy_action')) % 100;
  v_attack_weight     := coalesce((v_opponent.action_weights->>'attack')::integer, 100);
  v_defend_weight     := coalesce((v_opponent.action_weights->>'defend')::integer, 0);

  if v_enemy_action_roll < v_attack_weight then
    v_enemy_action := 'attack';
  elsif v_enemy_action_roll < v_attack_weight + v_defend_weight then
    v_enemy_action := 'defend';
  else
    v_enemy_action := 'focus';
  end if;

  -- ── Initiative roll (player wins ties) ────────────────────────────────────
  v_player_init := v_snapshot.momentum
    + (abs(hashtext(p_battle_run_id::text || v_current_round::text || 'pinit')) % 11) - 5;
  v_enemy_init  := v_opponent.momentum
    + (abs(hashtext(p_battle_run_id::text || v_current_round::text || 'einit')) % 11) - 5;
  v_player_goes_first := v_player_init >= v_enemy_init;

  -- ── Log: initiative entry ──────────────────────────────────────────────────
  v_log_entry := jsonb_build_object(
    'id',                         gen_random_uuid(),
    'round',                      v_current_round,
    'phase',                      'initiative',
    'actor',                      'system',
    'action',                     'initiative',
    'damage',                     0,
    'target',                     null,
    'target_hp_after',            null,
    'crit',                       false,
    'defended',                   false,
    'consumed_momentum_boost',    false,
    'consumed_next_attack_bonus', false,
    'message',                    case
                                    when v_player_goes_first then v_companion_name || ' acts first!'
                                    else v_opponent.name || ' acts first!'
                                  end
  );
  v_new_log := v_new_log || v_log_entry;

  -- ── Precompute crits ──────────────────────────────────────────────────────
  v_player_is_crit  := (abs(hashtext(p_battle_run_id::text || v_current_round::text || 'player' || 'crit')) % 10000)
                         < (v_snapshot.momentum * 15);
  v_player_crit_mult := case when v_player_is_crit then 1.5 else 1.0 end;

  v_enemy_is_crit   := (abs(hashtext(p_battle_run_id::text || v_current_round::text || 'opponent' || 'crit')) % 10000)
                         < (v_opponent.momentum * 15);
  v_enemy_crit_mult  := case when v_enemy_is_crit then 1.5 else 1.0 end;

  -- ══════════════════════════════════════════════════════════════════════════
  -- FIRST ACTOR
  -- ══════════════════════════════════════════════════════════════════════════
  if v_player_goes_first then

    case v_player_action
      when 'attack' then
        v_player_consumed_mb  := v_player_momentum_boost    > 0;
        v_player_consumed_nab := v_player_next_attack_bonus > 0;

        v_player_damage := public.battle_compute_damage(
          p_battle_run_id     => p_battle_run_id,
          p_round             => v_current_round,
          p_actor             => 'player',
          p_strength          => v_snapshot.strength,
          p_momentum          => v_snapshot.momentum,
          p_resilience        => v_opponent.resilience,
          p_momentum_boost    => v_player_momentum_boost,
          p_next_attack_bonus => v_player_next_attack_bonus,
          p_crit_multiplier   => v_player_crit_mult,
          p_level             => v_snapshot.level,
          p_stage             => v_snapshot.stage
        );
        if v_enemy_action = 'defend' then
          -- defender resilience scales mitigation: res=0→42%, res=50→57%, res=100→72%
          v_defend_mult     := greatest(0.25, 0.58 - v_opponent.resilience::numeric * 0.003);
          v_player_damage   := greatest(1, round(v_player_damage::numeric * v_defend_mult)::integer);
        end if;
        v_new_opponent_hp          := greatest(0, v_new_opponent_hp - v_player_damage);
        v_player_momentum_boost    := 0;
        v_player_next_attack_bonus := 0;

        v_log_entry := jsonb_build_object(
          'id',                         gen_random_uuid(),
          'round',                      v_current_round,
          'phase',                      'action',
          'actor',                      'player',
          'action',                     'attack',
          'damage',                     v_player_damage,
          'target',                     'opponent',
          'target_hp_after',            v_new_opponent_hp,
          'crit',                       v_player_is_crit,
          'defended',                   (v_enemy_action = 'defend'),
          'consumed_momentum_boost',    v_player_consumed_mb,
          'consumed_next_attack_bonus', v_player_consumed_nab,
          'message',                    v_companion_name || ' attacks for ' || v_player_damage || ' damage!'
                                          || case when v_player_is_crit then ' (Critical Hit!)' else '' end
                                          || case when v_enemy_action = 'defend' then ' (Blocked!)' else '' end
        );

      when 'defend' then
        v_player_next_attack_bonus := 0.10;
        v_log_entry := jsonb_build_object(
          'id',                         gen_random_uuid(),
          'round',                      v_current_round,
          'phase',                      'action',
          'actor',                      'player',
          'action',                     'defend',
          'damage',                     0,
          'target',                     null,
          'target_hp_after',            null,
          'crit',                       false,
          'defended',                   false,
          'consumed_momentum_boost',    false,
          'consumed_next_attack_bonus', false,
          'message',                    v_companion_name || ' takes a defensive stance!'
        );

      when 'focus' then
        v_player_momentum_boost := 0.20;
        v_log_entry := jsonb_build_object(
          'id',                         gen_random_uuid(),
          'round',                      v_current_round,
          'phase',                      'action',
          'actor',                      'player',
          'action',                     'focus',
          'damage',                     0,
          'target',                     null,
          'target_hp_after',            null,
          'crit',                       false,
          'defended',                   false,
          'consumed_momentum_boost',    false,
          'consumed_next_attack_bonus', false,
          'message',                    v_companion_name || ' focuses their power!'
        );
    end case;
    v_new_log := v_new_log || v_log_entry;

    if v_new_opponent_hp <= 0 and v_player_action = 'attack' then
      v_battle_complete := true;
      v_outcome := 'win';
    end if;

  else -- enemy goes first

    case v_enemy_action
      when 'attack' then
        v_enemy_consumed_mb  := v_enemy_momentum_boost    > 0;
        v_enemy_consumed_nab := v_enemy_next_attack_bonus > 0;

        v_enemy_damage := public.battle_compute_damage(
          p_battle_run_id     => p_battle_run_id,
          p_round             => v_current_round,
          p_actor             => 'opponent',
          p_strength          => v_opponent.strength,
          p_momentum          => v_opponent.momentum,
          p_resilience        => v_snapshot.resilience,
          p_momentum_boost    => v_enemy_momentum_boost,
          p_next_attack_bonus => v_enemy_next_attack_bonus,
          p_crit_multiplier   => v_enemy_crit_mult,
          p_level             => v_opponent.recommended_level,
          p_stage             => 'baby'
        );
        if v_player_action = 'defend' then
          v_defend_mult   := greatest(0.25, 0.58 - v_snapshot.resilience::numeric * 0.003);
          v_enemy_damage  := greatest(1, round(v_enemy_damage::numeric * v_defend_mult)::integer);
        end if;
        v_new_player_hp           := greatest(0, v_new_player_hp - v_enemy_damage);
        v_enemy_momentum_boost    := 0;
        v_enemy_next_attack_bonus := 0;

        v_log_entry := jsonb_build_object(
          'id',                         gen_random_uuid(),
          'round',                      v_current_round,
          'phase',                      'action',
          'actor',                      'opponent',
          'action',                     'attack',
          'damage',                     v_enemy_damage,
          'target',                     'player',
          'target_hp_after',            v_new_player_hp,
          'crit',                       v_enemy_is_crit,
          'defended',                   (v_player_action = 'defend'),
          'consumed_momentum_boost',    v_enemy_consumed_mb,
          'consumed_next_attack_bonus', v_enemy_consumed_nab,
          'message',                    v_opponent.name || ' strikes for ' || v_enemy_damage || ' damage!'
                                          || case when v_enemy_is_crit then ' (Critical Hit!)' else '' end
                                          || case when v_player_action = 'defend' then ' (Blocked!)' else '' end
        );

      when 'defend' then
        v_enemy_next_attack_bonus := 0.10;
        v_log_entry := jsonb_build_object(
          'id',                         gen_random_uuid(),
          'round',                      v_current_round,
          'phase',                      'action',
          'actor',                      'opponent',
          'action',                     'defend',
          'damage',                     0,
          'target',                     null,
          'target_hp_after',            null,
          'crit',                       false,
          'defended',                   false,
          'consumed_momentum_boost',    false,
          'consumed_next_attack_bonus', false,
          'message',                    v_opponent.name || ' braces for impact!'
        );

      when 'focus' then
        v_enemy_momentum_boost := 0.20;
        v_log_entry := jsonb_build_object(
          'id',                         gen_random_uuid(),
          'round',                      v_current_round,
          'phase',                      'action',
          'actor',                      'opponent',
          'action',                     'focus',
          'damage',                     0,
          'target',                     null,
          'target_hp_after',            null,
          'crit',                       false,
          'defended',                   false,
          'consumed_momentum_boost',    false,
          'consumed_next_attack_bonus', false,
          'message',                    v_opponent.name || ' gathers energy!'
        );
    end case;
    v_new_log := v_new_log || v_log_entry;

    if v_new_player_hp <= 0 and v_enemy_action = 'attack' then
      v_battle_complete := true;
      v_outcome := 'loss';
    end if;

  end if;

  -- ══════════════════════════════════════════════════════════════════════════
  -- SECOND ACTOR (only if battle not already over)
  -- ══════════════════════════════════════════════════════════════════════════
  if not v_battle_complete then

    if v_player_goes_first then
      -- Enemy goes second

      case v_enemy_action
        when 'attack' then
          v_enemy_consumed_mb  := v_enemy_momentum_boost    > 0;
          v_enemy_consumed_nab := v_enemy_next_attack_bonus > 0;

          v_enemy_damage := public.battle_compute_damage(
            p_battle_run_id     => p_battle_run_id,
            p_round             => v_current_round,
            p_actor             => 'opponent',
            p_strength          => v_opponent.strength,
            p_momentum          => v_opponent.momentum,
            p_resilience        => v_snapshot.resilience,
            p_momentum_boost    => v_enemy_momentum_boost,
            p_next_attack_bonus => v_enemy_next_attack_bonus,
            p_crit_multiplier   => v_enemy_crit_mult,
            p_level             => v_opponent.recommended_level,
            p_stage             => 'baby'
          );
          if v_player_action = 'defend' then
            v_defend_mult  := greatest(0.25, 0.58 - v_snapshot.resilience::numeric * 0.003);
            v_enemy_damage := greatest(1, round(v_enemy_damage::numeric * v_defend_mult)::integer);
          end if;
          v_new_player_hp           := greatest(0, v_new_player_hp - v_enemy_damage);
          v_enemy_momentum_boost    := 0;
          v_enemy_next_attack_bonus := 0;

          v_log_entry := jsonb_build_object(
            'id',                         gen_random_uuid(),
            'round',                      v_current_round,
            'phase',                      'action',
            'actor',                      'opponent',
            'action',                     'attack',
            'damage',                     v_enemy_damage,
            'target',                     'player',
            'target_hp_after',            v_new_player_hp,
            'crit',                       v_enemy_is_crit,
            'defended',                   (v_player_action = 'defend'),
            'consumed_momentum_boost',    v_enemy_consumed_mb,
            'consumed_next_attack_bonus', v_enemy_consumed_nab,
            'message',                    v_opponent.name || ' strikes for ' || v_enemy_damage || ' damage!'
                                            || case when v_enemy_is_crit then ' (Critical Hit!)' else '' end
                                            || case when v_player_action = 'defend' then ' (Blocked!)' else '' end
          );

        when 'defend' then
          v_enemy_next_attack_bonus := 0.10;
          v_log_entry := jsonb_build_object(
            'id',                         gen_random_uuid(),
            'round',                      v_current_round,
            'phase',                      'action',
            'actor',                      'opponent',
            'action',                     'defend',
            'damage',                     0,
            'target',                     null,
            'target_hp_after',            null,
            'crit',                       false,
            'defended',                   false,
            'consumed_momentum_boost',    false,
            'consumed_next_attack_bonus', false,
            'message',                    v_opponent.name || ' braces for impact!'
          );

        when 'focus' then
          v_enemy_momentum_boost := 0.20;
          v_log_entry := jsonb_build_object(
            'id',                         gen_random_uuid(),
            'round',                      v_current_round,
            'phase',                      'action',
            'actor',                      'opponent',
            'action',                     'focus',
            'damage',                     0,
            'target',                     null,
            'target_hp_after',            null,
            'crit',                       false,
            'defended',                   false,
            'consumed_momentum_boost',    false,
            'consumed_next_attack_bonus', false,
            'message',                    v_opponent.name || ' gathers energy!'
          );
      end case;
      v_new_log := v_new_log || v_log_entry;

      if v_new_player_hp <= 0 and v_enemy_action = 'attack' then
        v_battle_complete := true;
        v_outcome := 'loss';
      end if;

    else
      -- Player goes second

      case v_player_action
        when 'attack' then
          v_player_consumed_mb  := v_player_momentum_boost    > 0;
          v_player_consumed_nab := v_player_next_attack_bonus > 0;

          v_player_damage := public.battle_compute_damage(
            p_battle_run_id     => p_battle_run_id,
            p_round             => v_current_round,
            p_actor             => 'player',
            p_strength          => v_snapshot.strength,
            p_momentum          => v_snapshot.momentum,
            p_resilience        => v_opponent.resilience,
            p_momentum_boost    => v_player_momentum_boost,
            p_next_attack_bonus => v_player_next_attack_bonus,
            p_crit_multiplier   => v_player_crit_mult,
            p_level             => v_snapshot.level,
            p_stage             => v_snapshot.stage
          );
          if v_enemy_action = 'defend' then
            v_defend_mult     := greatest(0.25, 0.58 - v_opponent.resilience::numeric * 0.003);
            v_player_damage   := greatest(1, round(v_player_damage::numeric * v_defend_mult)::integer);
          end if;
          v_new_opponent_hp          := greatest(0, v_new_opponent_hp - v_player_damage);
          v_player_momentum_boost    := 0;
          v_player_next_attack_bonus := 0;

          v_log_entry := jsonb_build_object(
            'id',                         gen_random_uuid(),
            'round',                      v_current_round,
            'phase',                      'action',
            'actor',                      'player',
            'action',                     'attack',
            'damage',                     v_player_damage,
            'target',                     'opponent',
            'target_hp_after',            v_new_opponent_hp,
            'crit',                       v_player_is_crit,
            'defended',                   (v_enemy_action = 'defend'),
            'consumed_momentum_boost',    v_player_consumed_mb,
            'consumed_next_attack_bonus', v_player_consumed_nab,
            'message',                    v_companion_name || ' attacks for ' || v_player_damage || ' damage!'
                                            || case when v_player_is_crit then ' (Critical Hit!)' else '' end
                                            || case when v_enemy_action = 'defend' then ' (Blocked!)' else '' end
          );

        when 'defend' then
          v_player_next_attack_bonus := 0.10;
          v_log_entry := jsonb_build_object(
            'id',                         gen_random_uuid(),
            'round',                      v_current_round,
            'phase',                      'action',
            'actor',                      'player',
            'action',                     'defend',
            'damage',                     0,
            'target',                     null,
            'target_hp_after',            null,
            'crit',                       false,
            'defended',                   false,
            'consumed_momentum_boost',    false,
            'consumed_next_attack_bonus', false,
            'message',                    v_companion_name || ' takes a defensive stance!'
          );

        when 'focus' then
          v_player_momentum_boost := 0.20;
          v_log_entry := jsonb_build_object(
            'id',                         gen_random_uuid(),
            'round',                      v_current_round,
            'phase',                      'action',
            'actor',                      'player',
            'action',                     'focus',
            'damage',                     0,
            'target',                     null,
            'target_hp_after',            null,
            'crit',                       false,
            'defended',                   false,
            'consumed_momentum_boost',    false,
            'consumed_next_attack_bonus', false,
            'message',                    v_companion_name || ' focuses their power!'
          );
      end case;
      v_new_log := v_new_log || v_log_entry;

      if v_new_opponent_hp <= 0 and v_player_action = 'attack' then
        v_battle_complete := true;
        v_outcome := 'win';
      end if;

    end if;
  end if;

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
        where prior.user_id      = v_user_id
          and prior.opponent_id  = v_run.opponent_id
          and prior.id          <> v_run.id
          and prior.reward_claimed = true
      ) into v_rewardable;

      if v_rewardable then
        v_xp_awarded     := 10 + v_opponent.recommended_level * 4;
        v_arena_progress := 1;
        v_reward_claimed := true;
      end if;

      v_log_entry := jsonb_build_object(
        'id',                         gen_random_uuid(),
        'round',                      v_current_round,
        'phase',                      'result',
        'actor',                      'system',
        'action',                     'result',
        'damage',                     0,
        'target',                     null,
        'target_hp_after',            null,
        'crit',                       false,
        'defended',                   false,
        'consumed_momentum_boost',    false,
        'consumed_next_attack_bonus', false,
        'message',                    'Victory!'
      );
    else
      v_remaining_hp_pct := 0;

      v_log_entry := jsonb_build_object(
        'id',                         gen_random_uuid(),
        'round',                      v_current_round,
        'phase',                      'result',
        'actor',                      'system',
        'action',                     'result',
        'damage',                     0,
        'target',                     null,
        'target_hp_after',            null,
        'crit',                       false,
        'defended',                   false,
        'consumed_momentum_boost',    false,
        'consumed_next_attack_bonus', false,
        'message',                    'Defeat...'
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
  update public.battle_runs
  set
    status                   = v_status,
    outcome                  = case when v_battle_complete then v_outcome            else outcome              end,
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
    turn_count               = case when v_battle_complete then v_turn_count          else turn_count           end,
    remaining_hp_pct         = case when v_battle_complete then v_remaining_hp_pct   else remaining_hp_pct     end,
    xp_awarded               = case when v_battle_complete then v_xp_awarded          else xp_awarded           end,
    arena_progress_awarded   = case when v_battle_complete then v_arena_progress      else arena_progress_awarded end,
    reward_claimed           = case when v_battle_complete then v_reward_claimed      else reward_claimed       end,
    completed_at             = case when v_battle_complete then v_completed_at        else completed_at         end
  where id = p_battle_run_id;

  return public.battle_session_payload(p_battle_run_id);
end;
$$;
