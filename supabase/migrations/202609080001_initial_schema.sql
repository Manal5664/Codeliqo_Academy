-- Codeliqo Academy LMS schema for Supabase/PostgreSQL.
-- Run through the Supabase SQL editor or CLI migrations before enabling portal access.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'student' check (role in ('student', 'admin')),
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  code text not null unique,
  title text not null,
  description text not null default '',
  duration_weeks integer not null default 1 check (duration_weeks > 0),
  live_hours integer not null default 0 check (live_hours >= 0),
  level text not null default '',
  registration_fee numeric(12,2) not null default 0 check (registration_fee >= 0),
  monthly_fee numeric(12,2) not null default 0 check (monthly_fee >= 0),
  installment_months integer not null default 1 check (installment_months > 0),
  tuition_fee numeric(12,2) not null default 0 check (tuition_fee >= 0),
  total_fee numeric(12,2) not null default 0 check (total_fee >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  name text not null,
  start_date date,
  end_date date,
  live_day text,
  start_time time,
  timezone text not null default 'Asia/Karachi',
  status text not null default 'planned' check (status in ('planned', 'active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, name)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  application_id text,
  enrollment_id text unique,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'withdrawn')),
  certificate_eligible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete restrict,
  batch_id uuid references public.batches(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'withdrawn')),
  progress_percentage numeric(5,2) not null default 0 check (progress_percentage between 0 and 100),
  current_week integer not null default 1 check (current_week >= 0),
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists one_active_enrollment_per_student on public.enrollments(student_id) where status = 'active';

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  title text not null,
  description text,
  week integer not null check (week > 0),
  resource_links jsonb not null default '[]'::jsonb check (jsonb_typeof(resource_links) = 'array'),
  file_url text,
  video_url text,
  github_url text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  title text not null,
  week integer not null check (week > 0),
  instructions text not null,
  due_date date,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  submission_url text,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'submitted', 'reviewed')),
  feedback text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, assignment_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  title text not null,
  description text not null,
  technologies jsonb not null default '[]'::jsonb check (jsonb_typeof(technologies) = 'array'),
  requirements text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  github_url text,
  live_demo_url text,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'submitted', 'reviewed', 'completed')),
  feedback text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, project_id)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  class_date date not null,
  status text not null check (status in ('present', 'absent', 'late', 'excused')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, class_date)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  payment_type text not null check (payment_type in ('registration', 'installment', 'other')),
  amount numeric(12,2) not null check (amount >= 0),
  method text,
  paid_at date,
  receipt_number text unique,
  receipt_url text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'rejected', 'refunded')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  certificate_id text unique,
  program_name text not null,
  issue_date date,
  status text not null default 'pending' check (status in ('pending', 'issued', 'revoked')),
  file_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  program_id uuid references public.programs(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete cascade,
  priority text not null default 'normal' check (priority in ('normal', 'important', 'urgent')),
  published_at timestamptz not null default now(),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','programs','batches','students','enrollments','lessons','lesson_progress','assignments','assignment_submissions','projects','project_submissions','attendance','payments','certificates','announcements']
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.owns_student(student_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.students where id = student_uuid and profile_id = auth.uid());
$$;

create or replace function public.has_active_access(program_uuid uuid, batch_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.enrollments e
    join public.students s on s.id = e.student_id
    where s.profile_id = auth.uid()
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
    select 1 from public.enrollments e
    join public.students s on s.id = e.student_id
    where s.profile_id = auth.uid()
      and e.status = 'active'
      and (program_uuid is null or e.program_id = program_uuid)
      and (batch_uuid is null or e.batch_id = batch_uuid)
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, role)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''), 'student')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only an administrator can change account roles';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role before update on public.profiles for each row execute function public.protect_profile_role();

create or replace function public.protect_assignment_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if old.status = 'reviewed'
      or new.student_id is distinct from old.student_id
      or new.assignment_id is distinct from old.assignment_id
      or new.feedback is distinct from old.feedback
      or new.reviewed_at is distinct from old.reviewed_at
      or new.status not in ('not_started', 'in_progress', 'submitted') then
      raise exception 'Students cannot modify assignment review fields';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_assignment_review on public.assignment_submissions;
create trigger protect_assignment_review before update on public.assignment_submissions for each row execute function public.protect_assignment_review();

create or replace function public.protect_project_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if old.status in ('reviewed', 'completed')
      or new.student_id is distinct from old.student_id
      or new.project_id is distinct from old.project_id
      or new.feedback is distinct from old.feedback
      or new.reviewed_at is distinct from old.reviewed_at
      or new.status not in ('not_started', 'in_progress', 'submitted') then
      raise exception 'Students cannot modify project review fields';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_project_review on public.project_submissions;
create trigger protect_project_review before update on public.project_submissions for each row execute function public.protect_project_review();

alter table public.profiles enable row level security;
alter table public.programs enable row level security;
alter table public.batches enable row level security;
alter table public.students enable row level security;
alter table public.enrollments enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.projects enable row level security;
alter table public.project_submissions enable row level security;
alter table public.attendance enable row level security;
alter table public.payments enable row level security;
alter table public.certificates enable row level security;
alter table public.announcements enable row level security;

create policy "profiles read own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "admins manage profiles" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public reads active programs" on public.programs for select to anon, authenticated using (active or public.is_admin() or public.has_active_access(id, null));
create policy "admins manage programs" on public.programs for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "students read own batches" on public.batches for select to authenticated using (public.has_active_access(program_id, id) or public.is_admin());
create policy "admins manage batches" on public.batches for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "students read own record" on public.students for select to authenticated using (profile_id = auth.uid() or public.is_admin());
create policy "admins manage students" on public.students for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "students read own enrollments" on public.enrollments for select to authenticated using (public.owns_student(student_id) or public.is_admin());
create policy "admins manage enrollments" on public.enrollments for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "students read assigned lessons" on public.lessons for select to authenticated using ((published and public.has_active_access(program_id, batch_id)) or public.is_admin());
create policy "admins manage lessons" on public.lessons for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "students read own lesson progress" on public.lesson_progress for select to authenticated using (public.owns_student(student_id) or public.is_admin());
create policy "students add own lesson progress" on public.lesson_progress for insert to authenticated with check (public.owns_student(student_id));
create policy "students update own lesson progress" on public.lesson_progress for update to authenticated using (public.owns_student(student_id)) with check (public.owns_student(student_id));
create policy "admins manage lesson progress" on public.lesson_progress for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "students read assigned assignments" on public.assignments for select to authenticated using ((published and public.has_active_access(program_id, batch_id)) or public.is_admin());
create policy "admins manage assignments" on public.assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "students read own assignment submissions" on public.assignment_submissions for select to authenticated using (public.owns_student(student_id) or public.is_admin());
create policy "students add own assignment submissions" on public.assignment_submissions for insert to authenticated with check (public.owns_student(student_id) and status in ('not_started', 'in_progress', 'submitted') and feedback is null and reviewed_at is null);
create policy "students update own assignment submissions" on public.assignment_submissions for update to authenticated using (public.owns_student(student_id)) with check (public.owns_student(student_id));
create policy "admins manage assignment submissions" on public.assignment_submissions for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "students read assigned projects" on public.projects for select to authenticated using ((published and public.has_active_access(program_id, batch_id)) or public.is_admin());
create policy "admins manage projects" on public.projects for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "students read own project submissions" on public.project_submissions for select to authenticated using (public.owns_student(student_id) or public.is_admin());
create policy "students add own project submissions" on public.project_submissions for insert to authenticated with check (public.owns_student(student_id) and status in ('not_started', 'in_progress', 'submitted') and feedback is null and reviewed_at is null);
create policy "students update own project submissions" on public.project_submissions for update to authenticated using (public.owns_student(student_id)) with check (public.owns_student(student_id));
create policy "admins manage project submissions" on public.project_submissions for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "students read own attendance" on public.attendance for select to authenticated using (public.owns_student(student_id) or public.is_admin());
create policy "admins manage attendance" on public.attendance for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "students read own payments" on public.payments for select to authenticated using (public.owns_student(student_id) or public.is_admin());
create policy "admins manage payments" on public.payments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "students read own certificates" on public.certificates for select to authenticated using (public.owns_student(student_id) or public.is_admin());
create policy "admins manage certificates" on public.certificates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "students read relevant announcements" on public.announcements for select to authenticated using ((active and public.has_announcement_access(program_id, batch_id)) or public.is_admin());
create policy "admins manage announcements" on public.announcements for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.verify_certificate(lookup_id text)
returns table (certificate_id text, student_name text, program_name text, issue_date date, status text)
language sql
stable
security definer
set search_path = public
as $$
  select c.certificate_id, p.full_name, c.program_name, c.issue_date, c.status
  from public.certificates c
  join public.students s on s.id = c.student_id
  join public.profiles p on p.id = s.profile_id
  where upper(c.certificate_id) = upper(trim(lookup_id)) and c.status in ('issued', 'revoked')
  limit 1;
$$;
revoke all on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated;

insert into public.programs (id, slug, code, title, description, duration_weeks, live_hours, level, registration_fee, monthly_fee, installment_months, tuition_fee, total_fee, active)
values
  ('11111111-1111-4111-8111-111111111111', 'data-analyst', 'DA', 'AI-Powered Data Analyst Career Program', 'Build a practical analytics toolkit for transforming business data into clear, defensible insights and decision-ready dashboards.', 20, 60, 'Beginner → Job-Ready Junior Data Analyst', 1000, 6000, 5, 30000, 31000, true),
  ('22222222-2222-4222-8222-222222222222', 'data-science-ml', 'DSML', 'Applied Data Science & Machine Learning Engineering', 'Move from data foundations to applied machine learning and the engineering practices required to package, track and deploy models.', 24, 72, 'Foundation → Applied / Job-Ready', 1000, 6500, 6, 39000, 40000, true),
  ('33333333-3333-4333-8333-333333333333', 'generative-agentic-ai', 'GENAI', 'Generative & Agentic AI Engineering', 'Engineer grounded, testable AI applications with language models, retrieval, tools, workflows, evaluation and production safeguards.', 20, 60, 'Python-Aware Beginner → Applied AI Engineer', 1000, 8000, 5, 40000, 41000, true),
  ('44444444-4444-4444-8444-444444444444', 'frontend-developer', 'FE', 'Frontend Developer Career Program', 'Learn to build accessible, responsive and maintainable web interfaces using the modern JavaScript and React ecosystem.', 16, 48, 'Beginner → Job-Ready Junior Frontend Developer', 1000, 6000, 4, 24000, 25000, true),
  ('55555555-5555-4555-8555-555555555555', 'python-backend', 'BE', 'Python Backend Developer Career Program', 'Build secure, tested and database-backed APIs with Python, FastAPI and PostgreSQL, then package them for deployment.', 16, 48, 'Beginner → Job-Ready Junior Python Backend Developer', 1000, 6000, 4, 24000, 25000, true),
  ('66666666-6666-4666-8666-666666666666', 'full-stack', 'FS', 'Full-Stack Developer Career Program', 'A complete pathway combining frontend and Python backend training, followed by full-stack integration and a production capstone.', 32, 96, 'Beginner → Job-Ready Junior Full-Stack Developer', 1000, 5500, 8, 44000, 45000, true)
on conflict (slug) do update set
  code = excluded.code, title = excluded.title, description = excluded.description,
  duration_weeks = excluded.duration_weeks, live_hours = excluded.live_hours, level = excluded.level,
  registration_fee = excluded.registration_fee, monthly_fee = excluded.monthly_fee,
  installment_months = excluded.installment_months, tuition_fee = excluded.tuition_fee,
  total_fee = excluded.total_fee, active = excluded.active;

-- After inviting the first trusted admin in Authentication, promote that account once:
-- update public.profiles set role = 'admin' where id = '<AUTH-USER-UUID>';
