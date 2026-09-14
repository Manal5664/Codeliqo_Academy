-- Generate canonical certificate IDs inside PostgreSQL so concurrent admins
-- cannot reserve the same number. Existing certificate records are preserved.

alter table public.certificates
  alter column certificate_id set not null;

create unique index if not exists certificates_certificate_id_ci_key
on public.certificates (upper(certificate_id));

create or replace function public.create_pending_certificate(
  p_student_id uuid,
  p_program_name text,
  p_completion_date date
)
returns table (id uuid, certificate_id text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  certificate_year integer := extract(year from current_date)::integer;
  next_number bigint;
  generated_id text;
  inserted_id uuid;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'ADMIN_REQUIRED';
  end if;

  if p_student_id is null or not exists (
    select 1 from public.students where students.id = p_student_id
  ) then
    raise exception using errcode = '23503', message = 'CERTIFICATE_STUDENT_NOT_FOUND';
  end if;

  if length(trim(coalesce(p_program_name, ''))) not between 2 and 180 then
    raise exception using errcode = '22023', message = 'INVALID_CERTIFICATE_PROGRAM';
  end if;

  if p_completion_date is null then
    raise exception using errcode = '22023', message = 'COMPLETION_DATE_REQUIRED';
  end if;

  -- SHARE ROW EXCLUSIVE conflicts with concurrent INSERT/UPDATE/DELETE locks.
  -- It serializes allocation with direct writes as well as calls to this RPC.
  lock table public.certificates in share row exclusive mode;

  select coalesce(max(substring(c.certificate_id from 11 for 6)::bigint), 0) + 1
  into next_number
  from public.certificates c
  where c.certificate_id ~ ('^CERT-' || certificate_year || '-[0-9]{6}$');

  if next_number > 999999 then
    raise exception using errcode = '22003', message = 'CERTIFICATE_ID_RANGE_EXHAUSTED';
  end if;

  generated_id := 'CERT-' || certificate_year || '-' || lpad(next_number::text, 6, '0');

  insert into public.certificates (student_id, certificate_id, program_name, issue_date, status)
  values (p_student_id, generated_id, trim(p_program_name), p_completion_date, 'pending')
  returning certificates.id into inserted_id;

  return query select inserted_id, generated_id;
end;
$$;

revoke all on function public.create_pending_certificate(uuid, text, date) from public;
grant execute on function public.create_pending_certificate(uuid, text, date) to authenticated;

comment on function public.create_pending_certificate(uuid, text, date)
is 'Admin-only atomic allocator for CERT-YYYY-NNNNNN certificate IDs and pending certificate records.';
