-- Re-engagement marketing: canonical subscriber list + event log + one-click unsubscribe.
-- Idempotent. PII table — locked to anon/authenticated; service role bypasses RLS.

create extension if not exists citext;
create extension if not exists pgcrypto;

create table if not exists public.marketing_subscribers (
  id                bigint generated always as identity primary key,
  email             citext not null unique,
  name              text,
  first_name        text,
  segment           text not null default 'import'
                      check (segment in ('active','hot','warm','cold','never_signed_in','funnel_book','funnel_contact','import')),
  source            text not null default 'import',
  provider          text,
  signed_up_at      timestamptz,
  last_login_at     timestamptz,
  status            text not null default 'subscribed'
                      check (status in ('subscribed','unsubscribed','bounced','complained','suppressed')),
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  last_emailed_at   timestamptz,
  email_count       int not null default 0,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists marketing_subscribers_status_idx  on public.marketing_subscribers (status);
create index if not exists marketing_subscribers_segment_idx on public.marketing_subscribers (segment);

create table if not exists public.marketing_email_events (
  id            bigint generated always as identity primary key,
  subscriber_id bigint references public.marketing_subscribers(id) on delete cascade,
  email         citext,
  campaign      text not null,
  step          int,
  event         text not null
                  check (event in ('sent','delivered','opened','clicked','bounced','complained','unsubscribed','skipped','failed')),
  resend_id     text,
  meta          jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists marketing_email_events_campaign_idx   on public.marketing_email_events (campaign, step);
create index if not exists marketing_email_events_subscriber_idx on public.marketing_email_events (subscriber_id);

create or replace function public.marketing_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists marketing_subscribers_touch on public.marketing_subscribers;
create trigger marketing_subscribers_touch
  before update on public.marketing_subscribers
  for each row execute function public.marketing_touch_updated_at();

alter table public.marketing_subscribers  enable row level security;
alter table public.marketing_email_events enable row level security;
revoke all on public.marketing_subscribers  from anon, authenticated;
revoke all on public.marketing_email_events from anon, authenticated;
-- No policies for anon/authenticated => zero row access via the publishable key.

create or replace function public.marketing_unsubscribe(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare hit int;
begin
  update public.marketing_subscribers
     set status = 'unsubscribed', updated_at = now()
   where unsubscribe_token = p_token
     and status <> 'unsubscribed';
  get diagnostics hit = row_count;
  if hit > 0 then
    insert into public.marketing_email_events (subscriber_id, email, campaign, event, meta)
    select id, email, 'reengage_2026_05', 'unsubscribed', jsonb_build_object('via','one_click')
      from public.marketing_subscribers where unsubscribe_token = p_token;
  end if;
  return true;  -- always generic success: no token-enumeration signal
end $$;

revoke all on function public.marketing_unsubscribe(uuid) from public;
grant execute on function public.marketing_unsubscribe(uuid) to anon, authenticated;
