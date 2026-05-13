-- 064_new_skills_perks.sql
-- Three new player skills + revised milestone perk thresholds.
--
-- NEW SKILLS
--   charge_strike  (unlock L15, pip cost ALL, min 2)
--     Spends every pip. Damage = pips × 120% base power.
--     High ceiling for committed pip builds; costs the whole bank.
--   counter_stance (unlock L18, pip cost 1)
--     No immediate damage. Sets counter_pending flag. On the opponent's
--     next damaging action: player takes 50% damage and auto-retaliates
--     for 80% base power. Flag clears after opponent acts (attack or not).
--   overdrive      (unlock L20, pip cost 3)
--     5 hits × 60% base damage. Each hit crits independently (same as triple_hit).
--     Total without crits: 3× a normal hit.
--
-- REVISED PERKS (mirrors src/lib/battlePerks.ts)
--   Pip cap → 4:  level 10  (was 5)
--   Pip cap → 5:  level 20  (new)
--   Focus 2 pips: level 12  (unchanged)
--
-- SCHEMA
--   battle_runs.counter_pending boolean — persists the counter_stance flag between turns.

-- ── 0. Schema change ─────────────────────────────────────────────────────────

alter table public.battle_runs
  add column if not exists counter_pending boolean not null default false;

-- ── 1. Patch submit_battle_action(uuid, text, text) ──────────────────────────

do $$
declare
  v_function_sql text;

  -- ── A: Declare block — add counter_pending + charge_strike helpers ────────
  v_old_decl text := $old$
  v_defender_level         integer := 1;
$old$;

  v_new_decl text := $new$
  v_defender_level         integer := 1;
  v_counter_pending        boolean := false;
  v_pips_before_skill      integer := 0;
  v_counter_hit_damage     integer := 0;
$new$;

  -- ── B: Post-snapshot — read counter_pending + extend unlock levels ─────────
  v_old_post_snapshot text := $old$
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
$old$;

  v_new_post_snapshot text := $new$
  select * into v_snapshot from public.creature_battle_snapshots where id = v_run.snapshot_id;
  select * into v_opponent from public.battle_opponents           where id = v_run.opponent_id;

  v_counter_pending := v_run.counter_pending;

  -- Level unlock validation (second-pass; runs after snapshot is loaded).
  if p_action = 'skill' then
    v_skill_unlock_level := case p_skill_id
      when 'triple_hit'    then 1
      when 'power_strike'  then 4
      when 'regen'         then 8
      when 'charge_strike' then 15
      when 'counter_stance' then 18
      when 'overdrive'     then 20
      else 99
    end;
    if v_snapshot.level < v_skill_unlock_level then
      raise exception 'Skill % requires level % (current level: %)',
        p_skill_id, v_skill_unlock_level, v_snapshot.level;
    end if;
  end if;
$new$;

  -- ── C: Preconditions — extend known skills + charge_strike min-pip note ───
  v_old_preconds text := $old$
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
$old$;

  v_new_preconds text := $new$
    if p_skill_id not in ('triple_hit', 'power_strike', 'regen', 'charge_strike', 'counter_stance', 'overdrive') then
      raise exception 'Unknown skill: %', p_skill_id;
    end if;
    -- charge_strike costs ALL pips; v_skill_pip_cost is the minimum required (2).
    v_skill_pip_cost := case p_skill_id
      when 'triple_hit'    then 1
      when 'power_strike'  then 1
      when 'regen'         then 2
      when 'charge_strike' then 2
      when 'counter_stance' then 1
      when 'overdrive'     then 3
      else 0
    end;
    if v_player_focus_pips < v_skill_pip_cost then
      raise exception 'Not enough focus pips for % (need %, have %)',
        p_skill_id, v_skill_pip_cost, v_player_focus_pips;
    end if;
  end if;

  select * into v_snapshot from public.creature_battle_snapshots where id = v_run.snapshot_id;
$new$;

  -- ── D: Perk computation — pip cap L5 → L10, add L20 → 5 ──────────────────
  v_old_perks text := $old$
  -- Milestone perk: level 5 raises pip cap; level 12 boosts focus gain.
  -- Mirrors PERK_THRESHOLDS in src/lib/battlePerks.ts.
  v_pip_cap    := case when v_snapshot.level >= 5  then 4 else 3 end;
  v_focus_gain := case when v_snapshot.level >= 12 then 2 else 1 end;
$old$;

  v_new_perks text := $new$
  -- Milestone perks mirror PERK_THRESHOLDS in src/lib/battlePerks.ts.
  v_pip_cap    := case when v_snapshot.level >= 20 then 5
                       when v_snapshot.level >= 10 then 4
                       else 3 end;
  v_focus_gain := case when v_snapshot.level >= 12 then 2 else 1 end;
$new$;

  -- ── E: Skill dispatch + pip deduction + log building ─────────────────────
  -- Replaces from the regen case through the closing end if of the log block.
  v_old_skills text := $old$
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
$old$;

  v_new_skills text := $new$
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

          when 'charge_strike' then
            -- Spend ALL pips. Damage = pips × 120% base power. Minimum 2 pips.
            -- Tuning: multiplier 1.0–1.5 per pip; reward for deep pip investment.
            v_pips_before_skill := v_player_focus_pips;
            v_act_damage := greatest(1, round(
              public.battle_compute_damage(
                p_battle_run_id => p_battle_run_id, p_round => v_current_round,
                p_actor => v_act_actor_label,
                p_strength => v_act_strength, p_momentum => v_act_momentum,
                p_resilience => v_act_resilience,
                p_momentum_boost => v_act_momentum_boost,
                p_next_attack_bonus => 0,
                p_crit_multiplier => v_act_crit_mult,
                p_level => v_act_level, p_stage => v_act_stage
              ) * v_pips_before_skill * 1.2
            )::integer);

          when 'counter_stance' then
            -- No direct damage. Sets counter_pending — next opponent attack is halved
            -- and triggers an 80% auto counter-hit. Flag persists until opponent acts.
            v_counter_pending := true;
            v_act_damage      := 0;
            v_act_is_crit     := false;

          when 'overdrive' then
            -- 5 hits × 60% base damage. Each hit crits independently. Costs 3 pips.
            -- Total without crits: 3× a normal hit.
            v_hit_count       := 5;
            v_hit_fraction    := 0.60;
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

        -- charge_strike spends ALL pips; other skills deduct their fixed cost.
        v_player_focus_pips := case p_skill_id
          when 'charge_strike' then 0
          else greatest(0, v_player_focus_pips - v_skill_pip_cost)
        end;
        v_act_momentum_boost := 0;

        if p_skill_id = 'counter_stance' then
          -- Stance action: no HP change, log as self-targeted with 0 damage.
          v_log_entry := jsonb_build_object(
            'id', gen_random_uuid(), 'round', v_current_round, 'phase', 'action',
            'actor', 'player', 'action', 'skill',
            'skill_id', p_skill_id,
            'damage', 0, 'target', 'player',
            'target_hp_after', v_new_player_hp,
            'crit', false, 'defended', false,
            'consumed_momentum_boost', v_act_consumed_mb,
            'consumed_next_attack_bonus', false,
            'message', v_act_name || ' takes Counter Stance — ready to deflect and retaliate!'
          );
        elsif v_regen_heal_amount > 0 then
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
              when 'charge_strike' then
                v_act_name || ' unleashes Charge Strike (' || v_pips_before_skill::text || ' pips) for '
                || v_act_damage::text || ' damage!'
                || case when v_act_is_crit then ' (Critical Hit!)' else '' end
              when 'overdrive' then
                v_act_name || ' unleashes Overdrive! '
                || v_hit_count::text || ' hits: ' || v_hit_messages
                || ' = ' || v_act_damage::text || ' total!'
              else v_act_name || ' uses ' || p_skill_id || '!'
            end
              || case when v_opponent_action = 'defend' then ' (Blocked!)' else '' end
              || case when v_opponent_action = 'focus'  then ' (Exposed!)' else '' end
          );
        end if;
$new$;

  -- ── F: Write-back + counter_pending + counter-hit log + completion check ──
  v_old_writeback text := $old$
    -- ── Write-back: push v_act_* into canonical vars + apply damage ───────
    if v_actor = 'player' then
      v_player_momentum_boost := v_act_momentum_boost;
      v_new_opponent_hp       := greatest(0, v_new_opponent_hp - v_act_damage);
    else
      v_enemy_momentum_boost := v_act_momentum_boost;
      v_new_player_hp        := greatest(0, v_new_player_hp - v_act_damage);
    end if;

    v_new_log := v_new_log || v_log_entry;

    -- ── Battle completion check ────────────────────────────────────────────
    if v_actor_action in ('attack', 'skill', 'special') then
      if v_actor = 'player' and v_new_opponent_hp <= 0 then
        v_battle_complete := true; v_outcome := v_act_win_outcome;
      elsif v_actor = 'opponent' and v_new_player_hp <= 0 then
        v_battle_complete := true; v_outcome := v_act_win_outcome;
      end if;
    end if;

  end loop;
$old$;

  v_new_writeback text := $new$
    -- ── Write-back: push v_act_* into canonical vars + apply damage ───────
    if v_actor = 'player' then
      v_player_momentum_boost := v_act_momentum_boost;
      v_new_opponent_hp       := greatest(0, v_new_opponent_hp - v_act_damage);
    else
      v_enemy_momentum_boost := v_act_momentum_boost;
      -- counter_pending: deflect 50% of incoming damage, auto-retaliate for 80% power.
      -- Triggers on any damaging opponent action; clears after the opponent acts.
      if v_counter_pending and v_actor_action in ('attack', 'special') then
        v_act_damage         := greatest(1, round(v_act_damage * 0.5)::integer);
        v_counter_hit_damage := greatest(1, round(
          public.battle_compute_damage(
            p_battle_run_id, v_current_round, 'player',
            v_snapshot.strength, v_snapshot.momentum, v_opponent.resilience,
            0, 0, 1.0, v_snapshot.level, v_snapshot.stage
          ) * 0.80
          * greatest(0.50, 1.0 - v_opponent.recommended_level::numeric * 0.003)
        )::integer);
        v_new_opponent_hp := greatest(0, v_new_opponent_hp - v_counter_hit_damage);
        v_counter_pending := false;
      elsif v_actor_action not in ('attack', 'special') then
        -- Opponent did not attack; stance expires without firing.
        v_counter_pending := false;
      end if;
      v_new_player_hp := greatest(0, v_new_player_hp - v_act_damage);
    end if;

    v_new_log := v_new_log || v_log_entry;

    -- Append counter-hit entry if the stance fired this iteration.
    if v_counter_hit_damage > 0 then
      v_new_log := v_new_log || jsonb_build_object(
        'id', gen_random_uuid(), 'round', v_current_round, 'phase', 'action',
        'actor', 'player', 'action', 'counter',
        'skill_id', 'counter_stance',
        'damage', v_counter_hit_damage, 'target', 'opponent',
        'target_hp_after', v_new_opponent_hp,
        'crit', false, 'defended', false,
        'consumed_momentum_boost', false,
        'consumed_next_attack_bonus', false,
        'message', v_companion_name || ' counter-attacks for ' || v_counter_hit_damage::text || ' damage!'
      );
      v_counter_hit_damage := 0;
    end if;

    -- ── Battle completion check ────────────────────────────────────────────
    if v_actor_action in ('attack', 'skill', 'special') then
      if v_actor = 'player' and v_new_opponent_hp <= 0 then
        v_battle_complete := true; v_outcome := v_act_win_outcome;
      elsif v_actor = 'opponent' then
        if v_new_player_hp <= 0 then
          v_battle_complete := true; v_outcome := v_act_win_outcome;
        elsif v_new_opponent_hp <= 0 then
          -- counter-hit finished the opponent
          v_battle_complete := true; v_outcome := 'win';
        end if;
      end if;
    end if;

  end loop;
$new$;

  -- ── G: Persist block — add counter_pending ────────────────────────────────
  v_old_persist text := $old$
    completed_at             = case when v_battle_complete then v_completed_at     else completed_at           end
  where id = p_battle_run_id;
$old$;

  v_new_persist text := $new$
    completed_at             = case when v_battle_complete then v_completed_at     else completed_at           end,
    counter_pending          = v_counter_pending
  where id = p_battle_run_id;
$new$;

begin
  select pg_get_functiondef('public.submit_battle_action(uuid,text,text)'::regprocedure)
  into v_function_sql;

  if v_function_sql is null then
    raise exception 'submit_battle_action(uuid,text,text) not found';
  end if;

  -- Idempotency: skip if already patched.
  if position('''charge_strike''' in v_function_sql) > 0 then
    raise notice '064 already applied — skipping';
    return;
  end if;

  if position(v_old_decl in v_function_sql) = 0 then
    raise exception '064: could not locate declare fragment';
  end if;
  v_function_sql := replace(v_function_sql, v_old_decl, v_new_decl);

  if position(v_old_post_snapshot in v_function_sql) = 0 then
    raise exception '064: could not locate post-snapshot fragment';
  end if;
  v_function_sql := replace(v_function_sql, v_old_post_snapshot, v_new_post_snapshot);

  if position(v_old_preconds in v_function_sql) = 0 then
    raise exception '064: could not locate preconditions fragment';
  end if;
  v_function_sql := replace(v_function_sql, v_old_preconds, v_new_preconds);

  if position(v_old_perks in v_function_sql) = 0 then
    raise exception '064: could not locate perk computation fragment';
  end if;
  v_function_sql := replace(v_function_sql, v_old_perks, v_new_perks);

  if position(v_old_skills in v_function_sql) = 0 then
    raise exception '064: could not locate skill dispatch fragment';
  end if;
  v_function_sql := replace(v_function_sql, v_old_skills, v_new_skills);

  if position(v_old_writeback in v_function_sql) = 0 then
    raise exception '064: could not locate write-back fragment';
  end if;
  v_function_sql := replace(v_function_sql, v_old_writeback, v_new_writeback);

  if position(v_old_persist in v_function_sql) = 0 then
    raise exception '064: could not locate persist fragment';
  end if;
  v_function_sql := replace(v_function_sql, v_old_persist, v_new_persist);

  execute v_function_sql;
end;
$$;
