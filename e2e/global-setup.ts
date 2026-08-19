/**
 * Global setup: signs in once through the real /login page (the app's own
 * Supabase password flow — no debug/backdoor route), then persists the
 * browser cookies and a raw access token so the smoke tests can reuse the
 * session and clean up their own DB rows.
 *
 * Required env vars (set in .env.local or the shell before running):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   TEST_USER_EMAIL
 *   TEST_USER_PASSWORD
 */

import { chromium } from 'playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import * as path from 'path';

const AUTH_DIR = path.join(__dirname, '.auth');

export default async function globalSetup() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email       = process.env.TEST_USER_EMAIL;
  const password    = process.env.TEST_USER_PASSWORD;

  const missing = Object.entries({ supabaseUrl, anonKey, email, password })
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    throw new Error(
      `[global-setup] Missing required env vars: ${missing.join(', ')}\n` +
      'See the README section "Running E2E tests" for details.',
    );
  }

  mkdirSync(AUTH_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page    = await browser.newPage();

  // 1. Sign in through the real /login page — sets the same SSR session
  //    cookies (via the app's createBrowserClient()) that a real user gets.
  await page.goto('http://localhost:3000/login');
  await page.locator('input[type="email"]').fill(email!);
  await page.locator('input[type="password"]').fill(password!);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });

  // 2. Persist the browser session (cookies) for all tests to reuse
  await page.context().storageState({
    path: path.join(AUTH_DIR, 'user.json'),
  });

  // 3. Separately exchange email/password for a raw access token — needed by
  //    e2e/helpers.ts (deleteTestTrip) for direct Supabase REST cleanup calls,
  //    outside of the cookie session.
  const authRes = await page.request.post(
    `${supabaseUrl!}/auth/v1/token?grant_type=password`,
    {
      headers: {
        apikey:         anonKey!,
        'Content-Type': 'application/json',
      },
      data: { email, password },
    },
  );

  if (!authRes.ok()) {
    const body = await authRes.text();
    throw new Error(
      `[global-setup] Supabase sign-in failed (${authRes.status()}): ${body}`,
    );
  }

  const tokens = (await authRes.json()) as { access_token: string };

  writeFileSync(
    path.join(AUTH_DIR, 'tokens.json'),
    JSON.stringify({ accessToken: tokens.access_token }, null, 2),
  );

  await browser.close();
}
