-- Batch load composite product payloads in one round-trip (export / library tools).
-- Reuses get_composite_product for each id (single auth check per call inside that function).

create or replace function public.get_composite_products_batch(
  p_product_ids uuid[]
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_agg(s.payload)
      from (
        select get_composite_product(t.id) as payload
        from unnest(p_product_ids) as t(id)
      ) s
      where s.payload is not null
    ),
    '[]'::jsonb
  );
$$;
