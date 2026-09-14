-- Repair a deployment where the dynamic program catalog reached the database
-- without its course-outline Storage bucket. This migration is additive and
-- does not modify or delete programs, course data, or existing Storage objects.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-outlines', 'course-outlines', true, 10485760, array['application/pdf'])
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public course documents must remain available to signed-out visitors and
-- authenticated students through both public URLs and Storage API downloads.
drop policy if exists "public reads course outlines" on storage.objects;
create policy "public reads course outlines"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'course-outlines');

-- Course outline writes are restricted to authenticated application admins.
drop policy if exists "admins upload course outlines" on storage.objects;
create policy "admins upload course outlines"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'course-outlines'
  and name ~ '^[0-9a-f-]+/[0-9a-f-]+-[^/]+\.pdf$'
  and public.is_admin()
);

drop policy if exists "admins update course outlines" on storage.objects;
create policy "admins update course outlines"
on storage.objects
for update
to authenticated
using (bucket_id = 'course-outlines' and public.is_admin())
with check (
  bucket_id = 'course-outlines'
  and name ~ '^[0-9a-f-]+/[0-9a-f-]+-[^/]+\.pdf$'
  and public.is_admin()
);

drop policy if exists "admins delete course outlines" on storage.objects;
create policy "admins delete course outlines"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'course-outlines'
  and name ~ '^[0-9a-f-]+/[0-9a-f-]+-[^/]+\.pdf$'
  and public.is_admin()
);
