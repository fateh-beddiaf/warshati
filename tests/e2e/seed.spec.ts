import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

// Persistence across restarts: deleted seed items must not come back, and the full
// brand catalog must be present and fast to search in the new-ticket form.

test.describe.configure({ mode: 'serial' })

let dataDir: string

async function launch(): Promise<{ app: ElectronApplication; page: Page; problems: string[] }> {
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

async function brandNames(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const res = await window.api.getBrands()
    return (res.data ?? []).map((b: { name: string }) => b.name)
  })
}

test.beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'warshati-e2e-seed-'))
})

test.afterAll(() => {
  try {
    rmSync(dataDir, { recursive: true, force: true })
  } catch {
    // disposable temp dir
  }
})

test('catalog is seeded and a deleted brand does not return after restart', async () => {
  let { app, page } = await launch()
  const first = await brandNames(page)
  expect(first.length).toBeGreaterThanOrEqual(60)
  expect(first).toEqual(expect.arrayContaining(['Condor', 'IRIS', 'Stream System', 'Brandt', 'Itel']))

  // delete a seeded brand (no tickets use it) through the app API
  const deleted = await page.evaluate(async () => {
    const res = await window.api.getBrands()
    const brand = (res.data ?? []).find((b: { name: string }) => b.name === 'Wiko')
    if (!brand) return false
    const del = await window.api.deleteBrand(brand.id)
    return del.success
  })
  expect(deleted).toBe(true)
  await app.close()

  // restart on the same data directory
  ;({ app, page } = await launch())
  const second = await brandNames(page)
  expect(second).not.toContain('Wiko')
  expect(second.length).toBe(first.length - 1)
  await app.close()
})

test('brand/model type-ahead stays fast with the full catalog', async () => {
  const { app, page, problems } = await launch()
  await page.getByTestId('nav-new-ticket').click()
  const inputs = page.locator('[data-testid="new-ticket-form"] input[type="text"]')
  const brandInput = inputs.nth(3)
  const modelInput = inputs.nth(4)

  await brandInput.click()
  const optionCount = await page.locator('[data-testid="new-ticket-form"] div.max-h-60 button').count()
  expect(optionCount).toBeGreaterThanOrEqual(50)

  const started = Date.now()
  await brandInput.fill('')
  await brandInput.pressSequentially('Sam', { delay: 20 })
  await page.getByRole('button', { name: 'Samsung', exact: true }).first().click()
  await modelInput.click()
  await modelInput.pressSequentially('Galaxy A5', { delay: 20 })
  const modelOptions = await page.locator('[data-testid="new-ticket-form"] div.max-h-60 button').count()
  expect(modelOptions).toBeGreaterThan(0)
  expect(Date.now() - started).toBeLessThan(5000)
  expect(problems).toEqual([])
  await app.close()
})
