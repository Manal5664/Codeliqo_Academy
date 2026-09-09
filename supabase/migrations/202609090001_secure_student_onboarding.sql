-- Secure, admin-driven student onboarding support.
-- This migration is additive and preserves existing student and enrollment data.

alter table public.profiles
  add column if not exists email text;

-- Backfill account emails from Supabase Auth. Authentication email remains the
-- source of truth; this copy lets admins display it without exposing auth.users.
update public.profiles as profile
set email = lower(auth_user.email)
from auth.users as auth_user
where auth_user.id = profile.id
  and auth_user.email is not null
  and profile.email is distinct from lower(auth_user.email);

create unique index if not exists profiles_email_unique
  on public.profiles (lower(email))
  where email is not null;

create unique index if not exists students_application_id_unique
  on public.students (lower(application_id))
  where application_id is not null;

create unique index if not exists students_enrollment_id_case_insensitive_unique
  on public.students (lower(enrollment_id))
  where enrollment_id is not null;

-- "Inactive" is the explicit access-disabled state used by the admin UI.
alter table public.students drop constraint if exists students_status_check;
alter table public.students
  add constraint students_status_check
  check (status in ('active', 'inactive', 'paused', 'completed', 'withdrawn'));

-- Keep the public profile in sync whenever Supabase Auth creates an account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, email, role)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    lower(new.email),
    'student'
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name);
  return new;
end;
$$;

-- Students may maintain ordinary profile details but cannot rewrite their
-- account email or role through the public profile table.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not public.is_admin()
     and (
       new.role is distinct from old.role
       or new.email is distinct from old.email
     ) then
    raise exception 'Only an administrator can change account security fields';
  end if;
  return new;
end;
$$;

-- An inactive student keeps their Auth account and historical data, while RLS
-- denies access to student-owned LMS records until an admin activates them.
create or replace function public.owns_student(student_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.students
    where id = student_uuid
      and profile_id = auth.uid()
      and status <> 'inactive'
  );
$$;

create or replace function public.has_active_access(program_uuid uuid, batch_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.enrollments e
    join public.students s on s.id = e.student_id
    where s.profile_id = auth.uid()
      and s.status = 'active'
      and e.status = 'active'
      and e.program_id = program_uuid
      and (batch_uuid is null or e.batch_id = batch_uuid)
  );
$$;

create or replace function public.has_announcement_access(program_uuid uuid, batch_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (program_uuid is null and batch_uuid is null) or exists(
    select 1
    from public.enrollments e
    join public.students s on s.id = e.student_id
    where s.profile_id = auth.uid()
      and s.status = 'active'
      and e.status = 'active'
      and (program_uuid is null or e.program_id = program_uuid)
      and (batch_uuid is null or e.batch_id = batch_uuid)
  );
$$;

-- Guard all enrollment writes, including later edits in the admin dashboard.
create or replace function public.ensure_enrollment_batch_program()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.batch_id is not null and not exists (
    select 1
    from public.batches b
    where b.id = new.batch_id and b.program_id = new.program_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'The selected batch does not belong to the selected program.';
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_enrollment_batch_program on public.enrollments;
create trigger ensure_enrollment_batch_program
before insert or update of program_id, batch_id on public.enrollments
for each row execute function public.ensure_enrollment_batch_program();

-- Preflight prevents an invitation email being sent for a request that already
-- has a known reference conflict. The final transactional function repeats all
-- checks to stay safe if two admins submit concurrently.
create or replace function public.validate_student_onboarding(
  p_application_id text,
  p_enrollment_id text,
  p_program_id uuid,
  p_batch_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_application_id text := trim(coalesce(p_application_id, ''));
  v_enrollment_id text := nullif(trim(coalesce(p_enrollment_id, '')), '');
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if v_application_id !~ '^[A-Za-z0-9][A-Za-z0-9/_-]{2,63}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_APPLICATION_ID';
  end if;
  if v_enrollment_id is not null and v_enrollment_id !~ '^[A-Za-z0-9][A-Za-z0-9/_-]{2,63}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_ENROLLMENT_ID';
  end if;
  if exists (select 1 from public.students s where lower(s.application_id) = lower(v_application_id)) then
    raise exception using errcode = '23505', message = 'APPLICATION_ID_EXISTS';
  end if;
  if v_enrollment_id is not null and exists (
    select 1 from public.students s where lower(s.enrollment_id) = lower(v_enrollment_id)
  ) then
    raise exception using errcode = '23505', message = 'ENROLLMENT_ID_EXISTS';
  end if;
  if not exists (
    select 1
    from public.programs p
    join public.batches b on b.program_id = p.id
    where p.id = p_program_id
      and b.id = p_batch_id
      and p.active
      and b.status in ('planned', 'active')
  ) then
    raise exception using errcode = '23514', message = 'PROGRAM_BATCH_MISMATCH';
  end if;
  return true;
end;
$$;

revoke all on function public.validate_student_onboarding(text, text, uuid, uuid) from public;
revoke all on function public.validate_student_onboarding(text, text, uuid, uuid) from anon, authenticated;
grant execute on function public.validate_student_onboarding(text, text, uuid, uuid) to service_role;

-- The Edge Function calls this service-role-only RPC after it has created the
-- Auth user. Everything below runs in one database transaction.
create or replace function public.onboard_student_records(
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_application_id text,
  p_program_id uuid,
  p_batch_id uuid,
  p_student_status text default 'active',
  p_enrollment_status text default 'active',
  p_enrollment_id text default null
)
returns table (
  student_id uuid,
  enrollment_uuid uuid,
  enrollment_id text,
  program_name text,
  batch_name text
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_full_name text := trim(coalesce(p_full_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_application_id text := trim(coalesce(p_application_id, ''));
  v_enrollment_id text := nullif(trim(coalesce(p_enrollment_id, '')), '');
  v_student_id uuid;
  v_enrollment_uuid uuid;
  v_program_name text;
  v_batch_name text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  if v_full_name !~ '^.{2,120}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_FULL_NAME';
  end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email) > 254 then
    raise exception using errcode = 'P0001', message = 'INVALID_EMAIL';
  end if;
  if v_application_id !~ '^[A-Za-z0-9][A-Za-z0-9/_-]{2,63}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_APPLICATION_ID';
  end if;
  if v_enrollment_id is not null and v_enrollment_id !~ '^[A-Za-z0-9][A-Za-z0-9/_-]{2,63}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_ENROLLMENT_ID';
  end if;
  if p_program_id is null or p_batch_id is null then
    raise exception using errcode = 'P0001', message = 'PROGRAM_AND_BATCH_REQUIRED';
  end if;
  if p_student_status not in ('active', 'inactive', 'paused', 'completed', 'withdrawn') then
    raise exception using errcode = 'P0001', message = 'INVALID_STUDENT_STATUS';
  end if;
  if p_enrollment_status not in ('active', 'paused', 'completed', 'withdrawn') then
    raise exception using errcode = 'P0001', message = 'INVALID_ENROLLMENT_STATUS';
  end if;

  -- Serialize duplicate-sensitive application/enrollment reference checks.
  perform pg_advisory_xact_lock(hashtextextended(lower(v_application_id), 0));
  if exists (select 1 from public.students s where lower(s.application_id) = lower(v_application_id)) then
    raise exception using errcode = '23505', message = 'APPLICATION_ID_EXISTS';
  end if;

  if v_enrollment_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(lower(v_enrollment_id), 1));
    if exists (select 1 from public.students s where lower(s.enrollment_id) = lower(v_enrollment_id)) then
      raise exception using errcode = '23505', message = 'ENROLLMENT_ID_EXISTS';
    end if;
  else
    v_enrollment_id := 'CDL-' || to_char(now(), 'YYYY') || '-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  end if;

  if exists (select 1 from public.students s where s.profile_id = p_user_id) then
    raise exception using errcode = '23505', message = 'STUDENT_ALREADY_EXISTS';
  end if;
  if exists (select 1 from public.profiles p where lower(p.email) = v_email and p.id <> p_user_id) then
    raise exception using errcode = '23505', message = 'EMAIL_ALREADY_EXISTS';
  end if;

  select p.title, b.name
  into v_program_name, v_batch_name
  from public.programs p
  join public.batches b on b.program_id = p.id
  where p.id = p_program_id
    and b.id = p_batch_id
    and p.active
    and b.status in ('planned', 'active');

  if not found then
    raise exception using errcode = '23514', message = 'PROGRAM_BATCH_MISMATCH';
  end if;

  insert into public.profiles (id, full_name, email, role)
  values (p_user_id, v_full_name, v_email, 'student')
  on conflict (id) do update
  set full_name = excluded.full_name,
      email = excluded.email,
      role = 'student';

  insert into public.students (
    profile_id,
    application_id,
    enrollment_id,
    status,
    certificate_eligible
  )
  values (
    p_user_id,
    v_application_id,
    v_enrollment_id,
    p_student_status,
    false
  )
  returning id into v_student_id;

  insert into public.enrollments (
    student_id,
    program_id,
    batch_id,
    status,
    progress_percentage,
    current_week
  )
  values (
    v_student_id,
    p_program_id,
    p_batch_id,
    p_enrollment_status,
    0,
    1
  )
  returning id into v_enrollment_uuid;

  return query select
    v_student_id,
    v_enrollment_uuid,
    v_enrollment_id,
    v_program_name,
    v_batch_name;
end;
$$;

revoke all on function public.onboard_student_records(uuid, text, text, text, uuid, uuid, text, text, text) from public;
revoke all on function public.onboard_student_records(uuid, text, text, text, uuid, uuid, text, text, text) from anon, authenticated;
grant execute on function public.onboard_student_records(uuid, text, text, text, uuid, uuid, text, text, text) to service_role;
