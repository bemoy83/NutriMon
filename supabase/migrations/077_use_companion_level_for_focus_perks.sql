-- 077_use_companion_level_for_focus_perks.sql
--
-- Focus perk milestones are permanent companion-level unlocks, just like skill
-- unlocks. Migration 076 removed the snapshot-level skill gate, but pip cap and
-- focus gain still used snapshot.level. Patch submit_battle_action so same-day
-- level-ups can immediately grant the companion's focus perks too.

do $$
declare
  v_function_sql text;
  v_old_declare text := $old$
  v_companion_name     text;
$old$;
  v_new_declare text := $new$
  v_companion_name     text;
  v_companion_level    integer := 1;
$new$;
  v_old_perk_block text := $old$
  v_counter_pending := v_run.counter_pending;

  v_pip_cap    := case when v_snapshot.level >= 20 then 5
                       when v_snapshot.level >= 10 then 4
                       else 3 end;
  v_focus_gain := case when v_snapshot.level >= 12 then 2 else 1 end;

  select coalesce(name, 'Your companion') into v_companion_name
  from public.creature_companions where user_id = v_user_id;
$old$;
  v_new_perk_block text := $new$
  v_counter_pending := v_run.counter_pending;

  select coalesce(name, 'Your companion'), coalesce(level, v_snapshot.level, 1)
  into v_companion_name, v_companion_level
  from public.creature_companions
  where user_id = v_user_id;

  v_pip_cap    := case when v_companion_level >= 20 then 5
                       when v_companion_level >= 10 then 4
                       else 3 end;
  v_focus_gain := case when v_companion_level >= 12 then 2 else 1 end;
$new$;
begin
  select pg_get_functiondef('public.submit_battle_action(uuid,text,text)'::regprocedure)
  into v_function_sql;

  if v_function_sql is null then
    raise exception 'submit_battle_action(uuid,text,text) not found';
  end if;

  if position('v_companion_level' in v_function_sql) > 0 then
    return;
  end if;

  if position(v_old_declare in v_function_sql) = 0 then
    raise exception 'Could not locate companion declaration fragment';
  end if;

  if position(v_old_perk_block in v_function_sql) = 0 then
    raise exception 'Could not locate snapshot-level focus perk fragment';
  end if;

  v_function_sql := replace(v_function_sql, v_old_declare, v_new_declare);
  v_function_sql := replace(v_function_sql, v_old_perk_block, v_new_perk_block);

  execute v_function_sql;
end;
$$;
