-- Keep automatic IDs safe even for older clients that still submit a manual
-- certificate_id. Every new certificate receives the next canonical ID.

create or replace function public.assign_certificate_id()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  certificate_year integer := extract(year from current_date)::integer;
  next_number bigint;
begin
  -- All certificate insert paths run this trigger, so this transaction-scoped
  -- lock serializes the per-year MAX + 1 allocation across concurrent clients.
  perform pg_advisory_xact_lock(hashtextextended('certificate-id-' || certificate_year, 0));

  select coalesce(max(substring(c.certificate_id from 11 for 6)::bigint), 0) + 1
  into next_number
  from public.certificates c
  where c.certificate_id ~ ('^CERT-' || certificate_year || '-[0-9]{6}$');

  if next_number > 999999 then
    raise exception using errcode = '22003', message = 'CERTIFICATE_ID_RANGE_EXHAUSTED';
  end if;

  new.certificate_id := 'CERT-' || certificate_year || '-' || lpad(next_number::text, 6, '0');
  return new;
end;
$$;

drop trigger if exists assign_certificate_id on public.certificates;
create trigger assign_certificate_id
before insert on public.certificates
for each row execute function public.assign_certificate_id();

comment on function public.assign_certificate_id()
is 'Canonical CERT-YYYY-NNNNNN allocator enforced for every certificate insert, including legacy clients.';
