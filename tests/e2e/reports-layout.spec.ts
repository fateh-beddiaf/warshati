import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { spawnSync } from 'child_process'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

// The reports ledger (with its net-profit column) must fit the window without horizontal scrolling or
// clipping at every width from the 1024px minimum up, in both languages, on the demo data
// (provisional, loss and debt rows included).

let dataDir: string
let app: ElectronApplication
let page: Page
// eslint-disable-next-line @typescript-eslint/no-require-imports
const electronBinary: string = require('electron')
const problems: string[] = []

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'warshati-e2e-reports-layout-'))
  const seeded = spawnSync(electronBinary, ['-r', 'tsx', 'tests/fixtures/seed-demo.run.ts', dataDir], { encoding: 'utf8' })
  if (seeded.status !== 0) throw new Error(`demo seed failed: ${seeded.stdout}\n${seeded.stderr}`)
  app = await electron.launch({ args: [resolve('out/main/index.js')], env: { ...process.env, WARSHATI_DATA_DIR: dataDir } })
  page = await app.firstWindow()
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`)
  })
  await page.waitForSelector('[data-testid="nav-tickets"]')
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
  await app.evaluate(({ BrowserWindow }, w) => BrowserWindow.getAllWindows()[0].setSize(w, 800), width)
  await expect.poll(() => page.evaluate(() => window.outerWidth)).toBe(width)
}

for (const lang of ['ar', 'en'] as const) {
  test(`reports ledger fits without scrolling or clipping (${lang})`, async () => {
    await setLanguage(lang)
    await page.getByTestId('nav-reports').click()
    await page.getByTestId('period-all_time').click()
    await expect(page.locator('tbody tr')).toHaveCount(7)
    for (const width of [1024, 1100, 1180, 1280, 1440]) {
      await setWindowWidth(width)
      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const table = document.querySelector('table')!
              const wrap = table.parentElement!
              const box = wrap.getBoundingClientRect()
              const cells = Array.from(table.querySelectorAll('thead th, tbody tr:first-child td'))
              const inside = cells.every((c) => {
                const r = c.getBoundingClientRect()
                return r.left >= box.left - 1 && r.right <= box.right + 1
              })
              return {
                noScroll: wrap.scrollWidth <= wrap.clientWidth,
                pageNoScroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
                inside
              }
            }),
          { message: `ledger at ${width}px (${lang})` }
        )
        .toEqual({ noScroll: true, pageNoScroll: true, inside: true })
    }
    // the right-most numbers (shares) are really visible at the minimum width
    await setWindowWidth(1024)
    const last = page.locator('tbody tr').first().locator('td').last()
    await expect(last).toBeVisible()
    expect((await last.boundingBox())!.width).toBeGreaterThan(40)
    expect(problems).toEqual([])
  })
}
