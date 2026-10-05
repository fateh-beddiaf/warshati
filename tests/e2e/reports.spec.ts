import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { launchElectron } from './helpers'

// Reports screen: local-date defaults for the custom range, visible error when the report
// cannot be loaded (instead of stale numbers), and the ledger only lists delivered tickets.

test.describe.configure({ mode: 'serial' })

let app: ElectronApplication
let page: Page
let dataDir: string
const problems: string[] = []

const pad = (n: number): string => String(n).padStart(2, '0')
const localDate = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

type Api = {
  createTicket: (dto: unknown) => Promise<{ success: boolean; data?: { ticketId: number } }>
  updateTicketStatus: (dto: unknown) => Promise<{ success: boolean }>
}

async function openReports(): Promise<void> {
  await page.getByTestId('nav-reports').click()
  await page.getByTestId('period-custom').waitFor()
}

test.beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'warshati-e2e-reports-'))
  app = await launchElectron(dataDir)
  page = await app.firstWindow()
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
  await page.waitForSelector('[data-testid="nav-tickets"]')
})

test.afterAll(async () => {
  await app?.close()
  try {
    rmSync(dataDir, { recursive: true, force: true })
  } catch {
    // disposable
  }
})

test('custom range defaults are the local first-of-month and today', async () => {
  await openReports()
  await page.getByTestId('period-custom').click()
  const dates = page.locator('input[type="date"]')
  await expect(dates).toHaveCount(2)
  const now = new Date()
  await expect(dates.nth(0)).toHaveValue(localDate(new Date(now.getFullYear(), now.getMonth(), 1)))
  await expect(dates.nth(1)).toHaveValue(localDate(now))
})

test('a failing report shows an error and drops stale data; recovers afterwards', async () => {
  // Seed one delivered ticket so there is real data to go stale
  await page.evaluate(async () => {
    const api = (window as unknown as { api: Api }).api
    const created = await api.createTicket({
      customer: { name: 'Report Customer', phone: '0555111222' },
      device: { brand: 'Test', model: 'R1' },
      ticket: { repair_category_id: 1, price: 4000, payment_type: 'cash', amount_paid: 4000, technician_id: 1 }
    })
    const id = created.data!.ticketId
    await api.updateTicketStatus({ ticketId: id, newStatus: 'ready' })
    await api.updateTicketStatus({ ticketId: id, newStatus: 'delivered' })
  })

  await page.getByTestId('nav-tickets').click()
  await page.getByTestId('nav-reports').click()
  await page.getByTestId('period-all_time').click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.getByTestId('report-error')).toHaveCount(0)

  const refresh = page.getByRole('button', { name: 'تحديث التقرير' })

  // 1) handler answers { success: false }
  await app.evaluate(({ ipcMain }) => {
    const g = globalThis as unknown as { __origReport?: unknown }
    type Handler = (e: unknown, ...a: unknown[]) => unknown
    const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, Handler> })._invokeHandlers
    g.__origReport = handlers.get('reports:getFinancialReport')
    handlers.set('reports:getFinancialReport', () => ({ success: false, error: 'خطأ تجريبي' }))
  })
  await refresh.click()
  await expect(page.getByTestId('report-error')).toContainText('خطأ تجريبي')
  await expect(page.locator('tbody tr')).toHaveCount(0)

  // 2) handler throws => invoke rejects in the renderer => generic message
  await app.evaluate(({ ipcMain }) => {
    type Handler = (e: unknown, ...a: unknown[]) => unknown
    const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, Handler> })._invokeHandlers
    handlers.set('reports:getFinancialReport', () => {
      throw new Error('boom')
    })
  })
  await refresh.click()
  await expect(page.getByTestId('report-error')).toBeVisible()

  // 3) restore the real handler: error disappears and data is back
  await app.evaluate(({ ipcMain }) => {
    const g = globalThis as unknown as { __origReport?: unknown }
    type Handler = (e: unknown, ...a: unknown[]) => unknown
    const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, Handler> })._invokeHandlers
    handlers.set('reports:getFinancialReport', g.__origReport as Handler)
  })
  await refresh.click()
  await expect(page.getByTestId('report-error')).toHaveCount(0)
  await expect(page.locator('tbody tr')).toHaveCount(1)
  expect(problems).toEqual([])
})
