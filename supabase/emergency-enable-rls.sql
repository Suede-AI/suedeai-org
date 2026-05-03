-- Emergency mitigation for Supabase "rls_disabled_in_public" alerts.
--
-- Run this in the Supabase SQL editor for this project.
-- It enables Row-Level Security on every ordinary table in the public schema.
--
-- Important:
-- - This removes the "public table without RLS" exposure immediately.
-- - Tables without matching policies will become inaccessible to anon/authenticated
--   clients until the appropriate policy migration is applied.
-- - For suedeai.org, run schema.sql afterward to ensure the insert-only lead
--   capture policies are present.

select
  'before' as phase,
  schemaname,
  tablename
from pg_tables
where schemaname = 'public'
  and rowsecurity = false
order by tablename;

do $$
declare
  table_record record;
begin
  for table_record in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
      and rowsecurity = false
  loop
    execute format(
      'alter table %I.%I enable row level security',
      table_record.schemaname,
      table_record.tablename
    );
  end loop;
end $$;

select
  'after' as phase,
  schemaname,
  tablename
from pg_tables
where schemaname = 'public'
  and rowsecurity = false
order by tablename;
