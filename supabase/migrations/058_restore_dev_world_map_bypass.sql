-- 058_restore_dev_world_map_bypass.sql
-- Migration 057 replaced get_world_map to add size_class, but it was based on
-- the pre-dev-mode implementation and dropped the is_dev_account unlock bypass.
-- Restore that bypass while preserving size_class in the world map payload.

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
      o.size_class,
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
          where gate.user_id        = v_user_id
            and gate.opponent_id    = a.unlock_requires_boss_opponent_id
            and gate.reward_claimed = true
        )
      end as biome_unlocked,
      case
        when v_is_dev then null
        when a.unlock_requires_boss_opponent_id is not null
          and not exists (
            select 1 from public.battle_runs gate
            where gate.user_id        = v_user_id
              and gate.opponent_id    = a.unlock_requires_boss_opponent_id
              and gate.reward_claimed = true
          )
        then 'Defeat ' || boss_arena.boss_name || ' to unlock this biome.'
        when prev_o.id is not null
          and not exists (
            select 1 from public.battle_runs prior
            where prior.user_id     = v_user_id
              and prior.opponent_id = prev_o.id
              and prior.outcome     = 'win'
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
      where br.user_id        = v_user_id
        and br.opponent_id    = o.id
        and br.outcome        = 'win'
        and br.status         = 'completed'
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
      'size_class',                    n.size_class,
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
