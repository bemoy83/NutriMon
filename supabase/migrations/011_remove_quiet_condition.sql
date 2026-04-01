-- 011_remove_quiet_condition.sql
-- Simplify creature condition logic to thriving | steady | recovering.

begin;

update public.creature_battle_snapshots
set condition = case
  when readiness_score < 50 then 'recovering'
  else 'steady'
end
where condition = 'quiet';

with latest_snapshot as (
  select distinct on (user_id)
    user_id,
    condition
  from public.creature_battle_snapshots
  order by user_id, battle_date desc, created_at desc
)
update public.creature_companions c
set current_condition = coalesce(
  (select s.condition from latest_snapshot s where s.user_id = c.user_id),
  'steady'
)
where c.current_condition = 'quiet';

alter table public.creature_companions
  drop constraint if exists creature_companions_current_condition_check;

alter table public.creature_companions
  add constraint creature_companions_current_condition_check
  check (current_condition in ('thriving', 'steady', 'recovering'));

alter table public.creature_battle_snapshots
  drop constraint if exists creature_battle_snapshots_condition_check;

alter table public.creature_battle_snapshots
  add constraint creature_battle_snapshots_condition_check
  check (condition in ('thriving', 'steady', 'recovering'));

create or replace function public.creature_condition_from_metrics(
  p_has_meals boolean,
  p_adjusted_adherence numeric,
  p_current_streak integer,
  p_days_logged_last_7 integer,
  p_readiness_score integer
)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_readiness_score, 0) >= 88 and coalesce(p_adjusted_adherence, 0) >= 85 and coalesce(p_current_streak, 0) >= 3 then 'thriving'
    when not coalesce(p_has_meals, false) or coalesce(p_adjusted_adherence, 0) < 70 or coalesce(p_readiness_score, 0) < 50 then 'recovering'
    else 'steady'
  end;
$$;

commit;
