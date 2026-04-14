-- 028_special_action_column.sql
-- Adds a special_action column to battle_opponents to enable per-opponent
-- ability extensibility without modifying the core action enum.
--
-- Design intent:
--   • The 3 base actions (attack / defend / focus) remain universal and are
--     used for all opponents today and via the AI weight system.
--   • special_action is an optional 4th ability unique to a specific opponent,
--     enabling boss encounters and Arena 3 variety in Phase 3.
--   • The column is null for all current opponents; the combat loop does not
--     reference it yet.  A future migration will add the handler case to
--     submit_battle_action and populate select boss opponents.
--
-- special_action JSONB shape (when populated):
--   {
--     "type": "damage_boost" | "status_apply" | "multi_hit",
--     "label": string,          -- display name shown in battle UI
--     "description": string,    -- tooltip / flavour text
--     "weight": number,         -- 0–100, added on top of action_weights
--     "params": { ... }         -- type-specific parameters
--   }
--
--   damage_boost  params: { multiplier: number }
--   status_apply  params: { effect: "burn" | "slow", duration_rounds: number }
--   multi_hit     params: { hits: number, damage_fraction: number }

alter table public.battle_opponents
  add column if not exists special_action jsonb default null;

comment on column public.battle_opponents.special_action is
  'Optional 4th per-opponent ability for Phase 3 boss encounters. '
  'Null = no special action (all current opponents). '
  'Shape: { type, label, description, weight, params }. '
  'Handler case not yet wired in submit_battle_action.';
