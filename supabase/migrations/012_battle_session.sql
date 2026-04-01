-- 012_battle_session.sql
-- Converts battle_runs into a persistent, turn-based session with HP tracking,
-- round-by-round log, and new RPCs for the interactive battle screen.

-- ─── 1. EXTEND battle_runs ───────────────────────────────────────────────────

alter table public.battle_runs
  add column status text not null default 'active'
    check (status in ('active', 'completed')),
  add column player_max_hp integer not null default 0,
  add column player_current_hp integer not null default 0,
  add column opponent_max_hp integer not null default 0,
  add column opponent_current_hp integer not null default 0,
  add column current_round integer not null default 1,
  add column battle_log jsonb not null default '[]'::jsonb,
  add column completed_at timestamptz;

-- All pre-existing rows are fully resolved runs — mark them completed.
update public.battle_runs set status = 'completed';

-- Partial index: active-run lookup is at most one row per user+date.
create index battle_runs_user_date_active
  on public.battle_runs (user_id, battle_date)
  where status = 'active';


-- ─── 2. DAMAGE HELPER ────────────────────────────────────────────────────────

create or replace function public.battle_compute_damage(
  p_battle_run_id uuid,
  p_round         integer,
  p_actor         text,
  p_strength      integer,
  p_momentum      integer,
  p_resilience    integer
)
returns integer
language sql
immutable
set search_path = public
as $$
  select greatest(1,
    round(p_strength * 0.35 + p_momentum * 0.10 - p_resilience * 0.20)::integer
    + ((abs(hashtext(p_battle_run_id::text || p_round::text || p_actor)) % 7) - 3)
  );
$$;


-- ─── 3. SESSION PAYLOAD HELPER ───────────────────────────────────────────────
-- Returns the full JSON shape shared by start_battle_run, get_battle_run, and
-- submit_battle_action.  Ownership is enforced via WHERE r.user_id = auth.uid().

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
    'snapshot',               row_to_json(s),
    'opponent',               row_to_json(o),
    'companion',              row_to_json(cc)
  )
  from public.battle_runs r
  join  public.creature_battle_snapshots s on s.id       = r.snapshot_id
  join  public.battle_opponents          o on o.id       = r.opponent_id
  left join public.creature_companions  cc on cc.user_id = r.user_id
  where r.id       = p_battle_run_id
    and r.user_id  = auth.uid()
$$;


-- ─── 4. start_battle_run (redesigned) ────────────────────────────────────────

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
  v_user_id    uuid;
  v_snapshot   public.creature_battle_snapshots;
  v_companion  public.creature_companions;
  v_opponent   public.battle_opponents;
  v_run        public.battle_runs;
  v_active_run public.battle_runs;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Validate snapshot ownership
  select * into v_snapshot
  from public.creature_battle_snapshots
  where id = p_snapshot_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Battle snapshot not found';
  end if;

  -- Fetch companion (used for unlock level check)
  select * into v_companion
  from public.creature_companions
  where user_id = v_user_id;

  -- Validate opponent is active
  select o.* into v_opponent
  from public.battle_opponents o
  join public.battle_arenas a on a.id = o.arena_id and a.is_active = true
  where o.id = p_opponent_id
    and o.is_active = true;

  if not found then
    raise exception 'Opponent not found';
  end if;

  -- Validate opponent is unlocked
  if v_opponent.unlock_level > coalesce(v_companion.level, v_snapshot.level, 1) then
    raise exception 'Opponent not unlocked';
  end if;

  -- Check for an existing active run for this user + battle_date
  select * into v_active_run
  from public.battle_runs
  where user_id    = v_user_id
    and battle_date = v_snapshot.battle_date
    and status     = 'active'
  limit 1;

  if found then
    if v_active_run.opponent_id = p_opponent_id then
      -- Same opponent: idempotent resume
      return public.battle_session_payload(v_active_run.id);
    else
      raise exception 'Finish your current battle before starting another.';
    end if;
  end if;

  -- Insert new active run
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
    v_snapshot.vitality,
    v_snapshot.vitality,
    v_opponent.vitality,
    v_opponent.vitality,
    1,
    '[]'::jsonb
  )
  returning * into v_run;

  return public.battle_session_payload(v_run.id);
end;
$$;


-- ─── 5. get_battle_run ───────────────────────────────────────────────────────

create or replace function public.get_battle_run(p_battle_run_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload json;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_payload := public.battle_session_payload(p_battle_run_id);

  if v_payload is null then
    raise exception 'Battle run not found';
  end if;

  return v_payload;
end;
$$;


-- ─── 6. submit_battle_action ─────────────────────────────────────────────────

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
  v_user_id           uuid;
  v_run               public.battle_runs;
  v_snapshot          public.creature_battle_snapshots;
  v_opponent          public.battle_opponents;
  v_companion_name    text;

  v_player_damage     integer;
  v_opponent_damage   integer;
  v_new_opponent_hp   integer;
  v_new_player_hp     integer;

  v_log_entry         jsonb;
  v_new_log           jsonb;

  v_status            text;
  v_outcome           text;
  v_turn_count        integer;
  v_remaining_hp_pct  integer;
  v_xp_awarded        integer := 0;
  v_arena_progress    integer := 0;
  v_reward_claimed    boolean := false;
  v_rewardable        boolean := false;
  v_completed_at      timestamptz;
  v_current_round     integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_action <> 'attack' then
    raise exception 'Unsupported action: %', p_action;
  end if;

  -- Lock the run row to serialise concurrent submissions
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

  v_current_round := v_run.current_round;
  v_new_log       := v_run.battle_log;

  -- ── Player attacks ─────────────────────────────────────────────────────────
  v_player_damage := public.battle_compute_damage(
    p_battle_run_id => p_battle_run_id,
    p_round         => v_current_round,
    p_actor         => 'player',
    p_strength      => v_snapshot.strength,
    p_momentum      => v_snapshot.momentum,
    p_resilience    => v_opponent.resilience
  );

  v_new_opponent_hp := greatest(0, v_run.opponent_current_hp - v_player_damage);

  v_log_entry := jsonb_build_object(
    'id',             gen_random_uuid(),
    'round',          v_current_round,
    'actor',          'player',
    'action',         'attack',
    'damage',         v_player_damage,
    'target',         'opponent',
    'target_hp_after', v_new_opponent_hp,
    'message',        v_companion_name || ' attacks for ' || v_player_damage || ' damage!'
  );
  v_new_log := v_new_log || v_log_entry;

  -- ── Did opponent die? ───────────────────────────────────────────────────────
  if v_new_opponent_hp <= 0 then
    v_status       := 'completed';
    v_outcome      := 'win';
    v_completed_at := now();
    v_turn_count   := v_current_round;
    v_remaining_hp_pct := greatest(0, least(100,
      round(v_run.player_current_hp * 100.0 / v_run.player_max_hp)::integer
    ));

    -- First rewarded win check
    select not exists (
      select 1 from public.battle_runs prior
      where prior.user_id    = v_user_id
        and prior.battle_date = v_run.battle_date
        and prior.opponent_id = v_run.opponent_id
        and prior.id         <> v_run.id
        and prior.reward_claimed = true
    ) into v_rewardable;

    if v_rewardable then
      v_xp_awarded     := 10 + v_opponent.recommended_level * 4;
      v_arena_progress := 1;
      v_reward_claimed := true;
    end if;

    v_log_entry := jsonb_build_object(
      'id',              gen_random_uuid(),
      'round',           v_current_round,
      'actor',           'system',
      'action',          'result',
      'damage',          0,
      'target',          null,
      'target_hp_after', null,
      'message',         'Victory!'
    );
    v_new_log := v_new_log || v_log_entry;

    v_new_player_hp := v_run.player_current_hp;

  else
    -- ── Opponent counterattacks ─────────────────────────────────────────────
    v_opponent_damage := public.battle_compute_damage(
      p_battle_run_id => p_battle_run_id,
      p_round         => v_current_round,
      p_actor         => 'opponent',
      p_strength      => v_opponent.strength,
      p_momentum      => v_opponent.momentum,
      p_resilience    => v_snapshot.resilience
    );

    v_new_player_hp := greatest(0, v_run.player_current_hp - v_opponent_damage);

    v_log_entry := jsonb_build_object(
      'id',              gen_random_uuid(),
      'round',           v_current_round,
      'actor',           'opponent',
      'action',          'attack',
      'damage',          v_opponent_damage,
      'target',          'player',
      'target_hp_after', v_new_player_hp,
      'message',         v_opponent.name || ' strikes back for ' || v_opponent_damage || ' damage!'
    );
    v_new_log := v_new_log || v_log_entry;

    -- ── Did player die? ─────────────────────────────────────────────────────
    if v_new_player_hp <= 0 then
      v_status       := 'completed';
      v_outcome      := 'loss';
      v_completed_at := now();
      v_turn_count   := v_current_round;
      v_remaining_hp_pct := 0;

      v_log_entry := jsonb_build_object(
        'id',              gen_random_uuid(),
        'round',           v_current_round,
        'actor',           'system',
        'action',          'result',
        'damage',          0,
        'target',          null,
        'target_hp_after', null,
        'message',         'Defeat...'
      );
      v_new_log := v_new_log || v_log_entry;

    else
      -- ── Battle continues ──────────────────────────────────────────────────
      v_status           := 'active';
      v_outcome          := v_run.outcome;
      v_completed_at     := null;
      v_turn_count       := v_run.turn_count;
      v_remaining_hp_pct := v_run.remaining_hp_pct;
      v_current_round    := v_current_round + 1;
    end if;
  end if;

  -- ── Persist ────────────────────────────────────────────────────────────────
  update public.battle_runs
  set
    status                 = v_status,
    outcome                = case when v_status = 'completed' then v_outcome     else outcome             end,
    player_current_hp      = v_new_player_hp,
    opponent_current_hp    = v_new_opponent_hp,
    current_round          = v_current_round,
    battle_log             = v_new_log,
    turn_count             = case when v_status = 'completed' then v_turn_count   else turn_count          end,
    remaining_hp_pct       = case when v_status = 'completed' then v_remaining_hp_pct else remaining_hp_pct end,
    xp_awarded             = case when v_status = 'completed' then v_xp_awarded   else xp_awarded          end,
    arena_progress_awarded = case when v_status = 'completed' then v_arena_progress else arena_progress_awarded end,
    reward_claimed         = case when v_status = 'completed' then v_reward_claimed else reward_claimed     end,
    completed_at           = case when v_status = 'completed' then v_completed_at  else completed_at        end
  where id = p_battle_run_id;

  return public.battle_session_payload(p_battle_run_id);
end;
$$;


-- ─── 7. get_battle_hub (updated) ─────────────────────────────────────────────
-- Adds active_battle_run field; filters history to completed runs only.

create or replace function public.get_battle_hub(p_battle_date date)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id           uuid;
  v_companion         json;
  v_snapshot          public.creature_battle_snapshots;
  v_recommended       json;
  v_unlocked          json := '[]'::json;
  v_history           json := '[]'::json;
  v_active_battle_run json;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select row_to_json(c)
  into v_companion
  from public.creature_companions c
  where c.user_id = v_user_id;

  select *
  into v_snapshot
  from public.creature_battle_snapshots
  where user_id    = v_user_id
    and battle_date = p_battle_date;

  if found then
    v_recommended := public.creature_recommended_opponent(
      v_snapshot.id,
      coalesce((v_companion->>'level')::integer, v_snapshot.level)
    );
  end if;

  select coalesce(json_agg(row_to_json(opponent_row) order by opponent_row.sort_order asc), '[]'::json)
  into v_unlocked
  from (
    select o.*
    from public.battle_opponents o
    join public.battle_arenas a on a.id = o.arena_id and a.is_active = true
    where o.is_active     = true
      and o.unlock_level <= coalesce((v_companion->>'level')::integer, 1)
    order by o.sort_order asc
  ) opponent_row;

  select coalesce(json_agg(
    json_build_object(
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
      'opponent',               row_to_json(o)
    )
    order by r.created_at desc
  ), '[]'::json)
  into v_history
  from public.battle_runs r
  join public.battle_opponents o on o.id = r.opponent_id
  where r.user_id     = v_user_id
    and r.battle_date = p_battle_date
    and r.status      = 'completed';

  -- Active run for the battle date (at most one per user+date)
  select public.battle_session_payload(r.id)
  into v_active_battle_run
  from public.battle_runs r
  where r.user_id     = v_user_id
    and r.battle_date = p_battle_date
    and r.status      = 'active'
  limit 1;

  return json_build_object(
    'companion',         v_companion,
    'snapshot',          case when v_snapshot.id is null then null else row_to_json(v_snapshot) end,
    'recommended_opponent', v_recommended,
    'unlocked_opponents', v_unlocked,
    'battle_history',    v_history,
    'active_battle_run', v_active_battle_run
  );
end;
$$;
