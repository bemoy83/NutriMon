-- 006_shared_food_catalog.sql
-- Shared built-in food catalog, merged read RPCs, and catalog-aware meal RPCs

create table public.food_catalog_items (
  id                     text primary key,
  source                 text not null,
  source_item_id         text not null,
  name                   text not null,
  calories               integer not null check (calories >= 0 and calories <= 5000),
  protein_g              numeric(6,2) null check (protein_g is null or protein_g >= 0),
  carbs_g                numeric(6,2) null check (carbs_g is null or carbs_g >= 0),
  fat_g                  numeric(6,2) null check (fat_g is null or fat_g >= 0),
  default_serving_amount numeric(8,2) not null default 100 check (default_serving_amount > 0),
  default_serving_unit   text not null default 'g',
  edible_portion_percent numeric(5,2) null check (
    edible_portion_percent is null or
    (edible_portion_percent >= 0 and edible_portion_percent <= 100)
  ),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (source, source_item_id)
);

create index food_catalog_items_name on public.food_catalog_items (lower(name));

create table public.catalog_item_usage (
  user_id         uuid not null references auth.users(id) on delete cascade,
  catalog_item_id text not null references public.food_catalog_items(id) on delete cascade,
  use_count       integer not null default 0 check (use_count >= 0),
  last_used_at    timestamptz null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (user_id, catalog_item_id)
);

create index catalog_item_usage_user_last_used
  on public.catalog_item_usage (user_id, last_used_at desc nulls last);
create index catalog_item_usage_user_use_count
  on public.catalog_item_usage (user_id, use_count desc, last_used_at desc nulls last);

alter table public.meal_items
  add column catalog_item_id text null references public.food_catalog_items(id) on delete set null;

alter table public.food_catalog_items enable row level security;
alter table public.catalog_item_usage enable row level security;

create policy "food_catalog_items_select" on public.food_catalog_items
  for select using (auth.role() = 'authenticated');

create policy "catalog_item_usage_select" on public.catalog_item_usage
  for select using (auth.uid() = user_id);
create policy "catalog_item_usage_insert" on public.catalog_item_usage
  for insert with check (auth.uid() = user_id);
create policy "catalog_item_usage_update" on public.catalog_item_usage
  for update using (auth.uid() = user_id);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger food_catalog_items_updated_at
  before update on public.food_catalog_items
  for each row execute function public.handle_updated_at();

create trigger catalog_item_usage_updated_at
  before update on public.catalog_item_usage
  for each row execute function public.handle_updated_at();

create or replace function public.create_meal_with_items(
  p_log_date  date,
  p_logged_at timestamptz,
  p_items     jsonb
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
      select * into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid and user_id = v_user_id;
      if not found then
        raise exception 'Product not found or not owned: %', v_item->>'product_id';
      end if;
    else
      select * into v_catalog_item
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

  select * into v_log
  from public.daily_logs
  where user_id = v_user_id and log_date = p_log_date;

  if v_log.is_finalized then
    raise exception 'Daily log is finalized for date %', p_log_date;
  end if;

  insert into public.meals (user_id, daily_log_id, logged_at)
  values (v_user_id, v_log.id, p_logged_at)
  returning * into v_meal;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::numeric;
    v_has_product := v_item ? 'product_id' and coalesce(v_item->>'product_id', '') <> '';

    if v_has_product then
      select * into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid and user_id = v_user_id;

      v_line_cal := round(v_qty * v_product.calories);

      insert into public.meal_items (
        meal_id, product_id, catalog_item_id, quantity,
        product_name_snapshot, calories_per_serving_snapshot,
        protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        serving_amount_snapshot, serving_unit_snapshot,
        line_total_calories
      ) values (
        v_meal.id, v_product.id, null, v_qty,
        v_product.name, v_product.calories,
        v_product.protein_g, v_product.carbs_g, v_product.fat_g,
        v_product.default_serving_amount, v_product.default_serving_unit,
        v_line_cal
      ) returning * into v_meal_item;

      update public.products
      set use_count = use_count + 1,
          last_used_at = now(),
          updated_at = now()
      where id = v_product.id;
    else
      select * into v_catalog_item
      from public.food_catalog_items
      where id = v_item->>'catalog_item_id';

      v_line_cal := round(v_qty * v_catalog_item.calories);

      insert into public.meal_items (
        meal_id, product_id, catalog_item_id, quantity,
        product_name_snapshot, calories_per_serving_snapshot,
        protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        serving_amount_snapshot, serving_unit_snapshot,
        line_total_calories
      ) values (
        v_meal.id, null, v_catalog_item.id, v_qty,
        v_catalog_item.name, v_catalog_item.calories,
        v_catalog_item.protein_g, v_catalog_item.carbs_g, v_catalog_item.fat_g,
        v_catalog_item.default_serving_amount, v_catalog_item.default_serving_unit,
        v_line_cal
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
      item_count     = (select count(*) from public.meal_items where meal_id = v_meal.id),
      updated_at     = now()
  where id = v_meal.id
  returning * into v_meal;

  update public.daily_logs
  set total_calories = (select coalesce(sum(total_calories), 0) from public.meals where daily_log_id = v_log.id),
      meal_count     = (select count(*) from public.meals where daily_log_id = v_log.id),
      updated_at     = now()
  where id = v_log.id
  returning * into v_log;

  return json_build_object(
    'meal', row_to_json(v_meal),
    'meal_items', v_items_out,
    'daily_log', row_to_json(v_log)
  );
end;
$$;

create or replace function public.update_meal_with_items(
  p_meal_id   uuid,
  p_logged_at timestamptz,
  p_items     jsonb
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
      select * into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid and user_id = v_user_id;
      if not found then
        raise exception 'Product not found or not owned: %', v_item->>'product_id';
      end if;
    elsif v_has_catalog then
      select * into v_catalog_item
      from public.food_catalog_items
      where id = v_item->>'catalog_item_id';
      if not found then
        raise exception 'Catalog item not found: %', v_item->>'catalog_item_id';
      end if;
    end if;
  end loop;

  delete from public.meal_items where meal_id = p_meal_id;

  update public.meals
  set logged_at = p_logged_at, updated_at = now()
  where id = p_meal_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_has_product := v_item ? 'product_id' and coalesce(v_item->>'product_id', '') <> '';
    v_has_catalog := v_item ? 'catalog_item_id' and coalesce(v_item->>'catalog_item_id', '') <> '';

    if v_has_product then
      select * into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid and user_id = v_user_id;

      v_qty := (v_item->>'quantity')::numeric;
      v_line_cal := round(v_qty * v_product.calories);

      insert into public.meal_items (
        meal_id, product_id, catalog_item_id, quantity,
        product_name_snapshot, calories_per_serving_snapshot,
        protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        serving_amount_snapshot, serving_unit_snapshot,
        line_total_calories
      ) values (
        p_meal_id, v_product.id, null, v_qty,
        v_product.name, v_product.calories,
        v_product.protein_g, v_product.carbs_g, v_product.fat_g,
        v_product.default_serving_amount, v_product.default_serving_unit,
        v_line_cal
      ) returning * into v_meal_item;
    elsif v_has_catalog then
      select * into v_catalog_item
      from public.food_catalog_items
      where id = v_item->>'catalog_item_id';

      v_qty := (v_item->>'quantity')::numeric;
      v_line_cal := round(v_qty * v_catalog_item.calories);

      insert into public.meal_items (
        meal_id, product_id, catalog_item_id, quantity,
        product_name_snapshot, calories_per_serving_snapshot,
        protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        serving_amount_snapshot, serving_unit_snapshot,
        line_total_calories
      ) values (
        p_meal_id, null, v_catalog_item.id, v_qty,
        v_catalog_item.name, v_catalog_item.calories,
        v_catalog_item.protein_g, v_catalog_item.carbs_g, v_catalog_item.fat_g,
        v_catalog_item.default_serving_amount, v_catalog_item.default_serving_unit,
        v_line_cal
      ) returning * into v_meal_item;
    else
      v_qty := (v_item->>'quantity')::numeric;
      v_line_cal := round(v_qty * (v_item->>'calories_per_serving_snapshot')::integer);

      insert into public.meal_items (
        meal_id, product_id, catalog_item_id, quantity,
        product_name_snapshot, calories_per_serving_snapshot,
        protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
        serving_amount_snapshot, serving_unit_snapshot,
        line_total_calories
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
      item_count     = (select count(*) from public.meal_items where meal_id = p_meal_id),
      updated_at     = now()
  where id = p_meal_id
  returning * into v_meal;

  update public.daily_logs
  set total_calories = (select coalesce(sum(total_calories), 0) from public.meals where daily_log_id = v_log.id),
      meal_count     = (select count(*) from public.meals where daily_log_id = v_log.id),
      updated_at     = now()
  where id = v_log.id
  returning * into v_log;

  return json_build_object(
    'meal', row_to_json(v_meal),
    'meal_items', v_items_out,
    'daily_log', row_to_json(v_log)
  );
end;
$$;

create or replace function public.get_recent_food_sources(p_limit integer default 20)
returns table (
  source_type text,
  source_id text,
  name text,
  calories integer,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  default_serving_amount numeric,
  default_serving_unit text,
  use_count integer,
  last_used_at timestamptz
)
language sql
stable
set search_path = public
as $$
  with merged as (
    select
      'user_product'::text as source_type,
      p.id::text as source_id,
      p.name,
      p.calories,
      p.protein_g,
      p.carbs_g,
      p.fat_g,
      p.default_serving_amount,
      p.default_serving_unit,
      p.use_count,
      p.last_used_at,
      0 as source_rank
    from public.products p
    where p.user_id = auth.uid()
      and p.last_used_at is not null

    union all

    select
      'catalog_item'::text as source_type,
      c.id::text as source_id,
      c.name,
      c.calories,
      c.protein_g,
      c.carbs_g,
      c.fat_g,
      c.default_serving_amount,
      c.default_serving_unit,
      u.use_count,
      u.last_used_at,
      1 as source_rank
    from public.catalog_item_usage u
    join public.food_catalog_items c on c.id = u.catalog_item_id
    where u.user_id = auth.uid()
      and u.last_used_at is not null
  )
  select
    source_type,
    source_id,
    name,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    default_serving_amount,
    default_serving_unit,
    use_count,
    last_used_at
  from merged
  order by last_used_at desc, source_rank asc, name asc
  limit greatest(coalesce(p_limit, 20), 0);
$$;

create or replace function public.get_frequent_food_sources(p_limit integer default 10)
returns table (
  source_type text,
  source_id text,
  name text,
  calories integer,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  default_serving_amount numeric,
  default_serving_unit text,
  use_count integer,
  last_used_at timestamptz
)
language sql
stable
set search_path = public
as $$
  with merged as (
    select
      'user_product'::text as source_type,
      p.id::text as source_id,
      p.name,
      p.calories,
      p.protein_g,
      p.carbs_g,
      p.fat_g,
      p.default_serving_amount,
      p.default_serving_unit,
      p.use_count,
      p.last_used_at,
      0 as source_rank
    from public.products p
    where p.user_id = auth.uid()
      and p.use_count > 0

    union all

    select
      'catalog_item'::text as source_type,
      c.id::text as source_id,
      c.name,
      c.calories,
      c.protein_g,
      c.carbs_g,
      c.fat_g,
      c.default_serving_amount,
      c.default_serving_unit,
      u.use_count,
      u.last_used_at,
      1 as source_rank
    from public.catalog_item_usage u
    join public.food_catalog_items c on c.id = u.catalog_item_id
    where u.user_id = auth.uid()
      and u.use_count > 0
  )
  select
    source_type,
    source_id,
    name,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    default_serving_amount,
    default_serving_unit,
    use_count,
    last_used_at
  from merged
  order by use_count desc, last_used_at desc nulls last, source_rank asc, name asc
  limit greatest(coalesce(p_limit, 10), 0);
$$;

create or replace function public.search_food_sources(
  p_query text,
  p_limit integer default 20
)
returns table (
  source_type text,
  source_id text,
  name text,
  calories integer,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  default_serving_amount numeric,
  default_serving_unit text,
  use_count integer,
  last_used_at timestamptz
)
language sql
stable
set search_path = public
as $$
  with search_input as (
    select trim(coalesce(p_query, '')) as query
  ),
  merged as (
    select
      'user_product'::text as source_type,
      p.id::text as source_id,
      p.name,
      p.calories,
      p.protein_g,
      p.carbs_g,
      p.fat_g,
      p.default_serving_amount,
      p.default_serving_unit,
      p.use_count,
      p.last_used_at,
      0 as source_rank
    from public.products p
    cross join search_input s
    where p.user_id = auth.uid()
      and s.query <> ''
      and p.name ilike '%' || s.query || '%'

    union all

    select
      'catalog_item'::text as source_type,
      c.id::text as source_id,
      c.name,
      c.calories,
      c.protein_g,
      c.carbs_g,
      c.fat_g,
      c.default_serving_amount,
      c.default_serving_unit,
      coalesce(u.use_count, 0) as use_count,
      u.last_used_at,
      1 as source_rank
    from public.food_catalog_items c
    cross join search_input s
    left join public.catalog_item_usage u
      on u.catalog_item_id = c.id and u.user_id = auth.uid()
    where s.query <> ''
      and c.name ilike '%' || s.query || '%'
  )
  select
    source_type,
    source_id,
    name,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    default_serving_amount,
    default_serving_unit,
    use_count,
    last_used_at
  from merged
  order by source_rank asc, use_count desc, last_used_at desc nulls last, name asc
  limit greatest(coalesce(p_limit, 20), 0);
$$;
