-- 051_dev_mode.sql
-- Developer account bypass for progression locks.
--
-- Adds is_dev_account to profiles. When true for the calling user:
--   • get_world_map / get_arena_list / get_arena_detail / get_battle_hub
--     return all opponents and arenas as fully unlocked / challengeable.
--   • start_battle_run skips the sequential progression gate.
--   • ensure_dev_battle_snapshot creates a synthetic peak-stats snapshot
--     so battles can proceed without a real finalized day.
--
-- source_daily_evaluation_id is made nullable to allow the synthetic snapshot.

-- ── Schema ───────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists is_dev_account boolean not null default false;

alter table public.creature_battle_snapshots
  alter column source_daily_evaluation_id drop not null;

-- ── ensure_dev_battle_snapshot ───────────────────────────────────────────────
-- Upserts a synthetic snapshot with peak stats for a dev account.
-- No-ops if a snapshot already exists for the given battle_date.
-- Returns the snapshot row as JSON.

create or replace function public.ensure_dev_battle_snapshot(p_battle_date date)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid;
  v_is_dev   boolean;
  v_companion public.creature_companions;
  v_snapshot  public.creature_battle_snapshots;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select is_dev_account into v_is_dev
  from public.profiles
  where user_id = v_user_id;

  if not coalesce(v_is_dev, false) then
    raise exception 'Dev account required';
  end if;

  select * into v_snapshot
  from public.creature_battle_snapshots
  where user_id = v_user_id
    and battle_date = p_battle_date;

  if found then
    return row_to_json(v_snapshot);
  end if;

  select * into v_companion
  from public.creature_companions
  where user_id = v_user_id;

  insert into public.creature_battle_snapshots (
    user_id,
    prep_date,
    battle_date,
    strength,
    resilience,
    momentum,
    vitality,
    readiness_score,
    readiness_band,
    condition,
    level,
    stage,
    source_daily_evaluation_id,
    xp_gained
  ) values (
    v_user_id,
    p_battle_date - 1,
    p_battle_date,
    100,
    100,
    100,
    100,
    100,
    'peak',
    'thriving',
    coalesce(v_companion.level, 1),
    coalesce(v_companion.stage, 'baby'),
    null,
    0
  )
  returning * into v_snapshot;

  return row_to_json(v_snapshot);
end;
$$;

-- ── get_world_map (replaces 049) ─────────────────────────────────────────────

create or replace function public.get_world_map(p_battle_date date)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id  uuid;
  v_is_dev   boolean;
  v_companion json;
  v_snapshot  json;
  v_nodes     json;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select is_dev_account into v_is_dev
  from public.profiles
  where user_id = v_user_id;
  v_is_dev := coalesce(v_is_dev, false);

  select row_to_json(c)
  into v_companion
  from public.creature_companions c
  where c.user_id = v_user_id;

  select row_to_json(s)
  into v_snapshot
  from public.creature_battle_snapshots s
  where s.user_id    = v_user_id
    and s.battle_date = p_battle_date;

  with nodes as (
    select
      o.id,
      o.name,
      o.arena_id,
      a.arena_key,
      a.sort_order  as arena_sort_order,
      a.name        as arena_name,
      o.sort_order,
      o.is_arena_boss,
      lw.turn_count           as rewarded_win_turn_count,
      lw.remaining_hp_pct     as rewarded_win_remaining_hp_pct,
      lw.xp_awarded           as rewarded_win_xp_awarded,
      exists (
        select 1 from public.battle_runs own
        where own.user_id     = v_user_id
          and own.opponent_id = o.id
          and own.outcome     = 'win'
      ) as is_defeated,
      case
        when v_is_dev then true
        when prev_o.id is null then true
        else exists (
          select 1 from public.battle_runs prior
          where prior.user_id    = v_user_id
            and prior.opponent_id = prev_o.id
            and prior.outcome    = 'win'
        )
      end as within_biome_challengeable,
      case
        when v_is_dev then true
        when a.unlock_requires_boss_opponent_id is null then true
        else exists (
          select 1 from public.battle_runs gate
          where gate.user_id      = v_user_id
            and gate.opponent_id  = a.unlock_requires_boss_opponent_id
            and gate.reward_claimed = true
        )
      end as biome_unlocked,
      case
        when v_is_dev then null
        when a.unlock_requires_boss_opponent_id is not null
          and not exists (
            select 1 from public.battle_runs gate
            where gate.user_id      = v_user_id
              and gate.opponent_id  = a.unlock_requires_boss_opponent_id
              and gate.reward_claimed = true
          )
        then 'Defeat ' || boss_arena.boss_name || ' to unlock this biome.'
        when prev_o.id is not null
          and not exists (
            select 1 from public.battle_runs prior
            where prior.user_id    = v_user_id
              and prior.opponent_id = prev_o.id
              and prior.outcome    = 'win'
          )
        then 'Beat ' || prev_o.name || ' first.'
        else null
      end as lock_reason
    from public.battle_opponents o
    join public.battle_arenas a
      on  a.id        = o.arena_id
      and a.is_active = true
    left join public.battle_opponents prev_o
      on  prev_o.arena_id   = o.arena_id
      and prev_o.sort_order = o.sort_order - 1
      and prev_o.is_active  = true
    left join lateral (
      select boss.name as boss_name
      from public.battle_opponents boss
      where boss.id = a.unlock_requires_boss_opponent_id
    ) boss_arena on true
    left join lateral (
      select br.turn_count, br.remaining_hp_pct, br.xp_awarded
      from public.battle_runs br
      where br.user_id      = v_user_id
        and br.opponent_id  = o.id
        and br.outcome      = 'win'
        and br.status       = 'completed'
        and br.reward_claimed = true
      order by br.created_at asc
      limit 1
    ) lw on true
    where o.is_active = true
  )
  select coalesce(json_agg(
    json_build_object(
      'id',                            n.id,
      'name',                          n.name,
      'arena_id',                      n.arena_id,
      'arena_key',                     n.arena_key,
      'arena_sort_order',              n.arena_sort_order,
      'arena_name',                    n.arena_name,
      'sort_order',                    n.sort_order,
      'is_arena_boss',                 n.is_arena_boss,
      'is_defeated',                   n.is_defeated,
      'is_challengeable',              n.within_biome_challengeable and n.biome_unlocked,
      'lock_reason',                   n.lock_reason,
      'rewarded_win_turn_count',       n.rewarded_win_turn_count,
      'rewarded_win_remaining_hp_pct', n.rewarded_win_remaining_hp_pct,
      'rewarded_win_xp_awarded',       n.rewarded_win_xp_awarded
    )
    order by n.arena_sort_order asc, n.sort_order asc
  ), '[]'::json)
  into v_nodes
  from nodes n;

  return json_build_object(
    'companion', v_companion,
    'snapshot',  v_snapshot,
    'nodes',     v_nodes
  );
end;
$$;

-- ── get_arena_list (replaces 020) ────────────────────────────────────────────

create or replace function public.get_arena_list(p_battle_date date)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id   uuid;
  v_is_dev    boolean;
  v_companion json;
  v_snapshot  json;
  v_arenas    json;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select is_dev_account into v_is_dev
  from public.profiles
  where user_id = v_user_id;
  v_is_dev := coalesce(v_is_dev, false);

  select row_to_json(c)
  into v_companion
  from public.creature_companions c
  where c.user_id = v_user_id;

  select row_to_json(s)
  into v_snapshot
  from public.creature_battle_snapshots s
  where s.user_id = v_user_id
    and s.battle_date = p_battle_date;

  select coalesce(json_agg(
    json_build_object(
      'id',                                  a.id,
      'arena_key',                           a.arena_key,
      'name',                                a.name,
      'description',                         a.description,
      'sort_order',                          a.sort_order,
      'is_active',                           a.is_active,
      'unlock_requires_boss_opponent_id',    a.unlock_requires_boss_opponent_id,
      'unlock_boss_name', (
        select o.name from public.battle_opponents o
        where o.id = a.unlock_requires_boss_opponent_id
      ),
      'map_x',                               a.map_x,
      'map_y',                               a.map_y,
      'created_at',                          a.created_at,
      'opponent_count', (
        select count(*) from public.battle_opponents o
        where o.arena_id = a.id and o.is_active = true
      ),
      'defeated_count', (
        select count(distinct o.id)
        from public.battle_opponents o
        join public.battle_runs br
          on br.opponent_id = o.id
         and br.user_id     = v_user_id
         and br.outcome     = 'win'
        where o.arena_id   = a.id
          and o.is_active  = true
      ),
      'is_unlocked', case
        when v_is_dev then true
        when a.unlock_requires_boss_opponent_id is null then true
        else exists (
          select 1 from public.battle_runs br
          where br.user_id      = v_user_id
            and br.opponent_id  = a.unlock_requires_boss_opponent_id
            and br.reward_claimed = true
        )
      end,
      'has_active_run', exists (
        select 1
        from public.battle_runs br
        join public.battle_opponents o on o.id = br.opponent_id
        where br.user_id  = v_user_id
          and o.arena_id  = a.id
          and br.status   = 'active'
      )
    )
    order by a.sort_order asc
  ), '[]'::json)
  into v_arenas
  from public.battle_arenas a
  where a.is_active = true;

  return json_build_object(
    'companion', v_companion,
    'snapshot',  v_snapshot,
    'arenas',    v_arenas
  );
end;
$$;

-- ── get_arena_detail (replaces 020) ──────────────────────────────────────────

create or replace function public.get_arena_detail(
  p_arena_id    uuid,
  p_battle_date date
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id         uuid;
  v_is_dev          boolean;
  v_companion       json;
  v_snapshot        public.creature_battle_snapshots;
  v_recommended     json;
  v_arena_opponents json := '[]'::json;
  v_active_run      json;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select is_dev_account into v_is_dev
  from public.profiles
  where user_id = v_user_id;
  v_is_dev := coalesce(v_is_dev, false);

  select row_to_json(c)
  into v_companion
  from public.creature_companions c
  where c.user_id = v_user_id;

  select *
  into v_snapshot
  from public.creature_battle_snapshots
  where user_id    = v_user_id
    and battle_date = p_battle_date;

  with opponent_rows as (
    select
      o.*,
      prev.id   as required_previous_opponent_id,
      prev.name as required_previous_opponent_name,
      lw.turn_count           as rewarded_win_turn_count,
      lw.remaining_hp_pct     as rewarded_win_remaining_hp_pct,
      lw.xp_awarded           as rewarded_win_xp_awarded,
      exists (
        select 1 from public.battle_runs own
        where own.user_id    = v_user_id
          and own.opponent_id = o.id
          and own.outcome    = 'win'
      ) as is_defeated,
      case
        when v_is_dev then true
        when prev.id is null then true
        else exists (
          select 1 from public.battle_runs prior
          where prior.user_id    = v_user_id
            and prior.opponent_id = prev.id
            and prior.outcome    = 'win'
        )
      end as is_challengeable
    from public.battle_opponents o
    left join public.battle_opponents prev
      on  prev.arena_id   = o.arena_id
      and prev.sort_order = o.sort_order - 1
      and prev.is_active  = true
    left join lateral (
      select br.turn_count, br.remaining_hp_pct, br.xp_awarded
      from public.battle_runs br
      where br.user_id      = v_user_id
        and br.opponent_id  = o.id
        and br.outcome      = 'win'
        and br.status       = 'completed'
        and br.reward_claimed = true
      order by br.created_at asc
      limit 1
    ) lw on true
    where o.arena_id  = p_arena_id
      and o.is_active = true
  ),
  opponent_rows_with_reason as (
    select
      *,
      case
        when is_challengeable then null
        when required_previous_opponent_name is not null
          then 'Beat ' || required_previous_opponent_name || ' first.'
        else null
      end as lock_reason
    from opponent_rows
  )
  select coalesce(
    json_agg(row_to_json(r) order by r.sort_order asc),
    '[]'::json
  )
  into v_arena_opponents
  from opponent_rows_with_reason r;

  if v_snapshot.id is not null then
    with challenger_rows as (
      select
        o.*,
        exists (
          select 1 from public.battle_runs own
          where own.user_id    = v_user_id
            and own.opponent_id = o.id
            and own.outcome    = 'win'
        ) as is_defeated,
        case
          when v_is_dev then true
          when prev.id is null then true
          else exists (
            select 1 from public.battle_runs prior
            where prior.user_id    = v_user_id
              and prior.opponent_id = prev.id
              and prior.outcome    = 'win'
          )
        end as is_challengeable
      from public.battle_opponents o
      left join public.battle_opponents prev
        on  prev.arena_id   = o.arena_id
        and prev.sort_order = o.sort_order - 1
        and prev.is_active  = true
      where o.arena_id  = p_arena_id
        and o.is_active = true
    )
    select json_build_object(
      'opponent_id',       id,
      'name',              name,
      'archetype',         archetype,
      'recommended_level', recommended_level,
      'likely_outcome',    public.creature_likely_outcome(
        v_snapshot.strength,   v_snapshot.resilience,
        v_snapshot.momentum,   v_snapshot.vitality,
        v_snapshot.level,      v_snapshot.stage,
        strength,              resilience,
        momentum,              vitality,
        recommended_level
      )
    )
    into v_recommended
    from challenger_rows
    where is_challengeable = true
    order by
      case when is_defeated then 1 else 0 end asc,
      sort_order asc
    limit 1;
  end if;

  select public.battle_session_payload(r.id)
  into v_active_run
  from public.battle_runs r
  join public.battle_opponents o on o.id = r.opponent_id
  where r.user_id    = v_user_id
    and r.battle_date = p_battle_date
    and r.status     = 'active'
    and o.arena_id   = p_arena_id
  limit 1;

  return json_build_object(
    'companion',             v_companion,
    'snapshot',              case when v_snapshot.id is null then null else row_to_json(v_snapshot) end,
    'recommended_opponent',  v_recommended,
    'arena_opponents',       v_arena_opponents,
    'battle_history',        '[]'::json,
    'active_battle_run',     v_active_run
  );
end;
$$;

-- ── get_battle_hub (replaces 018) ────────────────────────────────────────────

create or replace function public.get_battle_hub(p_battle_date date)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id           uuid;
  v_is_dev            boolean;
  v_companion         json;
  v_snapshot          public.creature_battle_snapshots;
  v_recommended       json;
  v_arena_opponents   json := '[]'::json;
  v_history           json := '[]'::json;
  v_active_battle_run json;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select is_dev_account into v_is_dev
  from public.profiles
  where user_id = v_user_id;
  v_is_dev := coalesce(v_is_dev, false);

  select row_to_json(c)
  into v_companion
  from public.creature_companions c
  where c.user_id = v_user_id;

  select *
  into v_snapshot
  from public.creature_battle_snapshots
  where user_id    = v_user_id
    and battle_date = p_battle_date;

  with opponent_rows as (
    select
      o.*,
      prev.id   as required_previous_opponent_id,
      prev.name as required_previous_opponent_name,
      lw.turn_count           as rewarded_win_turn_count,
      lw.remaining_hp_pct     as rewarded_win_remaining_hp_pct,
      lw.xp_awarded           as rewarded_win_xp_awarded,
      exists (
        select 1 from public.battle_runs own
        where own.user_id    = v_user_id
          and own.opponent_id = o.id
          and own.outcome    = 'win'
      ) as is_defeated,
      case
        when v_is_dev then true
        when prev.id is null then true
        else exists (
          select 1 from public.battle_runs prior
          where prior.user_id    = v_user_id
            and prior.opponent_id = prev.id
            and prior.outcome    = 'win'
        )
      end as is_challengeable
    from public.battle_opponents o
    join public.battle_arenas a on a.id = o.arena_id and a.is_active = true
    left join public.battle_opponents prev
      on  prev.arena_id   = o.arena_id
      and prev.sort_order = o.sort_order - 1
      and prev.is_active  = true
    left join lateral (
      select br.turn_count, br.remaining_hp_pct, br.xp_awarded
      from public.battle_runs br
      where br.user_id      = v_user_id
        and br.opponent_id  = o.id
        and br.outcome      = 'win'
        and br.status       = 'completed'
        and br.reward_claimed = true
      order by br.created_at asc
      limit 1
    ) lw on true
    where o.is_active = true
      and a.arena_key = 'arena_1'
  ),
  opponent_rows_with_reason as (
    select
      *,
      case
        when is_challengeable then null
        when required_previous_opponent_name is not null
          then 'Beat ' || required_previous_opponent_name || ' first.'
        else null
      end as lock_reason
    from opponent_rows
  )
  select coalesce(json_agg(row_to_json(r) order by r.sort_order asc), '[]'::json)
  into v_arena_opponents
  from opponent_rows_with_reason r;

  if v_snapshot.id is not null then
    with opponent_rows as (
      select
        o.*,
        exists (
          select 1 from public.battle_runs own
          where own.user_id    = v_user_id
            and own.opponent_id = o.id
            and own.outcome    = 'win'
        ) as is_defeated,
        case
          when v_is_dev then true
          when prev.id is null then true
          else exists (
            select 1 from public.battle_runs prior
            where prior.user_id    = v_user_id
              and prior.opponent_id = prev.id
              and prior.outcome    = 'win'
          )
        end as is_challengeable
      from public.battle_opponents o
      join public.battle_arenas a on a.id = o.arena_id and a.is_active = true
      left join public.battle_opponents prev
        on  prev.arena_id   = o.arena_id
        and prev.sort_order = o.sort_order - 1
        and prev.is_active  = true
      where o.is_active = true
        and a.arena_key = 'arena_1'
    )
    select json_build_object(
      'opponent_id',       id,
      'name',              name,
      'archetype',         archetype,
      'recommended_level', recommended_level,
      'likely_outcome',    public.creature_likely_outcome(
        v_snapshot.strength,
        v_snapshot.resilience,
        v_snapshot.momentum,
        v_snapshot.vitality,
        v_snapshot.level,
        v_snapshot.stage,
        strength,
        resilience,
        momentum,
        vitality,
        recommended_level
      )
    )
    into v_recommended
    from opponent_rows
    where is_challengeable = true
    order by
      case when is_defeated then 1 else 0 end asc,
      sort_order asc
    limit 1;
  end if;

  select coalesce(json_agg(
    json_build_object(
      'id',                    r.id,
      'user_id',               r.user_id,
      'battle_date',           r.battle_date,
      'snapshot_id',           r.snapshot_id,
      'opponent_id',           r.opponent_id,
      'outcome',               r.outcome,
      'turn_count',            r.turn_count,
      'remaining_hp_pct',      r.remaining_hp_pct,
      'xp_awarded',            r.xp_awarded,
      'arena_progress_awarded', r.arena_progress_awarded,
      'reward_claimed',        r.reward_claimed,
      'created_at',            r.created_at,
      'opponent',              row_to_json(o)
    )
    order by r.created_at desc
  ), '[]'::json)
  into v_history
  from public.battle_runs r
  join public.battle_opponents o on o.id = r.opponent_id
  where r.user_id    = v_user_id
    and r.battle_date = p_battle_date
    and r.status     = 'completed';

  select public.battle_session_payload(r.id)
  into v_active_battle_run
  from public.battle_runs r
  where r.user_id    = v_user_id
    and r.battle_date = p_battle_date
    and r.status     = 'active'
  limit 1;

  return json_build_object(
    'companion',           v_companion,
    'snapshot',            case when v_snapshot.id is null then null else row_to_json(v_snapshot) end,
    'recommended_opponent', v_recommended,
    'arena_opponents',     v_arena_opponents,
    'battle_history',      v_history,
    'active_battle_run',   v_active_battle_run
  );
end;
$$;

-- ── start_battle_run (replaces 017) ──────────────────────────────────────────

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
  v_is_dev            boolean;
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

  select is_dev_account into v_is_dev
  from public.profiles
  where user_id = v_user_id;
  v_is_dev := coalesce(v_is_dev, false);

  select * into v_snapshot
  from public.creature_battle_snapshots
  where id      = p_snapshot_id
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
  where o.id        = p_opponent_id
    and o.is_active = true;

  if not found then
    raise exception 'Opponent not found';
  end if;

  -- Sequential progression gate — skipped for dev accounts
  if not v_is_dev then
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
