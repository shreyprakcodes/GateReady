/**
 * Global setup: signs in once via the Supabase password flow + the debug
 * signin endpoint, then persists the browser cookies and the raw access token
 * so the smoke tests can reuse the session and clean up their own DB rows.
 *
 * Required env vars (set in .env.local or the shell before running):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   DEBUG_LOGIN_SECRET
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
  const debugSecret = process.env.DEBUG_LOGIN_SECRET;

  const missing = Object.entries({ supabaseUrl, anonKey, email, password, debugSecret })
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

  // 1. Exchange email/password for Supabase JWTs
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

  const tokens = (await authRes.json()) as {
    access_token:  string;
    refresh_token: string;
  };

  // 2. Hand the tokens to the debug endpoint — it sets the SSR session cookies
  await page.goto(
    `http://localhost:3000/api/debug/signin` +
    `?secret=${encodeURIComponent(debugSecret!)}` +
    `&access_token=${encodeURIComponent(tokens.access_token)}` +
    `&refresh_token=${encodeURIComponent(tokens.refresh_token)}`,
  );

  // 3. Persist the browser session (cookies) for all tests to reuse
  await page.context().storageState({
    path: path.join(AUTH_DIR, 'user.json'),
  });

  // 4. Persist the raw access token for Supabase REST cleanup calls
  writeFileSync(
    path.join(AUTH_DIR, 'tokens.json'),
    JSON.stringify({ accessToken: tokens.access_token }, null, 2),
  );

  await browser.close();
}
