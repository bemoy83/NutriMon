-- 060_level_skills_defense_scaling.sql
-- Two related changes that make level a meaningful battle axis:
--
-- 1. DEFENSE SCALING — each level reduces incoming damage by 0.3%.
--    Applied post-battle_compute_damage as a multiplier on v_act_damage.
--    Floor lowered from 0.60 → 0.50 so high-level + high-resilience builds
--    can reach up to ~50% total mitigation (was capped at 40% by resilience alone).
--    Tuning: 0.002–0.004 per level; keep floor ≥ 0.50 to prevent turtling.
--
-- 2. NEW SKILLS
--    • power_strike  (unlock level 4, pip cost 1) — 1 hit × 200% power, uses normal crit roll.
--      Total without crits: 2.0× a normal hit.  Higher single-hit ceiling than triple_hit.
--    • regen         (unlock level 8, pip cost 2) — heal 30% of max HP.
--      Self-targeted; immune to defend/focus modifiers; no opponent damage.
--
-- 3. LEVEL UNLOCK VALIDATION — server-side check rejects a skill if
--    v_snapshot.level < unlock threshold.  Mirrors the client-side gating.

do $$
declare
  v_function_sql text;

  -- ── Fragment: actor routing — add v_defender_level ────────────────────────
  v_old_routing text := $old$
      v_act_level          := v_snapshot.level;
      v_act_stage          := v_snapshot.stage;
      v_act_name           := v_companion_name;
      v_act_actor_label    := 'player';
      v_act_target_label   := 'opponent';
      v_act_attack_verb    := 'attacks';
      v_act_defend_message := v_companion_name || ' takes a defensive stance!';
      v_act_win_outcome    := 'win';
    else
      v_actor_action       := v_enemy_action;
      v_opponent_action    := v_player_action;
      v_act_strength       := v_opponent.strength;
      v_act_momentum       := v_opponent.momentum;
      v_act_resilience     := v_snapshot.resilience;
      v_act_momentum_boost := v_enemy_momentum_boost;
      v_act_crit_mult      := v_enemy_crit_mult;
      v_act_is_crit        := v_enemy_is_crit;
      v_act_level          := v_opponent.recommended_level;
      v_act_stage          := 'baby';
      v_act_name           := v_opponent.name;
      v_act_actor_label    := 'opponent';
      v_act_target_label   := 'player';
      v_act_attack_verb    := 'strikes';
      v_act_defend_message := v_opponent.name || ' braces for impact!';
      v_act_win_outcome    := 'loss';
    end if;
$old$;

  v_new_routing text := $new$
      v_act_level          := v_snapshot.level;
      v_act_stage          := v_snapshot.stage;
      v_act_name           := v_companion_name;
      v_act_actor_label    := 'player';
      v_act_target_label   := 'opponent';
      v_act_attack_verb    := 'attacks';
      v_act_defend_message := v_companion_name || ' takes a defensive stance!';
      v_act_win_outcome    := 'win';
      v_defender_level     := v_opponent.recommended_level;
    else
      v_actor_action       := v_enemy_action;
      v_opponent_action    := v_player_action;
      v_act_strength       := v_opponent.strength;
      v_act_momentum       := v_opponent.momentum;
      v_act_resilience     := v_snapshot.resilience;
      v_act_momentum_boost := v_enemy_momentum_boost;
      v_act_crit_mult      := v_enemy_crit_mult;
      v_act_is_crit        := v_enemy_is_crit;
      v_act_level          := v_opponent.recommended_level;
      v_act_stage          := 'baby';
      v_act_name           := v_opponent.name;
      v_act_actor_label    := 'opponent';
      v_act_target_label   := 'player';
      v_act_attack_verb    := 'strikes';
      v_act_defend_message := v_opponent.name || ' braces for impact!';
      v_act_win_outcome    := 'loss';
      v_defender_level     := v_snapshot.level;
    end if;
$new$;

  -- ── Fragment: declare block — add new vars ─────────────────────────────────
  -- Insert after existing skill vars block.
  v_old_decl text := $old$
  -- Skill vars
  v_skill_pip_cost      integer;
$old$;

  v_new_decl text := $new$
  -- Skill vars
  v_skill_pip_cost         integer;
  v_skill_unlock_level     integer;
  v_regen_heal_amount      integer := 0;
  v_defender_level         integer := 1;
$new$;

  -- ── Fragment: preconditions — extend known skills + add level check ─────────
  v_old_preconds text := $old$
    if p_skill_id not in ('triple_hit') then
      raise exception 'Unknown skill: %', p_skill_id;
    end if;
    -- triple_hit costs 1 pip; extend this block as new skills are added
    v_skill_pip_cost := case p_skill_id when 'triple_hit' then 1 else 0 end;
    if v_player_focus_pips < v_skill_pip_cost then
      raise exception 'Not enough focus pips for % (need %, have %)',
        p_skill_id, v_skill_pip_cost, v_player_focus_pips;
    end if;
  end if;

  select * into v_snapshot from public.creature_battle_snapshots where id = v_run.snapshot_id;
$old$;

  v_new_preconds text := $new$
    if p_skill_id not in ('triple_hit', 'power_strike', 'regen') then
      raise exception 'Unknown skill: %', p_skill_id;
    end if;
    v_skill_pip_cost := case p_skill_id
      when 'triple_hit'   then 1
      when 'power_strike' then 1
      when 'regen'        then 2
      else 0
    end;
    if v_player_focus_pips < v_skill_pip_cost then
      raise exception 'Not enough focus pips for % (need %, have %)',
        p_skill_id, v_skill_pip_cost, v_player_focus_pips;
    end if;
  end if;

  select * into v_snapshot from public.creature_battle_snapshots where id = v_run.snapshot_id;
$new$;

  -- ── Fragment: level unlock check — insert after snapshot load ──────────────
  v_old_post_snapshot text := $old$
  select * into v_snapshot from public.creature_battle_snapshots where id = v_run.snapshot_id;
  select * into v_opponent from public.battle_opponents           where id = v_run.opponent_id;
$old$;

  v_new_post_snapshot text := $new$
  select * into v_snapshot from public.creature_battle_snapshots where id = v_run.snapshot_id;
  select * into v_opponent from public.battle_opponents           where id = v_run.opponent_id;

  -- Level unlock validation (second-pass; runs after snapshot is loaded).
  if p_action = 'skill' then
    v_skill_unlock_level := case p_skill_id
      when 'triple_hit'   then 1
      when 'power_strike' then 4
      when 'regen'        then 8
      else 99
    end;
    if v_snapshot.level < v_skill_unlock_level then
      raise exception 'Skill % requires level % (current level: %)',
        p_skill_id, v_skill_unlock_level, v_snapshot.level;
    end if;
  end if;
$new$;

  -- ── Fragment: normal attack — add defense scaling after damage computation ──
  v_old_attack text := $old$
      when 'attack' then
        -- Normal attack. No auto-trigger from pip state; that was removed.
        v_act_consumed_mb := v_act_momentum_boost > 0;
        v_act_damage := public.battle_compute_damage(
          p_battle_run_id => p_battle_run_id, p_round => v_current_round,
          p_actor => v_act_actor_label,
          p_strength => v_act_strength, p_momentum => v_act_momentum,
          p_resilience => v_act_resilience,
          p_momentum_boost => v_act_momentum_boost,
          p_next_attack_bonus => 0,
          p_crit_multiplier => v_act_crit_mult,
          p_level => v_act_level, p_stage => v_act_stage
        );
        if v_opponent_action = 'defend' then
$old$;

  v_new_attack text := $new$
      when 'attack' then
        -- Normal attack. No auto-trigger from pip state; that was removed.
        v_act_consumed_mb := v_act_momentum_boost > 0;
        v_act_damage := public.battle_compute_damage(
          p_battle_run_id => p_battle_run_id, p_round => v_current_round,
          p_actor => v_act_actor_label,
          p_strength => v_act_strength, p_momentum => v_act_momentum,
          p_resilience => v_act_resilience,
          p_momentum_boost => v_act_momentum_boost,
          p_next_attack_bonus => 0,
          p_crit_multiplier => v_act_crit_mult,
          p_level => v_act_level, p_stage => v_act_stage
        );
        -- Defense scaling: each defender level adds 0.3% mitigation (floor 0.50).
        v_act_damage := greatest(1, round(v_act_damage * greatest(0.50, 1.0 - v_defender_level * 0.003))::integer);
        if v_opponent_action = 'defend' then
$new$;

  -- ── Fragment: skill dispatch — add power_strike + regen cases ──────────────
  v_old_skill_dispatch text := $old$
          when 'triple_hit' then
            -- 3 hits × 75% base damage. Each hit crits independently at +50% relative
            -- chance (normal chance × 1.5), capped at 35%.
            -- Total without crits: 3 × 0.75 = 2.25× a normal hit.
            -- Tuning: hit_count 2–4; hit_fraction 0.60–0.90.
            v_hit_count       := 3;
            v_hit_fraction    := 0.75;
            v_any_hit_critted := false;
            v_focused_crit_threshold := least(3500, round(v_act_momentum * 15 * 1.5)::integer);
            v_single_hit_base := public.battle_compute_damage(
              p_battle_run_id => p_battle_run_id, p_round => v_current_round,
              p_actor => v_act_actor_label,
              p_strength => v_act_strength, p_momentum => v_act_momentum,
              p_resilience => v_act_resilience,
              p_momentum_boost => v_act_momentum_boost,
              p_next_attack_bonus => 0,
              p_crit_multiplier => 1.0,
              p_level => v_act_level, p_stage => v_act_stage
            );
            v_act_damage   := 0;
            v_hit_messages := '';
            for v_hit_i in 1..v_hit_count loop
              v_hit_is_crit := (abs(hashtext(
                p_battle_run_id::text || v_current_round::text
                || v_act_actor_label || 'skill_hit' || v_hit_i::text
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
            v_act_is_crit := v_any_hit_critted;

        end case;

        -- Deduct pip cost (validated pre-loop; safe to subtract directly).
        v_player_focus_pips := v_player_focus_pips - v_skill_pip_cost;

        if v_opponent_action = 'defend' then
          v_act_damage := greatest(1, round(v_act_damage * 0.5)::integer);
        end if;
        if v_opponent_action = 'focus' then
          v_act_damage := round(v_act_damage * 1.3)::integer;
        end if;
        v_act_momentum_boost  := 0;
        v_act_target_hp_after := greatest(0, v_new_opponent_hp - v_act_damage);
        v_log_entry := jsonb_build_object(
          'id', gen_random_uuid(), 'round', v_current_round, 'phase', 'action',
          'actor', v_act_actor_label, 'action', 'skill',
          'skill_id', p_skill_id,
          'damage', v_act_damage, 'target', v_act_target_label,
          'target_hp_after', v_act_target_hp_after,
          'crit', v_act_is_crit, 'defended', (v_opponent_action = 'defend'),
          'consumed_momentum_boost', v_act_consumed_mb,
          'consumed_next_attack_bonus', false,
          'message', case p_skill_id
            when 'triple_hit' then
              v_act_name || ' unleashes Triple Hit! '
              || v_hit_count::text || ' hits: ' || v_hit_messages
              || ' = ' || v_act_damage::text || ' total!'
            else v_act_name || ' uses ' || p_skill_id || '!'
          end
            || case when v_opponent_action = 'defend' then ' (Blocked!)' else '' end
            || case when v_opponent_action = 'focus'  then ' (Exposed!)' else '' end
        );
$old$;

  v_new_skill_dispatch text := $new$
          when 'triple_hit' then
            -- 3 hits × 75% base damage. Each hit crits independently at +50% relative
            -- chance (normal chance × 1.5), capped at 35%.
            -- Total without crits: 3 × 0.75 = 2.25× a normal hit.
            -- Tuning: hit_count 2–4; hit_fraction 0.60–0.90.
            v_hit_count       := 3;
            v_hit_fraction    := 0.75;
            v_any_hit_critted := false;
            v_focused_crit_threshold := least(3500, round(v_act_momentum * 15 * 1.5)::integer);
            v_single_hit_base := public.battle_compute_damage(
              p_battle_run_id => p_battle_run_id, p_round => v_current_round,
              p_actor => v_act_actor_label,
              p_strength => v_act_strength, p_momentum => v_act_momentum,
              p_resilience => v_act_resilience,
              p_momentum_boost => v_act_momentum_boost,
              p_next_attack_bonus => 0,
              p_crit_multiplier => 1.0,
              p_level => v_act_level, p_stage => v_act_stage
            );
            v_act_damage   := 0;
            v_hit_messages := '';
            for v_hit_i in 1..v_hit_count loop
              v_hit_is_crit := (abs(hashtext(
                p_battle_run_id::text || v_current_round::text
                || v_act_actor_label || 'skill_hit' || v_hit_i::text
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
            v_act_is_crit := v_any_hit_critted;

          when 'power_strike' then
            -- 1 hit × 200% base damage. Uses player's normal crit roll.
            -- Total without crits: 2.0× a normal hit (predictable high-damage option).
            -- Tuning: multiplier 1.5–2.5; keep below triple_hit expected value at high crit rates.
            v_act_damage := greatest(1, round(public.battle_compute_damage(
              p_battle_run_id => p_battle_run_id, p_round => v_current_round,
              p_actor => v_act_actor_label,
              p_strength => v_act_strength, p_momentum => v_act_momentum,
              p_resilience => v_act_resilience,
              p_momentum_boost => v_act_momentum_boost,
              p_next_attack_bonus => 0,
              p_crit_multiplier => v_act_crit_mult,
              p_level => v_act_level, p_stage => v_act_stage
            ) * 2.0)::integer);

          when 'regen' then
            -- Self-heal: restore 30% of max HP (capped at missing HP).
            -- Not subject to defend/focus modifiers. Consumes 2 pips.
            -- Tuning: 0.20–0.40; keep below 50% or regen becomes a stall strategy.
            v_regen_heal_amount := least(
              v_run.player_max_hp - v_new_player_hp,
              round(v_run.player_max_hp * 0.30)::integer
            );
            v_new_player_hp := v_new_player_hp + v_regen_heal_amount;
            v_act_damage    := 0;
            v_act_is_crit   := false;

        end case;

        -- Deduct pip cost (validated pre-loop; safe to subtract directly).
        v_player_focus_pips := v_player_focus_pips - v_skill_pip_cost;
        v_act_momentum_boost := 0;

        if v_regen_heal_amount > 0 then
          -- Regen: self-targeted heal, no opponent interaction.
          v_log_entry := jsonb_build_object(
            'id', gen_random_uuid(), 'round', v_current_round, 'phase', 'action',
            'actor', 'player', 'action', 'skill',
            'skill_id', p_skill_id,
            'damage', 0, 'target', 'player',
            'target_hp_after', v_new_player_hp,
            'crit', false, 'defended', false,
            'consumed_momentum_boost', v_act_consumed_mb,
            'consumed_next_attack_bonus', false,
            'message', v_act_name || ' recovers ' || v_regen_heal_amount::text || ' HP!'
          );
        else
          -- Attack skill: apply defend/focus modifiers then build standard log.
          -- Defense scaling matches normal attack.
          v_act_damage := greatest(1, round(v_act_damage * greatest(0.50, 1.0 - v_defender_level * 0.003))::integer);
          if v_opponent_action = 'defend' then
            v_act_damage := greatest(1, round(v_act_damage * 0.5)::integer);
          end if;
          if v_opponent_action = 'focus' then
            v_act_damage := round(v_act_damage * 1.3)::integer;
          end if;
          v_act_target_hp_after := greatest(0, v_new_opponent_hp - v_act_damage);
          v_log_entry := jsonb_build_object(
            'id', gen_random_uuid(), 'round', v_current_round, 'phase', 'action',
            'actor', v_act_actor_label, 'action', 'skill',
            'skill_id', p_skill_id,
            'damage', v_act_damage, 'target', v_act_target_label,
            'target_hp_after', v_act_target_hp_after,
            'crit', v_act_is_crit, 'defended', (v_opponent_action = 'defend'),
            'consumed_momentum_boost', v_act_consumed_mb,
            'consumed_next_attack_bonus', false,
            'message', case p_skill_id
              when 'triple_hit' then
                v_act_name || ' unleashes Triple Hit! '
                || v_hit_count::text || ' hits: ' || v_hit_messages
                || ' = ' || v_act_damage::text || ' total!'
              when 'power_strike' then
                v_act_name || ' unleashes Power Strike for ' || v_act_damage || ' damage!'
                || case when v_act_is_crit then ' (Critical Hit!)' else '' end
              else v_act_name || ' uses ' || p_skill_id || '!'
            end
              || case when v_opponent_action = 'defend' then ' (Blocked!)' else '' end
              || case when v_opponent_action = 'focus'  then ' (Exposed!)' else '' end
          );
        end if;
$new$;

begin
  select pg_get_functiondef('public.submit_battle_action(uuid,text,text)'::regprocedure)
  into v_function_sql;

  if v_function_sql is null then
    raise exception 'submit_battle_action(uuid,text,text) not found';
  end if;

  -- Idempotency: skip if already patched.
  if position('''power_strike''' in v_function_sql) > 0 then
    return;
  end if;

  -- Apply all patches in dependency order.
  if position(v_old_decl in v_function_sql) = 0 then
    raise exception 'Could not locate declare block fragment';
  end if;
  v_function_sql := replace(v_function_sql, v_old_decl, v_new_decl);

  if position(v_old_preconds in v_function_sql) = 0 then
    raise exception 'Could not locate preconditions fragment';
  end if;
  v_function_sql := replace(v_function_sql, v_old_preconds, v_new_preconds);

  if position(v_old_post_snapshot in v_function_sql) = 0 then
    raise exception 'Could not locate post-snapshot fragment';
  end if;
  v_function_sql := replace(v_function_sql, v_old_post_snapshot, v_new_post_snapshot);

  if position(v_old_routing in v_function_sql) = 0 then
    raise exception 'Could not locate actor routing fragment';
  end if;
  v_function_sql := replace(v_function_sql, v_old_routing, v_new_routing);

  if position(v_old_attack in v_function_sql) = 0 then
    raise exception 'Could not locate attack fragment';
  end if;
  v_function_sql := replace(v_function_sql, v_old_attack, v_new_attack);

  if position(v_old_skill_dispatch in v_function_sql) = 0 then
    raise exception 'Could not locate skill dispatch fragment';
  end if;
  v_function_sql := replace(v_function_sql, v_old_skill_dispatch, v_new_skill_dispatch);

  execute v_function_sql;
end;
$$;
