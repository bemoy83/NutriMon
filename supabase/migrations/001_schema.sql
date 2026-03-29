-- 001_schema.sql
-- Full NutriMon database schema

-- profiles: extends auth.users
create table public.profiles (
  user_id                  uuid primary key references auth.users(id) on delete cascade,
  height_cm                numeric(5,2)  null,
  starting_weight_kg       numeric(6,2)  null,
  age_years                integer       null check (age_years is null or (age_years >= 13 and age_years <= 120)),
  sex_for_tdee             text          null check (sex_for_tdee is null or sex_for_tdee in ('male','female')),
  activity_level           text          null check (activity_level is null or activity_level in ('sedentary','lightly_active','moderately_active','very_active')),
  timezone                 text          null,
  calorie_target           integer       null check (calorie_target is null or (calorie_target >= 800 and calorie_target <= 6000)),
  goal_weight_kg           numeric(6,2)  null,
  onboarding_completed_at  timestamptz   null,
  created_at               timestamptz   not null default now(),
  updated_at               timestamptz   not null default now()
);

-- products
create table public.products (
  id                     uuid        primary key default gen_random_uuid(),
  user_id                uuid        not null references auth.users(id) on delete cascade,
  name                   text        not null,
  calories               integer     not null check (calories >= 0 and calories <= 5000),
  protein_g              numeric(6,2) null check (protein_g is null or protein_g >= 0),
  carbs_g                numeric(6,2) null check (carbs_g is null or carbs_g >= 0),
  fat_g                  numeric(6,2) null check (fat_g is null or fat_g >= 0),
  default_serving_amount numeric(8,2) null check (default_serving_amount is null or default_serving_amount > 0),
  default_serving_unit   text        null,
  use_count              integer     not null default 0 check (use_count >= 0),
  last_used_at           timestamptz null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index products_user_last_used on public.products (user_id, last_used_at desc nulls last);
create index products_user_use_count on public.products (user_id, use_count desc);
create index products_user_name      on public.products (user_id, lower(name));

-- daily_logs
create table public.daily_logs (
  id              uuid    primary key default gen_random_uuid(),
  user_id         uuid    not null references auth.users(id) on delete cascade,
  log_date        date    not null,
  total_calories  integer not null default 0,
  meal_count      integer not null default 0,
  is_finalized    boolean not null default false,
  finalized_at    timestamptz null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, log_date)
);

create index daily_logs_user_date on public.daily_logs (user_id, log_date desc);

-- meals
create table public.meals (
  id             uuid    primary key default gen_random_uuid(),
  user_id        uuid    not null references auth.users(id) on delete cascade,
  daily_log_id   uuid    not null references public.daily_logs(id) on delete cascade,
  logged_at      timestamptz not null,
  total_calories integer not null default 0,
  item_count     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index meals_user_log_time on public.meals (user_id, daily_log_id, logged_at desc);

-- meal_items
create table public.meal_items (
  id                           uuid    primary key default gen_random_uuid(),
  meal_id                      uuid    not null references public.meals(id) on delete cascade,
  product_id                   uuid    null references public.products(id) on delete set null,
  quantity                     numeric(8,2) not null check (quantity > 0),
  product_name_snapshot        text    not null,
  calories_per_serving_snapshot integer not null,
  protein_g_snapshot           numeric(6,2) null,
  carbs_g_snapshot             numeric(6,2) null,
  fat_g_snapshot               numeric(6,2) null,
  serving_amount_snapshot      numeric(8,2) null,
  serving_unit_snapshot        text    null,
  line_total_calories          integer not null,
  created_at                   timestamptz not null default now()
);

create index meal_items_meal on public.meal_items (meal_id);

-- weight_entries
create table public.weight_entries (
  id           uuid    primary key default gen_random_uuid(),
  user_id      uuid    not null references auth.users(id) on delete cascade,
  entry_date   date    not null,
  weight_kg    numeric(6,2) not null check (weight_kg > 0 and weight_kg < 500),
  source_unit  text    not null check (source_unit in ('kg','lb')),
  source_value numeric(6,2) not null,
  notes        text    null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, entry_date)
);

create index weight_entries_user_date on public.weight_entries (user_id, entry_date desc);

-- daily_evaluations
create table public.daily_evaluations (
  id                   uuid    primary key default gen_random_uuid(),
  user_id              uuid    not null references auth.users(id) on delete cascade,
  daily_log_id         uuid    not null references public.daily_logs(id) on delete cascade,
  log_date             date    not null,
  target_calories      integer not null,
  consumed_calories    integer not null,
  calorie_delta        integer not null,
  adherence_score      numeric(5,2) not null check (adherence_score >= 0 and adherence_score <= 100),
  adjusted_adherence   numeric(5,2) not null check (adjusted_adherence >= 0 and adjusted_adherence <= 100),
  status               text    not null check (status in ('optimal','acceptable','poor','no_data')),
  calculation_version  text    not null default 'v1',
  finalized_at         timestamptz not null,
  created_at           timestamptz not null default now(),
  unique (user_id, log_date)
);

create index daily_evaluations_user_date on public.daily_evaluations (user_id, log_date desc);

-- habit_metrics
create table public.habit_metrics (
  id                  uuid    primary key default gen_random_uuid(),
  user_id             uuid    not null references auth.users(id) on delete cascade,
  log_date            date    not null,
  current_streak      integer not null default 0,
  longest_streak      integer not null default 0,
  days_logged_last_7  integer not null default 0,
  last_log_date       date    null,
  created_at          timestamptz not null default now(),
  unique (user_id, log_date)
);

create index habit_metrics_user_date on public.habit_metrics (user_id, log_date desc);

-- behavior_attributes
create table public.behavior_attributes (
  id                   uuid    primary key default gen_random_uuid(),
  user_id              uuid    not null references auth.users(id) on delete cascade,
  log_date             date    not null,
  consistency_score    numeric(5,2) not null,
  stability_score      numeric(5,2) not null,
  momentum_score       numeric(5,2) not null,
  discipline_score     numeric(5,2) not null,
  calculation_version  text    not null default 'v1',
  calculated_at        timestamptz not null,
  created_at           timestamptz not null default now(),
  unique (user_id, log_date)
);

create index behavior_attributes_user_date on public.behavior_attributes (user_id, log_date desc);

-- creature_stats
create table public.creature_stats (
  id         uuid    primary key default gen_random_uuid(),
  user_id    uuid    not null references auth.users(id) on delete cascade,
  log_date   date    not null,
  strength   integer not null,
  resilience integer not null,
  momentum   integer not null,
  vitality   integer not null,
  stage      text    not null check (stage in ('baby','adult','champion')),
  created_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create index creature_stats_user_date on public.creature_stats (user_id, log_date desc);

-- daily_feedback
create table public.daily_feedback (
  id                    uuid    primary key default gen_random_uuid(),
  user_id               uuid    not null references auth.users(id) on delete cascade,
  log_date              date    not null,
  daily_evaluation_id   uuid    not null references public.daily_evaluations(id) on delete cascade,
  status                text    not null check (status in ('optimal','acceptable','poor','no_data')),
  message               text    not null,
  recommendation        text    not null,
  created_at            timestamptz not null default now(),
  unique (user_id, log_date)
);

create index daily_feedback_user_date on public.daily_feedback (user_id, log_date desc);
