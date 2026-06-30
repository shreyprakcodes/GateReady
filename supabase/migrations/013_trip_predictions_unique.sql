-- Step 1: de-dupe — keep the most recent row per trip, delete older duplicates.
-- Required before adding the unique constraint.
DELETE FROM public.trip_predictions
WHERE id NOT IN (
  SELECT DISTINCT ON (trip_id) id
  FROM public.trip_predictions
  ORDER BY trip_id, created_at DESC
);

-- Step 2: add updated_at so upserts can record when a prediction was last refreshed.
ALTER TABLE public.trip_predictions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.trip_predictions SET updated_at = created_at;

-- Step 3: enforce one prediction row per trip.
ALTER TABLE public.trip_predictions
  ADD CONSTRAINT trip_predictions_trip_id_unique UNIQUE (trip_id);
