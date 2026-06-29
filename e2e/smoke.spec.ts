/**
 * GateReady — end-to-end smoke tests.
 *
 * Prerequisites (see bottom of file for full instructions):
 *   1. Dev server running:  npm run dev
 *   2. Env vars set:        NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *                           DEBUG_LOGIN_SECRET, TEST_USER_EMAIL, TEST_USER_PASSWORD
 *   3. Test user created in Supabase (email+password auth)
 *
 * Run:  npm run test:e2e
 *
 * All third-party API calls (AviationStack, Google Maps, TSA) are intercepted
 * at the browser→app boundary so tests are deterministic and burn no quota.
 * Real Supabase is used for DB-backed assertions.
 */

import { test, expect } from 'playwright/test';
import {
  FIXTURE_FLIGHT,
  makeLeaveNowFixture,
  createTestTrip,
  deleteTestTrip,
} from './helpers';

// ─── a) Unauthenticated redirect ──────────────────────────────────────────────
//
// Playwright's `browser` fixture inherits the project's `use.*` defaults
// (including storageState) and merges them into every browser.newContext() call.
// Using test.use() inside a describe block is the correct way to override the
// storageState for a specific test via the `page` fixture — it is guaranteed
// to produce a context with zero cookies.

test.describe('Unauthenticated access', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('unauthenticated user hitting a protected route is redirected to /login', async ({ page }) => {
    await page.goto('/dashboard');
    // Middleware must redirect — /dashboard is not in PUBLIC_PATHS
    await expect(page).toHaveURL(/\/login/);
  });
});

// ─── b) Authenticated dashboard ───────────────────────────────────────────────

test('authenticated user can load the dashboard without errors', async ({ page }) => {
  await page.goto('/dashboard');

  // The main heading proves the page rendered (not a redirect or crash)
  await expect(page.getByText('Upcoming Trips')).toBeVisible();

  // No JS error banner / crash screen
  await expect(page.getByText('Application error')).not.toBeVisible();
});

// ─── c) Add Flight ────────────────────────────────────────────────────────────

test('add flight: mock lookup returns fixture, flight is saved and rendered', async ({ page }) => {
  let createdTripId: string | null = null;

  // Intercept /api/flights/lookup so we never hit AviationStack
  await page.route('**/api/flights/lookup**', async route => {
    await route.fulfill({
      status:      200,
      contentType: 'application/json',
      body:        JSON.stringify({ flight: FIXTURE_FLIGHT, multiple: false }),
    });
  });

  try {
    await page.goto('/dashboard');
    await expect(page.getByText('Upcoming Trips')).toBeVisible();

    // Open the Add Flight modal
    await page.getByRole('button', { name: 'Add flight' }).click();
    await expect(page.getByRole('heading', { name: 'Add Flight' })).toBeVisible();

    // Fill in flight number
    await page.getByPlaceholder('e.g. AA1234').fill('AA123');

    // Fill in the date (type="date" accepts YYYY-MM-DD in Chromium)
    await page.locator('input[type="date"]').fill('2027-06-01');

    // Trigger the (intercepted) lookup
    await page.getByRole('button', { name: 'Look up flight' }).click();

    // Fixture result renders
    await expect(page.getByText('JFK → LAX')).toBeVisible();
    await expect(page.getByText('AA123')).toBeVisible();
    await expect(page.getByText('American Airlines')).toBeVisible();

    // Confirm and save — this hits the real /api/flights/save
    await page.getByRole('button', { name: 'Confirm & Save Flight' }).click();

    // Should navigate to the trip detail page
    await page.waitForURL(/\/trip\//);
    createdTripId = new URL(page.url()).pathname.split('/').pop() ?? null;
    expect(createdTripId).toBeTruthy();

    // Trip detail shows the saved route.
    // The header breadcrumb renders "American Airlines AA123 · <date>" — the
    // " · " separator makes this match unique vs the Journey Timeline step
    // which also renders "American Airlines AA123" (without the date suffix).
    await expect(page.getByText('JFK → LAX')).toBeVisible();
    await expect(page.getByText(/American Airlines AA123 ·/)).toBeVisible();
  } finally {
    if (createdTripId) await deleteTestTrip(page, createdTripId);
  }
});

// ─── d) Trip detail — LeaveNowCard ───────────────────────────────────────────

test('trip detail: LeaveNowCard renders leave time, countdown, and est badge', async ({ page }) => {
  const tripId = await createTestTrip(page);

  try {
    // Intercept /api/leave-now before loading the page so it's caught on mount
    await page.route('**/api/leave-now', async route => {
      await route.fulfill({
        status:      200,
        contentType: 'application/json',
        body:        JSON.stringify(makeLeaveNowFixture()),
      });
    });

    await page.goto(`/trip/${tripId}`);

    // LeaveNowCard header
    await expect(page.getByText('Leave Now Engine')).toBeVisible({ timeout: 10_000 });

    // "Leave by" label proves the leave time section rendered
    await expect(page.getByText('Leave by')).toBeVisible();

    // Status badge: fixture returns status "on-time" → "On Time"
    await expect(page.getByText('On Time')).toBeVisible();

    // "est" badge: drive.isLive is false in the fixture, so the badge appears
    await expect(page.getByText('est', { exact: true }).first()).toBeVisible();
  } finally {
    await deleteTestTrip(page, tripId);
  }
});

// ─── e) Milestones ───────────────────────────────────────────────────────────

test('milestones: tapping a step POSTs and the reached state + timestamp shows', async ({ page }) => {
  const tripId = await createTestTrip(page);

  try {
    await page.goto(`/trip/${tripId}`);

    // MilestonePanel loads with no milestones yet
    await expect(page.getByText('Travel Day Progress')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Tap a step when you reach it')).toBeVisible();

    // "Left Home" is the first step and will be the "next" step (highlighted)
    const leftHomeBtn = page.getByRole('button', { name: /Left Home/ });
    await expect(leftHomeBtn).toBeVisible();
    await leftHomeBtn.click();

    // POST succeeds → the step now shows "Reached at HH:MM AM/PM"
    await expect(page.getByText(/Reached at/)).toBeVisible({ timeout: 5_000 });

    // Panel header updates to show progress count
    await expect(page.getByText('1 of 4 steps reached')).toBeVisible();
  } finally {
    await deleteTestTrip(page, tripId);
  }
});

// ─── f) Sharing ───────────────────────────────────────────────────────────────

test('sharing: enable returns token/link; public endpoint omits sensitive fields; /s/[token] renders timeline; disabling returns inactive state', async ({ page }) => {
  const tripId = await createTestTrip(page);

  try {
    // Enable sharing and generate a token via the API in one call
    // (the DB default already sets share_token, but we enable it explicitly)
    const shareRes = await page.request.patch(`/api/trips/${tripId}/share`, {
      data: { share_enabled: true, regenerate: true },
    });
    expect(shareRes.ok()).toBe(true);

    const { trip: shareData } = (await shareRes.json()) as {
      trip: { share_enabled: boolean; share_token: string };
    };
    const shareToken = shareData.share_token;
    expect(shareToken).toBeTruthy();
    expect(shareData.share_enabled).toBe(true);

    // Navigate to the Details tab where the SharePanel lives
    await page.goto(`/trip/${tripId}`);
    await page.getByRole('button', { name: 'Details' }).click();

    // The share link is visible (enabled + token both true)
    await expect(page.getByText(new RegExp(`/s/${shareToken}`))).toBeVisible({ timeout: 5_000 });

    // ── Field safety: /api/share/[token] must NOT expose private fields ───────

    const publicRes  = await page.request.get(`/api/share/${shareToken}`);
    const publicJson = (await publicRes.json()) as Record<string, unknown>;

    expect(publicJson.active).toBe(true);

    // Walk the full serialised response — none of these keys may appear
    const rawJson = JSON.stringify(publicJson);
    expect(rawJson).not.toContain('"email"');
    expect(rawJson).not.toContain('"user_id"');
    expect(rawJson).not.toContain('"share_token"');

    // ── /s/[token] public page renders the milestone timeline ─────────────────

    await page.goto(`/s/${shareToken}`);
    await expect(page.getByText('Live Status')).toBeVisible({ timeout: 10_000 });

    // All four milestone steps appear in the timeline
    for (const label of ['Left Home', 'Cleared Security', 'At Gate', 'Boarded']) {
      await expect(page.getByText(label)).toBeVisible();
    }

    // ── Disable sharing via the UI toggle ─────────────────────────────────────

    await page.goto(`/trip/${tripId}`);
    await page.getByRole('button', { name: 'Details' }).click();

    // The toggle's aria-label flips between "Enable sharing" / "Disable sharing"
    await page.getByRole('button', { name: 'Disable sharing' }).click();

    // After disabling, the "Enable to generate a link" hint reappears
    await expect(
      page.getByText('Enable to generate a link you can send to family.'),
    ).toBeVisible({ timeout: 5_000 });

    // ── Public endpoint now returns inactive ──────────────────────────────────

    const disabledRes  = await page.request.get(`/api/share/${shareToken}`);
    const disabledJson = (await disabledRes.json()) as { active: boolean; reason: string };

    expect(disabledJson.active).toBe(false);
    expect(disabledJson.reason).toBe('disabled');
  } finally {
    await deleteTestTrip(page, tripId);
  }
});
