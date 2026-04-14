-- 017_combat_rebalance.sql
-- Five targeted fixes based on combat audit:
--   1. Scale damage coefficients down (0.20/0.13) + switch resilience to % mitigation
--   2. Add level bonus + stage multiplier to damage
--   3. Defend effectiveness scales with defender resilience
--   4. Player HP gains level × 2 bonus at battle start
--   5. Raise Arena 1 opponent vitality to restore meaningful HP pools after × 0.7 pacing fix

-- ─── 1. UPDATE opponent vitality ─────────────────────────────────────────────
-- Raise seeds ~50% to restore 3-5 round fights under the new lower-coefficient formula.
-- Extend check constraint to allow vitality up to 300 for high-tier opponents.

alter table public.battle_opponents
  drop constraint if exists battle_opponents_vitality_check;

alter table public.battle_opponents
  add constraint battle_opponents_vitality_check check (vitality >= 50 and vitality <= 300);

update public.battle_opponents set vitality = 115 where name = 'Pebble Pup';
update public.battle_opponents set vitality = 125 where name = 'Cinder Finch';
update public.battle_opponents set vitality = 145 where name = 'Mossback Ram';
update public.battle_opponents set vitality = 165 where name = 'Tide Lynx';
update public.battle_opponents set vitality = 190 where name = 'Sunscale Drake';

-- ─── 2. battle_compute_damage — rebalanced formula ───────────────────────────
-- Changes from 016:
--   • Coefficients: strength 0.6→0.20, momentum 0.4→0.13
--   • Level bonus: + level × 0.5 to base (new param p_level)
--   • Stage multiplier: baby=1.0, adult=1.15, champion=1.35 (new param p_stage)
--   • Resilience: flat-subtract → percentage mitigation (max 40% at res=100)

create or replace function public.battle_compute_damage(
  p_battle_run_id     uuid,
  p_round             integer,
  p_actor             text,
  p_strength          integer,
  p_momentum          integer,
  p_resilience        integer,
  p_momentum_boost    numeric  default 0,
  p_next_attack_bonus numeric  default 0,
  p_crit_multiplier   numeric  default 1.0,
  p_level             integer  default 1,
  p_stage             text     default 'baby'
)
returns integer
language sql
immutable
set search_path = public
as $$
  select greatest(1, round(
    -- BASE DAMAGE: str × 0.20 + mom × (1 + boost) × 0.13 + level × 0.5
    -- strength coeff 0.20: tuning range 0.15–0.30 (raising this amplifies stat-based power creep)
    -- momentum coeff 0.13: tuning range 0.08–0.20 (also gates crit chance, so raise carefully)
    -- level coeff 0.5: flat bonus per level; keeps leveling meaningful without dominating stats
    (p_strength * 0.20 + p_momentum * (1.0 + p_momentum_boost) * 0.13 + p_level * 0.5)

    -- VARIANCE: ±10% per-round deterministic jitter (0.90–1.10)
    -- Seeded by run + round + actor so the same battle always replays identically.
    -- Range (% 21 → 0–20) / 100 + 0.9 = 0.90–1.10. Widen to % 31 for ±15%.
    * (0.9 + (abs(hashtext(p_battle_run_id::text || p_round::text || p_actor || 'var')) % 21) / 100.0)

    -- CRIT MULTIPLIER: 1.5× on a critical hit (1.0 otherwise).
    -- Crit chance is computed upstream: (momentum × 15) / 10000
    --   → momentum=80 → 12% crit chance; momentum=100 → 15% max.
    -- Multiplier tuning range: 1.3–2.0 (above 2.0 feels swingy; below 1.3 crits feel pointless).
    * p_crit_multiplier

    -- STAGE MULTIPLIER: rewards creature evolution without making baby unplayable.
    -- baby=1.0 (baseline), adult=+15%, champion=+35%.
    -- Tuning: keep champion bonus ≤ 50% or it trivialises early arenas with an evolved creature.
    * case p_stage
        when 'adult'    then 1.15
        when 'champion' then 1.35
        else 1.0
      end

    -- NEXT-ATTACK BONUS: +60% multiplier banked by the Focus action (0 normally).
    -- Set to 0.60 by focus handler; consumed and reset to 0 on the next attack or focus.
    -- Tuning range: 0.40–0.80. Above 0.80, stacked Focus → Attack becomes a near-guaranteed KO.
    * (1.0 + p_next_attack_bonus)

    -- RESILIENCE MITIGATION: each resilience point blocks 0.4% of incoming damage.
    -- At resilience=100 → 40% blocked (multiplier floor: 0.60).
    -- Floor of 0.60 ensures even glass-cannon opponents deal at least 60% of raw damage.
    -- Tuning: 0.003–0.005 per point; don't let max mitigation exceed 50% (would reward turtling too hard).
    * greatest(0.60, 1.0 - p_resilience * 0.004)
  )::integer);
$$;


-- ─── 3. start_battle_run — player HP gains level × 2 bonus ───────────────────
-- Player HP = round(vitality × 0.7) + level × 2
-- Opponent HP stays at round(vitality × 0.7) — opponents are fixed, not leveling.
-- Full function copy required to change the HP init lines; progression gating unchanged.

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

  -- Player HP = round(vitality × 0.7) + level × 2
  -- Opponent HP = round(vitality × 0.7) — fixed opponents get no level scaling
  v_player_max_hp   := greatest(1, round(v_snapshot.vitality * 0.7)::integer) + v_snapshot.level * 2;
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


-- ─── 4. submit_battle_action — pass level/stage to damage; resilience-scaled defend
-- Changes from 016:
--   • All battle_compute_damage calls gain p_level and p_stage params
--     — player: snapshot.level, snapshot.stage
--     — opponent: recommended_level, 'baby' (no stage bonus for fixed opponents)
--   • Defend mitigation: fixed 0.5 → greatest(0.25, 0.58 - defender_resilience × 0.003)
--     — res=0: 42% reduction  res=50: 57% reduction  res=100: 72% reduction

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
