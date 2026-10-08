import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { spawnSync } from 'child_process'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { launchElectron, resetUi } from './helpers'

// The tickets table must fit the window without horizontal scrolling or clipping at every
// width from the 1024px minimum up, in both languages, with realistic (long) data.

let dataDir: string
let app: ElectronApplication
let page: Page
// eslint-disable-next-line @typescript-eslint/no-require-imports
const electronBinary: string = require('electron')
const problems: string[] = []

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'warshati-e2e-tickets-layout-'))
  const seeded = spawnSync(electronBinary, ['-r', 'tsx', 'tests/fixtures/seed-demo.run.ts', dataDir], {
    encoding: 'utf8'
  })
  if (seeded.status !== 0) throw new Error(`demo seed failed: ${seeded.stdout}\n${seeded.stderr}`)

  app = await launchElectron(dataDir)
  page = await app.firstWindow()
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`)
  })
  await page.waitForSelector('[data-testid="nav-tickets"]')
})

// One app for the file: every test starts from the app's starting state, whatever the previous one left behind
test.beforeEach(async () => {
  await resetUi(page)
})

test.afterAll(async () => {
  await app?.close()
  try {
    rmSync(dataDir, { recursive: true, force: true })
  } catch {
    // disposable temp dir
  }
})

async function setLanguage(lang: 'ar' | 'en'): Promise<void> {
  await page.evaluate(async (lg) => {
    localStorage.setItem('warshati_language', lg)
    await window.api.setSetting('app_language', lg)
  }, lang)
  await page.reload()
  await page.waitForSelector('[data-testid="nav-tickets"]')
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe(lang)
}

async function setWindowWidth(width: number): Promise<void> {
  await app.evaluate(({ BrowserWindow }, w) => {
    BrowserWindow.getAllWindows()[0].setSize(w, 800)
  }, width)
  await expect.poll(() => page.evaluate(() => window.outerWidth)).toBe(width)
}

for (const lang of ['ar', 'en'] as const) {
  test(`tickets table fits without scrolling or clipping (${lang})`, async () => {
    await setLanguage(lang)
    await page.getByTestId('nav-tickets').click()
    await page.locator('tbody tr').first().waitFor()
    await expect(page.locator('tbody tr')).toHaveCount(14)

    for (const width of [1024, 1100, 1180, 1280, 1440]) {
      await setWindowWidth(width)
      await page.waitForTimeout(450) // layout + entrance animation settle

      const m = await page.evaluate(() => {
        const table = document.querySelector('table') as HTMLTableElement
        const scroller = table.parentElement as HTMLElement
        const box = scroller.getBoundingClientRect()
        const lastCell = table.querySelector('thead th:last-child') as HTMLElement
        const lastBtn = table.querySelector('tbody tr:first-child [data-testid="row-print"]') as HTMLElement
        const firstCell = table.querySelector('thead th:first-child') as HTMLElement
        const within = (el: HTMLElement): boolean => {
          const r = el.getBoundingClientRect()
          return r.left >= box.left - 0.5 && r.right <= box.right + 0.5
        }
        return {
          scrollWidth: scroller.scrollWidth,
          clientWidth: scroller.clientWidth,
          docScroll: document.documentElement.scrollWidth,
          docClient: document.documentElement.clientWidth,
          lastHeaderVisible: within(lastCell),
          printButtonVisible: within(lastBtn),
          firstHeaderVisible: within(firstCell)
        }
      })

      const label = `${lang} @${width}: ${JSON.stringify(m)}`
      expect(m.scrollWidth, `table scroll container overflows (${label})`).toBeLessThanOrEqual(m.clientWidth)
      expect(m.docScroll, `page scrolls horizontally (${label})`).toBeLessThanOrEqual(m.docClient)
      expect(m.lastHeaderVisible, `last column clipped (${label})`).toBe(true)
      expect(m.firstHeaderVisible, `first column clipped (${label})`).toBe(true)
      expect(m.printButtonVisible, `print button clipped (${label})`).toBe(true)
    }

    expect(problems).toEqual([])
  })
}

test('overdue rows keep their status and remaining info in the compact layout', async () => {
  await setLanguage('ar')
  await setWindowWidth(1024)
  await page.getByTestId('filter-overdue').click()
  const rows = page.locator('tbody tr')
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toHaveAttribute('data-overdue', 'true')
  await expect(rows.first().locator('[data-status="overdue"]')).toBeVisible()
  await expect(rows.first()).toContainText('د.ج')
  await setWindowWidth(1280)
})
