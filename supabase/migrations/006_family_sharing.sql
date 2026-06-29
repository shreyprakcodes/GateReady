-- Add sharing columns to trips
alter table public.trips
  add column if not exists share_token  text unique default (gen_random_uuid()::text),
  add column if not exists share_enabled boolean not null default false;

-- ── trip_milestones ─────────────────────────────────────────────
-- One row per milestone per trip; upsert replaces reached_at to allow correction.
create table if not exists public.trip_milestones (
  id          uuid        primary key default gen_random_uuid(),
  trip_id     uuid        not null references public.trips(id) on delete cascade,
  type        text        not null check (type in ('left_home', 'cleared_security', 'at_gate', 'boarded')),
  reached_at  timestamptz not null default now(),
  unique(trip_id, type)
);

alter table public.trip_milestones enable row level security;

-- Owner can read milestones for their own trips
create policy "milestones: select own"
  on public.trip_milestones for select
  using (
    auth.uid() = (select user_id from public.trips where id = trip_id)
  );

-- Owner can insert milestones for their own trips
create policy "milestones: insert own"
  on public.trip_milestones for insert
  with check (
    auth.uid() = (select user_id from public.trips where id = trip_id)
  );

-- Owner can update (re-tap to update reached_at)
create policy "milestones: update own"
  on public.trip_milestones for update
  using (
    auth.uid() = (select user_id from public.trips where id = trip_id)
  )
  with check (
    auth.uid() = (select user_id from public.trips where id = trip_id)
  );

-- No public select policy: the public status page reads via service role only,
-- scoped strictly to the trip identified by share_token.
