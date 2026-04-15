-- 030_boss_special_actions.sql
-- Seeds special_action for the three arena bosses.
--
-- Sunscale Drake  (Arena 1 boss, lvl 5)  — damage_boost ×1.6  weight 20
-- Pyrestone Colossus (Arena 2 boss, lvl 12) — multi_hit ×2 @0.70  weight 22
-- The Vault Guardian (Arena 3 boss, lvl 20) — damage_boost ×1.85 weight 25
--
-- Weight semantics: pre-empt roll is (hashtext(run_id||round||'special_preempt') % 100).
-- A weight of 20 fires ~20% of turns, before AI rules run.

update public.battle_opponents
set special_action = '{
  "type":        "damage_boost",
  "label":       "Scorch Breath",
  "description": "Sunscale Drake unleashes a superheated blast dealing amplified damage.",
  "weight":      20,
  "params":      { "multiplier": 1.6 }
}'::jsonb
where name = 'Sunscale Drake';

update public.battle_opponents
set special_action = '{
  "type":        "multi_hit",
  "label":       "Magma Surge",
  "description": "Pyrestone Colossus erupts in a volcanic barrage, striking multiple times.",
  "weight":      22,
  "params":      { "hits": 2, "damage_fraction": 0.70 }
}'::jsonb
where name = 'Pyrestone Colossus';

update public.battle_opponents
set special_action = '{
  "type":        "damage_boost",
  "label":       "Ancient Wrath",
  "description": "The Vault Guardian channels centuries of power into a devastating strike.",
  "weight":      25,
  "params":      { "multiplier": 1.85 }
}'::jsonb
where name = 'The Vault Guardian';
