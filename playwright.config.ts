import { defineConfig } from '@playwright/test'

const ci = !!process.env.CI

// Electron smoke tests: run against the built app (`npm run build` first).
// On CI a failed test is retried once, so a flaky one is reported as "flaky" (list and GitHub annotations) instead of
// failing the run silently or being hidden; the retry is a safety net, not a fix. The Electron trace that makes the
// uploaded artifact useful is recorded by tests/e2e/helpers.ts (launchElectron): `trace` and `screenshot` below only
// apply to Playwright's own browser fixtures.
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 90_000,
  workers: 1,
  fullyParallel: false,
  retries: ci ? 1 : 0,
  reporter: ci ? [['list'], ['github']] : [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: ci ? 'only-on-failure' : 'off'
  }
})
