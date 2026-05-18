-- 078_enforce_xp_level_authority.sql
--
-- Make XP the authority for creature levels. Level columns remain cached
-- denormalized values, but database guardrails keep them derived from XP so
-- stale app or edge-function code cannot persist old linear-level values.

-- 1. Shared XP and level helpers

create or replace function public.creature_total_xp(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (
    coalesce((
      select sum(xp_gained)
      from public.creature_battle_snapshots
      where user_id = p_user_id
    ), 0)
    +
    coalesce((
      select sum(xp_awarded)
      from public.battle_runs
      where user_id = p_user_id
        and reward_claimed = true
    ), 0)
  )::integer;
$$;

create or replace function public.creature_snapshot_xp_through_battle_date(
  p_user_id uuid,
  p_battle_date date,
  p_replacing_snapshot_id uuid default null,
  p_replacing_snapshot_battle_date date default null,
  p_replacing_snapshot_xp_gained integer default null
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (
    coalesce((
      select sum(
        case
          when p_replacing_snapshot_id is not null
            and s.id = p_replacing_snapshot_id then 0
          else s.xp_gained
        end
      )
      from public.creature_battle_snapshots s
      where s.user_id = p_user_id
        and s.battle_date <= p_battle_date
    ), 0)
    +
    case
      when p_replacing_snapshot_xp_gained is not null
        and coalesce(p_replacing_snapshot_battle_date, p_battle_date) <= p_battle_date
      then greatest(p_replacing_snapshot_xp_gained, 0)
      else 0
    end
    +
    coalesce((
      select sum(br.xp_awarded)
      from public.battle_runs br
      where br.user_id = p_user_id
        and br.reward_claimed = true
        and br.battle_date <= p_battle_date
    ), 0)
  )::integer;
$$;

create or replace function public.creature_snapshot_level(
  p_user_id uuid,
  p_battle_date date
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select public.creature_level_for_xp(
    public.creature_snapshot_xp_through_battle_date(p_user_id, p_battle_date)
  );
$$;

create or replace function public.creature_sync_companion_progress(p_user_id uuid default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_total_xp integer;
  v_level integer;
begin
  v_user_id := coalesce(p_user_id, auth.uid());
  if v_user_id is null then
    raise exception 'creature_sync_companion_progress: user_id required';
  end if;

  v_total_xp := public.creature_total_xp(v_user_id);
  v_level := public.creature_level_for_xp(v_total_xp);

  update public.creature_companions
  set xp = v_total_xp,
      level = v_level
  where user_id = v_user_id;

  return json_build_object(
    'user_id', v_user_id,
    'total_xp', v_total_xp,
    'level', v_level
  );
end;
$$;

-- 2. Normalize stale dev override rows and backfill cached levels

delete from public.creature_battle_snapshots s
using public.profiles p
where s.user_id = p.user_id
  and s.prep_date = date '2099-01-01'
  and s.battle_date = date '2099-01-02'
  and s.source_daily_evaluation_id is null
  and not coalesce(p.is_dev_account, false);

with dev_override_xp as (
  select
    s.id,
    greatest(
      0,
      power(20 - 1, 3)::integer
      -
      (
        coalesce((
          select sum(real_s.xp_gained)
          from public.creature_battle_snapshots real_s
          where real_s.user_id = s.user_id
            and real_s.id <> s.id
        ), 0)
        +
        coalesce((
          select sum(br.xp_awarded)
          from public.battle_runs br
          where br.user_id = s.user_id
            and br.reward_claimed = true
        ), 0)
      )
    ) as xp_gained
  from public.creature_battle_snapshots s
  join public.profiles p on p.user_id = s.user_id
  where s.prep_date = date '2099-01-01'
    and s.battle_date = date '2099-01-02'
    and s.source_daily_evaluation_id is null
    and coalesce(p.is_dev_account, false)
)
update public.creature_battle_snapshots s
set xp_gained = dev_override_xp.xp_gained,
    level = 20,
    stage = 'champion'
from dev_override_xp
where dev_override_xp.id = s.id;

update public.creature_companions c
set xp = public.creature_total_xp(c.user_id),
    level = public.creature_level_for_xp(public.creature_total_xp(c.user_id))
where c.xp != public.creature_total_xp(c.user_id)
   or c.level != public.creature_level_for_xp(public.creature_total_xp(c.user_id));

update public.creature_battle_snapshots s
set level = public.creature_snapshot_level(s.user_id, s.battle_date)
where s.level != public.creature_snapshot_level(s.user_id, s.battle_date);

-- 3. Write-time guardrails

create or replace function public.creature_enforce_companion_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_xp integer;
begin
  v_total_xp := public.creature_total_xp(new.user_id);
  new.xp := v_total_xp;
  new.level := public.creature_level_for_xp(v_total_xp);
  return new;
end;
$$;

drop trigger if exists creature_companions_enforce_progress
  on public.creature_companions;

create trigger creature_companions_enforce_progress
  before insert or update of user_id, xp, level
  on public.creature_companions
  for each row
  execute function public.creature_enforce_companion_progress();

create or replace function public.creature_enforce_snapshot_level()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.level := public.creature_level_for_xp(
    public.creature_snapshot_xp_through_battle_date(
      new.user_id,
      new.battle_date,
      new.id,
      new.battle_date,
      new.xp_gained
    )
  );
  return new;
end;
$$;

drop trigger if exists creature_battle_snapshots_enforce_level
  on public.creature_battle_snapshots;

create trigger creature_battle_snapshots_enforce_level
  before insert or update of user_id, battle_date, xp_gained, level
  on public.creature_battle_snapshots
  for each row
  execute function public.creature_enforce_snapshot_level();

create or replace function public.creature_sync_after_snapshot_progress_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_refresh_from date;
begin
  if tg_op = 'DELETE' then
    v_user_id := old.user_id;
    v_refresh_from := old.battle_date;
  elsif tg_op = 'UPDATE' then
    v_user_id := new.user_id;
    v_refresh_from := least(old.battle_date, new.battle_date);

    if old.user_id is distinct from new.user_id then
      perform public.creature_sync_companion_progress(old.user_id);
      update public.creature_battle_snapshots s
      set level = public.creature_snapshot_level(s.user_id, s.battle_date)
      where s.user_id = old.user_id
        and s.battle_date >= old.battle_date;
    end if;
  else
    v_user_id := new.user_id;
    v_refresh_from := new.battle_date;
  end if;

  perform public.creature_sync_companion_progress(v_user_id);

  if pg_trigger_depth() = 1 then
    update public.creature_battle_snapshots s
    set level = public.creature_snapshot_level(s.user_id, s.battle_date)
    where s.user_id = v_user_id
      and s.battle_date >= v_refresh_from
      and s.level != public.creature_snapshot_level(s.user_id, s.battle_date);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists creature_battle_snapshots_sync_progress
  on public.creature_battle_snapshots;

create trigger creature_battle_snapshots_sync_progress
  after insert or update of user_id, battle_date, xp_gained or delete
  on public.creature_battle_snapshots
  for each row
  execute function public.creature_sync_after_snapshot_progress_change();

create or replace function public.creature_sync_after_battle_run_progress_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refresh_from date;
begin
  if tg_op = 'DELETE' then
    if old.reward_claimed then
      perform public.creature_sync_companion_progress(old.user_id);
      update public.creature_battle_snapshots s
      set level = public.creature_snapshot_level(s.user_id, s.battle_date)
      where s.user_id = old.user_id
        and s.battle_date >= old.battle_date
        and s.level != public.creature_snapshot_level(s.user_id, s.battle_date);
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE'
     and old.user_id is distinct from new.user_id
     and old.reward_claimed then
    perform public.creature_sync_companion_progress(old.user_id);
    update public.creature_battle_snapshots s
    set level = public.creature_snapshot_level(s.user_id, s.battle_date)
    where s.user_id = old.user_id
      and s.battle_date >= old.battle_date
      and s.level != public.creature_snapshot_level(s.user_id, s.battle_date);
  end if;

  if new.reward_claimed then
    perform public.creature_sync_companion_progress(new.user_id);
    v_refresh_from := case
      when tg_op = 'UPDATE' then least(old.battle_date, new.battle_date)
      else new.battle_date
    end;

    update public.creature_battle_snapshots s
    set level = public.creature_snapshot_level(s.user_id, s.battle_date)
    where s.user_id = new.user_id
      and s.battle_date >= v_refresh_from
      and s.level != public.creature_snapshot_level(s.user_id, s.battle_date);
  elsif tg_op = 'UPDATE' and old.reward_claimed then
    perform public.creature_sync_companion_progress(new.user_id);
    update public.creature_battle_snapshots s
    set level = public.creature_snapshot_level(s.user_id, s.battle_date)
    where s.user_id = new.user_id
      and s.battle_date >= old.battle_date
      and s.level != public.creature_snapshot_level(s.user_id, s.battle_date);
  end if;

  return new;
end;
$$;

drop trigger if exists battle_runs_sync_creature_progress
  on public.battle_runs;

create trigger battle_runs_sync_creature_progress
  after insert or update of user_id, battle_date, xp_awarded, reward_claimed or delete
  on public.battle_runs
  for each row
  execute function public.creature_sync_after_battle_run_progress_change();

-- 4. Verification checklist
--
-- After applying this migration, useful manual checks are:
--   select user_id, level, xp,
--          public.creature_level_for_xp(public.creature_total_xp(user_id)) as derived_level
--   from public.creature_companions
--   where level != public.creature_level_for_xp(public.creature_total_xp(user_id))
--      or xp != public.creature_total_xp(user_id);
--
--   select id, user_id, battle_date, level,
--          public.creature_snapshot_level(user_id, battle_date) as derived_level
--   from public.creature_battle_snapshots
--   where level != public.creature_snapshot_level(user_id, battle_date);
