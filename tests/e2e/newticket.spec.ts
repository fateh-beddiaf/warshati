import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

// New-ticket form: customer lookup beyond the latest 20, phone-match suggestions, no silent
// customer rename, and clean (unique) option keys with the full brand/model catalog.

test.describe.configure({ mode: 'serial' })

let app: ElectronApplication
let page: Page
let dataDir: string
const problems: string[] = []

test.beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'warshati-e2e-nt-'))
  app = await electron.launch({
    args: [resolve('out/main/index.js')],
    env: { ...process.env, WARSHATI_DATA_DIR: dataDir }
  })
  page = await app.firstWindow()
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`${msg.type()}: ${msg.text()}`)
  })
  await page.waitForSelector('[data-testid="nav-tickets"]')

  // 30 customers (more than the 20 the empty search returns), created through the real IPC
  await page.evaluate(async () => {
    const meta = await window.api.getMetadata()
    const data = meta.data!
    for (let i = 1; i <= 30; i++) {
      await window.api.createTicket({
        customer: { name: `زبون ${String(i).padStart(2, '0')}`, phone: `0550${String(100000 + i)}` },
        device: { brand: 'Samsung', model: 'Galaxy A54' },
        ticket: {
          repair_category_id: data.repairCategories[0].id,
          price: 1000,
          payment_type: 'cash',
          amount_paid: 1000,
          technician_id: data.technicians[0].id
        },
        accessory_ids: []
      })
    }
  })
  problems.length = 0
})

test.afterAll(async () => {
  await app?.close()
  try {
    rmSync(dataDir, { recursive: true, force: true })
  } catch {
    // disposable temp dir
  }
})

test('customer search finds old customers beyond the latest 20', async () => {
  await page.getByTestId('nav-new-ticket').click()
  const inputs = page.locator('[data-testid="new-ticket-form"] input[type="text"]')
  await inputs.nth(0).click()
  await inputs.nth(0).pressSequentially('زبون 01', { delay: 30 })
  await expect(page.getByRole('button', { name: /زبون 01/ }).first()).toBeVisible({ timeout: 5000 })
})

test('typing a registered phone offers the matching customer and selecting fills the form', async () => {
  await page.getByTestId('nav-tickets').click()
  await page.getByTestId('filter-all').waitFor() // let the previous screen fully unmount
  await page.getByTestId('nav-new-ticket').click()
  const inputs = page.locator('[data-testid="new-ticket-form"] input[type="text"]')
  await inputs.nth(1).pressSequentially('0550100003', { delay: 20 })
  const match = page.getByTestId('phone-match').first()
  await expect(match).toBeVisible({ timeout: 5000 })
  await match.click()
  await expect(inputs.nth(0)).toHaveValue('زبون 03')
})

test('editing the name of a selected customer creates a new customer instead of renaming', async () => {
  await page.getByTestId('nav-tickets').click()
  await page.getByTestId('filter-all').waitFor() // let the previous screen fully unmount
  await page.getByTestId('nav-new-ticket').click()
  const inputs = page.locator('[data-testid="new-ticket-form"] input[type="text"]')
  await inputs.nth(1).pressSequentially('0550100005', { delay: 20 })
  await page.getByTestId('phone-match').first().click()
  await inputs.nth(0).fill('اسم مختلف تماماً')
  await inputs.nth(3).fill('Samsung')
  await inputs.nth(4).fill('Galaxy A54')
  await page.locator('[data-testid="new-ticket-form"] input[type="number"]').nth(0).fill('1000')
  await page.locator('[data-testid="new-ticket-form"] input[type="number"]').nth(1).fill('1000')
  await page.locator('[data-testid="new-ticket-form"] button[type="submit"]').click()
  await page.waitForSelector('.bg-emerald-50')

  const names = await page.evaluate(async () => {
    const res = await window.api.searchCustomers('0550100005')
    return (res.data ?? []).map((c: { name: string }) => c.name)
  })
  expect(names).toContain('زبون 05') // the original customer keeps its name
  expect(names).toContain('اسم مختلف تماماً') // the edited form became a separate customer
})

test('full catalog gives unique option keys and no React warnings', async () => {
  await page.getByTestId('nav-tickets').click()
  await page.getByTestId('filter-all').waitFor() // let the previous screen fully unmount
  await page.getByTestId('nav-new-ticket').click()
  const inputs = page.locator('[data-testid="new-ticket-form"] input[type="text"]')
  // no brand selected: model list spans every brand (same model names repeat across brands)
  await inputs.nth(4).click()
  await page.waitForTimeout(300)
  expect(problems, 'console warnings/errors').toEqual([])
})

test('partial payment switches the payment type to credit', async () => {
  await page.getByTestId('nav-tickets').click()
  await page.getByTestId('filter-all').waitFor()
  await page.getByTestId('nav-new-ticket').click()
  const numbers = page.locator('[data-testid="new-ticket-form"] input[type="number"]')
  await numbers.nth(0).fill('5000')
  await numbers.nth(1).fill('2000')
  await expect(page.locator('input[name="paymentType"][value="credit"]')).toBeChecked()
  await numbers.nth(1).fill('5000')
  await expect(page.locator('input[name="paymentType"][value="cash"]')).toBeChecked()
})
