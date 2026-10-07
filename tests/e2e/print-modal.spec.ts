import { test, expect } from '@playwright/test'
import {
  launchApp,
  shutdownApp,
  createTicket,
  openDetailsByBarcode,
  closeDetails,
  resetUi,
  type Launched
} from './helpers'

// Print preview modal: never a stale barcode, printing disabled when the barcode cannot be
// generated, print SVG independent of the zoom toggle, and Close usable while a job hangs.
// The printer IPC handler is replaced inside the main process, so no real printing happens.

test.describe.configure({ mode: 'serial' })

let l: Launched
let barcodeA = ''
let barcodeB = ''

// One app for the file; beforeAll creates the two tickets every test uses, so any test can run alone.
test.beforeAll(async () => {
  l = await launchApp('print')
  barcodeA = await createTicket(l.page, { name: 'Alpha', phone: '0555000001', price: 5000, paid: 5000, type: 'cash' })
  barcodeB = await createTicket(l.page, { name: 'Beta', phone: '0555000002', price: 3000, paid: 3000, type: 'cash' })
  expect(barcodeA).not.toBe(barcodeB)
})

// One app for the file: every test starts from the app's starting state, whatever the previous one left behind
test.beforeEach(async () => {
  await resetUi(l.page)
})

test.afterAll(async () => {
  await shutdownApp(l)
})
test.afterEach(() => {
  expect(l.problems, 'renderer errors').toEqual([])
})

async function stubPrinter(mode: 'capture' | 'hang'): Promise<void> {
  await l.app.evaluate(({ ipcMain }, m) => {
    const g = globalThis as unknown as { __prints: unknown[]; __hung: Promise<unknown>[] }
    g.__prints = []
    g.__hung = []
    ipcMain.removeHandler('printer:printLabel')
    ipcMain.handle('printer:printLabel', (_e, labelData) => {
      g.__prints.push(labelData)
      if (m !== 'hang') return { success: true }
      // Keep a reference to the never-settling promise: if it is garbage collected Electron
      // rejects the invoke with "reply was never sent", which made this test flaky.
      const hung = new Promise(() => {})
      g.__hung.push(hung)
      return hung
    })
  }, mode)
}

async function printed(): Promise<Array<{ barcode: string; svgContent?: string }>> {
  return l.app.evaluate(() => (globalThis as unknown as { __prints: never[] }).__prints)
}

async function openPrintFor(barcode: string): Promise<void> {
  await openDetailsByBarcode(l.page, barcode)
  await l.page.getByTestId('details-reprint').click()
  await l.page.getByTestId('print-submit').waitFor()
}

async function closePrintAndDetails(): Promise<void> {
  await l.page.getByTestId('print-close').click()
  await l.page.getByTestId('print-submit').waitFor({ state: 'hidden' })
  await closeDetails(l.page)
}

test('switching tickets never shows a stale barcode', async () => {
  await openPrintFor(barcodeA)
  const svg = l.page.getByTestId('barcode-svg')
  await expect(svg).toHaveAttribute('data-barcode', barcodeA)
  await expect(l.page.getByText(barcodeA, { exact: true }).last()).toBeVisible()
  expect(await svg.locator('rect, path').count()).toBeGreaterThan(5)
  const barsA = await svg.innerHTML()
  await closePrintAndDetails()

  await openPrintFor(barcodeB)
  await expect(svg).toHaveAttribute('data-barcode', barcodeB)
  await expect(l.page.getByText(barcodeB, { exact: true }).last()).toBeVisible()
  expect(await svg.innerHTML()).not.toBe(barsA)

  // the on-screen zoom toggle redraws the same barcode, not another one
  await l.page.getByText('الحجم الفعلي', { exact: false }).first().click()
  await expect(svg).toHaveAttribute('data-barcode', barcodeB)
  await closePrintAndDetails()
})

test('the printed SVG matches the current ticket and ignores the zoom toggle', async () => {
  await stubPrinter('capture')
  await openPrintFor(barcodeA)
  await l.page.getByTestId('print-submit').click()
  await expect(l.page.getByTestId('print-status')).toBeVisible()
  await closePrintAndDetails()

  await openPrintFor(barcodeB)
  await l.page.getByText('الحجم الفعلي', { exact: false }).first().click() // actual
  await l.page.getByTestId('print-submit').click()
  await expect(l.page.getByTestId('print-status')).toBeVisible()
  await l.page.getByText('معاينة مكبّرة', { exact: false }).first().click() // zoomed
  await l.page.getByTestId('print-submit').click()
  await expect.poll(async () => (await printed()).length).toBe(3)

  const [pa, pb1, pb2] = await printed()
  expect(pa.barcode).toBe(barcodeA)
  expect(pa.svgContent).toContain(`data-barcode="${barcodeA}"`)
  expect(pb1.svgContent).toContain(`data-barcode="${barcodeB}"`)
  expect(pb1.svgContent).not.toContain(barcodeA)
  // identical output whichever zoom mode was selected when printing
  expect(pb2.svgContent).toBe(pb1.svgContent)
  await closePrintAndDetails()
})

test('Close stays usable while a print job never reports back', async () => {
  await stubPrinter('hang')
  await openPrintFor(barcodeA)
  await l.page.getByTestId('print-submit').click()
  await expect.poll(async () => (await printed()).length).toBe(1)
  // still "printing": print disabled, but Close works
  await expect(l.page.getByTestId('print-submit')).toBeDisabled()
  await expect(l.page.getByTestId('print-close-footer')).toBeEnabled()
  await l.page.getByTestId('print-close-footer').click()
  await l.page.getByTestId('print-submit').waitFor({ state: 'hidden' })
  await closeDetails(l.page)

  // reopening: not stuck on "printing"
  await openPrintFor(barcodeB)
  await expect(l.page.getByTestId('print-submit')).toBeEnabled()
  await closePrintAndDetails()
})

// Keep last: it replaces the barcode-lookup IPC handler for the rest of the session.
test('a barcode that cannot be generated disables printing and shows an error', async () => {
  // Make the "scan" lookup return a ticket whose barcode CODE128 cannot encode (non-ASCII).
  await l.app.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler('tickets:getByBarcode')
    ipcMain.handle('tickets:getByBarcode', () => ({
      success: true,
      data: {
        ticket: {
          id: 9999,
          barcode_code: 'سلام-٠١٢',
          customer_id: 1,
          created_at: new Date().toISOString(),
          technician: 'T',
          technician_id: 1,
          repair_category_id: 1,
          price: 100,
          payment_type: 'cash',
          amount_paid: 100,
          amount_remaining: 0,
          status: 'in_progress',
          my_share: null,
          partner_share: null
        },
        customer: { id: 1, name: 'Broken', phone: '0555' },
        device: { id: 1, ticket_id: 9999, brand: 'X', model: 'Y', short_label: 'X Y' },
        category: null,
        accessories: [],
        statusLogs: [],
        ready_at: null,
        is_overdue: false,
        overdue_days: 0
      }
    }))
  })
  const header = l.page.getByTestId('header-barcode-input')
  await header.fill('anything-here')
  await header.press('Enter')
  await l.page.getByTestId('details-close').waitFor()
  await l.page.getByTestId('details-reprint').click()
  await l.page.getByTestId('print-submit').waitFor()
  await expect(l.page.getByTestId('print-submit')).toBeDisabled()
  await expect(l.page.getByTestId('print-status')).toContainText('الباركود')
  await closePrintAndDetails()
})
