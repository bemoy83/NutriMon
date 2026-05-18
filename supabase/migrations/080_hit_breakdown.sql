-- 080_hit_breakdown.sql
--
-- Adds a structured hit_breakdown field to multi-hit battle log entries.
-- Each element is { "damage": N, "crit": true|false } for one hit.
-- The frontend uses this to display per-hit floating damage numbers instead
-- of a single total at the end of the animation.
--
-- Affected log entry types:
--   action = 'skill',  skill_id IN ('triple_hit', 'overdrive')
--   action = 'special', special type = 'multi_hit'
--
-- Non-multi-hit entries get hit_breakdown: null (no schema change needed;
-- battle_log is an append-only JSONB array and existing rows are immutable).

do $$
declare
  v_function_sql text;

  -- A: Add v_hit_breakdown variable to the DECLARE block.
  v_old_decl text := $old_decl$  v_hit_messages        text;$old_decl$;
  v_new_decl text := $new_decl$  v_hit_messages        text;
  v_hit_breakdown       jsonb;$new_decl$;

  -- B: Player skill multi-hit loop body — identical code for both triple_hit
  --    and overdrive (same hash seed 'skill_hit'). replace() patches both.
  v_old_skill_loop text := $old_skill_loop$            v_act_damage := 0;
            v_hit_messages := '';
            for v_hit_i in 1..v_hit_count loop
              v_hit_is_crit := (abs(hashtext(
                p_battle_run_id::text || v_current_round::text || v_act_actor_label || 'skill_hit' || v_hit_i::text
              )) % 10000) < v_focused_crit_threshold;
              v_hit_crit_mult     := case when v_hit_is_crit then 1.5 else 1.0 end;
              v_single_hit_damage := greatest(1, round(v_single_hit_base * v_hit_fraction * v_hit_crit_mult)::integer);
              v_act_damage        := v_act_damage + v_single_hit_damage;
              if v_hit_is_crit then v_any_hit_critted := true; end if;
              v_hit_messages := v_hit_messages
                || v_single_hit_damage::text
                || case when v_hit_is_crit then ' (CRIT!)' else '' end
                || case when v_hit_i < v_hit_count then ', ' else '' end;
            end loop;
            v_act_is_crit := v_any_hit_critted;$old_skill_loop$;
  v_new_skill_loop text := $new_skill_loop$            v_act_damage := 0;
            v_hit_messages := '';
            v_hit_breakdown := '[]'::jsonb;
            for v_hit_i in 1..v_hit_count loop
              v_hit_is_crit := (abs(hashtext(
                p_battle_run_id::text || v_current_round::text || v_act_actor_label || 'skill_hit' || v_hit_i::text
              )) % 10000) < v_focused_crit_threshold;
              v_hit_crit_mult     := case when v_hit_is_crit then 1.5 else 1.0 end;
              v_single_hit_damage := greatest(1, round(v_single_hit_base * v_hit_fraction * v_hit_crit_mult)::integer);
              v_act_damage        := v_act_damage + v_single_hit_damage;
              if v_hit_is_crit then v_any_hit_critted := true; end if;
              v_hit_messages := v_hit_messages
                || v_single_hit_damage::text
                || case when v_hit_is_crit then ' (CRIT!)' else '' end
                || case when v_hit_i < v_hit_count then ', ' else '' end;
              v_hit_breakdown := v_hit_breakdown || jsonb_build_array(
                jsonb_build_object('damage', v_single_hit_damage, 'crit', v_hit_is_crit)
              );
            end loop;
            v_act_is_crit := v_any_hit_critted;$new_skill_loop$;

  -- C: Enemy multi_hit loop body — distinct hash seed ('hit' not 'skill_hit').
  v_old_enemy_loop text := $old_enemy_loop$            v_act_damage := 0;
            v_hit_messages := '';
            for v_hit_i in 1..v_hit_count loop
              v_hit_is_crit := (abs(hashtext(
                p_battle_run_id::text || v_current_round::text || v_act_actor_label || 'hit' || v_hit_i::text
              )) % 10000) < (v_act_momentum * 15);
              v_hit_crit_mult := case when v_hit_is_crit then 1.5 else 1.0 end;
              v_single_hit_damage := greatest(1, round(v_single_hit_base * v_hit_fraction * v_hit_crit_mult)::integer);
              v_act_damage := v_act_damage + v_single_hit_damage;
              if v_hit_is_crit then v_any_hit_critted := true; end if;
              v_hit_messages := v_hit_messages
                || v_single_hit_damage::text
                || case when v_hit_is_crit then ' (CRIT!)' else '' end
                || case when v_hit_i < v_hit_count then ', ' else '' end;
            end loop;$old_enemy_loop$;
  v_new_enemy_loop text := $new_enemy_loop$            v_act_damage := 0;
            v_hit_messages := '';
            v_hit_breakdown := '[]'::jsonb;
            for v_hit_i in 1..v_hit_count loop
              v_hit_is_crit := (abs(hashtext(
                p_battle_run_id::text || v_current_round::text || v_act_actor_label || 'hit' || v_hit_i::text
              )) % 10000) < (v_act_momentum * 15);
              v_hit_crit_mult := case when v_hit_is_crit then 1.5 else 1.0 end;
              v_single_hit_damage := greatest(1, round(v_single_hit_base * v_hit_fraction * v_hit_crit_mult)::integer);
              v_act_damage := v_act_damage + v_single_hit_damage;
              if v_hit_is_crit then v_any_hit_critted := true; end if;
              v_hit_messages := v_hit_messages
                || v_single_hit_damage::text
                || case when v_hit_is_crit then ' (CRIT!)' else '' end
                || case when v_hit_i < v_hit_count then ', ' else '' end;
              v_hit_breakdown := v_hit_breakdown || jsonb_build_array(
                jsonb_build_object('damage', v_single_hit_damage, 'crit', v_hit_is_crit)
              );
            end loop;$new_enemy_loop$;

  -- D: Player skill attack log entry — add hit_breakdown before 'message'.
  --    Anchor: the 'consumed_next_attack_bonus' line just before 'message' in
  --    the skill attack branch (unique: followed by case p_skill_id when 'triple_hit').
  v_old_skill_log text := $old_skill_log$            'consumed_momentum_boost', v_act_consumed_mb,
            'consumed_next_attack_bonus', false,
            'message', case p_skill_id
              when 'triple_hit' then$old_skill_log$;
  v_new_skill_log text := $new_skill_log$            'consumed_momentum_boost', v_act_consumed_mb,
            'consumed_next_attack_bonus', false,
            'hit_breakdown', v_hit_breakdown,
            'message', case p_skill_id
              when 'triple_hit' then$new_skill_log$;

  -- E: Enemy special log entry — add hit_breakdown (null for damage_boost).
  --    Anchor: the two-space-indented 'consumed_next_attack_bonus' line just
  --    before 'message' in the special branch (unique: followed by v_act_name || ' unleashes ').
  v_old_enemy_log text := $old_enemy_log$          'consumed_momentum_boost', v_act_consumed_mb,
          'consumed_next_attack_bonus', false,
          'message',
            v_act_name || ' unleashes '$old_enemy_log$;
  v_new_enemy_log text := $new_enemy_log$          'consumed_momentum_boost', v_act_consumed_mb,
          'consumed_next_attack_bonus', false,
          'hit_breakdown', case when v_special_type = 'multi_hit' then v_hit_breakdown else null end,
          'message',
            v_act_name || ' unleashes '$new_enemy_log$;

begin
  select pg_get_functiondef('public.submit_battle_action(uuid,text,text)'::regprocedure)
  into v_function_sql;

  if v_function_sql is null then
    raise exception 'submit_battle_action(uuid,text,text) not found';
  end if;

  -- Idempotency guard: skip if already applied.
  if position('v_hit_breakdown' in v_function_sql) > 0 then
    return;
  end if;

  -- Verify all fragments exist before mutating.
  if position(v_old_decl in v_function_sql) = 0 then
    raise exception 'Could not locate v_hit_messages declaration fragment';
  end if;
  if position(v_old_skill_loop in v_function_sql) = 0 then
    raise exception 'Could not locate player skill multi-hit loop fragment';
  end if;
  if position(v_old_enemy_loop in v_function_sql) = 0 then
    raise exception 'Could not locate enemy multi_hit loop fragment';
  end if;
  if position(v_old_skill_log in v_function_sql) = 0 then
    raise exception 'Could not locate player skill log entry fragment';
  end if;
  if position(v_old_enemy_log in v_function_sql) = 0 then
    raise exception 'Could not locate enemy special log entry fragment';
  end if;

  v_function_sql := replace(v_function_sql, v_old_decl,       v_new_decl);
  v_function_sql := replace(v_function_sql, v_old_skill_loop, v_new_skill_loop);
  v_function_sql := replace(v_function_sql, v_old_enemy_loop, v_new_enemy_loop);
  v_function_sql := replace(v_function_sql, v_old_skill_log,  v_new_skill_log);
  v_function_sql := replace(v_function_sql, v_old_enemy_log,  v_new_enemy_log);

  execute v_function_sql;
end;
$$;
