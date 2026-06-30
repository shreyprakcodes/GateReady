CREATE TABLE IF NOT EXISTS public.trip_predictions (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id                  uuid        NOT NULL REFERENCES public.trips(id)  ON DELETE CASCADE,
  user_id                  uuid        NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
  predicted_buffer_minutes integer     NOT NULL,
  actual_buffer_minutes    integer,                 -- filled in post-trip; null until backfill
  rule_factors             jsonb,                   -- per-rule adjustments from bufferEngine
  created_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_predictions: own rows only"
  ON public.trip_predictions FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
