-- Completion safeguards for secure student onboarding and editing.
-- Kept separate from 202609090001 so projects that applied the interrupted
-- migration draft receive these additions exactly once.

-- Auth remains the source of truth for account email addresses. Keep the
-- admin-readable profile copy synchronized when an account email changes.
create or replace function public.sync_profile_auth_email()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  update public.profiles
  set email = lower(new.email)
  where id = new.id
    and email is distinct from lower(new.email);
  return new;
end;
$$;

revoke all on function public.sync_profile_auth_email() from public;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
after update of email on auth.users
for each row
when (new.email is distinct from old.email)
execute function public.sync_profile_auth_email();

-- Preserve historical enrollments while preventing a second record for the
-- same student/program/batch combination. Status changes belong on the
-- existing enrollment instead of creating a duplicate row.
create or replace function public.prevent_duplicate_enrollment()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.enrollments enrollment
    where enrollment.student_id = new.student_id
      and enrollment.program_id = new.program_id
      and enrollment.batch_id is not distinct from new.batch_id
      and enrollment.id <> new.id
  ) then
    raise exception using errcode = '23505', message = 'DUPLICATE_ENROLLMENT';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_duplicate_enrollment() from public;

drop trigger if exists prevent_duplicate_enrollment on public.enrollments;
create trigger prevent_duplicate_enrollment
before insert or update of student_id, program_id, batch_id on public.enrollments
for each row execute function public.prevent_duplicate_enrollment();

-- Resolve a pre-existing Auth account without listing Auth users or exposing
-- auth.users to the browser. This supports safely linking an account that was
-- created before the automated student workflow was deployed.
create or replace function public.lookup_student_onboarding_account(p_email text)
returns table (
  user_id uuid,
  email_confirmed boolean,
  profile_role text,
  student_exists boolean
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email) > 254 then
    raise exception using errcode = 'P0001', message = 'INVALID_EMAIL';
  end if;

  return query
  select
    auth_user.id,
    auth_user.email_confirmed_at is not null,
    profile.role,
    exists (
      select 1
      from public.students student
      where student.profile_id = auth_user.id
    )
  from auth.users auth_user
  left join public.profiles profile on profile.id = auth_user.id
  where lower(auth_user.email) = v_email
  limit 1;
end;
$$;

revoke all on function public.lookup_student_onboarding_account(text) from public;
revoke all on function public.lookup_student_onboarding_account(text) from anon, authenticated;
grant execute on function public.lookup_student_onboarding_account(text) to service_role;

-- Keep student, profile, and enrollment edits atomic. The dashboard supplies
-- internal identifiers from its selected row; administrators never type them.
create or replace function public.update_student_records(
  p_student_id uuid,
  p_profile_id uuid,
  p_full_name text,
  p_application_id text,
  p_enrollment_id text,
  p_student_status text,
  p_certificate_eligible boolean,
  p_enrollment_uuid uuid,
  p_enrollment_status text,
  p_progress_percentage numeric,
  p_current_week integer
)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_full_name text := trim(coalesce(p_full_name, ''));
  v_application_id text := trim(coalesce(p_application_id, ''));
  v_enrollment_id text := nullif(trim(coalesce(p_enrollment_id, '')), '');
  v_profile_id uuid;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if v_full_name !~ '^.{2,120}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_FULL_NAME';
  end if;
  if v_application_id !~ '^[A-Za-z0-9][A-Za-z0-9/_-]{2,63}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_APPLICATION_ID';
  end if;
  if v_enrollment_id is not null and v_enrollment_id !~ '^[A-Za-z0-9][A-Za-z0-9/_-]{2,63}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_ENROLLMENT_ID';
  end if;
  if p_student_status not in ('active', 'inactive', 'paused', 'completed', 'withdrawn') then
    raise exception using errcode = 'P0001', message = 'INVALID_STUDENT_STATUS';
  end if;

  select student.profile_id
  into v_profile_id
  from public.students student
  where student.id = p_student_id;

  if not found or v_profile_id is distinct from p_profile_id then
    raise exception using errcode = 'P0001', message = 'STUDENT_NOT_FOUND';
  end if;

  if p_enrollment_uuid is not null then
    if p_enrollment_status not in ('active', 'paused', 'completed', 'withdrawn') then
      raise exception using errcode = 'P0001', message = 'INVALID_ENROLLMENT_STATUS';
    end if;
    if p_progress_percentage is null or p_progress_percentage < 0 or p_progress_percentage > 100 then
      raise exception using errcode = 'P0001', message = 'INVALID_PROGRESS';
    end if;
    if p_current_week is null or p_current_week < 0 then
      raise exception using errcode = 'P0001', message = 'INVALID_CURRENT_WEEK';
    end if;
    if not exists (
      select 1
      from public.enrollments enrollment
      where enrollment.id = p_enrollment_uuid
        and enrollment.student_id = p_student_id
    ) then
      raise exception using errcode = 'P0001', message = 'ENROLLMENT_NOT_FOUND';
    end if;
  end if;

  update public.profiles
  set full_name = v_full_name
  where id = p_profile_id;

  update public.students
  set application_id = v_application_id,
      enrollment_id = v_enrollment_id,
      status = p_student_status,
      certificate_eligible = coalesce(p_certificate_eligible, false)
  where id = p_student_id;

  if p_enrollment_uuid is not null then
    update public.enrollments
    set status = p_enrollment_status,
        progress_percentage = p_progress_percentage,
        current_week = p_current_week
    where id = p_enrollment_uuid
      and student_id = p_student_id;
  end if;

  return true;
end;
$$;

revoke all on function public.update_student_records(uuid, uuid, text, text, text, text, boolean, uuid, text, numeric, integer) from public;
revoke all on function public.update_student_records(uuid, uuid, text, text, text, text, boolean, uuid, text, numeric, integer) from anon;
grant execute on function public.update_student_records(uuid, uuid, text, text, text, text, boolean, uuid, text, numeric, integer) to authenticated;
