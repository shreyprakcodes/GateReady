ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS arrival_buffer_minutes  integer  NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS travel_frequency        text,
  ADD COLUMN IF NOT EXISTS trip_scope              text,
  ADD COLUMN IF NOT EXISTS travels_with            text,
  ADD COLUMN IF NOT EXISTS travel_stressors        text[],
  ADD COLUMN IF NOT EXISTS family_auto_updates     boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS home_airport            text,
  ADD COLUMN IF NOT EXISTS onboarding_completed    boolean  NOT NULL DEFAULT false;

-- Backfill: existing users skip onboarding; the DEFAULT false handles new sign-ups.
UPDATE public.users SET onboarding_completed = true;
