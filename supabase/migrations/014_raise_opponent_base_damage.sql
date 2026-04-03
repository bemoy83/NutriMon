-- Replace the temporary opponent damage multiplier with an additive base attack
-- boost. This keeps player damage unchanged while making weak opponents hit for
-- meaningful damage even against high-resilience creatures.

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
  with raw as (
    select
      round(p_strength * 0.35 + p_momentum * 0.10 - p_resilience * 0.20)::integer
      + ((abs(hashtext(p_battle_run_id::text || p_round::text || p_actor)) % 7) - 3) as damage
  )
  select case
    when p_actor = 'opponent' then greatest(1, damage + 6)
    else greatest(1, damage)
  end
  from raw;
$$;
