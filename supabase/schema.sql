-- HamroBiz backend schema (Supabase / Postgres)
-- Run in the Supabase SQL editor. Assumes pg_trgm extension for search.
-- Design: public read of published rows, anyone can submit to the moderation
-- queue, only moderators can publish, Stripe webhooks write via service role.

create extension if not exists pg_trgm;

-- ============ helpers ============
create or replace function public.is_moderator()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.moderators m
    where m.user_id = auth.uid()
  );
$$;

-- ============ moderators ============
create table public.moderators (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'moderator' check (role in ('admin', 'moderator')),
  created_at timestamptz not null default now()
);

-- ============ listings ============
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,                       -- e.g. 'dc-016', for migrating listings.json
  name text not null,
  category text not null,
  address text,
  city text,
  state text check (state in ('DC', 'MD', 'VA')),
  zip text,
  phone text,
  website text,
  description text,
  tags text[] not null default '{}',
  lat double precision,
  lng double precision,
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  featured boolean not null default false,
  featured_until timestamptz,                  -- Stripe webhook sets/clears this
  verified boolean not null default false,
  premium boolean not null default false,
  owner_id uuid references auth.users (id),    -- filled when a business claims its listing
  source text,                                 -- where the listing came from
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_status_idx on public.listings (status);
create index listings_state_idx on public.listings (state);
create index listings_category_idx on public.listings (category);
create index listings_featured_idx on public.listings (featured_until) where featured;
create index listings_tags_gin on public.listings using gin (tags);
create index listings_name_trgm on public.listings using gin (name gin_trgm_ops);

-- ============ jobs / housing / events boards ============
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company text,
  location text,
  pay text,
  description text,
  contact_email text,
  status text not null default 'published' check (status in ('draft', 'published', 'expired')),
  posted_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

create table public.housing (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  location text,
  rent text,
  description text,
  contact text,
  status text not null default 'published' check (status in ('draft', 'published', 'expired')),
  posted_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  organizer text,
  start_date date not null,
  end_date date,
  location text,
  description text,
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now()
);

-- ============ moderation queue ============
-- Every public submission lands here first. Approving copies the payload
-- into listings / jobs / housing / events and marks the row approved.
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('listing', 'job', 'housing', 'event')),
  payload jsonb not null,
  submitter_email text,
  submitter_id uuid references auth.users (id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_note text,
  reviewed_by uuid references public.moderators (user_id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index submissions_status_idx on public.submissions (status);

-- ============ payments (written by Stripe webhook, service role only) ============
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text unique not null,
  tier text not null check (tier in ('featured', 'verified', 'premium', 'job_post', 'housing_post', 'ad')),
  listing_id uuid references public.listings (id),
  board_ref uuid,                              -- job/housing/event id for board posts
  amount_cents integer not null,
  currency text not null default 'usd',
  customer_email text,
  status text not null default 'completed',
  paid_at timestamptz not null default now(),
  expires_at timestamptz
);

-- ============ row-level security ============
alter table public.moderators enable row level security;
alter table public.listings   enable row level security;
alter table public.jobs        enable row level security;
alter table public.housing     enable row level security;
alter table public.events      enable row level security;
alter table public.submissions enable row level security;
alter table public.payments    enable row level security;

-- Public: read published, non-expired rows only
create policy "public read listings" on public.listings
  for select using (status = 'published');
create policy "public read jobs" on public.jobs
  for select using (status = 'published' and expires_at > now());
create policy "public read housing" on public.housing
  for select using (status = 'published' and expires_at > now());
create policy "public read events" on public.events
  for select using (status = 'published');

-- Public: submit to the moderation queue (never publish directly)
create policy "anyone can submit" on public.submissions
  for insert with check (status = 'pending');

-- Moderators: full access to everything except payments inserts
create policy "moderators manage listings" on public.listings
  for all using (public.is_moderator()) with check (public.is_moderator());
create policy "moderators manage jobs" on public.jobs
  for all using (public.is_moderator()) with check (public.is_moderator());
create policy "moderators manage housing" on public.housing
  for all using (public.is_moderator()) with check (public.is_moderator());
create policy "moderators manage events" on public.events
  for all using (public.is_moderator()) with check (public.is_moderator());
create policy "moderators review submissions" on public.submissions
  for all using (public.is_moderator()) with check (public.is_moderator());
create policy "moderators read payments" on public.payments
  for select using (public.is_moderator());
create policy "moderators read moderators" on public.moderators
  for select using (public.is_moderator());

-- Business owners: edit their own claimed listing (moderator approval still gates publish)
create policy "owners edit own listing" on public.listings
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ============ storage (listing photos for premium profiles) ============
-- Create via dashboard or: insert into storage.buckets (id, name, public)
--   values ('listing-photos', 'listing-photos', true);
-- Public read; moderator write:
--   create policy "public read photos" on storage.objects
--     for select using (bucket_id = 'listing-photos');
--   create policy "moderators upload photos" on storage.objects
--     for insert with check (bucket_id = 'listing-photos' and public.is_moderator());

-- ============ Stripe flow (app/webhook code, not SQL) ============
-- 1. User clicks "Feature my business" -> Stripe Checkout Session with
--    metadata { listing_id, tier: 'featured' }, price $49/mo (or one-time).
-- 2. Webhook checkout.session.completed -> service-role key:
--      insert into payments (...) ;
--      update listings set featured = true,
--        featured_until = now() + interval '30 days' where id = ...;
-- 3. Nightly job (pg_cron or scheduled edge function):
--      update listings set featured = false where featured_until < now();
-- 4. Job/housing posts: same pattern, webhook inserts into jobs/housing
--    with expires_at = paid_at + 30 days instead of touching listings.
