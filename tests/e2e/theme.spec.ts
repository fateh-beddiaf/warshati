import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { launchElectron } from './helpers'

// Theme switching: applied immediately, persisted in the Setting table, and applied
// by the preload (before the first paint) after a restart.

let dataDir: string
const problems: string[] = []

async function launch(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await launchElectron(dataDir)
  const page = await app.firstWindow()
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`)
  })
  await page.waitForSelector('[data-testid="nav-tickets"]')
  return { app, page }
}

/** Opens the header theme menu (waits until Radix reports it open) and picks an option. */
async function chooseTheme(page: Page, choice: 'light' | 'dark' | 'system'): Promise<void> {
  const toggle = page.getByTestId('theme-toggle')
  await toggle.click()
  await expect(toggle).toHaveAttribute('data-state', 'open')
  await page.getByTestId(`theme-menu-${choice}`).click()
  await expect(toggle).toHaveAttribute('data-state', 'closed')
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
    await chooseTheme(session.page, 'light')
    await expect.poll(() => isDark(session.page)).toBe(false)

    await chooseTheme(session.page, 'dark')
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
    await chooseTheme(session.page, 'light')
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

test('the theme menu reopens right after a choice (it used to close itself again)', async () => {
  const session = await launch()
  try {
    // Choose, then press the toggle again at once, while the menu that just closed could still be on screen
    const states = await session.page.evaluate(async () => {
      const toggle = document.querySelector<HTMLElement>('[data-testid="theme-toggle"]')!
      const press = (): void => {
        toggle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }))
      }
      const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()))
      press()
      await frame()
      document.querySelector<HTMLElement>('[data-testid="theme-menu-dark"]')!.click()
      await frame()
      press()
      // Watch the menu for longer than any open/close animation: it must stay open the whole time
      const seen: string[] = []
      const watch = new MutationObserver(() => seen.push(toggle.dataset.state ?? ''))
      watch.observe(toggle, { attributes: true, attributeFilter: ['data-state'] })
      await new Promise((r) => setTimeout(r, 500))
      watch.disconnect()
      return {
        closedAgain: seen.includes('closed'),
        now: toggle.dataset.state,
        menus: document.querySelectorAll('[role="menu"]').length
      }
    })
    expect(states).toEqual({ closedAgain: false, now: 'open', menus: 1 })
    expect(await isDark(session.page)).toBe(true)
    await session.page.getByTestId('theme-menu-light').click()
    await expect.poll(() => isDark(session.page)).toBe(false)
    expect(problems).toEqual([])
  } finally {
    await session.app.close()
  }
})
