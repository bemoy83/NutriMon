-- 043_meal_item_label_portion_snapshot.sql
-- Snapshot label_portion_grams from the source food onto meal_items so that
-- ServingEditSheet can show the Portions tab when editing logged items, even
-- when the live food source is not in memory.

-- 1. Add column
alter table public.meal_items
  add column if not exists label_portion_grams_snapshot numeric(8,2) null
  check (label_portion_grams_snapshot is null or label_portion_grams_snapshot > 0);

comment on column public.meal_items.label_portion_grams_snapshot is
  'Snapshot of the source food''s label_portion_grams at log time. NULL for catalog items and foods without a label portion.';

-- 2. Backfill existing rows from products
update public.meal_items mi
set label_portion_grams_snapshot = p.label_portion_grams
from public.products p
where mi.product_id = p.id
  and p.label_portion_grams is not null
  and mi.label_portion_grams_snapshot is null;

-- 3. Trigger: auto-fill on INSERT without touching any RPC
create or replace function public.fill_meal_item_label_portion()
returns trigger
language plpgsql
as $$
begin
  if new.label_portion_grams_snapshot is null and new.product_id is not null then
    select label_portion_grams
    into new.label_portion_grams_snapshot
    from public.products
    where id = new.product_id;
  end if;
  return new;
end;
$$;

drop trigger if exists meal_item_fill_label_portion on public.meal_items;

create trigger meal_item_fill_label_portion
  before insert on public.meal_items
  for each row execute function public.fill_meal_item_label_portion();
