import { defineConfig } from '@playwright/test'

// Electron smoke tests: run against the built app (`npm run build` first).
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 90_000,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' }
})
