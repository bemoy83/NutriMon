-- Seed opponents for Arena 2 (Ashrock Peaks) and Arena 3 (Crystalspire Vault).
-- Also wires the Arena 3 unlock to the Arena 2 final boss (Pyrestone Colossus).
--
-- Widen stat check constraints to allow high-tier opponent values.
-- The original schema capped strength/resilience/momentum at 100.
-- Arena 2/3 opponents exceed this — extend to 200 (matching vitality's treatment in 017).
alter table public.battle_opponents
  drop constraint if exists battle_opponents_strength_check,
  drop constraint if exists battle_opponents_resilience_check,
  drop constraint if exists battle_opponents_momentum_check;

alter table public.battle_opponents
  add constraint battle_opponents_strength_check   check (strength   >= 0 and strength   <= 200),
  add constraint battle_opponents_resilience_check check (resilience >= 0 and resilience <= 200),
  add constraint battle_opponents_momentum_check   check (momentum   >= 0 and momentum   <= 200);

-- Stat philosophy:
--   Arena 1 final stats: str 72, res 66, mom 68, vit 190   (level 5)
--   Arena 2 spans levels 6–12, volcanic bruisers — high strength, moderate speed
--   Arena 3 spans levels 13–20, prestige — all stats elevated, boss is punishing
--
-- Vitality range: Arena 2 → 200–260, Arena 3 → 260–340
-- (vitality constraint: 50–300, checked in migration 017)

-- ── Arena 2 — Ashrock Peaks ───────────────────────────────────────────────────
with arena as (
  select id from public.battle_arenas where arena_key = 'arena_2'
)
insert into public.battle_opponents (
  arena_id, name, archetype,
  recommended_level, strength, resilience, momentum, vitality,
  sort_order, unlock_level, is_active, is_arena_boss, action_weights
)
select
  arena.id,
  seed.name, seed.archetype,
  seed.recommended_level, seed.strength, seed.resilience, seed.momentum, seed.vitality,
  seed.sort_order, seed.unlock_level, true, seed.is_boss,
  seed.action_weights::jsonb
from arena
cross join (
  values
    -- name, archetype, rec_lvl, str, res, mom, vit, sort, unlock_lvl, is_boss, action_weights
    ('Ember Goat',          'reckless charger',  6,  78, 58, 62, 200, 1, 1,  false, '{"attack":90,"defend":0,"focus":10}'),
    ('Magma Crab',          'armoured slowpoke', 8,  80, 82, 44, 215, 2, 1,  false, '{"attack":40,"defend":60,"focus":0}'),
    ('Cindertail Fox',      'tricky skirmisher', 9,  84, 62, 78, 225, 3, 2,  false, '{"attack":50,"defend":20,"focus":30}'),
    ('Ashwing Hawk',        'aerial striker',   11,  92, 60, 86, 235, 4, 3,  false, '{"attack":60,"defend":10,"focus":30}'),
    ('Pyrestone Colossus',  'volcanic warlord', 12, 100, 90, 76, 260, 5, 4,  true,  '{"attack":55,"defend":25,"focus":20}')
) as seed(name, archetype, recommended_level, strength, resilience, momentum, vitality, sort_order, unlock_level, is_boss, action_weights)
on conflict (arena_id, sort_order) do update
  set name               = excluded.name,
      archetype          = excluded.archetype,
      recommended_level  = excluded.recommended_level,
      strength           = excluded.strength,
      resilience         = excluded.resilience,
      momentum           = excluded.momentum,
      vitality           = excluded.vitality,
      unlock_level       = excluded.unlock_level,
      is_active          = excluded.is_active,
      is_arena_boss      = excluded.is_arena_boss,
      action_weights     = excluded.action_weights;

-- Mark Pyrestone Colossus as the arena_2 boss
update public.battle_opponents
  set is_arena_boss = true
  where name = 'Pyrestone Colossus';

-- Wire Arena 3 unlock: requires defeating Pyrestone Colossus
update public.battle_arenas
  set unlock_requires_boss_opponent_id = (
    select id from public.battle_opponents where name = 'Pyrestone Colossus' limit 1
  )
  where arena_key = 'arena_3'
    and unlock_requires_boss_opponent_id is null;


-- ── Arena 3 — Crystalspire Vault ─────────────────────────────────────────────
with arena as (
  select id from public.battle_arenas where arena_key = 'arena_3'
)
insert into public.battle_opponents (
  arena_id, name, archetype,
  recommended_level, strength, resilience, momentum, vitality,
  sort_order, unlock_level, is_active, is_arena_boss, action_weights
)
select
  arena.id,
  seed.name, seed.archetype,
  seed.recommended_level, seed.strength, seed.resilience, seed.momentum, seed.vitality,
  seed.sort_order, seed.unlock_level, true, seed.is_boss,
  seed.action_weights::jsonb
from arena
cross join (
  values
    -- name, archetype, rec_lvl, str, res, mom, vit, sort, unlock_lvl, is_boss, action_weights
    ('Frostclaw Wolf',    'predatory hunter',   13, 106, 78,  90, 260, 1, 1,  false, '{"attack":65,"defend":10,"focus":25}'),
    ('Void Wisp',         'elusive phantom',    14, 100, 72, 108, 265, 2, 1,  false, '{"attack":45,"defend":15,"focus":40}'),
    ('Prism Golem',       'crystalline tank',   16, 108, 112, 68, 280, 3, 2,  false, '{"attack":35,"defend":65,"focus":0}'),
    ('Shatterhorn Dragon','berserker apex',      18, 118, 96,  98, 295, 4, 3,  false, '{"attack":70,"defend":10,"focus":20}'),
    ('The Vault Guardian','ancient sovereign',   20, 128, 120, 110, 300, 5, 4,  true, '{"attack":50,"defend":30,"focus":20}')
) as seed(name, archetype, recommended_level, strength, resilience, momentum, vitality, sort_order, unlock_level, is_boss, action_weights)
on conflict (arena_id, sort_order) do update
  set name               = excluded.name,
      archetype          = excluded.archetype,
      recommended_level  = excluded.recommended_level,
      strength           = excluded.strength,
      resilience         = excluded.resilience,
      momentum           = excluded.momentum,
      vitality           = excluded.vitality,
      unlock_level       = excluded.unlock_level,
      is_active          = excluded.is_active,
      is_arena_boss      = excluded.is_arena_boss,
      action_weights     = excluded.action_weights;

-- Mark The Vault Guardian as the arena_3 boss
update public.battle_opponents
  set is_arena_boss = true
  where name = 'The Vault Guardian';
