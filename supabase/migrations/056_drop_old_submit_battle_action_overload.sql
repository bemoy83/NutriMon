-- Migration 056: Drop stale submit_battle_action(uuid, text) overload
--
-- Migration 055 added p_skill_id (text default null) to submit_battle_action,
-- which in PostgreSQL creates a NEW overloaded function rather than replacing
-- the old 2-param version. PostgREST resolves ambiguous calls against the
-- wrong overload (the 054 version), so Attack/Defend/Focus calls hit the old
-- function instead of the pip-aware 055 version.
--
-- Dropping the 2-param overload forces all calls to the 3-param version.
-- The default (null) means callers that omit p_skill_id still work.

drop function if exists public.submit_battle_action(uuid, text);
