-- Trigram indexes to speed ILIKE / similarity search for user products and shared catalog.
create extension if not exists pg_trgm;

create index if not exists products_user_name_trgm
  on public.products
  using gin (lower(name) gin_trgm_ops);

create index if not exists food_catalog_items_name_trgm
  on public.food_catalog_items
  using gin (lower(name) gin_trgm_ops);

comment on index public.products_user_name_trgm is 'Supports my-food paged search (ILIKE %q%).';
comment on index public.food_catalog_items_name_trgm is 'Supports food catalog name search.';
