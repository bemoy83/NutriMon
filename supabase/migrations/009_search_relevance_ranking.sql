-- Improve search_food_sources result ordering with prefix/exact match relevance ranking
-- match_rank: 0 = exact, 1 = prefix, 2 = substring (computed in CTE, not returned)

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
      0 as source_rank,
      case
        when lower(p.name) = lower(s.query)              then 0
        when lower(p.name) like lower(s.query) || '%'    then 1
        else                                                  2
      end as match_rank
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
      1 as source_rank,
      case
        when lower(c.name) = lower(s.query)              then 0
        when lower(c.name) like lower(s.query) || '%'    then 1
        else                                                  2
      end as match_rank
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
  order by match_rank asc, source_rank asc, use_count desc, last_used_at desc nulls last, name asc
  limit greatest(coalesce(p_limit, 20), 0);
$$;
