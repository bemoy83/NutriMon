-- 052_deactivate_legacy_opponents.sql
-- Migration 050 upserted the 25 Worldspire Dex creatures via ON CONFLICT (arena_id, sort_order).
-- Any pre-Worldspire opponent row that did not share a (arena_id, sort_order) pair with a
-- Worldspire creature was left untouched and is_active = true, causing it to surface in RPCs
-- and the world map.
--
-- This migration deactivates every opponent whose name is not in the canonical Worldspire 25.
-- Rows are NOT deleted so that historical battle_runs records are preserved.

update public.battle_opponents
set is_active = false
where name not in (
  -- Arena 1 — Verdantroot Forest
  'Bramblin', 'Mushbob', 'Mossboar', 'Thornfang', 'Elderhorn',
  -- Arena 2 — Murkmire Wetlands
  'Boglet', 'Mudmaul', 'Reedstalker', 'Mirewidow', 'Leviamire',
  -- Arena 3 — Ashrock Highlands
  'Pebblit', 'Screechmite', 'Flintor', 'Shockmantis', 'Thunderox',
  -- Arena 4 — Frostveil Peaks
  'Frostscarab', 'Glaciowyrm', 'Glaciermaw', 'Frostwraith', 'Tuskraal',
  -- Arena 5 — Sunforge Summit
  'Pyrobeetle', 'Magmacrab', 'Ashraptor', 'Cindershell', 'Solgryth'
);
