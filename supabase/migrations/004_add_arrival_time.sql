-- The trips table is the flights table for this codebase.
-- arrival_time was absent from the initial schema; add it here.
alter table public.trips
  add column if not exists arrival_time timestamptz;
