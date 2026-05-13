-- 063_cubic_xp_curve.sql
-- Replace linear XP curve with cubic: level = floor(totalXp ^ (1/3)) + 1
--
-- Linear was: floor(xp / 100) + 1 — flat 100 XP per level forever.
-- Cubic gives: L2=1 XP, L5=64, L10=729, L15=2744, L20=6859
-- Early levels are fast; high levels require sustained engagement.
-- Retroactive: existing XP holders are promoted (e.g. 400 XP → L8, up from L5).
--
-- Also updates creature_finalization_xp to match the new nutrition XP design:
--   Log all meals:       40 XP (base, any meals present)
--   Adherence >= 70:    +30 XP
--   No meals logged:     0 XP
-- The streak bonus is removed; adherence quality is the primary signal.

-- ── 1. Level formula ─────────────────────────────────────────────────────────

create or replace function public.creature_level_for_xp(p_xp integer)
returns integer
language sql
immutable
as $$
  select floor(cbrt(greatest(coalesce(p_xp, 0), 0)))::integer + 1;
$$;

-- ── 2. Nutrition XP formula (mirrored in battleSystem.ts getFinalizationXp) ──

create or replace function public.creature_finalization_xp(
  p_adjusted_adherence numeric,
  p_status text,
  p_current_streak integer  -- retained for signature compat; no longer used
)
returns integer
language sql
immutable
as $$
  select case
    when p_status = 'no_data' then 0
    else 40 + case when coalesce(p_adjusted_adherence, 0) >= 70 then 30 else 0 end
  end;
$$;
