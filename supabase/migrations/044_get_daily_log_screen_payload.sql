-- Single-call read model for the daily log screen (replaces multiple round-trips).
-- security definer: enforces auth.uid() only.

create or replace function public.get_daily_log_screen_payload(
  p_log_date date,
  p_current_meal_type text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile jsonb;
  v_daily_log jsonb;
  v_meals jsonb;
  v_eval jsonb;
  v_hm jsonb;
  v_behave jsonb;
  v_cstats jsonb;
  v_feedback jsonb;
  v_latest_hm jsonb;
  v_latest_cs jsonb;
  v_r record;
  v_repeat jsonb;
  v_log_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select to_jsonb(p) into v_profile
  from public.profiles p
  where p.user_id = v_uid;

  if v_profile is null then
    v_profile := 'null'::jsonb;
  end if;

  select to_jsonb(dl) into v_daily_log
  from public.daily_logs dl
  where dl.user_id = v_uid
    and dl.log_date = p_log_date;

  if v_daily_log is null then
    v_meals := '[]'::jsonb;
  else
    v_log_id := (v_daily_log->>'id')::uuid;
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'meal', row_to_json(m)::jsonb,
          'items', coalesce(
            (
              select jsonb_agg(row_to_json(mi)::jsonb order by mi.created_at, mi.id)
              from public.meal_items mi
              where mi.meal_id = m.id
            ),
            '[]'::jsonb
          )
        )
        order by
          case m.meal_type
            when 'Breakfast' then 0
            when 'Lunch' then 1
            when 'Dinner' then 2
            when 'Snack' then 3
            else 4
          end,
          m.logged_at desc,
          m.id
      ),
      '[]'::jsonb
    )
    into v_meals
    from public.meals m
    where m.user_id = v_uid
      and m.daily_log_id = v_log_id;
  end if;

  select to_jsonb(e) into v_eval
  from public.daily_evaluations e
  where e.user_id = v_uid and e.log_date = p_log_date
  limit 1;

  select to_jsonb(h) into v_hm
  from public.habit_metrics h
  where h.user_id = v_uid and h.log_date = p_log_date
  limit 1;

  select to_jsonb(b) into v_behave
  from public.behavior_attributes b
  where b.user_id = v_uid and b.log_date = p_log_date
  limit 1;

  select to_jsonb(c) into v_cstats
  from public.creature_stats c
  where c.user_id = v_uid and c.log_date = p_log_date
  limit 1;

  select to_jsonb(f) into v_feedback
  from public.daily_feedback f
  where f.user_id = v_uid and f.log_date = p_log_date
  limit 1;

  select to_jsonb(h) into v_latest_hm
  from public.habit_metrics h
  where h.user_id = v_uid
  order by h.log_date desc
  limit 1;

  select to_jsonb(c) into v_latest_cs
  from public.creature_stats c
  where c.user_id = v_uid
  order by c.log_date desc
  limit 1;

  select m.meal_name, m.meal_type, m.total_calories
  into v_r
  from public.meals m
  inner join public.daily_logs dl on dl.id = m.daily_log_id
  where m.user_id = v_uid
    and dl.log_date < p_log_date
    and (p_current_meal_type is null or m.meal_type = p_current_meal_type)
  order by m.logged_at desc
  limit 1;

  if v_r is not null then
    v_repeat := jsonb_build_object(
      'meal_name', v_r.meal_name,
      'meal_type', v_r.meal_type,
      'total_calories', v_r.total_calories
    );
  else
    v_repeat := null;
  end if;

  return jsonb_build_object(
    'profile', v_profile,
    'daily_log', v_daily_log,
    'meals', coalesce(v_meals, '[]'::jsonb),
    'derived', jsonb_build_object(
      'daily_evaluation', v_eval,
      'habit_metrics', v_hm,
      'behavior_attributes', v_behave,
      'creature_stats', v_cstats,
      'daily_feedback', v_feedback
    ),
    'latest_fallback', jsonb_build_object(
      'habit_metrics', v_latest_hm,
      'creature_stats', v_latest_cs
    ),
    'repeat_last_meal', v_repeat
  );
end;
$$;

revoke all on function public.get_daily_log_screen_payload(date, text) from public;
grant execute on function public.get_daily_log_screen_payload(date, text) to authenticated;

comment on function public.get_daily_log_screen_payload(date, text) is
  'Profile, daily log, meals+items, per-day derived rows, latest habit/creature fallback, repeat-meal preview.';
