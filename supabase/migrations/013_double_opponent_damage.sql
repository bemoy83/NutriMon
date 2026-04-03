-- Double only opponent turn damage while preserving the existing damage formula,
-- variance range, and player attack output.

create or replace function public.battle_compute_damage(
  p_battle_run_id uuid,
  p_round         integer,
  p_actor         text,
  p_strength      integer,
  p_momentum      integer,
  p_resilience    integer
)
returns integer
language sql
immutable
set search_path = public
as $$
  with base as (
    select greatest(
      1,
      round(p_strength * 0.35 + p_momentum * 0.10 - p_resilience * 0.20)::integer
      + ((abs(hashtext(p_battle_run_id::text || p_round::text || p_actor)) % 7) - 3)
    ) as damage
  )
  select case
    when p_actor = 'opponent' then damage * 2
    else damage
  end
  from base;
$$;
