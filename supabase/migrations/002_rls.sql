-- 002_rls.sql
-- Row Level Security policies for all user-owned tables

-- Enable RLS
alter table public.profiles           enable row level security;
alter table public.products           enable row level security;
alter table public.daily_logs         enable row level security;
alter table public.meals              enable row level security;
alter table public.meal_items         enable row level security;
alter table public.weight_entries     enable row level security;
alter table public.daily_evaluations  enable row level security;
alter table public.habit_metrics      enable row level security;
alter table public.behavior_attributes enable row level security;
alter table public.creature_stats     enable row level security;
alter table public.daily_feedback     enable row level security;

-- profiles
create policy "profiles_select" on public.profiles
  for select using (auth.uid() = user_id);
create policy "profiles_insert" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "profiles_update" on public.profiles
  for update using (auth.uid() = user_id);
create policy "profiles_delete" on public.profiles
  for delete using (auth.uid() = user_id);

-- products
create policy "products_select" on public.products
  for select using (auth.uid() = user_id);
create policy "products_insert" on public.products
  for insert with check (auth.uid() = user_id);
create policy "products_update" on public.products
  for update using (auth.uid() = user_id);
create policy "products_delete" on public.products
  for delete using (auth.uid() = user_id);

-- daily_logs
create policy "daily_logs_select" on public.daily_logs
  for select using (auth.uid() = user_id);
create policy "daily_logs_insert" on public.daily_logs
  for insert with check (auth.uid() = user_id);
create policy "daily_logs_update" on public.daily_logs
  for update using (auth.uid() = user_id);
create policy "daily_logs_delete" on public.daily_logs
  for delete using (auth.uid() = user_id);

-- meals
create policy "meals_select" on public.meals
  for select using (auth.uid() = user_id);
create policy "meals_insert" on public.meals
  for insert with check (auth.uid() = user_id);
create policy "meals_update" on public.meals
  for update using (auth.uid() = user_id);
create policy "meals_delete" on public.meals
  for delete using (auth.uid() = user_id);

-- meal_items: access through parent meal ownership
create policy "meal_items_select" on public.meal_items
  for select using (
    exists (
      select 1 from public.meals m
      where m.id = meal_items.meal_id and m.user_id = auth.uid()
    )
  );
create policy "meal_items_insert" on public.meal_items
  for insert with check (
    exists (
      select 1 from public.meals m
      where m.id = meal_items.meal_id and m.user_id = auth.uid()
    )
  );
create policy "meal_items_update" on public.meal_items
  for update using (
    exists (
      select 1 from public.meals m
      where m.id = meal_items.meal_id and m.user_id = auth.uid()
    )
  );
create policy "meal_items_delete" on public.meal_items
  for delete using (
    exists (
      select 1 from public.meals m
      where m.id = meal_items.meal_id and m.user_id = auth.uid()
    )
  );

-- weight_entries
create policy "weight_entries_select" on public.weight_entries
  for select using (auth.uid() = user_id);
create policy "weight_entries_insert" on public.weight_entries
  for insert with check (auth.uid() = user_id);
create policy "weight_entries_update" on public.weight_entries
  for update using (auth.uid() = user_id);
create policy "weight_entries_delete" on public.weight_entries
  for delete using (auth.uid() = user_id);

-- daily_evaluations
create policy "daily_evaluations_select" on public.daily_evaluations
  for select using (auth.uid() = user_id);

-- habit_metrics
create policy "habit_metrics_select" on public.habit_metrics
  for select using (auth.uid() = user_id);

-- behavior_attributes
create policy "behavior_attributes_select" on public.behavior_attributes
  for select using (auth.uid() = user_id);

-- creature_stats
create policy "creature_stats_select" on public.creature_stats
  for select using (auth.uid() = user_id);

-- daily_feedback
create policy "daily_feedback_select" on public.daily_feedback
  for select using (auth.uid() = user_id);
