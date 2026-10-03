import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { spawnSync } from 'child_process'
import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

// Visual review: every main screen, every settings tab, the details / delivery / print dialogs and the
// empty states, in 4 combinations (light|dark x ar|en), on a realistic demo database.
//   npm run screenshots            (SCREENSHOTS_DIR=<folder> to choose the output folder)

const OUT_DIR = resolve(process.env['SCREENSHOTS_DIR'] ?? 'test-results/screens')
const THEMES = ['light', 'dark'] as const
const LANGS = ['ar', 'en'] as const
const SETTINGS_TABS = ['categories', 'brandsModels', 'accessories', 'technicians', 'backup', 'preferences']

let demoDir: string
let emptyDir: string
// eslint-disable-next-line @typescript-eslint/no-require-imports
const electronBinary: string = require('electron')

test.beforeAll(() => {
  mkdirSync(OUT_DIR, { recursive: true })
  demoDir = mkdtempSync(join(tmpdir(), 'warshati-shots-demo-'))
  emptyDir = mkdtempSync(join(tmpdir(), 'warshati-shots-empty-'))
  const res = spawnSync(electronBinary, ['-r', 'tsx', 'tests/fixtures/seed-demo.run.ts', demoDir], {
    encoding: 'utf8'
  })
  if (res.status !== 0) throw new Error(`demo seed failed: ${res.stdout}\n${res.stderr}`)
})

test.afterAll(() => {
  for (const dir of [demoDir, emptyDir]) {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      // disposable temp dir
    }
  }
})

async function launch(dataDir: string): Promise<{ app: ElectronApplication; page: Page; problems: string[] }> {
  const app = await electron.launch({
    args: [resolve('out/main/index.js')],
    env: { ...process.env, WARSHATI_DATA_DIR: dataDir }
  })
  const page = await app.firstWindow()
  const problems: string[] = []
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`)
  })
  await page.waitForSelector('[data-testid="nav-tickets"]')
  return { app, page, problems }
}

async function configure(page: Page, theme: 'light' | 'dark', lang: 'ar' | 'en'): Promise<void> {
  await page.evaluate(
    async ([th, lg]) => {
      localStorage.setItem('warshati_language', lg)
      await window.api.setSetting('app_language', lg)
      await window.api.setTheme(th as 'light' | 'dark')
    },
    [theme, lang]
  )
  await page.reload()
  await page.waitForSelector('[data-testid="nav-tickets"]')
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(theme === 'dark')
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe(lang)
}

async function shot(page: Page, name: string, theme: string, lang: string, settleMs = 700): Promise<void> {
  await page.waitForTimeout(settleMs) // entrance / counter animations
  await page.screenshot({ path: join(OUT_DIR, `${name}-${theme}-${lang}.png`) })
}

async function setWidth(app: ElectronApplication, width: number): Promise<void> {
  await app.evaluate(({ BrowserWindow }, w) => {
    BrowserWindow.getAllWindows()[0].setSize(w, 800)
  }, width)
}

async function nav(page: Page, tab: 'tickets' | 'new-ticket' | 'reports' | 'settings'): Promise<void> {
  await page.getByTestId(`nav-${tab}`).click()
}

async function openByBarcode(page: Page, barcode: string): Promise<void> {
  const header = page.getByTestId('header-barcode-input')
  await header.fill(barcode)
  await header.press('Enter')
  await page.getByTestId('details-close').waitFor()
}

/** The details modal is taller than the screenshot window: scroll its profit block into view. */
async function scrollToCost(page: Page): Promise<void> {
  await page.getByTestId('parts-cost-section').evaluate((el) => el.scrollIntoView({ block: 'center' }))
}

async function closeDetails(page: Page): Promise<void> {
  await page.getByTestId('details-close').click()
  await page.getByTestId('details-close').waitFor({ state: 'hidden' })
}

interface ListRow {
  barcode_code: string
  status: string
  is_overdue: boolean
  amount_remaining: number
  price: number
  parts_cost_missing: boolean
}

test.describe.configure({ mode: 'serial' })

for (const theme of THEMES) {
  for (const lang of LANGS) {
    test(`screens ${theme}-${lang}`, async () => {
      const { app, page, problems } = await launch(demoDir)
      try {
        await configure(page, theme, lang)

        const rows = (await page.evaluate(async () => (await window.api.getTicketsList()).data ?? [])) as ListRow[]
        const overdueReady = rows.find((r) => r.status === 'ready' && r.is_overdue)
        const inProgress = rows.find((r) => r.status === 'in_progress')
        const freshReady = rows.find((r) => r.status === 'ready' && !r.is_overdue)
        const deliveredDebt = rows.find((r) => r.status === 'delivered' && r.amount_remaining > 0)
        expect(overdueReady && inProgress && freshReady && deliveredDebt, 'demo data has every status').toBeTruthy()
        // T004 demo tickets: a ready one still missing its cost, delivered ones with a cost / without one / at a loss
        const readyMissingCost = rows.find((r) => r.status === 'ready' && r.parts_cost_missing)
        const deliveredWithCost = rows.find((r) => r.status === 'delivered' && r.price === 5500)
        const deliveredProvisional = rows.find((r) => r.status === 'delivered' && r.parts_cost_missing)
        const deliveredLoss = rows.find((r) => r.status === 'delivered' && r.price === 3500)
        expect(
          readyMissingCost && deliveredWithCost && deliveredProvisional && deliveredLoss,
          'demo data has the parts-cost cases'
        ).toBeTruthy()

        // --- Tickets list
        await nav(page, 'tickets')
        await shot(page, 'tickets', theme, lang)
        // The minimum supported window width: the whole table must still fit
        await setWidth(app, 1024)
        await shot(page, 'tickets-1024', theme, lang, 900)
        await setWidth(app, 1280)
        await page.getByTestId('filter-overdue').click()
        await shot(page, 'tickets-overdue-filter', theme, lang, 500)
        await page.getByTestId('filter-missing_cost').click()
        await shot(page, 'tickets-missing-cost-filter', theme, lang, 500)
        await page.getByTestId('filter-all').click()
        const search = page.getByTestId('tickets-search')
        await search.fill('zzzzzz-no-such-ticket')
        await shot(page, 'tickets-no-results', theme, lang, 900)
        await search.fill('')

        // --- New ticket (empty + filled with an open brand list)
        await nav(page, 'new-ticket')
        await shot(page, 'new-ticket', theme, lang)
        const textInputs = page.locator('[data-testid="new-ticket-form"] input[type="text"]')
        await textInputs.nth(0).fill('Karim')
        await textInputs.nth(1).fill('0555000111')
        await textInputs.nth(3).click()
        await textInputs.nth(3).fill('sam')
        await shot(page, 'new-ticket-autocomplete', theme, lang, 500)
        await page.keyboard.press('Escape')

        // The first category (screens) requires a cost: the field is there, masked (dots), no profit shown
        const costInput = page.getByTestId('parts-cost-input')
        await costInput.fill('2600')
        await costInput.evaluate((el) => el.scrollIntoView({ block: 'center' }))
        await shot(page, 'new-ticket-cost', theme, lang, 500)
        // A cost above the price asks for a confirmation (nothing is saved)
        await textInputs.nth(3).fill('Samsung')
        await textInputs.nth(4).fill('Galaxy A54')
        await page.locator('[data-testid="new-ticket-form"] input[type="number"]').nth(0).fill('2000')
        await page.locator('[data-testid="new-ticket-form"] button[type="submit"]').click()
        await page.getByTestId('loss-confirm-dialog').waitFor()
        await shot(page, 'new-ticket-loss-dialog', theme, lang, 500)
        await page.getByTestId('loss-confirm-cancel').click()

        // --- Reports
        await nav(page, 'reports')
        for (const period of ['this_month', 'all_time']) {
          await page.getByTestId(`period-${period}`).click()
          await shot(page, `reports-${period}`, theme, lang, 1100)
        }
        // "N delivered tickets without a cost": the ledger can be narrowed to those tickets
        await page.getByTestId('report-provisional-toggle').click()
        await shot(page, 'reports-provisional-filter', theme, lang, 600)
        await page.getByTestId('report-provisional-toggle').click()

        // --- Settings tabs
        await nav(page, 'settings')
        for (const tab of SETTINGS_TABS) {
          await page.getByTestId(`settings-tab-${tab}`).click()
          await shot(page, `settings-${tab}`, theme, lang, 600)
        }

        // --- Dialogs
        await nav(page, 'tickets')
        await openByBarcode(page, overdueReady!.barcode_code)
        await shot(page, 'details-ready-overdue', theme, lang)
        await page.getByTestId('open-delivery').click()
        await shot(page, 'delivery-dialog', theme, lang)
        await page.keyboard.press('Escape')
        await page.getByTestId('details-reprint').click()
        await shot(page, 'print-modal', theme, lang)
        await page.getByTestId('print-close').click()
        await closeDetails(page)

        await openByBarcode(page, inProgress!.barcode_code)
        await shot(page, 'details-in-progress', theme, lang)
        await closeDetails(page)

        await openByBarcode(page, deliveredDebt!.barcode_code)
        await shot(page, 'details-delivered-debt', theme, lang)
        await closeDetails(page)

        // --- Parts cost: ready ticket still without its cost (provisional warning in the delivery dialog)
        await openByBarcode(page, readyMissingCost!.barcode_code)
        await scrollToCost(page)
        await shot(page, 'details-ready-missing-cost', theme, lang)
        await page.getByTestId('open-delivery').click()
        await shot(page, 'delivery-dialog-provisional', theme, lang)
        await page.keyboard.press('Escape')
        await closeDetails(page)

        // delivered with a cost (hidden by default), then revealed with the eye
        await openByBarcode(page, deliveredWithCost!.barcode_code)
        await scrollToCost(page)
        await shot(page, 'details-delivered-cost', theme, lang)
        await page.getByTestId('parts-cost-edit').click()
        await page.getByTestId('parts-cost-dialog').waitFor()
        await shot(page, 'parts-cost-dialog', theme, lang, 500)
        await page.keyboard.press('Escape')
        await page.getByTestId('parts-cost-dialog').waitFor({ state: 'hidden' })
        await closeDetails(page)

        // delivered without the cost: provisional profit; delivered at a loss: danger colour
        await openByBarcode(page, deliveredProvisional!.barcode_code)
        await scrollToCost(page)
        await shot(page, 'details-delivered-provisional', theme, lang)
        await closeDetails(page)
        await openByBarcode(page, deliveredLoss!.barcode_code)
        await scrollToCost(page)
        await shot(page, 'details-delivered-loss', theme, lang)
        await closeDetails(page)

        expect(problems, 'no renderer errors while taking screenshots').toEqual([])
      } finally {
        await app.close()
      }
    })

    test(`empty states ${theme}-${lang}`, async () => {
      const { app, page, problems } = await launch(emptyDir)
      try {
        await configure(page, theme, lang)
        await nav(page, 'tickets')
        await shot(page, 'tickets-empty', theme, lang)
        await nav(page, 'reports')
        await shot(page, 'reports-empty', theme, lang, 900)
        expect(problems).toEqual([])
      } finally {
        await app.close()
      }
    })
  }
}
