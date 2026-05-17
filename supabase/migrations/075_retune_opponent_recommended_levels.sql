-- 075_retune_opponent_recommended_levels.sql
--
-- Retune opponent recommended levels for the cubic XP curve.
--
-- Design target:
--   * Keep snapshot behavior unchanged; level unlocks apply from the next battle
--     snapshot, not immediately after same-day XP gains.
--   * Solgryth should be recommended level 20 so Overdrive and the 5-pip cap are
--     available only when the player enters the final-boss snapshot at level 20.
--   * Perfect daily logging + one new node/day ends below level 20.
--   * Perfect daily logging + one new node/day + roughly 3 distinct rewarded
--     rematches/day reaches level 20 before Solgryth.
--
-- This changes only battle_opponents.recommended_level. Authored stats, action
-- weights, boss specials, arena gates, XP formulas, and snapshot behavior stay
-- unchanged.

with tuned_levels(arena_key, sort_order, recommended_level) as (
  values
    ('arena_1', 1,  3),
    ('arena_1', 2,  4),
    ('arena_1', 3,  5),
    ('arena_1', 4,  6),
    ('arena_1', 5,  7),
    ('arena_2', 1,  7),
    ('arena_2', 2,  8),
    ('arena_2', 3,  9),
    ('arena_2', 4, 10),
    ('arena_2', 5, 11),
    ('arena_3', 1, 10),
    ('arena_3', 2, 11),
    ('arena_3', 3, 12),
    ('arena_3', 4, 14),
    ('arena_3', 5, 15),
    ('arena_4', 1, 14),
    ('arena_4', 2, 15),
    ('arena_4', 3, 16),
    ('arena_4', 4, 18),
    ('arena_4', 5, 19),
    ('arena_5', 1, 16),
    ('arena_5', 2, 17),
    ('arena_5', 3, 18),
    ('arena_5', 4, 19),
    ('arena_5', 5, 20)
)
update public.battle_opponents o
set recommended_level = tuned_levels.recommended_level
from public.battle_arenas a
join tuned_levels
  on tuned_levels.arena_key = a.arena_key
where o.arena_id = a.id
  and o.sort_order = tuned_levels.sort_order
  and o.recommended_level != tuned_levels.recommended_level;
