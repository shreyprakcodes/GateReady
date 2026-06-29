// Load .env.local before anything else — Next.js does this automatically but
// the Playwright runner process does not.  Must be the very first thing so
// that global-setup (and the tests themselves) see these vars in process.env.
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { defineConfig, devices } from 'playwright/test';
import * as path from 'path';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  // Sequential: tests share the same Supabase test user — races cause flakiness
  fullyParallel: false,
  workers: 1,
  globalSetup: require.resolve('./e2e/global-setup'),
  use: {
    baseURL: 'http://localhost:3000',
    // All tests start already logged in via this stored session
    storageState: path.join(__dirname, 'e2e', '.auth', 'user.json'),
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
