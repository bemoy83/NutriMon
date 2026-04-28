-- 048_world_map_five_biomes.sql
-- Seed arenas 4 and 5 to complete the 5-biome world map structure.
-- Arenas 1–3 already exist. Unlock chains for arenas 3–5 are wired when
-- boss opponents are seeded (separate content migrations per biome).

insert into public.battle_arenas (arena_key, name, description, sort_order, is_active)
values
  ('arena_4', 'Frostpeak Ridge',   'A frozen highland where only the most resilient companions survive.', 4, true),
  ('arena_5', 'Emberveil Summit',  'The volcanic apex — final proving ground for champion-tier companions.', 5, true)
on conflict (arena_key) do update
  set name        = excluded.name,
      description = excluded.description,
      sort_order  = excluded.sort_order,
      is_active   = excluded.is_active;
