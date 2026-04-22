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
