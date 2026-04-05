-- Attach XP-rewarding win stats per arena opponent in get_battle_hub (for defeated-card UI).
-- Uses the first completed win with reward_claimed (practice wins excluded).

create or replace function public.get_battle_hub(p_battle_date date)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_companion json;
  v_snapshot public.creature_battle_snapshots;
  v_recommended json;
  v_arena_opponents json := '[]'::json;
  v_history json := '[]'::json;
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
  where user_id = v_user_id
    and battle_date = p_battle_date;

  with opponent_rows as (
    select
      o.*,
      prev.id as required_previous_opponent_id,
      prev.name as required_previous_opponent_name,
      lw.turn_count as rewarded_win_turn_count,
      lw.remaining_hp_pct as rewarded_win_remaining_hp_pct,
      lw.xp_awarded as rewarded_win_xp_awarded,
      exists (
        select 1
        from public.battle_runs own
        where own.user_id = v_user_id
          and own.opponent_id = o.id
          and own.outcome = 'win'
      ) as is_defeated,
      case
        when prev.id is null then true
        else exists (
          select 1
          from public.battle_runs prior
          where prior.user_id = v_user_id
            and prior.opponent_id = prev.id
            and prior.outcome = 'win'
        )
      end as is_challengeable
    from public.battle_opponents o
    join public.battle_arenas a on a.id = o.arena_id and a.is_active = true
    left join public.battle_opponents prev
      on prev.arena_id = o.arena_id
     and prev.sort_order = o.sort_order - 1
     and prev.is_active = true
    left join lateral (
      select br.turn_count, br.remaining_hp_pct, br.xp_awarded
      from public.battle_runs br
      where br.user_id = v_user_id
        and br.opponent_id = o.id
        and br.outcome = 'win'
        and br.status = 'completed'
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
        when required_previous_opponent_name is not null then 'Beat ' || required_previous_opponent_name || ' first.'
        else null
      end as lock_reason
    from opponent_rows
  )
  select coalesce(json_agg(row_to_json(opponent_row) order by opponent_row.sort_order asc), '[]'::json)
  into v_arena_opponents
  from opponent_rows_with_reason opponent_row;

  if v_snapshot.id is not null then
    with opponent_rows as (
      select
        o.*,
        exists (
          select 1
          from public.battle_runs own
          where own.user_id = v_user_id
            and own.opponent_id = o.id
            and own.outcome = 'win'
        ) as is_defeated,
        case
          when prev.id is null then true
          else exists (
            select 1
            from public.battle_runs prior
            where prior.user_id = v_user_id
              and prior.opponent_id = prev.id
              and prior.outcome = 'win'
          )
        end as is_challengeable
      from public.battle_opponents o
      join public.battle_arenas a on a.id = o.arena_id and a.is_active = true
      left join public.battle_opponents prev
        on prev.arena_id = o.arena_id
       and prev.sort_order = o.sort_order - 1
       and prev.is_active = true
      where o.is_active = true
        and a.arena_key = 'arena_1'
    )
    select json_build_object(
      'opponent_id', id,
      'name', name,
      'archetype', archetype,
      'recommended_level', recommended_level,
      'likely_outcome', public.creature_likely_outcome(
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
      'id', r.id,
      'user_id', r.user_id,
      'battle_date', r.battle_date,
      'snapshot_id', r.snapshot_id,
      'opponent_id', r.opponent_id,
      'outcome', r.outcome,
      'turn_count', r.turn_count,
      'remaining_hp_pct', r.remaining_hp_pct,
      'xp_awarded', r.xp_awarded,
      'arena_progress_awarded', r.arena_progress_awarded,
      'reward_claimed', r.reward_claimed,
      'created_at', r.created_at,
      'opponent', row_to_json(o)
    )
    order by r.created_at desc
  ), '[]'::json)
  into v_history
  from public.battle_runs r
  join public.battle_opponents o on o.id = r.opponent_id
  where r.user_id = v_user_id
    and r.battle_date = p_battle_date
    and r.status = 'completed';

  select public.battle_session_payload(r.id)
  into v_active_battle_run
  from public.battle_runs r
  where r.user_id = v_user_id
    and r.battle_date = p_battle_date
    and r.status = 'active'
  limit 1;

  return json_build_object(
    'companion', v_companion,
    'snapshot', case when v_snapshot.id is null then null else row_to_json(v_snapshot) end,
    'recommended_opponent', v_recommended,
    'arena_opponents', v_arena_opponents,
    'battle_history', v_history,
    'active_battle_run', v_active_battle_run
  );
end;
$$;
