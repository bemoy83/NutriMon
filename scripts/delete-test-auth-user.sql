-- Delete one NutriMon test auth user completely by email.
--
-- Usage:
-- 1. Open the Supabase SQL editor for your project.
-- 2. Paste this file.
-- 3. Replace the email below.
-- 4. Run it.
--
-- Behavior:
-- - deletes the auth.users row
-- - cascades all user-owned app data through foreign keys
-- - removes the profile row as part of the cascade
--
-- Use this only when you want a full clean recreation of the account.

begin;

do $$
declare
  v_email text := 'replace-with-test-user@example.com';
  v_user_id uuid;
begin
  select id
  into v_user_id
  from auth.users
  where email = v_email;

  if v_user_id is null then
    raise exception 'No auth user found for email: %', v_email;
  end if;

  delete from auth.users
  where id = v_user_id;

  raise notice 'Deleted auth user % (%)', v_email, v_user_id;
end
$$;

commit;
