import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

// Theme switching: applied immediately, persisted in the Setting table, and applied
// by the preload (before the first paint) after a restart.

let dataDir: string
const problems: string[] = []

async function launch(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [resolve('out/main/index.js')],
    env: { ...process.env, WARSHATI_DATA_DIR: dataDir }
  })
  const page = await app.firstWindow()
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`)
  })
  await page.waitForSelector('[data-testid="nav-tickets"]')
  return { app, page }
}

const isDark = (page: Page): Promise<boolean> =>
  page.evaluate(() => document.documentElement.classList.contains('dark'))

test.beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'warshati-e2e-theme-'))
})

test.afterAll(() => {
  try {
    rmSync(dataDir, { recursive: true, force: true })
  } catch {
    // disposable temp dir
  }
})

test('dark theme set from the header persists across a restart and is applied by the preload', async () => {
  let session = await launch()
  try {
    // Force a known starting point regardless of the OS theme
    await session.page.getByTestId('theme-toggle').click()
    await session.page.getByTestId('theme-menu-light').click()
    await expect.poll(() => isDark(session.page)).toBe(false)

    await session.page.getByTestId('theme-toggle').click()
    await session.page.getByTestId('theme-menu-dark').click()
    await expect.poll(() => isDark(session.page)).toBe(true)
    const stored = await session.page.evaluate(() => window.api.getSetting('theme'))
    expect(stored).toMatchObject({ success: true, data: 'dark' })
  } finally {
    await session.app.close()
  }

  // Restart on the same data directory
  session = await launch()
  try {
    // The preload marks <html> before React mounts: proves no flash of the light theme
    expect(await session.page.evaluate(() => document.documentElement.getAttribute('data-theme-boot'))).toBe('dark')
    expect(await isDark(session.page)).toBe(true)
    const bg = await session.page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(bg).toBe('rgb(17, 20, 28)') // --background (dark) = #11141c

    // Back to light from Settings-independent quick toggle, then verify it persists too
    await session.page.getByTestId('theme-toggle').click()
    await session.page.getByTestId('theme-menu-light').click()
    await expect.poll(() => isDark(session.page)).toBe(false)
  } finally {
    await session.app.close()
  }

  session = await launch()
  try {
    expect(await session.page.evaluate(() => document.documentElement.getAttribute('data-theme-boot'))).toBe('light')
    expect(await isDark(session.page)).toBe(false)
    expect(problems).toEqual([])
  } finally {
    await session.app.close()
  }
})
