-- Migration 066: counter_stance always wins initiative
--
-- If the player uses counter_stance, v_player_goes_first is forced true
-- regardless of momentum rolls. This ensures the stance is always set
-- before the opponent acts that turn, making the skill reliably useful
-- against high-momentum opponents that normally strike first.

do $$
declare
  v_function_sql text;
  v_old_init     text;
  v_new_init     text;
begin
  select pg_get_functiondef(oid)
  into   v_function_sql
  from   pg_proc
  where  proname = 'submit_battle_action'
    and  pronargs = 3;

  -- Idempotency: skip if already patched.
  if position('-- counter_stance: always wins initiative' in v_function_sql) > 0 then return; end if;

  v_old_init := $old$
  v_player_goes_first := v_player_init >= v_enemy_init;

  v_new_log := v_new_log || jsonb_build_object(
$old$;

  v_new_init := $new$
  v_player_goes_first := v_player_init >= v_enemy_init;
  -- counter_stance: always wins initiative — ensures the stance is set before
  -- the opponent can attack this turn, regardless of momentum.
  if p_action = 'skill' and p_skill_id = 'counter_stance' then
    v_player_goes_first := true;
  end if;

  v_new_log := v_new_log || jsonb_build_object(
$new$;

  if position(v_old_init in v_function_sql) = 0 then
    raise exception 'Migration 066: initiative anchor not found';
  end if;

  v_function_sql := replace(v_function_sql, v_old_init, v_new_init);
  execute v_function_sql;
end;
$$;
