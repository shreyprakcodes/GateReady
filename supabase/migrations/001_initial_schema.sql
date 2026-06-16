-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ── users ──────────────────────────────────────────────────────
create table if not exists public.users (
  id                  uuid references auth.users primary key,
  name                text,
  email               text,
  home_address        text,
  home_lat            float,
  home_lng            float,
  tsa_precheck        boolean default false,
  global_entry        boolean default false,
  preferred_transport text default 'uber',
  accessibility_needs text[],
  created_at          timestamptz default now()
);

alter table public.users enable row level security;

create policy "users: own row only"
  on public.users for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── trips ──────────────────────────────────────────────────────
create table if not exists public.trips (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.users(id),
  flight_number     text,
  airline           text,
  origin            text,
  destination       text,
  departure_time    timestamptz,
  boarding_time     timestamptz,
  gate              text,
  terminal          text,
  seat              text,
  status            text default 'scheduled',
  confirmation_code text,
  raw_boarding_pass jsonb,
  created_at        timestamptz default now()
);

alter table public.trips enable row level security;

create policy "trips: own rows only"
  on public.trips for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── itinerary_steps ────────────────────────────────────────────
create table if not exists public.itinerary_steps (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid references public.trips(id) on delete cascade,
  position    integer,
  time        timestamptz,
  label       text,
  icon        text,
  detail      text,
  step_type   text,
  status      text default 'upcoming',
  action_url  text,
  updated_at  timestamptz default now()
);

alter table public.itinerary_steps enable row level security;

create policy "itinerary_steps: own rows only"
  on public.itinerary_steps for all
  using (
    auth.uid() = (select user_id from public.trips where id = trip_id)
  )
  with check (
    auth.uid() = (select user_id from public.trips where id = trip_id)
  );

-- ── alerts ─────────────────────────────────────────────────────
create table if not exists public.alerts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.users(id),
  trip_id       uuid references public.trips(id),
  message       text,
  trigger_time  timestamptz,
  type          text,
  priority      integer default 1,
  delivered     boolean default false,
  snoozed_until timestamptz
);

alter table public.alerts enable row level security;

create policy "alerts: own rows only"
  on public.alerts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── user_preferences ───────────────────────────────────────────
create table if not exists public.user_preferences (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.users(id),
  key              text,
  value            jsonb,
  confidence_score float default 0.1,
  source           text,
  times_observed   integer default 1,
  last_updated     timestamptz default now(),
  unique(user_id, key)
);

alter table public.user_preferences enable row level security;

create policy "user_preferences: own rows only"
  on public.user_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── trip_events (append-only) ──────────────────────────────────
create table if not exists public.trip_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users(id),
  trip_id     uuid references public.trips(id),
  event_type  text,
  data        jsonb,
  created_at  timestamptz default now()
);

alter table public.trip_events enable row level security;

create policy "trip_events: insert only"
  on public.trip_events for insert
  with check (auth.uid() = user_id);

create policy "trip_events: read own"
  on public.trip_events for select
  using (auth.uid() = user_id);

-- ── family_links ───────────────────────────────────────────────
create table if not exists public.family_links (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.users(id),
  family_member_id uuid references public.users(id),
  permissions      text[],
  active           boolean default true
);

alter table public.family_links enable row level security;

create policy "family_links: own rows only"
  on public.family_links for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Realtime ───────────────────────────────────────────────────
alter publication supabase_realtime add table public.itinerary_steps;
alter publication supabase_realtime add table public.alerts;
alter publication supabase_realtime add table public.trips;
