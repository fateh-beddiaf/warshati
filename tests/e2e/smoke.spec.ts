import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

// Smoke test for the renderer: walks through every screen and fails on any
// page error, console.error or an empty #root (the "white screen" symptom).
// Runs on the built app (out/main/index.js) with a throw-away data directory,
// so it can never touch real shop data.

test.describe.configure({ mode: 'serial' })

let app: ElectronApplication
let page: Page
let dataDir: string
const problems: string[] = []

const SETTINGS_TABS = ['categories', 'brandsModels', 'accessories', 'technicians', 'backup', 'preferences']

async function assertAlive(label: string): Promise<void> {
  // Give React a moment to commit the next render, then check the tree is alive.
  await page.waitForTimeout(250)
  const rootChildren = await page.evaluate(() => document.getElementById('root')?.childElementCount ?? 0)
  expect(rootChildren, `#root is empty after: ${label} (white screen)`).toBeGreaterThan(0)
  expect(problems, `renderer errors after: ${label}`).toEqual([])
}

async function go(tab: 'tickets' | 'new-ticket' | 'reports' | 'settings'): Promise<void> {
  await page.getByTestId(`nav-${tab}`).click()
  await assertAlive(`nav ${tab}`)
}

test.beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'warshati-e2e-'))
  app = await electron.launch({
    args: [resolve('out/main/index.js')],
    env: { ...process.env, WARSHATI_DATA_DIR: dataDir }
  })
  page = await app.firstWindow()
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`)
  })
  await page.waitForSelector('[data-testid="nav-tickets"]')
  await assertAlive('boot')
})

test.afterAll(async () => {
  await app?.close()
  try {
    rmSync(dataDir, { recursive: true, force: true })
  } catch {
    // WAL files may still be released a moment later; the temp dir is disposable
  }
})

test('every sidebar tab renders', async () => {
  for (const tab of ['tickets', 'new-ticket', 'reports', 'settings', 'tickets'] as const) {
    await go(tab)
  }
})

test('every settings sub-tab renders', async () => {
  await go('settings')
  for (const id of SETTINGS_TABS) {
    await page.getByTestId(`settings-tab-${id}`).click()
    await assertAlive(`settings tab ${id}`)
  }
})

test('create tickets (cash + credit) and open details', async () => {
  for (const kind of ['cash', 'credit'] as const) {
    await go('new-ticket')
    const textInputs = page.locator('[data-testid="new-ticket-form"] input[type="text"]')
    // order: customer name (autocomplete), phone, notes, brand, model, short label
    await textInputs.nth(0).fill(kind === 'cash' ? 'زبون اختبار' : 'Test Customer')
    await textInputs.nth(1).fill(kind === 'cash' ? '0555123456' : '0666000111')
    await textInputs.nth(3).fill('Samsung')
    await textInputs.nth(4).fill('Galaxy A54')
    await page.locator('[data-testid="new-ticket-form"] input[type="number"]').nth(0).fill('5000')
    await page
      .locator('[data-testid="new-ticket-form"] input[type="number"]')
      .nth(1)
      .fill(kind === 'cash' ? '5000' : '2000')
    await page.locator(`[data-testid="new-ticket-form"] input[name="paymentType"][value="${kind}"]`).check()
    await page.locator('[data-testid="new-ticket-form"] button[type="submit"]').click()
    await page.waitForSelector('[data-testid="ticket-created-banner"]')
    await assertAlive(`create ${kind} ticket`)
  }
  await go('tickets')
  await page.locator('tbody tr').first().waitFor()
  await page.locator('tbody tr').first().click()
  await page.getByTestId('details-close').waitFor()
  await assertAlive('open ticket details')
})

test('ticket lifecycle in details modal', async () => {
  // Modal is open on the latest ticket (in_progress)
  await page.getByTestId('status-to-ready').click()
  await assertAlive('mark ready')
  await page.getByTestId('open-delivery').click()
  await assertAlive('open delivery dialog')
  await page.getByTestId('confirm-delivery').click()
  await assertAlive('confirm delivery')
  await page.getByTestId('status-back-to-ready').click()
  await assertAlive('revert to ready')
  await page.getByTestId('status-to-in-progress').click()
  await assertAlive('revert to in_progress')
  await page.getByTestId('details-reprint').click()
  await assertAlive('print preview from details')
  await page.getByTestId('print-close').click()
  await assertAlive('close print preview')
  await page.getByTestId('details-close').click()
  await assertAlive('close details')
})

test('print preview from list and filters', async () => {
  await go('tickets')
  for (const f of ['all', 'in_progress', 'ready', 'overdue', 'delivered', 'all']) {
    await page.getByTestId(`filter-${f}`).click()
    await assertAlive(`filter ${f}`)
  }
  await page.getByTestId('row-print').first().click()
  await assertAlive('print preview from list')
  await page.getByTestId('print-close').click()
  await assertAlive('close print preview from list')
})

test('reports for every period and filter', async () => {
  await go('reports')
  for (const p of ['today', 'this_week', 'this_month', 'all_time', 'custom', 'this_month']) {
    await page.getByTestId(`period-${p}`).click()
    await assertAlive(`reports period ${p}`)
  }
  await page.getByTestId('period-custom').click()
  const dates = page.locator('input[type="date"]')
  if ((await dates.count()) >= 2) {
    await dates.nth(0).fill('2030-01-01')
    await dates.nth(1).fill('2020-01-01')
    await assertAlive('reports custom range from > to')
    await dates.nth(0).fill('')
    await assertAlive('reports custom range cleared')
  }
  await page.getByTestId('period-all_time').click()
  const selects = page.locator('main select')
  const selectCount = await selects.count()
  for (let i = 0; i < selectCount; i++) {
    const values = await selects
      .nth(i)
      .locator('option')
      .evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))
    for (const v of values) {
      await selects.nth(i).selectOption(v)
      await assertAlive(`reports filter select#${i}=${v}`)
    }
  }
})

test('language toggle ar <-> en across all screens', async () => {
  await go('settings')
  await page.getByTestId('settings-tab-preferences').click()
  for (const lang of ['en', 'ar'] as const) {
    await page.getByTestId(`lang-${lang}`).click()
    await assertAlive(`language ${lang}`)
    if (lang === 'en') {
      for (const tab of ['tickets', 'new-ticket', 'reports', 'settings'] as const) {
        await go(tab)
      }
      for (const id of SETTINGS_TABS) {
        await page.getByTestId(`settings-tab-${id}`).click()
        await assertAlive(`en settings tab ${id}`)
      }
      await page.getByTestId('settings-tab-preferences').click()
    }
  }
  expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl')
})

test('new ticket form survives regex metacharacters in brand/model', async () => {
  await go('new-ticket')
  const textInputs = page.locator('[data-testid="new-ticket-form"] input[type="text"]')
  for (const brand of ['C++', '(', '[x', '*', '?']) {
    await textInputs.nth(3).fill(brand)
    await textInputs.nth(4).fill('Model 1')
    await assertAlive(`brand "${brand}"`)
  }
})
