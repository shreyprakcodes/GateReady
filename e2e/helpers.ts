/**
 * Shared helpers, fixtures, and cleanup utilities for the smoke tests.
 */

import type { Page } from 'playwright/test';
import { readFileSync } from 'fs';
import * as path from 'path';

// ─── Fixture data ─────────────────────────────────────────────────────────────

/** Mirrors the shape returned by /api/flights/lookup for a single match */
export const FIXTURE_FLIGHT = {
  flightNumber:      'AA123',
  airline:           'AA',
  airlineName:       'American Airlines',
  departure_airport: 'JFK',
  departure_time:    '2027-06-01T14:00:00.000Z',
  arrival_airport:   'LAX',
  arrival_time:      '2027-06-01T17:30:00.000Z',
  status:            'scheduled',
  gate:              'B12',
  terminal:          '4',
  raw:               {},
} as const;

/** Mirrors the shape returned by /api/leave-now.
 *  Called as a function so the recommendedLeaveTime is fresh on every test. */
export function makeLeaveNowFixture() {
  return {
    recommendedLeaveTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    minutesUntilLeave:    120,
    status:               'on-time',
    segments:             [],
    inputs: {
      drive:      { minutes: 45, isLive: false, note: 'No location — using 45 min estimate' },
      tsa:        { minutes: 15, source: 'estimate', note: 'Estimated wait' },
      walkToGate: { minutes: 15 },
      buffer:     {
        minutes: 20,
        factors: [{ rule: 'base', adjustmentMinutes: 0, reason: 'User preferred buffer: 20 min' }],
      },
    },
  };
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

/**
 * Creates a test trip via /api/flights/save (uses the page's auth cookies).
 * Returns the new trip's UUID.
 */
export async function createTestTrip(page: Page): Promise<string> {
  const res = await page.request.post('/api/flights/save', {
    data: { flight: FIXTURE_FLIGHT },
  });

  if (!res.ok()) {
    throw new Error(
      `createTestTrip: /api/flights/save returned ${res.status()}: ${await res.text()}`,
    );
  }

  const json = (await res.json()) as { trip: { id: string } };
  return json.trip.id;
}

/**
 * Deletes a trip directly via the Supabase REST API using the stored access
 * token (bypasses the app — no DELETE route exists in the app).
 * trip_milestones are cascade-deleted by the DB.
 */
export async function deleteTestTrip(page: Page, tripId: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    console.warn('deleteTestTrip: missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    return;
  }

  const accessToken = getStoredAccessToken();

  await page.request.delete(
    `${supabaseUrl}/rest/v1/trips?id=eq.${tripId}`,
    {
      headers: {
        apikey:        anonKey,
        Authorization: `Bearer ${accessToken}`,
        Prefer:        'return=minimal',
      },
    },
  );
}

function getStoredAccessToken(): string {
  const tokenFile = path.join(__dirname, '.auth', 'tokens.json');
  const parsed = JSON.parse(readFileSync(tokenFile, 'utf-8')) as { accessToken: string };
  return parsed.accessToken;
}
