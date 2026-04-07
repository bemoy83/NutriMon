-- Multi-arena expansion: boss flags, unlock chain, world-map coordinates,
-- arena seeding, and new RPCs (get_arena_list, get_arena_detail).

-- ── Schema changes ────────────────────────────────────────────────────────────

-- Mark the final boss of each arena on the opponent row
alter table public.battle_opponents
  add column if not exists is_arena_boss boolean not null default false;

-- Sunscale Drake is the Arena 1 final boss
update public.battle_opponents
  set is_arena_boss = true
  where name = 'Sunscale Drake';

-- Pointer from arena → the boss that must be defeated to unlock it
alter table public.battle_arenas
  add column if not exists unlock_requires_boss_opponent_id uuid null
    references public.battle_opponents(id) on delete set null;

-- World-map node positions (nullable until the map UI is built)
alter table public.battle_arenas
  add column if not exists map_x numeric null;
alter table public.battle_arenas
  add column if not exists map_y numeric null;

-- Seed Arena 2 and Arena 3 (no opponents yet — content ships in Phase 3)
insert into public.battle_arenas (arena_key, name, description, sort_order, is_active)
values
  ('arena_2', 'Ashrock Peaks',      'Volcanic mountain arena for battle-hardened companions.',   2, true),
  ('arena_3', 'Crystalspire Vault', 'Ancient prestige arena for only the strongest companions.', 3, true)
on conflict (arena_key) do nothing;

-- Wire Arena 2 unlock: requires defeating Sunscale Drake (Arena 1 boss)
update public.battle_arenas
  set unlock_requires_boss_opponent_id = (
    select id from public.battle_opponents where name = 'Sunscale Drake' limit 1
  )
  where arena_key = 'arena_2'
    and unlock_requires_boss_opponent_id is null;

-- Arena 3 unlock wired in Phase 3 migration once Arena 2 opponents are seeded.


-- ── get_arena_list RPC ────────────────────────────────────────────────────────
-- Returns companion, today's snapshot, and all active arenas with aggregated
-- per-user state (defeated count, unlock status, active run presence).
-- Called by BattleHubPage via useArenaList.

create or replace function public.get_arena_list(p_battle_date date)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_companion json;
  v_snapshot json;
  v_arenas json;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

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


-- ── get_arena_detail RPC ──────────────────────────────────────────────────────
-- Per-arena equivalent of get_battle_hub. Parameterised by arena_id + battle_date.
-- Returns companion, snapshot, recommended opponent, opponents with win summaries,
-- and active battle run. Return shape matches BattleHubRow so the same mapper works.

create or replace function public.get_arena_detail(
  p_arena_id   uuid,
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

  select row_to_json(c)
  into v_companion
  from public.creature_companions c
  where c.user_id = v_user_id;

  select *
  into v_snapshot
  from public.creature_battle_snapshots
  where user_id    = v_user_id
    and battle_date = p_battle_date;

  -- Opponents with win summaries and lock state
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

  -- Recommended opponent (only if a snapshot is available)
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

  -- Active battle run scoped to this arena
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
    'companion',           v_companion,
    'snapshot',            case when v_snapshot.id is null then null else row_to_json(v_snapshot) end,
    'recommended_opponent', v_recommended,
    'arena_opponents',     v_arena_opponents,
    'battle_history',      '[]'::json,
    'active_battle_run',   v_active_run
  );
end;
$$;
