-- Store the departure airport's IANA timezone (e.g. "America/New_York") so the
-- UI can display departure and boarding times in the correct local timezone
-- rather than the viewer's browser timezone.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS departure_timezone TEXT;
