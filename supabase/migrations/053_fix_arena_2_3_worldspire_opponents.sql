-- 053_fix_arena_2_3_worldspire_opponents.sql
-- Migration 050's ON CONFLICT produced no rows for Arenas 2 and 3, leaving the
-- pre-Worldspire placeholder opponents in place. Migration 052 then deactivated
-- those rows, so Arenas 2 and 3 currently have no active opponents.
--
-- This migration updates the existing rows in-place by (arena_key, sort_order),
-- which preserves row UUIDs and avoids cascading any battle_runs history.
-- Boss special actions are re-applied at the end.

-- ── Arena 2 — Murkmire Wetlands ───────────────────────────────────────────────

update public.battle_opponents
set
  name               = v.name,
  archetype          = v.archetype,
  recommended_level  = v.recommended_level,
  strength           = v.strength,
  resilience         = v.resilience,
  momentum           = v.momentum,
  vitality           = v.vitality,
  is_active          = true,
  is_arena_boss      = v.is_boss,
  size_class         = v.size_class,
  action_weights     = v.action_weights::jsonb,
  special_action     = null
from (values
  (1, 'Boglet',     'gaping ambusher',    6,  74,  58,  62, 145, false, 'small',  '{"attack":60,"defend":20,"focus":20}'),
  (2, 'Mudmaul',    'armoured bulldozer', 8,  84,  84,  42, 160, false, 'medium', '{"attack":40,"defend":60,"focus":0}'),
  (3, 'Reedstalker','aerial skirmisher',  9,  80,  54,  90, 162, false, 'medium', '{"attack":55,"defend":15,"focus":30}'),
  (4, 'Mirewidow',  'patient ambusher',  10,  84,  70,  76, 175, false, 'medium', '{"attack":45,"defend":25,"focus":30}'),
  (5, 'Leviamire',  'ancient swamp titan',11, 98,  80,  64, 200, true,  'large',  '{"attack":50,"defend":25,"focus":25}')
) as v(sort_order, name, archetype, recommended_level, strength, resilience, momentum, vitality, is_boss, size_class, action_weights)
where battle_opponents.arena_id = (select id from public.battle_arenas where arena_key = 'arena_2')
  and battle_opponents.sort_order = v.sort_order;


-- ── Arena 3 — Ashrock Highlands ───────────────────────────────────────────────

update public.battle_opponents
set
  name               = v.name,
  archetype          = v.archetype,
  recommended_level  = v.recommended_level,
  strength           = v.strength,
  resilience         = v.resilience,
  momentum           = v.momentum,
  vitality           = v.vitality,
  is_active          = true,
  is_arena_boss      = v.is_boss,
  size_class         = v.size_class,
  action_weights     = v.action_weights::jsonb,
  special_action     = null
from (values
  (1, 'Pebblit',     'stony sentinel',   12, 106,  88,  70, 205, false, 'small',  '{"attack":35,"defend":60,"focus":5}'),
  (2, 'Screechmite', 'armoured aggressor',13, 112,  84,  80, 215, false, 'medium', '{"attack":55,"defend":25,"focus":20}'),
  (3, 'Flintor',     'swift blade',      14, 112,  74, 108, 218, false, 'medium', '{"attack":60,"defend":15,"focus":25}'),
  (4, 'Shockmantis', 'storm scythe',     16, 118,  78, 106, 230, false, 'medium', '{"attack":65,"defend":10,"focus":25}'),
  (5, 'Thunderox',   'storm colossus',   18, 130, 110,  88, 265, true,  'large',  '{"attack":50,"defend":30,"focus":20}')
) as v(sort_order, name, archetype, recommended_level, strength, resilience, momentum, vitality, is_boss, size_class, action_weights)
where battle_opponents.arena_id = (select id from public.battle_arenas where arena_key = 'arena_3')
  and battle_opponents.sort_order = v.sort_order;


-- ── Boss special actions ──────────────────────────────────────────────────────

-- 010 Leviamire (Arena 2 boss) — multi_hit ×3 @ 0.45, weight 22
update public.battle_opponents
set special_action = '{
  "type":        "multi_hit",
  "label":       "Hydra Strike",
  "description": "Leviamire lunges with all three heads in a coordinated barrage.",
  "weight":      22,
  "params":      { "hits": 3, "damage_fraction": 0.45 }
}'::jsonb
where name = 'Leviamire';

-- 015 Thunderox (Arena 3 boss) — damage_boost ×1.85, weight 24
update public.battle_opponents
set special_action = '{
  "type":        "damage_boost",
  "label":       "Thunder Charge",
  "description": "Thunderox builds a storm across its broken horns and releases it in one catastrophic blow.",
  "weight":      24,
  "params":      { "multiplier": 1.85 }
}'::jsonb
where name = 'Thunderox';


-- ── Re-wire Arena 3 unlock to Leviamire ──────────────────────────────────────
-- Migration 050 relied on ON CONFLICT preserving the Pyrestone Colossus row UUID,
-- which would then become Leviamire. Since that upsert never ran, arena_3's
-- unlock_requires_boss_opponent_id still points to the old Pyrestone Colossus row.
-- Update it to point to the Leviamire row now that it exists under the correct name.

update public.battle_arenas
set unlock_requires_boss_opponent_id = (
  select id from public.battle_opponents where name = 'Leviamire' limit 1
)
where arena_key = 'arena_3';
