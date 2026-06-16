-- Add parental mode columns to trips
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS parental_mode     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_id         uuid    REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS parental_settings jsonb   DEFAULT '{}';

-- Allow parents to read the child's trip they're monitoring
CREATE POLICY IF NOT EXISTS "parents can read monitored trips"
  ON public.trips FOR SELECT
  USING (
    auth.uid() = user_id
    OR (parental_mode = true AND parent_id = auth.uid())
  );

-- Allow parents to update parental_mode/settings on a child's trip
-- (only when they have a family_link to that child)
CREATE POLICY IF NOT EXISTS "parents can update parental settings"
  ON public.trips FOR UPDATE
  USING (
    auth.uid() = user_id
    OR (parental_mode = true AND parent_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.family_links fl
      WHERE fl.user_id = auth.uid()
        AND fl.family_member_id = trips.user_id
        AND fl.active = true
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR (parental_mode = true AND parent_id = auth.uid())
  );
