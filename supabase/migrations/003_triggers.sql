-- 003_triggers.sql
-- Triggers: profile bootstrap on signup, updated_at maintenance

-- updated_at trigger function
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply updated_at triggers to tables that have the column
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger products_updated_at
  before update on public.products
  for each row execute function public.handle_updated_at();

create trigger daily_logs_updated_at
  before update on public.daily_logs
  for each row execute function public.handle_updated_at();

create trigger meals_updated_at
  before update on public.meals
  for each row execute function public.handle_updated_at();

create trigger weight_entries_updated_at
  before update on public.weight_entries
  for each row execute function public.handle_updated_at();

-- Auto-create profile on new auth user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
