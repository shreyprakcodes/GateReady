# Migration Status

**Rule:** After writing any new migration, apply it in the Supabase SQL Editor and mark it here. A committed migration file does NOT mean it's live.

| Migration file | Applied to live DB | Date confirmed | What it added |
|---|---|---|---|
| `001_initial_schema.sql` | Y | 2026-06-30 | Core tables: users, trips, itinerary_steps, alerts, user_preferences, trip_events, family_links; RLS on all |
| `002_auth_user_trigger.sql` | Y | 2026-06-30 | Trigger: auto-inserts public.users row on auth.users signup |
| `003_parental_mode.sql` | Y | 2026-06-30 | trips: parental_mode, parent_id, parental_settings; parent RLS policies |
| `004_add_arrival_time.sql` | Y | 2026-06-30 | trips: arrival_time |
| `005_notifications.sql` | Y | 2026-06-30 | New table: notifications (id, user_id, trip_id, type, title, body, read); RLS |
| `006_family_sharing.sql` | Y | 2026-06-30 | trips: share_token, share_enabled; new table: trip_milestones |
| `007_add_departure_timezone.sql` | Y | 2026-06-30 | trips: departure_timezone |
| `008_add_destination_timezone.sql` | Y | 2026-06-30 | trips: destination_timezone |
| `009_add_scheduled_estimated_actual.sql` | Y | 2026-06-30 | trips: departure/arrival ×{scheduled, estimated, actual} |
| `010_traveler_profile.sql` | Y | 2026-06-30 | users: has_real_id, has_clear, known_traveler_number, lounge_memberships |
| `011_onboarding_fields.sql` | Y | 2026-06-30 | users: arrival_buffer_minutes, travel_frequency, trip_scope, travels_with, travel_stressors, family_auto_updates, home_airport, onboarding_completed |
| `012_trip_predictions.sql` | N | — | New table: trip_predictions (predicted_buffer_minutes, actual_buffer_minutes, rule_factors jsonb); RLS own-rows |
| `013_trip_predictions_unique.sql` | N | — | trip_predictions: de-dupe existing rows, add updated_at, add UNIQUE(trip_id) |
