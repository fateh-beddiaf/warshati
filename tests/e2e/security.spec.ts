import { test, expect } from '@playwright/test'
import { launchApp, shutdownApp, type Launched } from './helpers'

// Electron hardening: sandboxed renderer with a strict CSP, no navigation away from the app, no new windows,
// no permissions, and IPC handlers that reject malformed input.

let l: Launched

test.beforeEach(async () => {
  l = await launchApp('security')
})

test.afterEach(async () => {
  await shutdownApp(l)
})

test('the main window is sandboxed and isolated, with a strict CSP and no violations', async () => {
  const { app, page, problems } = l
  const prefs = await app.evaluate(({ BrowserWindow }) => {
    // getLastWebPreferences exists at runtime but is not in Electron's typings (there is no public getter for the
    // preferences a window was created with): type just that one method
    const contents = BrowserWindow.getAllWindows()[0].webContents as Electron.WebContents & {
      getLastWebPreferences(): Electron.WebPreferences | null
    }
    const p = contents.getLastWebPreferences()
    return { sandbox: p?.sandbox, contextIsolation: p?.contextIsolation, nodeIntegration: p?.nodeIntegration }
  })
  expect(prefs).toEqual({ sandbox: true, contextIsolation: true, nodeIntegration: false })
  // The built UI comes from the app's own scheme, not file:// (src/main/app-url.ts)
  expect(page.url()).toBe('app://warshati/index.html')

  const csp = await page.evaluate(
    () => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') ?? ''
  )
  expect(csp).toContain("default-src 'self'")
  expect(csp).toContain("script-src 'self';")
  expect(csp).not.toContain('unsafe-eval')
  expect(await page.evaluate(() => typeof (window as unknown as { require?: unknown }).require)).toBe('undefined')
  expect(await page.evaluate(() => typeof (window as unknown as { process?: unknown }).process)).toBe('undefined')

  await page.evaluate(() => {
    const w = window as unknown as { cspViolations: string[] }
    w.cspViolations = []
    document.addEventListener('securitypolicyviolation', (e) => w.cspViolations.push(e.violatedDirective))
  })
  for (const tab of ['nav-new-ticket', 'nav-reports', 'nav-settings', 'nav-tickets']) {
    await page.getByTestId(tab).click()
    await page.waitForTimeout(300)
  }
  expect(await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations)).toEqual([])
  expect(problems).toEqual([])
})

test('navigation away from the app and new windows are blocked', async () => {
  const { app, page } = l
  const startUrl = page.url()

  expect(await page.evaluate(() => window.open('https://example.com/') === null)).toBe(true)
  await page.evaluate(() => {
    const a = document.createElement('a')
    a.href = 'https://example.com/'
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    a.remove()
  })
  await page.waitForTimeout(500)
  expect(app.windows()).toHaveLength(1)

  // Last: Playwright keeps waiting for the cancelled navigation, so only evaluate() is used after it
  await page.evaluate(() => {
    window.location.href = 'https://example.com/'
  })
  await page.waitForTimeout(1000)
  expect(page.url()).toBe(startUrl)
  expect(await page.evaluate(() => document.querySelector('[data-testid="nav-tickets"]') !== null)).toBe(true)
  expect(app.windows()).toHaveLength(1)
})

test('IPC handlers reject malformed input before touching the database', async () => {
  const { page } = l
  const results = await page.evaluate(async () => {
    // Deliberately wrong types, as a compromised renderer could send them
    const api = window.api as unknown as Record<
      string,
      (...args: unknown[]) => Promise<{ success: boolean; error?: string }>
    >
    return Promise.all([
      api.getTicketById('1 OR 1=1'),
      api.deleteTicket(-1),
      api.recordPayment(1, '500'),
      api.setSetting('theme', { not: 'a string' }),
      api.updateTicketStatus({ ticketId: 1, newStatus: 'stolen' }),
      api.createTicket({ customer: null })
    ])
  })
  for (const r of results) {
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/^Invalid input: /)
  }
})
