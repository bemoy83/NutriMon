-- Migration 071: hard safety guard — close battle as loss when player HP is already 0
--
-- After counter_stance deflection kills the player, v_battle_complete should
-- be set and status written to 'completed'. In practice this sometimes does not
-- happen (root cause unresolved across migrations 069–070). This migration adds
-- an unconditional guard at the TOP of submit_battle_action: if the row already
-- has player_current_hp = 0 when the next action arrives, immediately finalize
-- as a loss and return — no further processing. This is safe because the only
-- valid reason for player_current_hp = 0 in an active battle is a stuck finish.

do $$
declare
  v_function_sql text;
begin
  select pg_get_functiondef(oid)
  into   v_function_sql
  from   pg_proc
  where  proname = 'submit_battle_action'
    and  pronargs = 3;

  -- Idempotency: skip if already patched.
  if position('v_run.player_current_hp <= 0 and v_run.status' in v_function_sql) > 0 then return; end if;

  if position('if v_run.status <> ''active'' then' in v_function_sql) = 0 then
    raise exception 'Migration 071: status-check anchor not found';
  end if;

  v_function_sql := replace(
    v_function_sql,
    'if v_run.status <> ''active'' then',
    'if v_run.player_current_hp <= 0 and v_run.status = ''active'' then' || chr(10)
    || '    update public.battle_runs set status = ''completed'', outcome = ''loss'', completed_at = now() where id = p_battle_run_id;' || chr(10)
    || '    return public.battle_session_payload(p_battle_run_id);' || chr(10)
    || '  end if;' || chr(10)
    || chr(10)
    || '  if v_run.status <> ''active'' then'
  );

  execute v_function_sql;
end;
$$;
