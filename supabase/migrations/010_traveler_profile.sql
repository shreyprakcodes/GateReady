ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS has_real_id           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_clear             boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS known_traveler_number text,
  ADD COLUMN IF NOT EXISTS lounge_memberships    text[];
