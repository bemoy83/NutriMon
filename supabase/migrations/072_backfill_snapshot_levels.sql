-- Migration 072: backfill creature_battle_snapshots.level to cubic XP values
--
-- Migration 063 introduced the cubic XP curve (level = floor(cbrt(xp)) + 1).
-- Migration 065 backfilled creature_companions.level but left existing
-- creature_battle_snapshots rows untouched.
--
-- Snapshot level is used directly by start_battle_run for player_max_hp
-- (vitality * 0.7 + level * 2), by submit_battle_action for damage scaling
-- and skill unlock checks, and by battle_compute_damage. A stale linear level
-- (~72) inflates HP, damage, and pip caps relative to the intended cubic level
-- (~20).
--
-- Fix: apply the same backfill pattern as migration 065, targeting snapshots.
-- Only rows where the stored level disagrees with the derived cubic value are
-- touched (idempotent on re-run).

update public.creature_battle_snapshots
set    level = public.creature_level_for_xp(public.creature_total_xp(user_id))
where  level != public.creature_level_for_xp(public.creature_total_xp(user_id));
