-- Add size_class to battle_opponents.
-- Three tiers drive opponent display size in the battle renderer independently
-- of the player companion's stage, removing the old "opponent always smaller
-- than companion" constraint.
--
--   small  →  96 px   (finches, pups, wisps)
--   medium → 144 px   (default for all opponents)
--   large  → 192 px   (bosses, colossi, dragons)
--
-- All 15 opponents default to 'medium'. Override individually to taste:
--   update public.battle_opponents set size_class = 'large' where name = 'Sunscale Drake';

alter table public.battle_opponents
  add column if not exists size_class text not null default 'medium'
    check (size_class in ('small', 'medium', 'large'));
