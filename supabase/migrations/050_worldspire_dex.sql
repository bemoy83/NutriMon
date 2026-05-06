-- 050_worldspire_dex.sql
-- Replace all placeholder opponents with the Worldspire Dex (25 creatures, 5 biomes).
-- Update arena names to match the finalised world structure.
-- Wire arena 4 & 5 unlock chains.
-- All sprites are registered in src/lib/sprites.ts but commented out pending art delivery.
--
-- Progression design:
--   Arena 1 Verdantroot Forest  — levels  1–5   (baby stage; first week of logging)
--   Arena 2 Murkmire Wetlands   — levels  6–11  (adult unlocks mid-biome at 7-day streak)
--   Arena 3 Ashrock Highlands   — levels 12–18  (adult/champion transition)
--   Arena 4 Frostveil Peaks     — levels 19–26  (champion territory)
--   Arena 5 Sunforge Summit     — levels 27–35  (endgame)
--
-- Stat constraints (enforced by earlier migrations):
--   strength / resilience / momentum : 0–200
--   vitality                         : 50–300
--
-- Power formula (for reference when tuning):
--   opponent_power = str×0.34 + res×0.22 + mom×0.18 + clamp(vit−50,0,100)×0.26 + level×2
--   player_power   = str×0.32 + res×0.22 + mom×0.18 + clamp(vit−50,0,100)×0.28 + level×2 + stage_bonus
--   stage_bonus: baby=0, adult=6, champion=12
--   outcome thresholds: favored ≥ +8, competitive ≥ −6, risky < −6


-- ── 1. Update arena names & descriptions ─────────────────────────────────────

update public.battle_arenas set
  name        = 'Verdantroot Forest',
  description = 'An ancient layered woodland of dense undergrowth, fungal decay, and towering grove guardians.'
where arena_key = 'arena_1';

update public.battle_arenas set
  name        = 'Murkmire Wetlands',
  description = 'Drowned marshes of blackwater channels, peat bogs, and submerged ancient life.'
where arena_key = 'arena_2';

update public.battle_arenas set
  name        = 'Ashrock Highlands',
  description = 'Jagged mountain ranges shaped by wind, lightning, and shifting stone.'
where arena_key = 'arena_3';

update public.battle_arenas set
  name        = 'Frostveil Peaks',
  description = 'Frozen alpine heights of glaciers, blizzards, and ancient cold-adapted life.'
where arena_key = 'arena_4';

update public.battle_arenas set
  name        = 'Sunforge Summit',
  description = 'A volcanic summit of lava flows, obsidian cliffs, and solar-forged beasts.'
where arena_key = 'arena_5';


-- ── 2. Arena 1 — Verdantroot Forest (levels 1–5) ─────────────────────────────
--
-- Nature/forest biome. Moderate, accessible difficulty for new players.
-- Archetypes: prickly defender → unstable brawler → heavy charger → quick predator → ancient guardian (boss)
--
-- Approx opponent_power: 40 → 47 → 58 → 64 → 78

with arena as (select id from public.battle_arenas where arena_key = 'arena_1')
insert into public.battle_opponents (
  arena_id, name, archetype,
  recommended_level, strength, resilience, momentum, vitality,
  sort_order, unlock_level, is_active, is_arena_boss, size_class, action_weights
)
select
  arena.id,
  v.name, v.archetype,
  v.recommended_level, v.strength, v.resilience, v.momentum, v.vitality,
  v.sort_order, 1, true, v.is_boss, v.size_class,
  v.action_weights::jsonb
from arena
cross join (values
  -- 001 Bramblin — prickly defender; turtles hard, attacks sparingly
  ('Bramblin',  'prickly defender',        1,  40,  50,  36,  78, 1, false, 'small',  '{"attack":35,"defend":55,"focus":10}'),
  -- 002 Mushbob — unstable brawler; erratic, mixes pressure with odd focus turns
  ('Mushbob',   'unstable brawler',        2,  48,  38,  54,  84, 2, false, 'small',  '{"attack":55,"defend":15,"focus":30}'),
  -- 003 Mossboar — heavy charger; durable tank that mixes attacks and defence
  ('Mossboar',  'heavy charger',           3,  58,  62,  38,  96, 3, false, 'medium', '{"attack":45,"defend":40,"focus":15}'),
  -- 004 Thornfang — quick predator; high momentum, aggressive opener
  ('Thornfang', 'quick predator',          4,  64,  44,  66, 100, 4, false, 'medium', '{"attack":60,"defend":15,"focus":25}'),
  -- 005 Elderhorn — ancient forest guardian (BOSS); balanced, special on ~20% of turns
  ('Elderhorn', 'ancient forest guardian', 5,  70,  62,  54, 130, 5, true,  'large',  '{"attack":50,"defend":25,"focus":25}')
) as v(name, archetype, recommended_level, strength, resilience, momentum, vitality, sort_order, is_boss, size_class, action_weights)
on conflict (arena_id, sort_order) do update set
  name               = excluded.name,
  archetype          = excluded.archetype,
  recommended_level  = excluded.recommended_level,
  strength           = excluded.strength,
  resilience         = excluded.resilience,
  momentum           = excluded.momentum,
  vitality           = excluded.vitality,
  unlock_level       = excluded.unlock_level,
  is_active          = excluded.is_active,
  is_arena_boss      = excluded.is_arena_boss,
  size_class         = excluded.size_class,
  action_weights     = excluded.action_weights,
  special_action     = null;  -- cleared here; bosses get specials re-applied at end of migration


-- ── 3. Arena 2 — Murkmire Wetlands (levels 6–11) ─────────────────────────────
--
-- Swamp biome. Mix of slow armoured brutes and surprising agility.
-- Archetypes: gaping ambusher → armoured bulldozer → aerial skirmisher → patient ambusher → swamp titan (boss)
--
-- Approx opponent_power: 86 → 95 → 99 → 104 → 110

with arena as (select id from public.battle_arenas where arena_key = 'arena_2')
insert into public.battle_opponents (
  arena_id, name, archetype,
  recommended_level, strength, resilience, momentum, vitality,
  sort_order, unlock_level, is_active, is_arena_boss, size_class, action_weights
)
select
  arena.id,
  v.name, v.archetype,
  v.recommended_level, v.strength, v.resilience, v.momentum, v.vitality,
  v.sort_order, 1, true, v.is_boss, v.size_class,
  v.action_weights::jsonb
from arena
cross join (values
  -- 006 Boglet — gaping ambusher; wide mouth, balanced aggression
  ('Boglet',     'gaping ambusher',    6,  74,  58,  62, 145, 1, false, 'small',  '{"attack":60,"defend":20,"focus":20}'),
  -- 007 Mudmaul — armoured bulldozer; extremely defensive, high strength
  ('Mudmaul',    'armoured bulldozer', 8,  84,  84,  42, 160, 2, false, 'medium', '{"attack":40,"defend":60,"focus":0}'),
  -- 008 Reedstalker — aerial skirmisher; fast needle-bird, loves Focus→Attack
  ('Reedstalker','aerial skirmisher',  9,  80,  54,  90, 162, 3, false, 'medium', '{"attack":55,"defend":15,"focus":30}'),
  -- 009 Mirewidow — patient ambusher; wide-leg spider, charges then strikes
  ('Mirewidow',  'patient ambusher',  10,  84,  70,  76, 175, 4, false, 'medium', '{"attack":45,"defend":25,"focus":30}'),
  -- 010 Leviamire — ancient swamp titan (BOSS); multi-head, special multi-hit barrage
  ('Leviamire',  'ancient swamp titan',11, 98,  80,  64, 200, 5, true,  'large',  '{"attack":50,"defend":25,"focus":25}')
) as v(name, archetype, recommended_level, strength, resilience, momentum, vitality, sort_order, is_boss, size_class, action_weights)
on conflict (arena_id, sort_order) do update set
  name               = excluded.name,
  archetype          = excluded.archetype,
  recommended_level  = excluded.recommended_level,
  strength           = excluded.strength,
  resilience         = excluded.resilience,
  momentum           = excluded.momentum,
  vitality           = excluded.vitality,
  unlock_level       = excluded.unlock_level,
  is_active          = excluded.is_active,
  is_arena_boss      = excluded.is_arena_boss,
  size_class         = excluded.size_class,
  action_weights     = excluded.action_weights,
  special_action     = null;


-- ── 4. Arena 3 — Ashrock Highlands (levels 12–18) ────────────────────────────
--
-- Stone/storm biome. Stats climb significantly; adult→champion transition zone.
-- Archetypes: stony sentinel → armoured aggressor → swift blade → storm scythe → storm colossus (boss)
--
-- Approx opponent_power: 118 → 123 → 128 → 134 → 146

with arena as (select id from public.battle_arenas where arena_key = 'arena_3')
insert into public.battle_opponents (
  arena_id, name, archetype,
  recommended_level, strength, resilience, momentum, vitality,
  sort_order, unlock_level, is_active, is_arena_boss, size_class, action_weights
)
select
  arena.id,
  v.name, v.archetype,
  v.recommended_level, v.strength, v.resilience, v.momentum, v.vitality,
  v.sort_order, 1, true, v.is_boss, v.size_class,
  v.action_weights::jsonb
from arena
cross join (values
  -- 011 Pebblit — stony sentinel; small but walls up; punishes aggression
  ('Pebblit',     'stony sentinel',   12, 106,  88,  70, 205, 1, false, 'small',  '{"attack":35,"defend":60,"focus":5}'),
  -- 012 Screechmite — armoured aggressor; jaw-beetle, steady pressure
  ('Screechmite', 'armoured aggressor',13, 112,  84,  80, 215, 2, false, 'medium', '{"attack":55,"defend":25,"focus":20}'),
  -- 013 Flintor — swift blade; serrated back, high momentum, likes Focus combos
  ('Flintor',     'swift blade',      14, 112,  74, 108, 218, 3, false, 'medium', '{"attack":60,"defend":15,"focus":25}'),
  -- 014 Shockmantis — storm scythe; fastest non-boss in biome, heavy attack bias
  ('Shockmantis', 'storm scythe',     16, 118,  78, 106, 230, 4, false, 'medium', '{"attack":65,"defend":10,"focus":25}'),
  -- 015 Thunderox — storm colossus (BOSS); broken horns, brutal damage_boost special
  ('Thunderox',   'storm colossus',   18, 130, 110,  88, 265, 5, true,  'large',  '{"attack":50,"defend":30,"focus":20}')
) as v(name, archetype, recommended_level, strength, resilience, momentum, vitality, sort_order, is_boss, size_class, action_weights)
on conflict (arena_id, sort_order) do update set
  name               = excluded.name,
  archetype          = excluded.archetype,
  recommended_level  = excluded.recommended_level,
  strength           = excluded.strength,
  resilience         = excluded.resilience,
  momentum           = excluded.momentum,
  vitality           = excluded.vitality,
  unlock_level       = excluded.unlock_level,
  is_active          = excluded.is_active,
  is_arena_boss      = excluded.is_arena_boss,
  size_class         = excluded.size_class,
  action_weights     = excluded.action_weights,
  special_action     = null;


-- ── 5. Arena 4 — Frostveil Peaks (levels 19–26) ──────────────────────────────
--
-- Ice biome. Champion-stage territory; tank-heavy opponents with cryo resilience.
-- Archetypes: glacial bulwark → relentless tunneler → frozen juggernaut → frost phantom → tundra warlord (boss)
--
-- Approx opponent_power: 133 → 142 → 152 → 154 → 156

with arena as (select id from public.battle_arenas where arena_key = 'arena_4')
insert into public.battle_opponents (
  arena_id, name, archetype,
  recommended_level, strength, resilience, momentum, vitality,
  sort_order, unlock_level, is_active, is_arena_boss, size_class, action_weights
)
select
  arena.id,
  v.name, v.archetype,
  v.recommended_level, v.strength, v.resilience, v.momentum, v.vitality,
  v.sort_order, 1, true, v.is_boss, v.size_class,
  v.action_weights::jsonb
from arena
cross join (values
  -- 016 Frostscarab — glacial bulwark; ice-shell beetle, heavily defensive opener
  ('Frostscarab', 'glacial bulwark',   19, 100, 105,  66, 268, 1, false, 'small',  '{"attack":30,"defend":65,"focus":5}'),
  -- 017 Glaciowyrm — relentless tunneler; giant-mouth worm, aggressive and hard to stop
  ('Glaciowyrm',  'relentless tunneler',21, 112,  95,  82, 278, 2, false, 'medium', '{"attack":65,"defend":15,"focus":20}'),
  -- 018 Glaciermaw — frozen juggernaut; ice-tank, slow but absorbs punishment
  ('Glaciermaw',  'frozen juggernaut', 23, 122, 118,  68, 288, 3, false, 'medium', '{"attack":40,"defend":55,"focus":5}'),
  -- 019 Frostwraith — frost phantom; fast spectre, Focus-heavy threat
  ('Frostwraith', 'frost phantom',     24, 114,  90, 120, 285, 4, false, 'medium', '{"attack":50,"defend":20,"focus":30}'),
  -- 020 Tuskraal — tundra warlord (BOSS); tusk-cluster mass, multi-hit special
  ('Tuskraal',    'tundra warlord',    26, 120, 104,  80, 300, 5, true,  'large',  '{"attack":50,"defend":30,"focus":20}')
) as v(name, archetype, recommended_level, strength, resilience, momentum, vitality, sort_order, is_boss, size_class, action_weights)
on conflict (arena_id, sort_order) do update set
  name               = excluded.name,
  archetype          = excluded.archetype,
  recommended_level  = excluded.recommended_level,
  strength           = excluded.strength,
  resilience         = excluded.resilience,
  momentum           = excluded.momentum,
  vitality           = excluded.vitality,
  unlock_level       = excluded.unlock_level,
  is_active          = excluded.is_active,
  is_arena_boss      = excluded.is_arena_boss,
  size_class         = excluded.size_class,
  action_weights     = excluded.action_weights,
  special_action     = null;


-- ── 6. Arena 5 — Sunforge Summit (levels 27–35) ──────────────────────────────
--
-- Fire/endgame biome. Max-tier threats; only well-maintained champions reach here.
-- Archetypes: magma vanguard → crushing brute → volcanic raider → basalt titan → solar apex predator (boss)
--
-- Approx opponent_power: 153 → 164 → 171 → 177 → 179
-- Solgryth is designed ~"risky" for a solid level-35 champion — requires peak nutrition.

with arena as (select id from public.battle_arenas where arena_key = 'arena_5')
insert into public.battle_opponents (
  arena_id, name, archetype,
  recommended_level, strength, resilience, momentum, vitality,
  sort_order, unlock_level, is_active, is_arena_boss, size_class, action_weights
)
select
  arena.id,
  v.name, v.archetype,
  v.recommended_level, v.strength, v.resilience, v.momentum, v.vitality,
  v.sort_order, 1, true, v.is_boss, v.size_class,
  v.action_weights::jsonb
from arena
cross join (values
  -- 021 Pyrobeetle — magma vanguard; glowing armoured beetle, defensive + tanky
  ('Pyrobeetle',  'magma vanguard',    27, 104, 110,  76, 265, 1, false, 'small',  '{"attack":40,"defend":50,"focus":10}'),
  -- 022 Magmacrab — crushing brute; one-giant-claw asymmetry, strong all-round
  ('Magmacrab',   'crushing brute',    29, 122, 108,  84, 276, 2, false, 'medium', '{"attack":55,"defend":35,"focus":10}'),
  -- 023 Ashraptor — volcanic raider; tall lava runner, momentum-dominant threat
  ('Ashraptor',   'volcanic raider',   31, 114,  94, 128, 276, 3, false, 'medium', '{"attack":65,"defend":10,"focus":25}'),
  -- 024 Cindershell — basalt titan; walking dome, highest resilience in the game
  ('Cindershell', 'basalt titan',      33, 122, 138,  72, 288, 4, false, 'medium', '{"attack":40,"defend":50,"focus":10}'),
  -- 025 Solgryth — solar apex predator (BOSS); radial-wing burst, damage_boost special
  ('Solgryth',    'solar apex predator',35,120, 108, 104, 300, 5, true,  'large',  '{"attack":55,"defend":25,"focus":20}')
) as v(name, archetype, recommended_level, strength, resilience, momentum, vitality, sort_order, is_boss, size_class, action_weights)
on conflict (arena_id, sort_order) do update set
  name               = excluded.name,
  archetype          = excluded.archetype,
  recommended_level  = excluded.recommended_level,
  strength           = excluded.strength,
  resilience         = excluded.resilience,
  momentum           = excluded.momentum,
  vitality           = excluded.vitality,
  unlock_level       = excluded.unlock_level,
  is_active          = excluded.is_active,
  is_arena_boss      = excluded.is_arena_boss,
  size_class         = excluded.size_class,
  action_weights     = excluded.action_weights,
  special_action     = null;


-- ── 7. Wire arena unlock chains for arenas 4 and 5 ───────────────────────────
-- Arena 3 is already locked behind the arena-2 boss (updated in-place to Leviamire above).
-- Arena 4 requires defeating Thunderox (arena-3 boss).
-- Arena 5 requires defeating Tuskraal (arena-4 boss).

update public.battle_arenas
  set unlock_requires_boss_opponent_id = (
    select id from public.battle_opponents where name = 'Thunderox' limit 1
  )
where arena_key = 'arena_4';

update public.battle_arenas
  set unlock_requires_boss_opponent_id = (
    select id from public.battle_opponents where name = 'Tuskraal' limit 1
  )
where arena_key = 'arena_5';


-- ── 8. Boss special actions ───────────────────────────────────────────────────
-- All five arena bosses get unique specials. Weight = pre-empt probability per turn (0–100).
-- damage_boost multiplier range: 1.5–2.0 (above 2.5 risks one-shot KOs at close power parity).
-- multi_hit: hits × damage_fraction should total ~1.2–1.4× a normal attack for high tension.

-- 005 Elderhorn (Arena 1 boss, lvl 5) — damage_boost ×1.6, weight 20
update public.battle_opponents
set special_action = '{
  "type":        "damage_boost",
  "label":       "Antler Slam",
  "description": "Elderhorn channels the forest and drives its crown forward in a devastating charge.",
  "weight":      20,
  "params":      { "multiplier": 1.6 }
}'::jsonb
where name = 'Elderhorn';

-- 010 Leviamire (Arena 2 boss, lvl 11) — multi_hit ×3 @ 0.45, weight 22
-- 3 hits × 0.45 = ~135% total damage; each hit crits independently.
update public.battle_opponents
set special_action = '{
  "type":        "multi_hit",
  "label":       "Hydra Strike",
  "description": "Leviamire lunges with all three heads in a coordinated barrage.",
  "weight":      22,
  "params":      { "hits": 3, "damage_fraction": 0.45 }
}'::jsonb
where name = 'Leviamire';

-- 015 Thunderox (Arena 3 boss, lvl 18) — damage_boost ×1.85, weight 24
update public.battle_opponents
set special_action = '{
  "type":        "damage_boost",
  "label":       "Thunder Charge",
  "description": "Thunderox builds a storm across its broken horns and releases it in one catastrophic blow.",
  "weight":      24,
  "params":      { "multiplier": 1.85 }
}'::jsonb
where name = 'Thunderox';

-- 020 Tuskraal (Arena 4 boss, lvl 26) — multi_hit ×3 @ 0.45, weight 24
update public.battle_opponents
set special_action = '{
  "type":        "multi_hit",
  "label":       "Tusk Barrage",
  "description": "Tuskraal sweeps its tusk cluster in a rapid triple strike, each blow capable of a critical hit.",
  "weight":      24,
  "params":      { "hits": 3, "damage_fraction": 0.45 }
}'::jsonb
where name = 'Tuskraal';

-- 025 Solgryth (Arena 5 boss, lvl 35) — damage_boost ×2.0, weight 26
-- Highest weight and multiplier in the game; the final boss deserves to be feared.
update public.battle_opponents
set special_action = '{
  "type":        "damage_boost",
  "label":       "Solar Flare",
  "description": "Solgryth ignites its wings in a solar burst, releasing a concentrated beam of volcanic energy.",
  "weight":      26,
  "params":      { "multiplier": 2.0 }
}'::jsonb
where name = 'Solgryth';
