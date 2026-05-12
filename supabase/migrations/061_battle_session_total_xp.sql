-- 061_battle_session_total_xp.sql
-- Add total_xp to the battle_session_payload JSON so the client can compute
-- pre/post level without an extra round-trip.
--
-- total_xp = creature_total_xp(user_id) — cumulative XP including this battle's
-- xp_awarded, so the client can derive:
--   preBattleXp  = total_xp - xp_awarded
--   preLevel     = floor(preBattleXp / 100) + 1   (== snapshot.level when no prior same-day battles)
--   postLevel    = floor(total_xp    / 100) + 1
--   leveledUp    = reward_claimed && postLevel > preLevel

do $$
declare
  v_function_sql text;
  v_old_fragment text := $old$
    'companion',              row_to_json(cc)
  )
  from public.battle_runs r
$old$;
  v_new_fragment text := $new$
    'companion',              row_to_json(cc),
    'total_xp',               public.creature_total_xp(r.user_id)
  )
  from public.battle_runs r
$new$;
begin
  select pg_get_functiondef('public.battle_session_payload(uuid)'::regprocedure)
  into v_function_sql;

  if v_function_sql is null then
    raise exception 'battle_session_payload(uuid) not found';
  end if;

  if position('''total_xp''' in v_function_sql) > 0 then
    return;  -- already patched
  end if;

  if position(v_old_fragment in v_function_sql) = 0 then
    raise exception 'Could not locate companion fragment in battle_session_payload';
  end if;

  execute replace(v_function_sql, v_old_fragment, v_new_fragment);
end;
$$;
