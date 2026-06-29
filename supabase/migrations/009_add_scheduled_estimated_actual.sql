-- Capture the raw scheduled / estimated / actual gate times for both departure and
-- arrival so the UI can show struck-through scheduled times when a flight is delayed.
-- The existing departure_time and arrival_time columns remain the "effective" time
-- (actual ?? estimated ?? scheduled) used for countdowns and the Leave Now engine.
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS departure_scheduled  timestamptz,
  ADD COLUMN IF NOT EXISTS departure_estimated  timestamptz,
  ADD COLUMN IF NOT EXISTS departure_actual     timestamptz,
  ADD COLUMN IF NOT EXISTS arrival_scheduled    timestamptz,
  ADD COLUMN IF NOT EXISTS arrival_estimated    timestamptz,
  ADD COLUMN IF NOT EXISTS arrival_actual       timestamptz;
