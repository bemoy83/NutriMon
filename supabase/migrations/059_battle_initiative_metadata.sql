-- 059_battle_initiative_metadata.sql
-- Add structured turn-order metadata to initiative battle log entries.
--
-- The active submit_battle_action resolver was last replaced in migration 055.
-- Existing environments already migrated past 055 need this forward migration;
-- fresh database replays also get the same patch here after 055 is applied.

do $$
declare
  v_function_sql text;
  v_old_fragment text := $old$
    'id', gen_random_uuid(), 'round', v_current_round, 'phase', 'initiative',
    'actor', 'system', 'action', 'initiative',
    'damage', 0, 'target', null, 'target_hp_after', null,
$old$;
  v_new_fragment text := $new$
    'id', gen_random_uuid(), 'round', v_current_round, 'phase', 'initiative',
    'actor', 'system', 'action', 'initiative',
    'first_actor', case when v_player_goes_first then 'player' else 'opponent' end,
    'player_initiative', v_player_init,
    'opponent_initiative', v_enemy_init,
    'player_action', v_player_action,
    'opponent_action', v_enemy_action,
    'damage', 0, 'target', null, 'target_hp_after', null,
$new$;
begin
  select pg_get_functiondef('public.submit_battle_action(uuid,text,text)'::regprocedure)
  into v_function_sql;

  if v_function_sql is null then
    raise exception 'submit_battle_action(uuid,text,text) not found';
  end if;

  if position('''first_actor''' in v_function_sql) > 0 then
    return;
  end if;

  if position(v_old_fragment in v_function_sql) = 0 then
    raise exception 'Could not locate initiative log fragment in submit_battle_action';
  end if;

  execute replace(v_function_sql, v_old_fragment, v_new_fragment);
end;
$$;
