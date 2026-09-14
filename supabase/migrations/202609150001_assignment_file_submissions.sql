-- Extend the existing assignment flow with private, validated file submissions.
-- Existing assignments remain link-only and existing URL submissions remain valid.

alter table public.assignments
  add column if not exists submission_type text not null default 'link_only',
  add column if not exists max_file_size_mb integer not null default 25,
  add column if not exists allow_resubmission boolean not null default true;

alter table public.assignments drop constraint if exists assignments_submission_type_check;
alter table public.assignments
  add constraint assignments_submission_type_check
  check (submission_type in ('link_only', 'file_only', 'link_or_file', 'no_submission'));

alter table public.assignments drop constraint if exists assignments_max_file_size_mb_check;
alter table public.assignments
  add constraint assignments_max_file_size_mb_check
  check (max_file_size_mb between 1 and 50);

alter table public.assignment_submissions
  add column if not exists file_path text,
  add column if not exists file_name text,
  add column if not exists file_size bigint,
  add column if not exists file_mime_type text,
  add column if not exists notes text;

alter table public.assignment_submissions drop constraint if exists assignment_submissions_status_check;
alter table public.assignment_submissions
  add constraint assignment_submissions_status_check
  check (status in ('not_started', 'in_progress', 'submitted', 'reviewed', 'approved', 'needs_revision'));

alter table public.assignment_submissions drop constraint if exists assignment_submissions_notes_length_check;
alter table public.assignment_submissions
  add constraint assignment_submissions_notes_length_check
  check (notes is null or char_length(notes) <= 4000);

alter table public.assignment_submissions drop constraint if exists assignment_submissions_file_metadata_check;
alter table public.assignment_submissions
  add constraint assignment_submissions_file_metadata_check
  check (
    (file_path is null and file_name is null and file_size is null and file_mime_type is null)
    or
    (file_path is not null and file_name is not null and file_size > 0 and file_mime_type is not null)
  );

-- The bucket-level limit is a hard ceiling. Each assignment can set a smaller
-- limit, which the submission function enforces against Storage metadata.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assignment-submissions',
  'assignment-submissions',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed',
    'application/x-zip',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_read_assignment_submission_file(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.assignment_submissions submission
    where submission.file_path = object_name
      and public.owns_student(submission.student_id)
  );
$$;

revoke all on function public.can_read_assignment_submission_file(text) from public;
grant execute on function public.can_read_assignment_submission_file(text) to authenticated;

drop policy if exists "authorized users read assignment submissions" on storage.objects;
create policy "authorized users read assignment submissions"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'assignment-submissions'
  and (public.is_admin() or public.can_read_assignment_submission_file(name))
);

-- Uploads deliberately have no client Storage policy. The assignment-submission
-- Edge Function validates the bytes and uploads with the service role.

-- New clients submit through one atomic RPC after the Edge Function has
-- inspected uploaded bytes. Existing URL-only clients retain their RLS path
-- during a rolling deployment; the validation trigger below applies the same
-- assignment rules and server timestamp to those direct writes.

create or replace function public.submit_assignment_submission(
  p_assignment_id uuid,
  p_submission_url text default null,
  p_file_path text default null,
  p_file_name text default null,
  p_file_size bigint default null,
  p_file_mime_type text default null,
  p_notes text default null
)
returns table (submission_id uuid, replaced_file_path text)
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_student_id uuid;
  v_assignment public.assignments%rowtype;
  v_existing public.assignment_submissions%rowtype;
  v_url text := nullif(btrim(p_submission_url), '');
  v_notes text := nullif(btrim(p_notes), '');
  v_extension text;
  v_storage_metadata jsonb;
  v_replaced_file_path text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select student.id
  into v_student_id
  from public.students student
  where student.profile_id = auth.uid()
    and student.status = 'active'
  limit 1;

  if v_student_id is null then
    raise exception using errcode = '42501', message = 'ACTIVE_STUDENT_REQUIRED';
  end if;

  select assignment.*
  into v_assignment
  from public.assignments assignment
  where assignment.id = p_assignment_id
    and assignment.published
    and exists (
      select 1
      from public.enrollments enrollment
      where enrollment.student_id = v_student_id
        and enrollment.status = 'active'
        and enrollment.program_id = assignment.program_id
        and (assignment.batch_id is null or enrollment.batch_id = assignment.batch_id)
    );

  if not found then
    raise exception using errcode = '42501', message = 'ASSIGNMENT_NOT_AVAILABLE';
  end if;

  if v_assignment.submission_type = 'no_submission' then
    raise exception using errcode = '23514', message = 'SUBMISSION_NOT_REQUIRED';
  end if;

  -- Serialize submissions for the same student/assignment pair so a double
  -- click or two browser tabs cannot create or overwrite a first submission.
  perform pg_advisory_xact_lock(hashtextextended(v_student_id::text || ':' || p_assignment_id::text, 0));

  select submission.*
  into v_existing
  from public.assignment_submissions submission
  where submission.student_id = v_student_id
    and submission.assignment_id = p_assignment_id
  for update;

  if found
    and (v_existing.submitted_at is not null or v_existing.status in ('submitted', 'reviewed', 'approved', 'needs_revision'))
    and not v_assignment.allow_resubmission then
    raise exception using errcode = '23505', message = 'RESUBMISSION_NOT_ALLOWED';
  end if;

  if v_url is not null and (
    char_length(v_url) > 2048
    or v_url !~* '^https?://[^[:space:][:cntrl:]]+$'
  ) then
    raise exception using errcode = '23514', message = 'INVALID_SUBMISSION_URL';
  end if;

  if v_notes is not null and char_length(v_notes) > 4000 then
    raise exception using errcode = '23514', message = 'SUBMISSION_NOTES_TOO_LONG';
  end if;

  if (p_file_path is null or p_file_name is null or p_file_size is null or p_file_mime_type is null)
    and not (p_file_path is null and p_file_name is null and p_file_size is null and p_file_mime_type is null) then
    raise exception using errcode = '23514', message = 'INCOMPLETE_FILE_METADATA';
  end if;

  if p_file_path is not null then
    if p_file_name = ''
      or char_length(p_file_name) > 180
      or position('/' in p_file_name) > 0
      or position(chr(92) in p_file_name) > 0
      or p_file_name ~ '[[:cntrl:]]' then
      raise exception using errcode = '23514', message = 'INVALID_FILE_NAME';
    end if;

    if p_file_path !~ (
      '^' || v_student_id::text || '/' || p_assignment_id::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
      || '\.(pdf|docx|pptx|xlsx|zip|png|jpg|jpeg)$'
    ) then
      raise exception using errcode = '23514', message = 'INVALID_FILE_PATH';
    end if;

    v_extension := lower(substring(p_file_path from '\.([^.]+)$'));
    if not (
      (v_extension = 'pdf' and p_file_mime_type = 'application/pdf')
      or (v_extension = 'docx' and p_file_mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      or (v_extension = 'pptx' and p_file_mime_type = 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
      or (v_extension = 'xlsx' and p_file_mime_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      or (v_extension = 'zip' and p_file_mime_type in ('application/zip', 'application/x-zip-compressed', 'application/x-zip'))
      or (v_extension = 'png' and p_file_mime_type = 'image/png')
      or (v_extension in ('jpg', 'jpeg') and p_file_mime_type = 'image/jpeg')
    ) then
      raise exception using errcode = '23514', message = 'INVALID_FILE_TYPE';
    end if;

    if p_file_size < 1 or p_file_size > (v_assignment.max_file_size_mb::bigint * 1024 * 1024) then
      raise exception using errcode = '23514', message = 'FILE_TOO_LARGE';
    end if;

    select object.metadata
    into v_storage_metadata
    from storage.objects object
    where object.bucket_id = 'assignment-submissions'
      and object.name = p_file_path;

    if not found
      or v_storage_metadata ->> 'size' is null
      or (v_storage_metadata ->> 'size') !~ '^[0-9]+$'
      or (v_storage_metadata ->> 'size')::bigint <> p_file_size
      or coalesce(v_storage_metadata ->> 'mimetype', '') <> p_file_mime_type then
      raise exception using errcode = '23514', message = 'FILE_STORAGE_METADATA_MISMATCH';
    end if;
  end if;

  if v_assignment.submission_type = 'link_only' and (v_url is null or p_file_path is not null) then
    raise exception using errcode = '23514', message = 'LINK_SUBMISSION_REQUIRED';
  elsif v_assignment.submission_type = 'file_only' and (p_file_path is null or v_url is not null) then
    raise exception using errcode = '23514', message = 'FILE_SUBMISSION_REQUIRED';
  elsif v_assignment.submission_type = 'link_or_file' and v_url is null and p_file_path is null then
    raise exception using errcode = '23514', message = 'LINK_OR_FILE_REQUIRED';
  end if;

  if v_existing.id is not null and v_existing.file_path is distinct from p_file_path then
    v_replaced_file_path := v_existing.file_path;
  end if;

  return query
  insert into public.assignment_submissions (
    student_id,
    assignment_id,
    submission_url,
    file_path,
    file_name,
    file_size,
    file_mime_type,
    notes,
    status,
    submitted_at,
    reviewed_at
  ) values (
    v_student_id,
    p_assignment_id,
    v_url,
    p_file_path,
    p_file_name,
    p_file_size,
    p_file_mime_type,
    v_notes,
    'submitted',
    now(),
    null
  )
  on conflict (student_id, assignment_id) do update set
    submission_url = excluded.submission_url,
    file_path = excluded.file_path,
    file_name = excluded.file_name,
    file_size = excluded.file_size,
    file_mime_type = excluded.file_mime_type,
    notes = excluded.notes,
    status = 'submitted',
    submitted_at = now(),
    reviewed_at = null
  returning assignment_submissions.id, v_replaced_file_path;
end;
$$;

revoke all on function public.submit_assignment_submission(uuid, text, text, text, bigint, text, text) from public;
grant execute on function public.submit_assignment_submission(uuid, text, text, text, bigint, text, text) to authenticated;

-- Review content remains teacher-owned. Submission RPC updates may clear a
-- prior review timestamp when an explicitly allowed resubmission is made.
create or replace function public.protect_assignment_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.student_id is distinct from old.student_id
      or new.assignment_id is distinct from old.assignment_id
      or new.feedback is distinct from old.feedback
      or new.status <> 'submitted'
      or (
        new.reviewed_at is distinct from old.reviewed_at
        and not (old.reviewed_at is not null and new.reviewed_at is null)
      ) then
      raise exception using errcode = '42501', message = 'STUDENTS_CANNOT_MODIFY_REVIEW_FIELDS';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.validate_assignment_submission()
returns trigger
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_assignment public.assignments%rowtype;
  v_extension text;
  v_storage_metadata jsonb;
  v_already_submitted boolean := false;
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if not public.owns_student(new.student_id) then
    raise exception using errcode = '42501', message = 'STUDENT_SUBMISSION_FORBIDDEN';
  end if;

  select assignment.*
  into v_assignment
  from public.assignments assignment
  where assignment.id = new.assignment_id
    and assignment.published
    and public.has_active_access(assignment.program_id, assignment.batch_id);

  if not found then
    raise exception using errcode = '42501', message = 'ASSIGNMENT_NOT_AVAILABLE';
  end if;

  if v_assignment.submission_type = 'no_submission' then
    raise exception using errcode = '23514', message = 'SUBMISSION_NOT_REQUIRED';
  end if;

  if tg_op = 'UPDATE' then
    v_already_submitted := old.submitted_at is not null
      or old.status in ('submitted', 'reviewed', 'approved', 'needs_revision');
    if v_already_submitted and new.status = 'submitted' and not v_assignment.allow_resubmission then
      raise exception using errcode = '23505', message = 'RESUBMISSION_NOT_ALLOWED';
    end if;
  end if;

  if new.submission_url is not null and (
    char_length(new.submission_url) > 2048
    or new.submission_url !~* '^https?://[^[:space:][:cntrl:]]+$'
  ) then
    raise exception using errcode = '23514', message = 'INVALID_SUBMISSION_URL';
  end if;

  if new.file_path is not null then
    if new.file_name is null
      or new.file_name = ''
      or char_length(new.file_name) > 180
      or position('/' in new.file_name) > 0
      or position(chr(92) in new.file_name) > 0
      or new.file_name ~ '[[:cntrl:]]'
      or new.file_size is null
      or new.file_mime_type is null then
      raise exception using errcode = '23514', message = 'INCOMPLETE_FILE_METADATA';
    end if;

    if new.file_path !~ (
      '^' || new.student_id::text || '/' || new.assignment_id::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
      || '\.(pdf|docx|pptx|xlsx|zip|png|jpg|jpeg)$'
    ) then
      raise exception using errcode = '23514', message = 'INVALID_FILE_PATH';
    end if;

    v_extension := lower(substring(new.file_path from '\.([^.]+)$'));
    if not (
      (v_extension = 'pdf' and new.file_mime_type = 'application/pdf')
      or (v_extension = 'docx' and new.file_mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      or (v_extension = 'pptx' and new.file_mime_type = 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
      or (v_extension = 'xlsx' and new.file_mime_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      or (v_extension = 'zip' and new.file_mime_type in ('application/zip', 'application/x-zip-compressed', 'application/x-zip'))
      or (v_extension = 'png' and new.file_mime_type = 'image/png')
      or (v_extension in ('jpg', 'jpeg') and new.file_mime_type = 'image/jpeg')
    ) then
      raise exception using errcode = '23514', message = 'INVALID_FILE_TYPE';
    end if;

    if new.file_size < 1 or new.file_size > (v_assignment.max_file_size_mb::bigint * 1024 * 1024) then
      raise exception using errcode = '23514', message = 'FILE_TOO_LARGE';
    end if;

    select object.metadata
    into v_storage_metadata
    from storage.objects object
    where object.bucket_id = 'assignment-submissions'
      and object.name = new.file_path;

    if not found
      or v_storage_metadata ->> 'size' is null
      or (v_storage_metadata ->> 'size') !~ '^[0-9]+$'
      or (v_storage_metadata ->> 'size')::bigint <> new.file_size
      or coalesce(v_storage_metadata ->> 'mimetype', '') <> new.file_mime_type then
      raise exception using errcode = '23514', message = 'FILE_STORAGE_METADATA_MISMATCH';
    end if;
  end if;

  if new.status = 'submitted' then
    if v_assignment.submission_type = 'link_only' and (new.submission_url is null or new.file_path is not null) then
      raise exception using errcode = '23514', message = 'LINK_SUBMISSION_REQUIRED';
    elsif v_assignment.submission_type = 'file_only' and (new.file_path is null or new.submission_url is not null) then
      raise exception using errcode = '23514', message = 'FILE_SUBMISSION_REQUIRED';
    elsif v_assignment.submission_type = 'link_or_file' and new.submission_url is null and new.file_path is null then
      raise exception using errcode = '23514', message = 'LINK_OR_FILE_REQUIRED';
    end if;
    new.submitted_at := now();
    if tg_op = 'UPDATE' and v_already_submitted then
      new.reviewed_at := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_assignment_submission on public.assignment_submissions;
create trigger validate_assignment_submission
before insert or update on public.assignment_submissions
for each row execute function public.validate_assignment_submission();

comment on column public.assignments.submission_type is 'Accepted student response: link_only, file_only, link_or_file, or no_submission.';
comment on column public.assignments.max_file_size_mb is 'Per-assignment upload limit; hard-capped by the private Storage bucket at 50 MB.';
comment on column public.assignment_submissions.file_path is 'Private UUID-based Storage object path. Never expose as a permanent public URL.';
comment on column public.assignment_submissions.file_name is 'Sanitized display-only filename; never used as a Storage object key.';
