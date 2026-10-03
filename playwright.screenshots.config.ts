import { defineConfig } from '@playwright/test'

// Visual-review screenshots (light/dark x ar/en). Not part of `npm run test:e2e`.
// Output folder: SCREENSHOTS_DIR env var (default test-results/screens).
export default defineConfig({
  testDir: './tests/screenshots',
  testMatch: '**/*.spec.ts',
  timeout: 300_000,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']]
})
