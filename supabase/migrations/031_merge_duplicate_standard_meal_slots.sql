-- Slice A: merge duplicate standard-slot meals (Breakfast/Lunch/Dinner/Snack) per daily_log,
-- then enforce one row per (daily_log_id, meal_type) via partial unique index.
-- Invariant: per daily_log, sum(meal_items.line_total_calories) unchanged (items only change meal_id).

create temporary table slot_merge_affected_logs (daily_log_id uuid primary key) on commit drop;

insert into slot_merge_affected_logs (daily_log_id)
select distinct m.daily_log_id
from public.meals m
where m.meal_type in ('Breakfast', 'Lunch', 'Dinner', 'Snack')
group by m.daily_log_id, m.meal_type
having count(*) > 1;

-- Keeper per (daily_log_id, meal_type): earliest created_at, then smallest id.
with ranked as (
  select
    m.id,
    m.daily_log_id,
    m.meal_type,
    first_value(m.id) over (
      partition by m.daily_log_id, m.meal_type
      order by m.created_at asc, m.id asc
    ) as keeper_id
  from public.meals m
  where m.meal_type in ('Breakfast', 'Lunch', 'Dinner', 'Snack')
),
repoint as (
  select r.id as dupe_meal_id, r.keeper_id
  from ranked r
  where r.id <> r.keeper_id
)
update public.meal_items mi
set meal_id = p.keeper_id
from repoint p
where mi.meal_id = p.dupe_meal_id;

with ranked as (
  select
    m.id,
    first_value(m.id) over (
      partition by m.daily_log_id, m.meal_type
      order by m.created_at asc, m.id asc
    ) as keeper_id
  from public.meals m
  where m.meal_type in ('Breakfast', 'Lunch', 'Dinner', 'Snack')
),
to_remove as (
  select r.id as meal_id
  from ranked r
  where r.id <> r.keeper_id
)
delete from public.meals m
using to_remove tr
where m.id = tr.meal_id;

-- Recompute meal aggregates from lines (keepers + any co-located meals on affected days).
update public.meals m
set
  total_calories = coalesce(a.sum_line_cal, 0),
  item_count = coalesce(a.item_n, 0),
  updated_at = now()
from (
  select
    m2.id as meal_id,
    sum(mi.line_total_calories)::integer as sum_line_cal,
    count(mi.id)::integer as item_n
  from public.meals m2
  left join public.meal_items mi on mi.meal_id = m2.id
  where m2.daily_log_id in (select daily_log_id from slot_merge_affected_logs)
  group by m2.id
) a
where m.id = a.meal_id;

update public.daily_logs dl
set
  total_calories = coalesce(d.sum_meal_cal, 0),
  meal_count = coalesce(d.meal_n, 0),
  updated_at = now()
from (
  select
    m.daily_log_id,
    sum(m.total_calories)::integer as sum_meal_cal,
    count(*)::integer as meal_n
  from public.meals m
  where m.daily_log_id in (select daily_log_id from slot_merge_affected_logs)
  group by m.daily_log_id
) d
where dl.id = d.daily_log_id;

create unique index if not exists meals_one_row_per_standard_slot
  on public.meals (daily_log_id, meal_type)
  where meal_type in ('Breakfast', 'Lunch', 'Dinner', 'Snack');
