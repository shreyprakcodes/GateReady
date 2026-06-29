-- Store the destination airport's IANA timezone so arrival times can be
-- displayed in the correct local timezone (distinct from the departure timezone).
ALTER TABLE trips ADD COLUMN IF NOT EXISTS destination_timezone TEXT;
