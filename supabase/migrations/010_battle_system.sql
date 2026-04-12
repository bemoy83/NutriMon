-- 010_battle_system.sql
-- Persistent companion state, battle prep snapshots, battle RPCs, and additive meal preview payloads.

create table public.creature_companions (
  user_id                  uuid primary key references auth.users(id) on delete cascade,
  name                     text not null default 'Sprout',
  stage                    text not null default 'baby' check (stage in ('baby', 'adult', 'champion')),
  level                    integer not null default 1 check (level >= 1),
  xp                       integer not null default 0 check (xp >= 0),
  current_condition        text not null default 'steady' check (current_condition in ('thriving', 'steady', 'recovering', 'quiet')),
  hatched_at               timestamptz not null default now(),
  evolved_to_adult_at      timestamptz null,
  evolved_to_champion_at   timestamptz null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger creature_companions_updated_at
  before update on public.creature_companions
  for each row execute function public.handle_updated_at();

create table public.creature_battle_snapshots (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references auth.users(id) on delete cascade,
  prep_date                  date not null,
  battle_date                date not null,
  strength                   integer not null check (strength >= 0 and strength <= 100),
  resilience                 integer not null check (resilience >= 0 and resilience <= 100),
  momentum                   integer not null check (momentum >= 0 and momentum <= 100),
  vitality                   integer not null check (vitality >= 50 and vitality <= 999),
  readiness_score            integer not null check (readiness_score >= 0 and readiness_score <= 100),
  readiness_band             text not null check (readiness_band in ('recovering', 'building', 'ready', 'peak')),
  condition                  text not null check (condition in ('thriving', 'steady', 'recovering', 'quiet')),
  level                      integer not null check (level >= 1),
  stage                      text not null check (stage in ('baby', 'adult', 'champion')),
  source_daily_evaluation_id uuid not null references public.daily_evaluations(id) on delete cascade,
  xp_gained                  integer not null default 0 check (xp_gained >= 0),
  created_at                 timestamptz not null default now(),
  unique (user_id, prep_date),
  unique (user_id, battle_date),
  unique (source_daily_evaluation_id)
);

create index creature_battle_snapshots_user_battle_date
  on public.creature_battle_snapshots (user_id, battle_date desc);

create table public.battle_arenas (
  id          uuid primary key default gen_random_uuid(),
  arena_key   text not null unique,
  name        text not null,
  description text null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.battle_opponents (
  id                uuid primary key default gen_random_uuid(),
  arena_id          uuid not null references public.battle_arenas(id) on delete cascade,
  name              text not null,
  archetype         text not null,
  recommended_level integer not null check (recommended_level >= 1),
  strength          integer not null check (strength >= 0 and strength <= 100),
  resilience        integer not null check (resilience >= 0 and resilience <= 100),
  momentum          integer not null check (momentum >= 0 and momentum <= 100),
  vitality          integer not null check (vitality >= 50 and vitality <= 150),
  sort_order        integer not null default 0,
  unlock_level      integer not null default 1 check (unlock_level >= 1),
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (arena_id, sort_order)
);

create index battle_opponents_arena_sort
  on public.battle_opponents (arena_id, sort_order asc);

create table public.battle_runs (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  battle_date            date not null,
  snapshot_id            uuid not null references public.creature_battle_snapshots(id) on delete cascade,
  opponent_id            uuid not null references public.battle_opponents(id) on delete cascade,
  outcome                text not null default 'pending' check (outcome in ('pending', 'win', 'loss')),
  turn_count             integer null check (turn_count is null or turn_count > 0),
  remaining_hp_pct       integer null check (remaining_hp_pct is null or (remaining_hp_pct >= 0 and remaining_hp_pct <= 100)),
  xp_awarded             integer not null default 0 check (xp_awarded >= 0),
  arena_progress_awarded integer not null default 0 check (arena_progress_awarded >= 0),
  reward_claimed         boolean not null default false,
  created_at             timestamptz not null default now()
);

create index battle_runs_user_battle_date
  on public.battle_runs (user_id, battle_date desc, created_at desc);

alter table public.creature_companions enable row level security;
alter table public.creature_battle_snapshots enable row level security;
alter table public.battle_arenas enable row level security;
alter table public.battle_opponents enable row level security;
alter table public.battle_runs enable row level security;

create policy "creature_companions_select" on public.creature_companions
  for select using (auth.uid() = user_id);

create policy "creature_battle_snapshots_select" on public.creature_battle_snapshots
  for select using (auth.uid() = user_id);

create policy "battle_arenas_select" on public.battle_arenas
  for select using (true);

create policy "battle_opponents_select" on public.battle_opponents
  for select using (true);

create policy "battle_runs_select" on public.battle_runs
  for select using (auth.uid() = user_id);

insert into public.battle_arenas (arena_key, name, description, sort_order, is_active)
values ('arena_1', 'Mosshollow Glen', 'A mossy forest clearing where young companions take their first steps into battle.', 1, true)
on conflict (arena_key) do update
set name = excluded.name,
    description = excluded.description,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active;

with arena as (
  select id from public.battle_arenas where arena_key = 'arena_1'
)
insert into public.battle_opponents (
  arena_id,
  name,
  archetype,
  recommended_level,
  strength,
  resilience,
  momentum,
  vitality,
  sort_order,
  unlock_level,
  is_active
)
select arena.id, seed.name, seed.archetype, seed.recommended_level, seed.strength, seed.resilience, seed.momentum, seed.vitality, seed.sort_order, seed.unlock_level, true
from arena
cross join (
  values
    ('Pebble Pup', 'steady bruiser', 1, 42, 45, 38, 78, 1, 1),
    ('Cinder Finch', 'fast opener', 2, 50, 36, 58, 82, 2, 1),
    ('Mossback Ram', 'durable tank', 3, 56, 62, 42, 92, 3, 2),
    ('Tide Lynx', 'balanced striker', 4, 64, 58, 60, 96, 4, 3),
    ('Sunscale Drake', 'arena closer', 5, 72, 66, 68, 108, 5, 4)
) as seed(name, archetype, recommended_level, strength, resilience, momentum, vitality, sort_order, unlock_level)
on conflict (arena_id, sort_order) do update
set name = excluded.name,
    archetype = excluded.archetype,
    recommended_level = excluded.recommended_level,
    strength = excluded.strength,
    resilience = excluded.resilience,
    momentum = excluded.momentum,
    vitality = excluded.vitality,
    unlock_level = excluded.unlock_level,
    is_active = excluded.is_active;

create or replace function public.creature_level_for_xp(p_xp integer)
returns integer
language sql
immutable
as $$
  select floor(greatest(coalesce(p_xp, 0), 0) / 100.0)::integer + 1;
$$;

create or replace function public.creature_stage_for_streak(p_longest_streak integer)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_longest_streak, 0) >= 30 then 'champion'
    when coalesce(p_longest_streak, 0) >= 7 then 'adult'
    else 'baby'
  end;
$$;

create or replace function public.creature_readiness_score(
  p_strength integer,
  p_resilience integer,
  p_momentum integer,
  p_vitality integer
)
returns integer
language sql
immutable
as $$
  select round(
    coalesce(p_strength, 0) * 0.30 +
    coalesce(p_resilience, 0) * 0.20 +
    coalesce(p_momentum, 0) * 0.20 +
    greatest(least(coalesce(p_vitality, 50) - 50, 100), 0) * 0.30
  )::integer;
$$;

create or replace function public.creature_readiness_band(p_score integer)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_score, 0) >= 90 then 'peak'
    when coalesce(p_score, 0) >= 75 then 'ready'
    when coalesce(p_score, 0) >= 50 then 'building'
    else 'recovering'
  end;
$$;

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
    when not coalesce(p_has_meals, false) or coalesce(p_days_logged_last_7, 0) <= 1 then 'quiet'
    when coalesce(p_readiness_score, 0) >= 88 and coalesce(p_adjusted_adherence, 0) >= 85 and coalesce(p_current_streak, 0) >= 3 then 'thriving'
    when coalesce(p_adjusted_adherence, 0) < 70 or coalesce(p_readiness_score, 0) < 50 then 'recovering'
    else 'steady'
  end;
$$;

create or replace function public.creature_stage_bonus(p_stage text)
returns integer
language sql
immutable
as $$
  select case
    when p_stage = 'champion' then 12
    when p_stage = 'adult' then 6
    else 0
  end;
$$;

create or replace function public.creature_snapshot_power(
  p_strength integer,
  p_resilience integer,
  p_momentum integer,
  p_vitality integer,
  p_level integer,
  p_stage text
)
returns integer
language sql
immutable
as $$
  select round(
    coalesce(p_strength, 0) * 0.32 +
    coalesce(p_resilience, 0) * 0.22 +
    coalesce(p_momentum, 0) * 0.18 +
    greatest(least(coalesce(p_vitality, 50) - 50, 100), 0) * 0.28 +
    coalesce(p_level, 1) * 2 +
    public.creature_stage_bonus(p_stage)
  )::integer;
$$;

create or replace function public.creature_opponent_power(
  p_strength integer,
  p_resilience integer,
  p_momentum integer,
  p_vitality integer,
  p_recommended_level integer
)
returns integer
language sql
immutable
as $$
  select round(
    coalesce(p_strength, 0) * 0.34 +
    coalesce(p_resilience, 0) * 0.22 +
    coalesce(p_momentum, 0) * 0.18 +
    greatest(least(coalesce(p_vitality, 50) - 50, 100), 0) * 0.26 +
    coalesce(p_recommended_level, 1) * 2
  )::integer;
$$;

create or replace function public.creature_likely_outcome(
  p_strength integer,
  p_resilience integer,
  p_momentum integer,
  p_vitality integer,
  p_level integer,
  p_stage text,
  p_opp_strength integer,
  p_opp_resilience integer,
  p_opp_momentum integer,
  p_opp_vitality integer,
  p_opp_level integer
)
returns text
language sql
immutable
as $$
  with diff as (
    select public.creature_snapshot_power(
      p_strength,
      p_resilience,
      p_momentum,
      p_vitality,
      p_level,
      p_stage
    ) - public.creature_opponent_power(
      p_opp_strength,
      p_opp_resilience,
      p_opp_momentum,
      p_opp_vitality,
      p_opp_level
    ) as value
  )
  select case
    when value >= 8 then 'favored'
    when value >= -6 then 'competitive'
    else 'risky'
  end
  from diff;
$$;

create or replace function public.creature_finalization_xp(
  p_adjusted_adherence numeric,
  p_status text,
  p_current_streak integer
)
returns integer
language sql
immutable
as $$
  select case
    when p_status = 'no_data' or coalesce(p_adjusted_adherence, 0) < 70 then 0
    else 15 + least(coalesce(p_current_streak, 0), 10) + case when coalesce(p_adjusted_adherence, 0) >= 90 then 5 else 0 end
  end;
$$;

create or replace function public.creature_total_xp(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select sum(xp_gained) from public.creature_battle_snapshots where user_id = p_user_id), 0) +
    coalesce((select sum(xp_awarded) from public.battle_runs where user_id = p_user_id and reward_claimed = true), 0);
$$;

create or replace function public.creature_recommended_opponent(
  p_snapshot_id uuid,
  p_level integer
)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with snapshot as (
    select *
    from public.creature_battle_snapshots
    where id = p_snapshot_id
  ),
  candidates as (
    select
      o.*,
      public.creature_likely_outcome(
        s.strength,
        s.resilience,
        s.momentum,
        s.vitality,
        s.level,
        s.stage,
        o.strength,
        o.resilience,
        o.momentum,
        o.vitality,
        o.recommended_level
      ) as likely_outcome,
      public.creature_snapshot_power(
        s.strength,
        s.resilience,
        s.momentum,
        s.vitality,
        s.level,
        s.stage
      ) - public.creature_opponent_power(
        o.strength,
        o.resilience,
        o.momentum,
        o.vitality,
        o.recommended_level
      ) as power_diff
    from snapshot s
    join public.battle_opponents o on o.is_active = true
    join public.battle_arenas a on a.id = o.arena_id and a.is_active = true
    where o.unlock_level <= coalesce(p_level, s.level)
  )
  select (
    select json_build_object(
      'opponent_id', id,
      'name', name,
      'archetype', archetype,
      'recommended_level', recommended_level,
      'likely_outcome', likely_outcome
    )
    from candidates
    order by
      case likely_outcome when 'favored' then 0 when 'competitive' then 1 else 2 end asc,
      case when likely_outcome = 'favored' then -recommended_level else abs(power_diff) end asc,
      power_diff desc,
      sort_order asc
    limit 1
  );
$$;

create or replace function public.calculate_creature_preview(
  p_user_id uuid,
  p_log_date date
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_target integer := 2000;
  v_consumed integer := 0;
  v_meal_count integer := 0;
  v_current_streak integer := 0;
  v_days_logged_last_7 integer := 0;
  v_protein_g numeric := 0;
  v_carbs_g numeric := 0;
  v_fat_g numeric := 0;
  v_has_macro_data boolean := false;
  v_recent_consistency numeric := 50;
  v_progress_ratio numeric := 0;
  v_progress_score numeric := 0;
  v_trajectory_score numeric := 0;
  v_meal_count_score numeric := 30;
  v_protein_target_g numeric := 0;
  v_protein_score numeric := 60;
  v_balance_score numeric := 60;
  v_macro_total_calories numeric := 0;
  v_protein_share numeric := 0;
  v_carbs_share numeric := 0;
  v_fat_share numeric := 0;
  v_extreme_penalty numeric := 0;
  v_strength integer := 0;
  v_resilience integer := 0;
  v_momentum integer := 0;
  v_vitality integer := 50;
  v_readiness_score integer := 0;
  v_readiness_band text := 'recovering';
  v_meal_rating text := 'weak';
  v_feedback_message text := 'One simple logged meal can start building tomorrow''s prep.';
begin
  select coalesce(calorie_target, 2000)
  into v_target
  from public.profiles
  where user_id = p_user_id;

  select
    coalesce(dl.total_calories, 0),
    coalesce(dl.meal_count, 0)
  into
    v_consumed,
    v_meal_count
  from public.daily_logs dl
  where dl.user_id = p_user_id
    and dl.log_date = p_log_date;

  select
    coalesce(sum(mi.protein_g_snapshot * mi.quantity), 0),
    coalesce(sum(mi.carbs_g_snapshot * mi.quantity), 0),
    coalesce(sum(mi.fat_g_snapshot * mi.quantity), 0),
    coalesce(sum(
      case
        when mi.protein_g_snapshot is not null or mi.carbs_g_snapshot is not null or mi.fat_g_snapshot is not null
        then 1
        else 0
      end
    ), 0) > 0
  into
    v_protein_g,
    v_carbs_g,
    v_fat_g,
    v_has_macro_data
  from public.meals m
  join public.daily_logs dl on dl.id = m.daily_log_id
  join public.meal_items mi on mi.meal_id = m.id
  where dl.user_id = p_user_id
    and dl.log_date = p_log_date;

  select
    coalesce(current_streak, 0),
    coalesce(days_logged_last_7, 0)
  into
    v_current_streak,
    v_days_logged_last_7
  from public.habit_metrics
  where user_id = p_user_id
    and log_date < p_log_date
  order by log_date desc
  limit 1;

  select coalesce(avg(adjusted_adherence), 50)
  into v_recent_consistency
  from (
    select adjusted_adherence
    from public.daily_evaluations
    where user_id = p_user_id
      and log_date < p_log_date
    order by log_date desc
    limit 3
  ) recent;

  if v_target > 0 then
    v_progress_ratio := v_consumed::numeric / v_target::numeric;
    v_progress_score := greatest(0, least(100, 100 - abs(v_consumed - v_target)::numeric * 100 / greatest(v_target, 1)));
    v_trajectory_score := greatest(0, least(100,
      case
        when v_progress_ratio between 0.85 and 1.05 then 100
        when v_progress_ratio < 0.85 then 35 + (v_progress_ratio * 65)
        else 100 - ((v_progress_ratio - 1.05) * 120)
      end
    ));
  end if;

  v_meal_count_score := greatest(25, least(100, 100 - abs(v_meal_count - 3) * 18));

  if v_target > 0 then
    v_protein_target_g := round(v_target * 0.25 / 4.0, 2);
  end if;

  if v_has_macro_data and v_protein_target_g > 0 then
    v_protein_score := greatest(35, least(100, (v_protein_g / v_protein_target_g) * 100));
  end if;

  v_macro_total_calories := (v_protein_g * 4) + (v_carbs_g * 4) + (v_fat_g * 9);
  if v_has_macro_data and v_macro_total_calories > 0 then
    v_protein_share := (v_protein_g * 4) / v_macro_total_calories;
    v_carbs_share := (v_carbs_g * 4) / v_macro_total_calories;
    v_fat_share := (v_fat_g * 9) / v_macro_total_calories;
    v_balance_score := greatest(30, least(100,
      100 - (
        abs(v_protein_share - 0.25) * 160 +
        abs(v_carbs_share - 0.45) * 160 +
        abs(v_fat_share - 0.30) * 160
      )
    ));
  end if;

  if v_target > 0 then
    if v_progress_ratio < 0.45 then
      v_extreme_penalty := least(25, (0.45 - v_progress_ratio) * 90);
    elsif v_progress_ratio > 1.20 then
      v_extreme_penalty := least(30, (v_progress_ratio - 1.20) * 120);
    end if;
  end if;

  v_strength := round(greatest(0, least(100,
    v_trajectory_score * 0.55 +
    v_protein_score * 0.30 +
    v_balance_score * 0.15 -
    v_extreme_penalty
  )))::integer;

  v_resilience := round(greatest(0, least(100,
    v_recent_consistency * 0.50 +
    v_balance_score * 0.20 +
    v_meal_count_score * 0.30 -
    (v_extreme_penalty * 0.6)
  )))::integer;

  v_momentum := round(greatest(0, least(100,
    v_recent_consistency * 0.45 +
    v_progress_score * 0.35 +
    v_meal_count_score * 0.20 -
    (v_extreme_penalty * 0.8)
  )))::integer;

  v_vitality := round(greatest(50, least(150,
    50 +
    ((v_strength + v_resilience + v_momentum) / 3.0) * 0.55 +
    (least(v_current_streak, 10) * 4) -
    (v_extreme_penalty * 0.7)
  )))::integer;

  v_readiness_score := public.creature_readiness_score(v_strength, v_resilience, v_momentum, v_vitality);
  v_readiness_band := public.creature_readiness_band(v_readiness_score);

  if v_meal_count = 0 then
    v_meal_rating := 'weak';
    v_feedback_message := 'One simple logged meal can start building tomorrow''s prep.';
  elsif v_readiness_score >= 82 then
    v_meal_rating := 'strong';
    if v_progress_ratio > 1.10 then
      v_feedback_message := 'You are still in a strong range. A lighter next meal keeps tomorrow''s prep steady.';
    else
      v_feedback_message := 'This is pushing tomorrow''s prep in a strong direction. Keep the same steady rhythm.';
    end if;
  elsif v_readiness_score >= 60 then
    v_meal_rating := 'solid';
    if v_progress_ratio < 0.70 then
      v_feedback_message := 'This helps, and you still have room to round out the day with a balanced next meal.';
    else
      v_feedback_message := 'Tomorrow is shaping up well. A protein-forward next meal can strengthen the prep further.';
    end if;
  else
    v_meal_rating := 'weak';
    if v_progress_ratio > 1.15 then
      v_feedback_message := 'Today is drifting high. A lighter next meal can steady tomorrow''s battle prep.';
    else
      v_feedback_message := 'You are still building momentum. A balanced next meal can pull tomorrow''s prep back up.';
    end if;
  end if;

  return json_build_object(
    'tomorrow_readiness_score', v_readiness_score,
    'tomorrow_readiness_band', v_readiness_band,
    'projected_strength', v_strength,
    'projected_resilience', v_resilience,
    'projected_momentum', v_momentum,
    'projected_vitality', v_vitality,
    'meal_rating', v_meal_rating,
    'meal_feedback_message', v_feedback_message
  );
end;
$$;

create or replace function public.get_battle_hub(p_battle_date date)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_companion json;
  v_snapshot public.creature_battle_snapshots;
  v_recommended json;
  v_unlocked json := '[]'::json;
  v_history json := '[]'::json;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select row_to_json(c)
  into v_companion
  from public.creature_companions c
  where c.user_id = v_user_id;

  select *
  into v_snapshot
  from public.creature_battle_snapshots
  where user_id = v_user_id
    and battle_date = p_battle_date;

  if found then
    v_recommended := public.creature_recommended_opponent(
      v_snapshot.id,
      coalesce((v_companion->>'level')::integer, v_snapshot.level)
    );
  end if;

  select coalesce(json_agg(row_to_json(opponent_row) order by opponent_row.sort_order asc), '[]'::json)
  into v_unlocked
  from (
    select o.*
    from public.battle_opponents o
    join public.battle_arenas a on a.id = o.arena_id and a.is_active = true
    where o.is_active = true
      and o.unlock_level <= coalesce((v_companion->>'level')::integer, 1)
    order by o.sort_order asc
  ) opponent_row;

  select coalesce(json_agg(
    json_build_object(
      'id', r.id,
      'user_id', r.user_id,
      'battle_date', r.battle_date,
      'snapshot_id', r.snapshot_id,
      'opponent_id', r.opponent_id,
      'outcome', r.outcome,
      'turn_count', r.turn_count,
      'remaining_hp_pct', r.remaining_hp_pct,
      'xp_awarded', r.xp_awarded,
      'arena_progress_awarded', r.arena_progress_awarded,
      'reward_claimed', r.reward_claimed,
      'created_at', r.created_at,
      'opponent', row_to_json(o)
    )
    order by r.created_at desc
  ), '[]'::json)
  into v_history
  from public.battle_runs r
  join public.battle_opponents o on o.id = r.opponent_id
  where r.user_id = v_user_id
    and r.battle_date = p_battle_date;

  return json_build_object(
    'companion', v_companion,
    'snapshot', case when v_snapshot.id is null then null else row_to_json(v_snapshot) end,
    'recommended_opponent', v_recommended,
    'unlocked_opponents', v_unlocked,
    'battle_history', v_history
  );
end;
$$;

create or replace function public.start_battle_run(
  p_snapshot_id uuid,
  p_opponent_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_snapshot public.creature_battle_snapshots;
  v_companion public.creature_companions;
  v_opponent public.battle_opponents;
  v_run public.battle_runs;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_snapshot
  from public.creature_battle_snapshots
  where id = p_snapshot_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Battle snapshot not found';
  end if;

  select *
  into v_companion
  from public.creature_companions
  where user_id = v_user_id;

  select o.*
  into v_opponent
  from public.battle_opponents o
  join public.battle_arenas a on a.id = o.arena_id and a.is_active = true
  where o.id = p_opponent_id
    and o.is_active = true;

  if not found then
    raise exception 'Opponent not found';
  end if;

  if v_opponent.unlock_level > coalesce(v_companion.level, v_snapshot.level, 1) then
    raise exception 'Opponent not unlocked';
  end if;

  insert into public.battle_runs (
    user_id,
    battle_date,
    snapshot_id,
    opponent_id
  ) values (
    v_user_id,
    v_snapshot.battle_date,
    v_snapshot.id,
    v_opponent.id
  )
  returning * into v_run;

  return json_build_object('battle_run', row_to_json(v_run));
end;
$$;

create or replace function public.resolve_battle_run(
  p_battle_run_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_run public.battle_runs;
  v_snapshot public.creature_battle_snapshots;
  v_opponent public.battle_opponents;
  v_player_power integer;
  v_opponent_power integer;
  v_player_seed integer;
  v_opponent_seed integer;
  v_turn_seed integer;
  v_margin integer;
  v_outcome text;
  v_turn_count integer;
  v_remaining_hp integer;
  v_rewardable boolean := false;
  v_xp_awarded integer := 0;
  v_arena_progress integer := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_run
  from public.battle_runs
  where id = p_battle_run_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Battle run not found';
  end if;

  if v_run.outcome <> 'pending' then
    select * into v_opponent from public.battle_opponents where id = v_run.opponent_id;
    return json_build_object(
      'battle_run', row_to_json(v_run),
      'opponent', row_to_json(v_opponent)
    );
  end if;

  select *
  into v_snapshot
  from public.creature_battle_snapshots
  where id = v_run.snapshot_id
    and user_id = v_user_id;

  select *
  into v_opponent
  from public.battle_opponents
  where id = v_run.opponent_id;

  v_player_power := public.creature_snapshot_power(
    v_snapshot.strength,
    v_snapshot.resilience,
    v_snapshot.momentum,
    v_snapshot.vitality,
    v_snapshot.level,
    v_snapshot.stage
  );

  v_opponent_power := public.creature_opponent_power(
    v_opponent.strength,
    v_opponent.resilience,
    v_opponent.momentum,
    v_opponent.vitality,
    v_opponent.recommended_level
  );

  v_player_seed := abs(('x' || substr(md5(v_run.id::text || ':player'), 1, 8))::bit(32)::int);
  v_opponent_seed := abs(('x' || substr(md5(v_run.id::text || ':opponent'), 1, 8))::bit(32)::int);
  v_turn_seed := abs(('x' || substr(md5(v_run.id::text || ':turns'), 1, 8))::bit(32)::int);

  v_margin := (v_player_power + (v_player_seed % 11) - 5) - (v_opponent_power + (v_opponent_seed % 11) - 5);
  v_outcome := case when v_margin >= 0 then 'win' else 'loss' end;
  v_turn_count := 3 + (v_turn_seed % 4);
  v_remaining_hp := case
    when v_outcome = 'win' then greatest(8, least(100, 35 + (v_margin * 3)))
    else greatest(0, least(45, 24 + (v_margin * 2)))
  end;

  if v_outcome = 'win' then
    select not exists (
      select 1
      from public.battle_runs prior
      where prior.user_id = v_user_id
        and prior.battle_date = v_run.battle_date
        and prior.opponent_id = v_run.opponent_id
        and prior.id <> v_run.id
        and prior.outcome = 'win'
        and prior.reward_claimed = true
    )
    into v_rewardable;

    if v_rewardable then
      v_xp_awarded := 10 + (v_opponent.recommended_level * 4);
      v_arena_progress := 1;
    end if;
  end if;

  update public.battle_runs
  set outcome = v_outcome,
      turn_count = v_turn_count,
      remaining_hp_pct = v_remaining_hp,
      xp_awarded = v_xp_awarded,
      arena_progress_awarded = v_arena_progress,
      reward_claimed = (v_xp_awarded > 0 or v_arena_progress > 0)
  where id = v_run.id
  returning * into v_run;

  return json_build_object(
    'battle_run', row_to_json(v_run),
    'opponent', row_to_json(v_opponent)
  );
end;
$$;

create or replace function public.create_meal_with_items(
  p_log_date    date,
  p_logged_at   timestamptz,
  p_items       jsonb,
  p_meal_type   text default null,
  p_meal_name   text default null,
  p_template_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id      uuid;
  v_log          daily_logs;
  v_meal         meals;
  v_item         jsonb;
  v_product      products;
  v_catalog_item food_catalog_items;
  v_meal_item    meal_items;
  v_items_out    jsonb := '[]'::jsonb;
  v_qty          numeric;
  v_line_cal     integer;
  v_has_product  boolean;
  v_has_catalog  boolean;
  v_preview      json;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_has_product := v_item ? 'product_id' and coalesce(v_item->>'product_id', '') <> '';
    v_has_catalog := v_item ? 'catalog_item_id' and coalesce(v_item->>'catalog_item_id', '') <> '';

    if (case when v_has_product then 1 else 0 end) + (case when v_has_catalog then 1 else 0 end) <> 1 then
      raise exception 'Each item must include exactly one of product_id or catalog_item_id';
    end if;

    if v_has_product then
      select *
      into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid
        and user_id = v_user_id;

      if not found then
        raise exception 'Product not found or not owned: %', v_item->>'product_id';
      end if;
    else
      select *
      into v_catalog_item
      from public.food_catalog_items
      where id = v_item->>'catalog_item_id';

      if not found then
        raise exception 'Catalog item not found: %', v_item->>'catalog_item_id';
      end if;
    end if;
  end loop;

  insert into public.daily_logs (user_id, log_date)
  values (v_user_id, p_log_date)
  on conflict (user_id, log_date) do nothing;

  select *
  into v_log
  from public.daily_logs
  where user_id = v_user_id
    and log_date = p_log_date;

  if v_log.is_finalized then
    raise exception 'Daily log is finalized for date %', p_log_date;
  end if;

  insert into public.meals (user_id, daily_log_id, logged_at, meal_type, meal_name)
  values (v_user_id, v_log.id, p_logged_at, p_meal_type, p_meal_name)
  returning * into v_meal;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::numeric;
    v_has_product := v_item ? 'product_id' and coalesce(v_item->>'product_id', '') <> '';

    if v_has_product then
      select *
      into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid
        and user_id = v_user_id;

      v_line_cal := round(v_qty * v_product.calories);

      insert into public.meal_items (
        meal_id, product_id, catalog_item_id, quantity,
        product_name_snapshot, calories_per_serving_snapshot,
        protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        serving_amount_snapshot, serving_unit_snapshot, line_total_calories
      ) values (
        v_meal.id, v_product.id, null, v_qty,
        v_product.name, v_product.calories,
        v_product.protein_g, v_product.carbs_g, v_product.fat_g,
        v_product.default_serving_amount, v_product.default_serving_unit, v_line_cal
      ) returning * into v_meal_item;

      update public.products
      set use_count = use_count + 1,
          last_used_at = now(),
          updated_at = now()
      where id = v_product.id;
    else
      select *
      into v_catalog_item
      from public.food_catalog_items
      where id = v_item->>'catalog_item_id';

      v_line_cal := round(v_qty * v_catalog_item.calories);

      insert into public.meal_items (
        meal_id, product_id, catalog_item_id, quantity,
        product_name_snapshot, calories_per_serving_snapshot,
        protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        serving_amount_snapshot, serving_unit_snapshot, line_total_calories
      ) values (
        v_meal.id, null, v_catalog_item.id, v_qty,
        v_catalog_item.name, v_catalog_item.calories,
        v_catalog_item.protein_g, v_catalog_item.carbs_g, v_catalog_item.fat_g,
        v_catalog_item.default_serving_amount, v_catalog_item.default_serving_unit, v_line_cal
      ) returning * into v_meal_item;

      insert into public.catalog_item_usage (user_id, catalog_item_id, use_count, last_used_at)
      values (v_user_id, v_catalog_item.id, 1, now())
      on conflict (user_id, catalog_item_id) do update
      set use_count = catalog_item_usage.use_count + 1,
          last_used_at = excluded.last_used_at,
          updated_at = now();
    end if;

    v_items_out := v_items_out || jsonb_build_object(
      'id', v_meal_item.id,
      'product_id', v_meal_item.product_id,
      'catalog_item_id', v_meal_item.catalog_item_id,
      'quantity', v_meal_item.quantity,
      'product_name_snapshot', v_meal_item.product_name_snapshot,
      'calories_per_serving_snapshot', v_meal_item.calories_per_serving_snapshot,
      'line_total_calories', v_meal_item.line_total_calories
    );
  end loop;

  update public.meals
  set total_calories = (select coalesce(sum(line_total_calories), 0) from public.meal_items where meal_id = v_meal.id),
      item_count = (select count(*) from public.meal_items where meal_id = v_meal.id),
      updated_at = now()
  where id = v_meal.id
  returning * into v_meal;

  update public.daily_logs
  set total_calories = (select coalesce(sum(total_calories), 0) from public.meals where daily_log_id = v_log.id),
      meal_count = (select count(*) from public.meals where daily_log_id = v_log.id),
      updated_at = now()
  where id = v_log.id
  returning * into v_log;

  if p_template_id is not null then
    update public.meal_templates
    set use_count = use_count + 1,
        last_used_at = now(),
        updated_at = now()
    where id = p_template_id
      and user_id = v_user_id;
  end if;

  v_preview := public.calculate_creature_preview(v_user_id, p_log_date);

  return json_build_object(
    'meal', row_to_json(v_meal),
    'meal_items', v_items_out,
    'daily_log', row_to_json(v_log),
    'creature_preview', v_preview
  );
end;
$$;

create or replace function public.update_meal_with_items(
  p_meal_id   uuid,
  p_logged_at timestamptz,
  p_items     jsonb,
  p_meal_type text default null,
  p_meal_name text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id      uuid;
  v_meal         meals;
  v_log          daily_logs;
  v_item         jsonb;
  v_product      products;
  v_catalog_item food_catalog_items;
  v_meal_item    meal_items;
  v_items_out    jsonb := '[]'::jsonb;
  v_qty          numeric;
  v_line_cal     integer;
  v_has_product  boolean;
  v_has_catalog  boolean;
  v_has_snapshot boolean;
  v_preview      json;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_meal from public.meals where id = p_meal_id and user_id = v_user_id;
  if not found then
    raise exception 'Meal not found or not owned: %', p_meal_id;
  end if;

  select * into v_log from public.daily_logs where id = v_meal.daily_log_id;
  if v_log.is_finalized then
    raise exception 'Daily log is finalized for this meal';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_has_product := v_item ? 'product_id' and coalesce(v_item->>'product_id', '') <> '';
    v_has_catalog := v_item ? 'catalog_item_id' and coalesce(v_item->>'catalog_item_id', '') <> '';
    v_has_snapshot := v_item ? 'meal_item_id' and coalesce(v_item->>'meal_item_id', '') <> '';

    if (case when v_has_product then 1 else 0 end)
       + (case when v_has_catalog then 1 else 0 end)
       + (case when v_has_snapshot then 1 else 0 end) <> 1 then
      raise exception 'Each item must include exactly one of product_id, catalog_item_id, or meal_item_id';
    end if;

    if v_has_product then
      select * into v_product from public.products where id = (v_item->>'product_id')::uuid and user_id = v_user_id;
      if not found then raise exception 'Product not found or not owned: %', v_item->>'product_id'; end if;
    elsif v_has_catalog then
      select * into v_catalog_item from public.food_catalog_items where id = v_item->>'catalog_item_id';
      if not found then raise exception 'Catalog item not found: %', v_item->>'catalog_item_id'; end if;
    end if;
  end loop;

  delete from public.meal_items where meal_id = p_meal_id;

  update public.meals
  set logged_at = p_logged_at,
      meal_type = p_meal_type,
      meal_name = p_meal_name,
      updated_at = now()
  where id = p_meal_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_has_product := v_item ? 'product_id' and coalesce(v_item->>'product_id', '') <> '';
    v_has_catalog := v_item ? 'catalog_item_id' and coalesce(v_item->>'catalog_item_id', '') <> '';

    if v_has_product then
      select * into v_product from public.products where id = (v_item->>'product_id')::uuid and user_id = v_user_id;
      v_qty := (v_item->>'quantity')::numeric;
      v_line_cal := round(v_qty * v_product.calories);

      insert into public.meal_items (
        meal_id, product_id, catalog_item_id, quantity,
        product_name_snapshot, calories_per_serving_snapshot,
        protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        serving_amount_snapshot, serving_unit_snapshot, line_total_calories
      ) values (
        p_meal_id, v_product.id, null, v_qty,
        v_product.name, v_product.calories,
        v_product.protein_g, v_product.carbs_g, v_product.fat_g,
        v_product.default_serving_amount, v_product.default_serving_unit, v_line_cal
      ) returning * into v_meal_item;
    elsif v_has_catalog then
      select * into v_catalog_item from public.food_catalog_items where id = v_item->>'catalog_item_id';
      v_qty := (v_item->>'quantity')::numeric;
      v_line_cal := round(v_qty * v_catalog_item.calories);

      insert into public.meal_items (
        meal_id, product_id, catalog_item_id, quantity,
        product_name_snapshot, calories_per_serving_snapshot,
        protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        serving_amount_snapshot, serving_unit_snapshot, line_total_calories
      ) values (
        p_meal_id, null, v_catalog_item.id, v_qty,
        v_catalog_item.name, v_catalog_item.calories,
        v_catalog_item.protein_g, v_catalog_item.carbs_g, v_catalog_item.fat_g,
        v_catalog_item.default_serving_amount, v_catalog_item.default_serving_unit, v_line_cal
      ) returning * into v_meal_item;
    else
      v_qty := (v_item->>'quantity')::numeric;
      v_line_cal := round(v_qty * (v_item->>'calories_per_serving_snapshot')::integer);

      insert into public.meal_items (
        meal_id, product_id, catalog_item_id, quantity,
        product_name_snapshot, calories_per_serving_snapshot,
        protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        serving_amount_snapshot, serving_unit_snapshot, line_total_calories
      ) values (
        p_meal_id, null, null, v_qty,
        v_item->>'product_name_snapshot',
        (v_item->>'calories_per_serving_snapshot')::integer,
        nullif(v_item->>'protein_g_snapshot', '')::numeric,
        nullif(v_item->>'carbs_g_snapshot', '')::numeric,
        nullif(v_item->>'fat_g_snapshot', '')::numeric,
        nullif(v_item->>'serving_amount_snapshot', '')::numeric,
        nullif(v_item->>'serving_unit_snapshot', ''),
        v_line_cal
      ) returning * into v_meal_item;
    end if;

    v_items_out := v_items_out || jsonb_build_object(
      'id', v_meal_item.id,
      'product_id', v_meal_item.product_id,
      'catalog_item_id', v_meal_item.catalog_item_id,
      'quantity', v_meal_item.quantity,
      'product_name_snapshot', v_meal_item.product_name_snapshot,
      'calories_per_serving_snapshot', v_meal_item.calories_per_serving_snapshot,
      'line_total_calories', v_meal_item.line_total_calories
    );
  end loop;

  update public.meals
  set total_calories = (select coalesce(sum(line_total_calories), 0) from public.meal_items where meal_id = p_meal_id),
      item_count = (select count(*) from public.meal_items where meal_id = p_meal_id),
      updated_at = now()
  where id = p_meal_id
  returning * into v_meal;

  update public.daily_logs
  set total_calories = (select coalesce(sum(total_calories), 0) from public.meals where daily_log_id = v_log.id),
      meal_count = (select count(*) from public.meals where daily_log_id = v_log.id),
      updated_at = now()
  where id = v_log.id
  returning * into v_log;

  v_preview := public.calculate_creature_preview(v_user_id, v_log.log_date);

  return json_build_object(
    'meal', row_to_json(v_meal),
    'meal_items', v_items_out,
    'daily_log', row_to_json(v_log),
    'creature_preview', v_preview
  );
end;
$$;

create or replace function public.delete_meal(p_meal_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_meal    meals;
  v_log     daily_logs;
  v_preview json;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_meal from public.meals where id = p_meal_id and user_id = v_user_id;
  if not found then
    raise exception 'Meal not found or not owned: %', p_meal_id;
  end if;

  select * into v_log from public.daily_logs where id = v_meal.daily_log_id;
  if v_log.is_finalized then
    raise exception 'Daily log is finalized';
  end if;

  delete from public.meals where id = p_meal_id;

  update public.daily_logs
  set total_calories = (select coalesce(sum(total_calories), 0) from public.meals where daily_log_id = v_log.id),
      meal_count = (select count(*) from public.meals where daily_log_id = v_log.id),
      updated_at = now()
  where id = v_log.id
  returning * into v_log;

  v_preview := public.calculate_creature_preview(v_user_id, v_log.log_date);

  return json_build_object(
    'deleted_meal_id', p_meal_id,
    'daily_log', row_to_json(v_log),
    'creature_preview', v_preview
  );
end;
$$;

create or replace function public.repeat_last_meal(p_log_date date)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_tz text;
  v_source_meal meals;
  v_log daily_logs;
  v_new_meal meals;
  v_logged_at timestamptz;
  v_item meal_items;
  v_new_item meal_items;
  v_items_out jsonb := '[]'::jsonb;
  v_preview json;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select timezone into v_tz from public.profiles where user_id = v_user_id;

  select m.*
  into v_source_meal
  from public.meals m
  join public.daily_logs dl on dl.id = m.daily_log_id
  where m.user_id = v_user_id
    and dl.log_date < p_log_date
  order by m.logged_at desc
  limit 1;

  if not found then
    raise exception 'No previous meals found to repeat';
  end if;

  insert into public.daily_logs (user_id, log_date)
  values (v_user_id, p_log_date)
  on conflict (user_id, log_date) do nothing;

  select * into v_log from public.daily_logs where user_id = v_user_id and log_date = p_log_date;
  if v_log.is_finalized then
    raise exception 'Daily log is finalized for date %', p_log_date;
  end if;

  v_logged_at := (p_log_date || ' ' || to_char(now() at time zone coalesce(v_tz, 'UTC'), 'HH24:MI:SS'))::timestamptz
                 at time zone coalesce(v_tz, 'UTC');

  insert into public.meals (user_id, daily_log_id, logged_at, meal_type, meal_name)
  values (v_user_id, v_log.id, v_logged_at, v_source_meal.meal_type, v_source_meal.meal_name)
  returning * into v_new_meal;

  for v_item in
    select *
    from public.meal_items
    where meal_id = v_source_meal.id
  loop
    insert into public.meal_items (
      meal_id, product_id, catalog_item_id, quantity,
      product_name_snapshot, calories_per_serving_snapshot,
      protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
      serving_amount_snapshot, serving_unit_snapshot,
      line_total_calories
    ) values (
      v_new_meal.id, null, null, v_item.quantity,
      v_item.product_name_snapshot, v_item.calories_per_serving_snapshot,
      v_item.protein_g_snapshot, v_item.carbs_g_snapshot, v_item.fat_g_snapshot,
      v_item.serving_amount_snapshot, v_item.serving_unit_snapshot,
      v_item.line_total_calories
    ) returning * into v_new_item;

    v_items_out := v_items_out || jsonb_build_object(
      'id', v_new_item.id,
      'product_id', v_new_item.product_id,
      'catalog_item_id', v_new_item.catalog_item_id,
      'quantity', v_new_item.quantity,
      'product_name_snapshot', v_new_item.product_name_snapshot,
      'calories_per_serving_snapshot', v_new_item.calories_per_serving_snapshot,
      'line_total_calories', v_new_item.line_total_calories
    );
  end loop;

  update public.meals
  set total_calories = (select coalesce(sum(line_total_calories), 0) from public.meal_items where meal_id = v_new_meal.id),
      item_count = (select count(*) from public.meal_items where meal_id = v_new_meal.id),
      updated_at = now()
  where id = v_new_meal.id
  returning * into v_new_meal;

  update public.daily_logs
  set total_calories = (select coalesce(sum(total_calories), 0) from public.meals where daily_log_id = v_log.id),
      meal_count = (select count(*) from public.meals where daily_log_id = v_log.id),
      updated_at = now()
  where id = v_log.id
  returning * into v_log;

  v_preview := public.calculate_creature_preview(v_user_id, p_log_date);

  return json_build_object(
    'meal', row_to_json(v_new_meal),
    'meal_items', v_items_out,
    'daily_log', row_to_json(v_log),
    'creature_preview', v_preview
  );
end;
$$;

create or replace function public.restore_meal_from_snapshot(
  p_log_date  date,
  p_logged_at timestamptz,
  p_items     jsonb,
  p_meal_type text default null,
  p_meal_name text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_log daily_logs;
  v_meal meals;
  v_item jsonb;
  v_meal_item meal_items;
  v_items_out jsonb := '[]'::jsonb;
  v_qty numeric;
  v_line_cal integer;
  v_preview json;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one item is required to restore a meal';
  end if;

  insert into public.daily_logs (user_id, log_date)
  values (v_user_id, p_log_date)
  on conflict (user_id, log_date) do nothing;

  select *
  into v_log
  from public.daily_logs
  where user_id = v_user_id
    and log_date = p_log_date;

  if v_log.is_finalized then
    raise exception 'Daily log is finalized for date %', p_log_date;
  end if;

  insert into public.meals (user_id, daily_log_id, logged_at, meal_type, meal_name)
  values (v_user_id, v_log.id, p_logged_at, p_meal_type, p_meal_name)
  returning * into v_meal;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::numeric;
    v_line_cal := round(v_qty * (v_item->>'calories_per_serving_snapshot')::integer);

    insert into public.meal_items (
      meal_id, product_id, catalog_item_id, quantity,
      product_name_snapshot, calories_per_serving_snapshot,
      protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
      serving_amount_snapshot, serving_unit_snapshot,
      line_total_calories
    ) values (
      v_meal.id, null, null, v_qty,
      v_item->>'product_name_snapshot',
      (v_item->>'calories_per_serving_snapshot')::integer,
      nullif(v_item->>'protein_g_snapshot', '')::numeric,
      nullif(v_item->>'carbs_g_snapshot', '')::numeric,
      nullif(v_item->>'fat_g_snapshot', '')::numeric,
      nullif(v_item->>'serving_amount_snapshot', '')::numeric,
      nullif(v_item->>'serving_unit_snapshot', ''),
      v_line_cal
    ) returning * into v_meal_item;

    v_items_out := v_items_out || jsonb_build_object(
      'id', v_meal_item.id,
      'product_id', v_meal_item.product_id,
      'catalog_item_id', v_meal_item.catalog_item_id,
      'quantity', v_meal_item.quantity,
      'product_name_snapshot', v_meal_item.product_name_snapshot,
      'calories_per_serving_snapshot', v_meal_item.calories_per_serving_snapshot,
      'line_total_calories', v_meal_item.line_total_calories
    );
  end loop;

  update public.meals
  set total_calories = (select coalesce(sum(line_total_calories), 0) from public.meal_items where meal_id = v_meal.id),
      item_count = (select count(*) from public.meal_items where meal_id = v_meal.id),
      updated_at = now()
  where id = v_meal.id
  returning * into v_meal;

  update public.daily_logs
  set total_calories = (select coalesce(sum(total_calories), 0) from public.meals where daily_log_id = v_log.id),
      meal_count = (select count(*) from public.meals where daily_log_id = v_log.id),
      updated_at = now()
  where id = v_log.id
  returning * into v_log;

  v_preview := public.calculate_creature_preview(v_user_id, p_log_date);

  return json_build_object(
    'meal', row_to_json(v_meal),
    'meal_items', v_items_out,
    'daily_log', row_to_json(v_log),
    'creature_preview', v_preview
  );
end;
$$;
