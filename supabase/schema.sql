create table if not exists public.book_leads (
  id bigint generated always as identity primary key,
  email text not null,
  name text,
  context text,
  source text default 'suedeai.org',
  submitted_at timestamptz not null default now()
);

create index if not exists book_leads_submitted_at_idx
  on public.book_leads (submitted_at desc);

create table if not exists public.contact_inquiries (
  id bigint generated always as identity primary key,
  name text not null,
  email text not null,
  topic text,
  message text not null,
  source text default 'suedeai.org',
  submitted_at timestamptz not null default now()
);

create index if not exists contact_inquiries_submitted_at_idx
  on public.contact_inquiries (submitted_at desc);

alter table public.book_leads enable row level security;
alter table public.contact_inquiries enable row level security;

drop policy if exists "book_leads_insert_anon" on public.book_leads;
create policy "book_leads_insert_anon"
  on public.book_leads
  for insert
  to anon, authenticated
  with check (
    source = 'suedeai.org'
    and email is not null
    and submitted_at is not null
  );

drop policy if exists "contact_inquiries_insert_anon" on public.contact_inquiries;
create policy "contact_inquiries_insert_anon"
  on public.contact_inquiries
  for insert
  to anon, authenticated
  with check (
    source = 'suedeai.org'
    and name is not null
    and email is not null
    and message is not null
    and submitted_at is not null
  );

revoke all on public.book_leads from anon, authenticated;
revoke all on public.contact_inquiries from anon, authenticated;

grant insert on public.book_leads to anon, authenticated;
grant insert on public.contact_inquiries to anon, authenticated;

grant usage on schema public to anon, authenticated;
