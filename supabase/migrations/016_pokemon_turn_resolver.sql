-- 016_pokemon_turn_resolver.sql
-- Replaces the attack-only battle runtime with a full 3-action (attack/defend/focus)
-- Pokémon-style turn resolver with momentum-based initiative, crits, and per-archetype AI.
-- Supersedes 013_double_opponent_damage.sql and 014_raise_opponent_base_damage.sql.

-- ─── 1. EXTEND battle_runs ────────────────────────────────────────────────────

alter table public.battle_runs
  add column player_last_action      text    null,
  add column enemy_last_action       text    null,
  add column player_momentum_boost   numeric not null default 0,
  add column enemy_momentum_boost    numeric not null default 0,
  add column player_next_attack_bonus numeric not null default 0,
  add column enemy_next_attack_bonus  numeric not null default 0;

-- ─── 2. EXTEND battle_opponents + seed Arena 1 action weights ────────────────

alter table public.battle_opponents
  add column action_weights jsonb not null default '{"attack":100,"defend":0,"focus":0}'::jsonb;

update public.battle_opponents set action_weights = '{"attack":80,"defend":20,"focus":0}'::jsonb  where name = 'Pebble Pup';
update public.battle_opponents set action_weights = '{"attack":60,"defend":0,"focus":40}'::jsonb   where name = 'Cinder Finch';
update public.battle_opponents set action_weights = '{"attack":50,"defend":50,"focus":0}'::jsonb   where name = 'Mossback Ram';
update public.battle_opponents set action_weights = '{"attack":50,"defend":25,"focus":25}'::jsonb  where name = 'Tide Lynx';
update public.battle_opponents set action_weights = '{"attack":50,"defend":25,"focus":25}'::jsonb  where name = 'Sunscale Drake';

-- ─── 3. battle_session_payload — add 6 new fields ────────────────────────────

create or replace function public.battle_session_payload(p_battle_run_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'id',                        r.id,
    'user_id',                   r.user_id,
    'battle_date',               r.battle_date,
    'snapshot_id',               r.snapshot_id,
    'opponent_id',               r.opponent_id,
    'outcome',                   r.outcome,
    'turn_count',                r.turn_count,
    'remaining_hp_pct',          r.remaining_hp_pct,
    'xp_awarded',                r.xp_awarded,
    'arena_progress_awarded',    r.arena_progress_awarded,
    'reward_claimed',            r.reward_claimed,
    'created_at',                r.created_at,
    'status',                    r.status,
    'player_max_hp',             r.player_max_hp,
    'player_current_hp',         r.player_current_hp,
    'opponent_max_hp',           r.opponent_max_hp,
    'opponent_current_hp',       r.opponent_current_hp,
    'current_round',             r.current_round,
    'battle_log',                r.battle_log,
    'completed_at',              r.completed_at,
    'player_last_action',        r.player_last_action,
    'enemy_last_action',         r.enemy_last_action,
    'player_momentum_boost',     r.player_momentum_boost,
    'enemy_momentum_boost',      r.enemy_momentum_boost,
    'player_next_attack_bonus',  r.player_next_attack_bonus,
    'enemy_next_attack_bonus',   r.enemy_next_attack_bonus,
    'snapshot',                  row_to_json(s),
    'opponent',                  row_to_json(o),
    'companion',                 row_to_json(cc)
  )
  from public.battle_runs r
  join  public.creature_battle_snapshots s  on s.id      = r.snapshot_id
  join  public.battle_opponents          o  on o.id      = r.opponent_id
  left join public.creature_companions  cc  on cc.user_id = r.user_id
  where r.id      = p_battle_run_id
    and r.user_id = auth.uid()
$$;

-- ─── 4. battle_compute_damage — action-aware, supersedes 013 and 014 ─────────
-- New parameters: momentum_boost, next_attack_bonus, crit_multiplier.
-- Crit detection happens in submit_battle_action; multiplier is passed in.

create or replace function public.battle_compute_damage(
  p_battle_run_id     uuid,
  p_round             integer,
  p_actor             text,
  p_strength          integer,
  p_momentum          integer,
  p_resilience        integer,
  p_momentum_boost    numeric  default 0,
  p_next_attack_bonus numeric  default 0,
  p_crit_multiplier   numeric  default 1.0
)
returns integer
language sql
immutable
set search_path = public
as $$
  select greatest(1, round(
    (p_strength * 0.6 + p_momentum * (1.0 + p_momentum_boost) * 0.4)
    * (0.9 + (abs(hashtext(p_battle_run_id::text || p_round::text || p_actor || 'var')) % 21) / 100.0)
    * p_crit_multiplier
    * (1.0 + p_next_attack_bonus)
    - p_resilience * 0.3
  )::integer);
$$;

-- ─── 5. start_battle_run — HP initialized as round(vitality * 0.7) ───────────
-- Carries over sequential progression gating from 015; only HP init changes.

create or replace function public.start_battle_run(
  p_snapshot_id uuid,
  p_opponent_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id           uuid;
  v_snapshot          public.creature_battle_snapshots;
  v_companion         public.creature_companions;
  v_opponent          public.battle_opponents;
  v_required_opponent public.battle_opponents;
  v_required_win      boolean := false;
  v_run               public.battle_runs;
  v_active_run        public.battle_runs;
  v_player_max_hp     integer;
  v_opponent_max_hp   integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_snapshot
  from public.creature_battle_snapshots
  where id = p_snapshot_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Battle snapshot not found';
  end if;

  select * into v_companion
  from public.creature_companions
  where user_id = v_user_id;

  select o.* into v_opponent
  from public.battle_opponents o
  join public.battle_arenas a on a.id = o.arena_id and a.is_active = true
  where o.id = p_opponent_id
    and o.is_active = true;

  if not found then
    raise exception 'Opponent not found';
  end if;

  -- Sequential progression gate (from 015)
  select prev.* into v_required_opponent
  from public.battle_opponents prev
  where prev.arena_id   = v_opponent.arena_id
    and prev.sort_order = v_opponent.sort_order - 1
    and prev.is_active  = true;

  if found then
    select exists (
      select 1
      from public.battle_runs r
      where r.user_id     = v_user_id
        and r.opponent_id = v_required_opponent.id
        and r.outcome     = 'win'
    ) into v_required_win;

    if not v_required_win then
      raise exception 'Beat % first.', v_required_opponent.name;
    end if;
  end if;

  select * into v_active_run
  from public.battle_runs
  where user_id    = v_user_id
    and battle_date = v_snapshot.battle_date
    and status     = 'active'
  limit 1;

  if found then
    if v_active_run.opponent_id = p_opponent_id then
      return public.battle_session_payload(v_active_run.id);
    else
      raise exception 'Finish your current battle before starting another.';
    end if;
  end if;

  -- HP = round(vitality * 0.7), minimum 1
  v_player_max_hp   := greatest(1, round(v_snapshot.vitality * 0.7)::integer);
  v_opponent_max_hp := greatest(1, round(v_opponent.vitality  * 0.7)::integer);

  insert into public.battle_runs (
    user_id,
    battle_date,
    snapshot_id,
    opponent_id,
    outcome,
    status,
    player_max_hp,
    player_current_hp,
    opponent_max_hp,
    opponent_current_hp,
    current_round,
    battle_log
  ) values (
    v_user_id,
    v_snapshot.battle_date,
    v_snapshot.id,
    v_opponent.id,
    'pending',
    'active',
    v_player_max_hp,
    v_player_max_hp,
    v_opponent_max_hp,
    v_opponent_max_hp,
    1,
    '[]'::jsonb
  )
  returning * into v_run;

  return public.battle_session_payload(v_run.id);
end;
$$;

-- ─── 6. submit_battle_action — full Pokémon-style turn resolver ───────────────

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

  -- Buff tracking (working copies for this resolution)
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

  -- Lock the row to serialise concurrent submissions
  select * into v_run
  from public.battle_runs
  where id      = p_battle_run_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Battle run not found';
  end if;

  -- Idempotency: already completed — return current state
  if v_run.status <> 'active' then
    return public.battle_session_payload(p_battle_run_id);
  end if;

  -- Fetch combatant stats
  select * into v_snapshot from public.creature_battle_snapshots where id = v_run.snapshot_id;
  select * into v_opponent from public.battle_opponents           where id = v_run.opponent_id;

  select coalesce(name, 'Your companion') into v_companion_name
  from public.creature_companions
  where user_id = v_user_id;

  v_current_round   := v_run.current_round;
  v_new_log         := v_run.battle_log;
  v_player_action   := p_action;

  -- Working HP
  v_new_player_hp   := v_run.player_current_hp;
  v_new_opponent_hp := v_run.opponent_current_hp;

  -- Load persisted buffs
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

  -- ── Precompute crits (used only on attack, multiplier passed to damage fn) ─
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
          p_crit_multiplier   => v_player_crit_mult
        );
        if v_enemy_action = 'defend' then
          v_player_damage := greatest(1, round(v_player_damage * 0.5)::integer);
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
          p_crit_multiplier   => v_enemy_crit_mult
        );
        if v_player_action = 'defend' then
          v_enemy_damage := greatest(1, round(v_enemy_damage * 0.5)::integer);
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
            p_crit_multiplier   => v_enemy_crit_mult
          );
          if v_player_action = 'defend' then
            v_enemy_damage := greatest(1, round(v_enemy_damage * 0.5)::integer);
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
            p_crit_multiplier   => v_player_crit_mult
          );
          if v_enemy_action = 'defend' then
            v_player_damage := greatest(1, round(v_player_damage * 0.5)::integer);
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
          and prior.battle_date  = v_run.battle_date
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
    -- Battle continues
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
