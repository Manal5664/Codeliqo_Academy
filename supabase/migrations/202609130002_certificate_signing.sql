-- Private certificate-signing settings and immutable issuance snapshots.

create table if not exists public.certificate_settings (
  id boolean primary key default true check (id),
  authorized_signatory_name text not null check (length(trim(authorized_signatory_name)) between 2 and 120),
  designation text not null check (length(trim(designation)) between 2 and 120),
  signature_path text not null check (signature_path ~ '^settings/[0-9a-f-]+\.png$'),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_certificate_settings_updated_at on public.certificate_settings;
create trigger set_certificate_settings_updated_at
before update on public.certificate_settings
for each row execute function public.set_updated_at();

alter table public.certificate_settings enable row level security;
drop policy if exists "admins manage certificate settings" on public.certificate_settings;
create policy "admins manage certificate settings"
on public.certificate_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

revoke all on table public.certificate_settings from anon;
grant select, insert, update on table public.certificate_settings to authenticated;

alter table public.certificates
  add column if not exists student_name_snapshot text,
  add column if not exists signatory_name_snapshot text,
  add column if not exists signatory_designation_snapshot text,
  add column if not exists signature_path_snapshot text,
  add column if not exists signature_sha256_snapshot text,
  add column if not exists file_path text,
  add column if not exists issued_at timestamptz,
  add column if not exists issued_by uuid references public.profiles(id) on delete restrict;

create or replace function public.protect_certificate_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'issued' and (
    nullif(trim(new.certificate_id), '') is null
    or nullif(trim(new.program_name), '') is null
    or new.issue_date is null
    or nullif(trim(new.student_name_snapshot), '') is null
    or nullif(trim(new.signatory_name_snapshot), '') is null
    or nullif(trim(new.signatory_designation_snapshot), '') is null
    or nullif(trim(new.signature_path_snapshot), '') is null
    or nullif(trim(new.signature_sha256_snapshot), '') is null
    or new.signature_sha256_snapshot !~ '^[0-9a-f]{64}$'
    or nullif(trim(new.file_path), '') is null
    or new.issued_at is null
    or new.issued_by is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'CERTIFICATE_ISSUANCE_REQUIRES_RENDERED_SNAPSHOT';
  end if;

  if tg_op = 'UPDATE' and old.status in ('issued', 'revoked') and (
    new.student_id is distinct from old.student_id
    or new.certificate_id is distinct from old.certificate_id
    or new.program_name is distinct from old.program_name
    or new.issue_date is distinct from old.issue_date
    or new.student_name_snapshot is distinct from old.student_name_snapshot
    or new.signatory_name_snapshot is distinct from old.signatory_name_snapshot
    or new.signatory_designation_snapshot is distinct from old.signatory_designation_snapshot
    or new.signature_path_snapshot is distinct from old.signature_path_snapshot
    or new.signature_sha256_snapshot is distinct from old.signature_sha256_snapshot
    or new.file_path is distinct from old.file_path
    or new.file_url is distinct from old.file_url
    or new.issued_at is distinct from old.issued_at
    or new.issued_by is distinct from old.issued_by
  ) then
    raise exception using errcode = '23514', message = 'CERTIFICATE_SNAPSHOT_IS_IMMUTABLE';
  end if;

  if tg_op = 'UPDATE' and old.status = 'issued' and new.status not in ('issued', 'revoked') then
    raise exception using errcode = '23514', message = 'ISSUED_CERTIFICATE_CANNOT_RETURN_TO_PENDING';
  end if;
  if tg_op = 'UPDATE' and old.status = 'revoked' and new.status <> 'revoked' then
    raise exception using errcode = '23514', message = 'REVOKED_CERTIFICATE_IS_FINAL';
  end if;
  if tg_op = 'INSERT' and new.status = 'revoked' then
    raise exception using errcode = '23514', message = 'ONLY_ISSUED_CERTIFICATES_CAN_BE_REVOKED';
  end if;
  if tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'revoked' then
    raise exception using errcode = '23514', message = 'ONLY_ISSUED_CERTIFICATES_CAN_BE_REVOKED';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_certificate_snapshot on public.certificates;
create trigger protect_certificate_snapshot
before insert or update on public.certificates
for each row execute function public.protect_certificate_snapshot();

create or replace function public.prevent_issued_certificate_deletion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status <> 'pending' then
    raise exception using errcode = '23514', message = 'ONLY_PENDING_CERTIFICATES_CAN_BE_DELETED';
  end if;
  return old;
end;
$$;

drop trigger if exists prevent_issued_certificate_deletion on public.certificates;
create trigger prevent_issued_certificate_deletion
before delete on public.certificates
for each row execute function public.prevent_issued_certificate_deletion();

-- Both buckets are private. Original signatures are readable only by admins;
-- the server-side issue-certificate function reads and snapshots them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificate-signatures', 'certificate-signatures', false, 2097152, array['image/png'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificates', 'certificates', false, 10485760, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admins manage certificate signatures" on storage.objects;
drop policy if exists "admins read certificate signatures" on storage.objects;
create policy "admins read certificate signatures"
on storage.objects
for select
to authenticated
using (bucket_id = 'certificate-signatures' and public.is_admin());

drop policy if exists "admins upload certificate settings signatures" on storage.objects;
create policy "admins upload certificate settings signatures"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'certificate-signatures'
  and name ~ '^settings/[0-9a-f-]+\.png$'
  and public.is_admin()
);

drop policy if exists "admins delete certificate settings signatures" on storage.objects;
create policy "admins delete certificate settings signatures"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'certificate-signatures'
  and name ~ '^settings/[0-9a-f-]+\.png$'
  and public.is_admin()
);

create or replace function public.can_read_certificate_file(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.certificates c
    where c.file_path = object_name
      and c.status = 'issued'
      and public.owns_student(c.student_id)
  );
$$;

revoke all on function public.can_read_certificate_file(text) from public;
grant execute on function public.can_read_certificate_file(text) to authenticated;

drop policy if exists "authorized users read rendered certificates" on storage.objects;
create policy "authorized users read rendered certificates"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'certificates'
  and (public.is_admin() or public.can_read_certificate_file(name))
);

-- Public verification remains intentionally limited and never returns file or
-- signature paths. Issued records use the immutable student-name snapshot.
create or replace function public.verify_certificate(lookup_id text)
returns table (certificate_id text, student_name text, program_name text, issue_date date, status text)
language sql
stable
security definer
set search_path = public
as $$
  select c.certificate_id, coalesce(c.student_name_snapshot, p.full_name), c.program_name, c.issue_date, c.status
  from public.certificates c
  join public.students s on s.id = c.student_id
  join public.profiles p on p.id = s.profile_id
  where upper(c.certificate_id) = upper(trim(lookup_id)) and c.status in ('issued', 'revoked')
  limit 1;
$$;

revoke all on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated;

comment on table public.certificate_settings is 'Singleton current signatory configuration; the source PNG is stored in a private bucket.';
comment on column public.certificates.signature_path_snapshot is 'Private immutable PNG copy used when this certificate was rendered.';
comment on column public.certificates.signature_sha256_snapshot is 'SHA-256 of the exact signature PNG embedded in the rendered certificate.';
comment on column public.certificates.file_path is 'Private rendered PDF object path; never a permanent public URL.';
