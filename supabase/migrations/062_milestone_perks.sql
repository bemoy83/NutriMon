-- 062_milestone_perks.sql
-- Milestone passive perks — level-specific pip mechanics unlocks.
--
--   Level  5: focus pip cap raised 3 → 4.
--   Level 12: Focus action grants 2 pips instead of 1.
--
-- Enemy focus remains capped at 3 with a +1 gain; perks are player-only.
-- Frontend mirrors these thresholds via src/lib/battlePerks.ts.

do $$
declare
  v_function_sql text;

  -- ── Fragment 1: declare block — add pip perk vars ─────────────────────────
  -- Anchor on the last var added by migration 060.
  v_old_decl text := $old$
  v_defender_level         integer := 1;
$old$;

  v_new_decl text := $new$
  v_defender_level         integer := 1;
  v_pip_cap                integer;
  v_focus_gain             integer;
$new$;

  -- ── Fragment 2: after level-unlock validation — compute perk values ────────
  v_old_post_unlock text := $old$
    if v_snapshot.level < v_skill_unlock_level then
      raise exception 'Skill % requires level % (current level: %)',
        p_skill_id, v_skill_unlock_level, v_snapshot.level;
    end if;
  end if;
$old$;

  v_new_post_unlock text := $new$
    if v_snapshot.level < v_skill_unlock_level then
      raise exception 'Skill % requires level % (current level: %)',
        p_skill_id, v_skill_unlock_level, v_snapshot.level;
    end if;
  end if;

  -- Milestone perk: level 5 raises pip cap; level 12 boosts focus gain.
  -- Mirrors PERK_THRESHOLDS in src/lib/battlePerks.ts.
  v_pip_cap    := case when v_snapshot.level >= 5  then 4 else 3 end;
  v_focus_gain := case when v_snapshot.level >= 12 then 2 else 1 end;
$new$;

  -- ── Fragment 3: focus action — player branch uses perk values ─────────────
  v_old_focus text := $old$
        if v_actor = 'player' then
          v_player_focus_pips := least(3, v_player_focus_pips + 1);
        else
          v_enemy_focus_pips := least(3, v_enemy_focus_pips + 1);
        end if;
$old$;

  v_new_focus text := $new$
        if v_actor = 'player' then
          v_player_focus_pips := least(v_pip_cap, v_player_focus_pips + v_focus_gain);
        else
          v_enemy_focus_pips := least(3, v_enemy_focus_pips + 1);
        end if;
$new$;

begin
  select pg_get_functiondef('public.submit_battle_action(uuid,text,text)'::regprocedure)
  into v_function_sql;

  if v_function_sql is null then
    raise exception 'submit_battle_action(uuid,text,text) not found';
  end if;

  -- Idempotency: skip if already patched.
  if position('v_pip_cap' in v_function_sql) > 0 then
    return;
  end if;

  if position(v_old_decl in v_function_sql) = 0 then
    raise exception 'Could not locate declare fragment';
  end if;
  v_function_sql := replace(v_function_sql, v_old_decl, v_new_decl);

  if position(v_old_post_unlock in v_function_sql) = 0 then
    raise exception 'Could not locate post-unlock fragment';
  end if;
  v_function_sql := replace(v_function_sql, v_old_post_unlock, v_new_post_unlock);

  if position(v_old_focus in v_function_sql) = 0 then
    raise exception 'Could not locate focus action fragment';
  end if;
  v_function_sql := replace(v_function_sql, v_old_focus, v_new_focus);

  execute v_function_sql;
end;
$$;
