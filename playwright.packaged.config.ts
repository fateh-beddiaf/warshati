import { defineConfig } from '@playwright/test'

// Smoke test of the packaged app in release/win-unpacked (`npm run dist` first). Not part of `npm run test:e2e`.
export default defineConfig({
  testDir: './tests/packaged',
  testMatch: '**/*.spec.ts',
  timeout: 120_000,
  workers: 1,
  fullyParallel: false,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']]
})
