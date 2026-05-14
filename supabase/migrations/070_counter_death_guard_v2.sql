-- Migration 070: suppress counter-hit log entry when player is already dead (v2)
--
-- Migrations 065 and 069 used multi-line anchors that failed to match after
-- pg_get_functiondef normalized whitespace. This version uses a single-line
-- anchor that is whitespace-agnostic and guaranteed unique in the function.

do $$
declare
  v_function_sql text;
begin
  select pg_get_functiondef(oid)
  into   v_function_sql
  from   pg_proc
  where  proname = 'submit_battle_action'
    and  pronargs = 3;

  -- Idempotency.
  if position('v_counter_hit_damage > 0 and v_new_player_hp > 0' in v_function_sql) > 0 then return; end if;

  if position('if v_counter_hit_damage > 0 then' in v_function_sql) = 0 then
    raise exception 'Migration 070: counter-hit guard anchor not found';
  end if;

  v_function_sql := replace(
    v_function_sql,
    'if v_counter_hit_damage > 0 then',
    'if v_counter_hit_damage > 0 and v_new_player_hp > 0 then'
  );

  execute v_function_sql;
end;
$$;
