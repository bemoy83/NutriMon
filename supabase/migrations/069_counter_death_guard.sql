-- Migration 069: suppress counter-hit log entry when player is already dead
--
-- Migration 065 attempted a larger refactor of the counter block that likely
-- failed to match due to pg_get_functiondef whitespace normalisation.
-- The idempotency guard ('v_deflect') now causes 065 to no-op on re-run.
--
-- The actual symptom: when the opponent's attack reduces player HP to 0 while
-- counter_stance is active, the counter-hit log entry is still appended.
-- The frontend processes that entry (playing attack animation + damage number
-- on the opponent) before the defeat modal can appear, effectively blocking it.
--
-- Fix: guard the log append with v_new_player_hp > 0.
-- The opponent HP reduction from the counter may still happen (harmless —
-- the completion check correctly resolves player-dies-first as a loss).

do $$
declare
  v_function_sql text;
  v_old_append   text;
  v_new_append   text;
begin
  select pg_get_functiondef(oid)
  into   v_function_sql
  from   pg_proc
  where  proname = 'submit_battle_action'
    and  pronargs = 3;

  -- Idempotency: skip if already patched.
  if position('v_counter_hit_damage > 0 and v_new_player_hp > 0' in v_function_sql) > 0 then return; end if;

  v_old_append := $old$
    -- Append counter-hit entry if the stance fired this iteration.
    if v_counter_hit_damage > 0 then
$old$;

  v_new_append := $new$
    -- Append counter-hit entry only if the stance fired and player survived.
    if v_counter_hit_damage > 0 and v_new_player_hp > 0 then
$new$;

  if position(v_old_append in v_function_sql) = 0 then
    raise exception 'Migration 069: counter-hit log append anchor not found';
  end if;

  v_function_sql := replace(v_function_sql, v_old_append, v_new_append);
  execute v_function_sql;
end;
$$;
