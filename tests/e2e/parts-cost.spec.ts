import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { launchApp, shutdownApp, openDetailsByBarcode, closeDetails, type Launched } from './helpers'

// T004: parts cost, end to end on the built app.
//  (a) the category switch in Settings          (b) a ticket without a cost: warning + list flag + filter
//  (c) the field is masked by default            (d) delivered without a cost, cost added later -> shares + report
//  (e) a loss needs a confirmation               (f) the cost never reaches the label / print preview

test.describe.configure({ mode: 'serial' })

let l: Launched
const CATEGORY = 'بطارية ومنفذ شحن' // seeded, 50% -> 4000 - 2600 = 1400 => 700 / 700
const PLAIN_CATEGORY = 'صيانة عامة وأخرى' // seeded, never gets the switch
const MINUS = /[-−‎]/

/** The barcode art is full of numbers: strip the SVG (and the random barcode) so a coincidence cannot fail a "no cost digits" check. */
const withoutBarcodeArt = (html: string, barcode: string): string =>
  html
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .split(barcode)
    .join('')

test.beforeAll(async () => {
  l = await launchApp('partscost')
})
test.afterAll(async () => {
  await shutdownApp(l)
})
test.afterEach(() => {
  expect(l.problems, 'renderer errors').toEqual([])
})

/** The profit split in the delivery dialog is hidden until asked for. */
async function revealDelivery(): Promise<void> {
  const toggle = l.page.getByTestId('delivery-profit-toggle')
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click()
}

/** Cost, net profit and shares in the ticket details are hidden until asked for. */
async function revealDetails(): Promise<void> {
  const eye = l.page.getByTestId('parts-cost-reveal')
  if ((await eye.getAttribute('aria-pressed')) !== 'true') await eye.click()
}

const go = async (tab: 'tickets' | 'new-ticket' | 'reports' | 'settings'): Promise<void> => {
  await l.page.getByTestId(`nav-${tab}`).click()
}

async function pickCategory(page: Page, name: string): Promise<void> {
  await page.getByTestId('repair-category').click()
  await page.getByRole('option', { name: new RegExp(name) }).click()
}

interface NewTicketOptions {
  name: string
  phone: string
  price: number
  paid?: number
  category: string
  /** typed into the masked cost box (omitted = left empty) */
  cost?: string
}

/** Fills the New Ticket form (fresh mount) and submits. Does NOT wait for the result. */
async function fillAndSubmit(o: NewTicketOptions): Promise<void> {
  // leave the screen and come back, and wait until the previous attempt (banners, typed values) is gone
  await go('tickets')
  await l.page.getByTestId('tickets-search').waitFor()
  await go('new-ticket')
  const form = l.page.getByTestId('new-ticket-form')
  await form.waitFor()
  await expect(l.page.getByTestId('ticket-created-banner')).toHaveCount(0)
  await expect(l.page.getByTestId('ticket-error-banner')).toHaveCount(0)
  const text = form.locator('input[type="text"]')
  // order: customer name, phone, notes, brand, model, short label, (cost)
  await text.nth(0).fill(o.name)
  await text.nth(1).fill(o.phone)
  await text.nth(3).fill('Realme')
  await text.nth(4).fill('C51')
  await pickCategory(l.page, o.category)
  await form.locator('input[type="number"]').nth(0).fill(String(o.price))
  await form
    .locator('input[type="number"]')
    .nth(1)
    .fill(String(o.paid ?? o.price))
  if (o.cost !== undefined) await form.getByTestId('parts-cost-input').fill(o.cost)
  else if (o.category === CATEGORY) await expect(form.getByTestId('parts-cost-input')).toHaveValue('') // a fresh form never inherits a cost
  await form.locator('button[type="submit"]').click()
}

async function submitAndGetBarcode(o: NewTicketOptions): Promise<string> {
  await fillAndSubmit(o)
  await l.page.getByTestId('ticket-created-banner').waitFor()
  return ((await l.page.getByTestId('ticket-created-barcode').textContent()) ?? '').trim()
}

async function saveCostFromDetails(value: string): Promise<void> {
  await l.page.getByTestId('parts-cost-edit').click()
  const input = l.page.getByTestId('parts-cost-dialog-input')
  await input.waitFor()
  await input.fill(value)
  await l.page.getByTestId('parts-cost-save').click()
}

let barcodeNoCost = ''
let barcodeLoss = ''

// ---------------------------------------------------------------------------------------------
test('(a) Settings: no category requires a cost by default; the switch enables it for one category', async () => {
  await go('settings')
  await l.page.getByTestId('settings-tab-categories').click()
  const cards = l.page.getByTestId('settings-category-card')
  await expect(cards).toHaveCount(4)
  await expect(l.page.getByTestId('settings-category-cost-badge')).toHaveCount(0)
  for (const sw of await l.page.getByTestId('settings-category-requires-cost').all()) {
    await expect(sw).toHaveAttribute('aria-checked', 'false')
  }

  const card = cards.filter({ hasText: CATEGORY })
  await card.getByTestId('settings-category-requires-cost').click()
  await expect(card.getByTestId('settings-category-cost-badge')).toBeVisible()
  await expect(l.page.getByTestId('settings-category-cost-badge')).toHaveCount(1)

  // persisted in the database, only for that category
  const stored = await l.page.evaluate(async () => {
    const res = await (
      window as unknown as {
        api: { getRepairCategories: () => Promise<{ data: { name: string; requires_parts_cost: boolean }[] }> }
      }
    ).api.getRepairCategories()
    return res.data.map((c) => [c.name, c.requires_parts_cost])
  })
  expect(stored).toEqual([
    ['تغيير شاشة', false],
    [CATEGORY, true],
    ['صيانة بورد وسوفتوير', false],
    [PLAIN_CATEGORY, false]
  ])
})

test('(a) Settings: the dialog preview takes an example with a cost when the switch is on', async () => {
  const card = l.page.getByTestId('settings-category-card').filter({ hasText: CATEGORY })
  await card.getByTestId('settings-category-edit').click()
  const dialog = l.page.getByTestId('settings-category-dialog')
  await expect(dialog.getByTestId('settings-category-dialog-requires-cost')).toHaveAttribute('aria-checked', 'true')
  // 10,000 price - 6,000 cost = 4,000 net => 2,000 / 2,000 at 50%
  await expect(dialog.getByTestId('settings-category-preview-line')).toContainText('4.000')
  await expect(dialog.getByTestId('settings-category-preview-owner')).toContainText('2.000')
  await expect(dialog.getByTestId('settings-category-preview-partner')).toContainText('2.000')
  await dialog.getByTestId('settings-category-dialog-requires-cost').click()
  await expect(dialog.getByTestId('settings-category-preview-line')).toHaveCount(0)
  await expect(dialog.getByTestId('settings-category-preview-owner')).toContainText('5.000')
  await l.page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  // cancelled: the card still requires a cost
  await expect(card.getByTestId('settings-category-requires-cost')).toHaveAttribute('aria-checked', 'true')
})

// ---------------------------------------------------------------------------------------------
test('(c) New ticket: the cost field exists only for categories that require it, and is masked by default', async () => {
  await go('tickets')
  await go('new-ticket')
  const form = l.page.getByTestId('new-ticket-form')
  await pickCategory(l.page, PLAIN_CATEGORY)
  await expect(form.getByTestId('parts-cost-input')).toHaveCount(0)
  await pickCategory(l.page, CATEGORY)
  const input = form.getByTestId('parts-cost-input')
  await expect(input).toBeVisible()

  // masked: dots, not digits
  await expect(input).toHaveAttribute('data-masked', 'true')
  await input.fill('2600')
  await expect(input).toHaveValue('2600')
  expect(await input.evaluate((el) => getComputedStyle(el).getPropertyValue('-webkit-text-security'))).toBe('disc')
  // no profit, no cost digits anywhere else on the screen
  const visibleText = (await l.page.locator('main, body').first().innerText()) ?? ''
  expect(visibleText).not.toContain('2600')
  expect(visibleText).not.toContain('2.600')
  await expect(form.getByTestId('payment-summary')).not.toContainText('2.600')

  // reveal with the eye
  await form.getByTestId('parts-cost-input-toggle').click()
  await expect(input).toHaveAttribute('data-masked', 'false')
  expect(await input.evaluate((el) => getComputedStyle(el).getPropertyValue('-webkit-text-security'))).toBe('none')
  // ... and it hides again when focus leaves the control
  await form.locator('input[type="number"]').nth(0).click()
  await expect(input).toHaveAttribute('data-masked', 'true')

  // ... and by itself after a few seconds
  await form.getByTestId('parts-cost-input-toggle').click()
  await expect(input).toHaveAttribute('data-masked', 'false')
  await l.page.waitForTimeout(5600)
  await expect(input).toHaveAttribute('data-masked', 'true')

  // a different category hides the field again
  await pickCategory(l.page, PLAIN_CATEGORY)
  await expect(input).toHaveCount(0)
})

test('(c) New ticket: an invalid cost is refused with a message and nothing is created', async () => {
  await fillAndSubmit({ name: 'Bad Cost', phone: '0555000099', price: 4000, category: CATEGORY, cost: 'abc' })
  await expect(l.page.getByTestId('ticket-error-banner')).toContainText('التكلفة')
  await expect(l.page.getByTestId('ticket-created-banner')).toHaveCount(0)
  await fillAndSubmit({ name: 'Bad Cost', phone: '0555000099', price: 4000, category: CATEGORY, cost: '-5' })
  await expect(l.page.getByTestId('ticket-error-banner')).toBeVisible()
  await expect(l.page.getByTestId('ticket-created-banner')).toHaveCount(0)
})

// ---------------------------------------------------------------------------------------------
test('(b) a ticket created without a cost succeeds with a clear warning, a flag in the list and a filter', async () => {
  barcodeNoCost = await submitAndGetBarcode({
    name: 'No Cost Customer',
    phone: '0555000001',
    price: 4000,
    category: CATEGORY
  })
  await expect(l.page.getByTestId('ticket-created-no-cost-warning')).toBeVisible()
  await expect(l.page.getByTestId('ticket-created-no-cost-warning')).toContainText('بلا تكلفة')

  // a ticket of a category that does not require a cost: no warning
  await go('tickets')
  const plainBarcode = await submitAndGetBarcode({
    name: 'Plain Customer',
    phone: '0555000002',
    price: 1500,
    category: PLAIN_CATEGORY
  })
  await expect(l.page.getByTestId('ticket-created-no-cost-warning')).toHaveCount(0)

  await go('tickets')
  const rows = l.page.locator('tbody tr')
  await expect(rows).toHaveCount(2)
  // only the ticket with the missing cost carries the indicator, and it never shows an amount
  const flagged = rows.filter({ hasText: barcodeNoCost })
  await expect(flagged.getByTestId('row-missing-cost')).toBeVisible()
  await expect(rows.filter({ hasText: plainBarcode }).getByTestId('row-missing-cost')).toHaveCount(0)
  await flagged.getByTestId('row-missing-cost').hover()
  await expect(l.page.getByRole('tooltip').first()).toContainText('التكلفة غير مُدخلة')

  await expect(l.page.getByTestId('missing-cost-banner')).toContainText('1')
  await l.page.getByTestId('missing-cost-banner-show').click()
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText(barcodeNoCost)
  await expect(l.page.getByTestId('missing-cost-banner')).toHaveCount(0) // the banner steps aside while filtering
  await l.page.getByTestId('filter-all').click()
  await expect(rows).toHaveCount(2)
  await l.page.getByTestId('filter-missing_cost').click()
  await expect(rows).toHaveCount(1)
  await l.page.getByTestId('filter-all').click()
})

// ---------------------------------------------------------------------------------------------
test('(d) delivered without a cost: provisional shares, then adding the cost recomputes shares and the report', async () => {
  await go('tickets')
  await openDetailsByBarcode(l.page, barcodeNoCost)
  await l.page.getByTestId('status-to-ready').click()
  await l.page.getByTestId('open-delivery').click()

  // the delivery dialog warns that the profit is provisional but does not block
  await expect(l.page.getByTestId('delivery-provisional-warning')).toBeVisible()
  await revealDelivery()
  await expect(l.page.getByTestId('share-owner-amount')).toContainText('2.000')
  await expect(l.page.getByTestId('share-partner-amount')).toContainText('2.000')
  await l.page.getByTestId('confirm-delivery').click()
  await l.page.getByTestId('status-back-to-ready').waitFor()

  await expect(l.page.getByTestId('profit-provisional-badge')).toBeVisible()
  await revealDetails()
  await expect(l.page.getByTestId('compact-my-share')).toContainText('2.000')
  await expect(l.page.getByTestId('parts-cost-value')).toHaveText('لم تُدخل بعد')
  await expect(l.page.getByTestId('parts-cost-edit')).toContainText('إضافة')

  // the report flags it
  await closeDetails(l.page)
  await go('reports')
  await l.page.getByTestId('period-all_time').click()
  await expect(l.page.getByTestId('report-provisional-alert')).toBeVisible()
  await expect(l.page.getByTestId('report-provisional-alert')).toContainText('1')
  await expect(l.page.getByTestId('stat-net-profit')).toContainText('4.000')
  await expect(l.page.getByTestId('stat-parts-cost')).toContainText(/^0/)
  await expect(l.page.getByTestId('ledger-provisional')).toHaveCount(1)

  // add the cost later, from the details (the ticket is already delivered)
  await go('tickets')
  await openDetailsByBarcode(l.page, barcodeNoCost)
  await saveCostFromDetails('2600')
  await expect(l.page.getByTestId('parts-cost-dialog')).toHaveCount(0)

  await expect(l.page.getByTestId('profit-provisional-badge')).toHaveCount(0)
  await expect(l.page.getByTestId('parts-cost-edit')).toContainText('تعديل')

  // the cost is hidden: dots, no digits anywhere in the details; the eye shows it for a moment
  const value = l.page.getByTestId('parts-cost-value')
  await expect(value).toHaveAttribute('data-masked', 'true')
  await expect(value).not.toContainText('2.600')
  await expect(l.page.getByTestId('net-profit-value')).not.toContainText('1.400')
  await expect(l.page.getByTestId('compact-my-share')).not.toContainText('700')
  const modalText = await l.page.getByRole('dialog').first().innerText()
  for (const needle of ['2.600', '2600', '1.400', '1400']) expect(modalText).not.toContain(needle)
  await l.page.getByTestId('parts-cost-reveal').click()
  await expect(l.page.getByTestId('compact-my-share')).toHaveText(/^700\b/)
  await expect(l.page.getByTestId('compact-partner-share')).toHaveText(/^700\b/)
  await expect(l.page.getByTestId('net-profit-value')).toContainText('1.400')
  await expect(value).toContainText('2.600')
  await expect(value).toHaveAttribute('data-masked', 'false')
  await l.page.getByTestId('details-close-footer').focus() // focus leaves the eye
  await expect(value).toHaveAttribute('data-masked', 'true')

  // payments untouched by the cost
  await expect(l.page.getByTestId('record-payment-section')).toHaveCount(0)
  await closeDetails(l.page)

  // the report follows: 4000 revenue, 2600 cost, 1400 net => 700 / 700
  await go('reports')
  await l.page.getByTestId('period-all_time').click()
  await expect(l.page.getByTestId('stat-revenue')).toContainText('4.000')
  await expect(l.page.getByTestId('stat-parts-cost')).toContainText('2.600')
  await expect(l.page.getByTestId('stat-net-profit')).toContainText('1.400')
  await expect(l.page.getByTestId('stat-my-share')).toContainText('700')
  await expect(l.page.getByTestId('stat-partner-share')).toContainText('700')
  await expect(l.page.getByTestId('report-provisional-alert')).toHaveCount(0)
  await expect(l.page.getByTestId('ledger-provisional')).toHaveCount(0)

  // and the list no longer flags it
  await go('tickets')
  await expect(l.page.getByTestId('missing-cost-banner')).toHaveCount(0)
  await expect(l.page.getByTestId('row-missing-cost')).toHaveCount(0)
})

test('(d) editing the cost again moves the shares; clearing it makes the profit provisional again', async () => {
  await openDetailsByBarcode(l.page, barcodeNoCost)
  await saveCostFromDetails('2000')
  await revealDetails()
  await expect(l.page.getByTestId('compact-my-share')).toHaveText(/^1\.000\b/)
  await expect(l.page.getByTestId('net-profit-value')).toContainText('2.000')

  await l.page.getByTestId('parts-cost-edit').click()
  await l.page.getByTestId('parts-cost-clear').click()
  await expect(l.page.getByTestId('parts-cost-dialog')).toHaveCount(0)
  await expect(l.page.getByTestId('profit-provisional-badge')).toBeVisible()
  await revealDetails()
  await expect(l.page.getByTestId('compact-my-share')).toHaveText(/^2\.000\b/)

  await saveCostFromDetails('2600') // back to the documented example
  await revealDetails()
  await expect(l.page.getByTestId('compact-my-share')).toHaveText(/^700\b/)

  // invalid text is refused inside the dialog and nothing changes
  await l.page.getByTestId('parts-cost-edit').click()
  await l.page.getByTestId('parts-cost-dialog-input').fill('12x')
  await l.page.getByTestId('parts-cost-save').click()
  await expect(l.page.getByTestId('parts-cost-error')).toBeVisible()
  await l.page.keyboard.press('Escape')
  await revealDetails()
  await expect(l.page.getByTestId('compact-my-share')).toHaveText(/^700\b/)
  await closeDetails(l.page)
})

// ---------------------------------------------------------------------------------------------
test('(e) a cost above the price asks for a confirmation; the loss is shared like a profit', async () => {
  await fillAndSubmit({ name: 'Loss Customer', phone: '0555000003', price: 3000, category: CATEGORY, cost: '3500' })
  // the loss dialog appears and nothing has been created yet
  const dialog = l.page.getByTestId('loss-confirm-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).not.toContainText('3500')
  await expect(dialog).not.toContainText('3.500')
  await expect(l.page.getByTestId('ticket-created-banner')).toHaveCount(0)

  // "review the values" cancels
  await l.page.getByTestId('loss-confirm-cancel').click()
  await expect(dialog).toHaveCount(0)
  await expect(l.page.getByTestId('ticket-created-banner')).toHaveCount(0)

  // submit again and accept
  await l.page.getByTestId('new-ticket-form').locator('button[type="submit"]').click()
  await expect(dialog).toBeVisible()
  await l.page.getByTestId('loss-confirm-accept').click()
  await l.page.getByTestId('ticket-created-banner').waitFor()
  barcodeLoss = ((await l.page.getByTestId('ticket-created-barcode').textContent()) ?? '').trim()
  await expect(l.page.getByTestId('ticket-created-no-cost-warning')).toHaveCount(0)

  // delivering a loss: negative shares in the delivery dialog, allowed
  await go('tickets')
  await openDetailsByBarcode(l.page, barcodeLoss)
  await l.page.getByTestId('status-to-ready').click()
  await l.page.getByTestId('open-delivery').click()
  await expect(l.page.getByTestId('delivery-loss-note')).toBeVisible()
  await revealDelivery()
  await expect(l.page.getByTestId('share-owner-amount')).toContainText('250')
  await expect(l.page.getByTestId('share-owner-amount')).toContainText(MINUS)
  await expect(l.page.getByTestId('share-partner-amount')).toContainText(MINUS)
  await l.page.getByTestId('confirm-delivery').click()
  await l.page.getByTestId('status-back-to-ready').waitFor()
  await expect(l.page.getByTestId('profit-loss-badge')).toBeVisible()
  await revealDetails()
  await expect(l.page.getByTestId('compact-my-share')).toContainText('250')
  await expect(l.page.getByTestId('compact-my-share')).toContainText(MINUS)
  await expect(l.page.getByTestId('net-profit-value')).toContainText('500')

  // raising the cost above the price from the details needs the same confirmation
  await saveCostFromDetails('3200')
  await expect(l.page.getByTestId('loss-confirm-dialog')).toBeVisible()
  await l.page.getByTestId('loss-confirm-cancel').click()
  await expect(l.page.getByTestId('loss-confirm-dialog')).toHaveCount(0)
  await l.page.getByTestId('parts-cost-save').click()
  await l.page.getByTestId('loss-confirm-accept').click()
  await expect(l.page.getByTestId('parts-cost-dialog')).toHaveCount(0)
  await revealDetails()
  await expect(l.page.getByTestId('net-profit-value')).toContainText('200')
  await expect(l.page.getByTestId('compact-my-share')).toContainText('100')
  await closeDetails(l.page)

  // the report shows the loss in the danger colour
  await go('reports')
  await l.page.getByTestId('period-all_time').click()
  await expect(l.page.getByTestId('stat-loss-count')).toHaveCount(1)
  await expect(l.page.getByTestId('ledger-loss')).toHaveCount(1)
  await expect(l.page.getByTestId('stat-net-profit')).toContainText('1.200') // 1400 - 200
})

// ---------------------------------------------------------------------------------------------
test('(f) the cost never reaches the label: print preview from the new-ticket banner and from the details', async () => {
  const COST = '7431'
  const barcode = await submitAndGetBarcode({
    name: 'Label Customer',
    phone: '0555000004',
    price: 9000,
    category: CATEGORY,
    cost: COST
  })

  await l.app.evaluate(({ ipcMain }) => {
    const g = globalThis as unknown as { __prints: unknown[] }
    g.__prints = []
    ipcMain.removeHandler('printer:printLabel')
    ipcMain.handle('printer:printLabel', (_e, labelData) => {
      g.__prints.push(labelData)
      return { success: true }
    })
  })

  // 1) preview opened from the success banner
  await l.page.getByTestId('ticket-created-print').click()
  await l.page.getByTestId('print-submit').waitFor()
  const previewHtml = await l.page.getByRole('dialog').first().innerHTML()
  expect(previewHtml).toContain(barcode)
  let html = withoutBarcodeArt(previewHtml, barcode)
  for (const needle of [COST, '7.431', '7,431']) expect(html).not.toContain(needle)
  await l.page.getByTestId('print-submit').click()
  await l.page.getByTestId('print-close').click()
  await l.page.getByTestId('print-submit').waitFor({ state: 'hidden' })

  // 2) preview opened from the details of the same ticket (after revealing the cost there)
  await go('tickets')
  await openDetailsByBarcode(l.page, barcode)
  await l.page.getByTestId('parts-cost-reveal').click()
  await expect(l.page.getByTestId('parts-cost-value')).toContainText('7.431')
  await l.page.getByTestId('details-reprint').click()
  await l.page.getByTestId('print-submit').waitFor()
  html = withoutBarcodeArt(await l.page.getByRole('dialog').last().innerHTML(), barcode)
  for (const needle of [COST, '7.431', '7,431']) expect(html).not.toContain(needle)
  await l.page.getByTestId('print-submit').click()
  await l.page.getByTestId('print-close').click()
  await l.page.getByTestId('print-submit').waitFor({ state: 'hidden' })

  // 3) what the main process was asked to print: no cost anywhere in the payload
  const prints = await l.app.evaluate(() => (globalThis as unknown as { __prints: unknown[] }).__prints)
  expect(prints.length).toBeGreaterThanOrEqual(2)
  const payload = JSON.stringify(
    (prints as Array<Record<string, unknown>>).map(
      ({ svgContent, barcode: code, ...rest }) => (void svgContent, void code, rest)
    )
  )
  for (const needle of [COST, '7.431', '7,431', 'parts_cost', 'partsCost']) expect(payload).not.toContain(needle)
  await closeDetails(l.page)

  // 4) reprint from the list row
  await go('tickets')
  await l.page.locator('tbody tr').first().getByTestId('row-print').click()
  await l.page.getByTestId('print-submit').waitFor()
  html = withoutBarcodeArt(await l.page.getByRole('dialog').first().innerHTML(), barcode)
  for (const needle of [COST, '7.431', '7,431']) expect(html).not.toContain(needle)
  await l.page.getByTestId('print-close').click()
  await l.page.getByTestId('print-submit').waitFor({ state: 'hidden' })
})

// ---------------------------------------------------------------------------------------------
test('(d) reports: the ledger with its net-profit column still fits at 1280 and 1440 (no horizontal scroll)', async () => {
  await go('reports')
  await l.page.getByTestId('period-all_time').click()
  for (const width of [1280, 1440]) {
    await l.app.evaluate(({ BrowserWindow }, w) => BrowserWindow.getAllWindows()[0].setSize(w, 800), width)
    await expect(l.page.locator('tbody tr').first()).toBeVisible()
    await expect
      .poll(() =>
        l.page.evaluate(() => {
          const wrap = document.querySelector('table')!.parentElement!
          return (
            wrap.scrollWidth <= wrap.clientWidth &&
            document.documentElement.scrollWidth <= document.documentElement.clientWidth
          )
        })
      )
      .toBe(true)
  }
})

// ---------------------------------------------------------------------------------------------
// T004b
async function apiTicket(
  category: number,
  price: number,
  cost: number | null
): Promise<{ id: number; barcode: string }> {
  return l.page.evaluate(
    async ([cat, p, c]) => {
      const res = await (
        window as unknown as {
          api: { createTicket: (d: unknown) => Promise<{ data: { ticketId: number; barcode: string } }> }
        }
      ).api.createTicket({
        customer: { name: `API ${Math.random()}`, phone: `0555${Math.floor(Math.random() * 900000 + 100000)}` },
        device: { brand: 'Realme', model: 'C51' },
        ticket: {
          repair_category_id: cat,
          price: p,
          payment_type: 'credit',
          amount_paid: 1000,
          technician_id: 1,
          parts_cost: c
        }
      })
      return { id: res.data.ticketId, barcode: res.data.barcode }
    },
    [category, price, cost] as [number, number, number | null]
  )
}

test('(T004b) turning the category switch on does not make old tickets "missing a cost"', async () => {
  // category 4 (general) has its switch off: an old ticket is created now
  const oldTicket = await apiTicket(4, 2000, null)
  await go('settings')
  await l.page.getByTestId('settings-tab-categories').click()
  const card = l.page.getByTestId('settings-category-card').filter({ hasText: PLAIN_CATEGORY })
  await card.getByTestId('settings-category-requires-cost').click()
  await expect(card.getByTestId('settings-category-cost-badge')).toBeVisible()

  await go('tickets')
  await l.page.getByTestId('filter-missing_cost').click()
  const rows = l.page.locator('tbody tr')
  await expect(rows.filter({ hasText: oldTicket.barcode })).toHaveCount(0)

  // a ticket created AFTER the switch is on does count
  const fresh = await apiTicket(4, 2000, null)
  await go('settings')
  await l.page.getByTestId('settings-tab-categories').waitFor()
  await go('tickets')
  await l.page.getByTestId('tickets-search').waitFor()
  await expect(rows.filter({ hasText: fresh.barcode })).toHaveCount(1) // listed (unfiltered) first
  await l.page.getByTestId('filter-missing_cost').click()
  await expect(rows.filter({ hasText: fresh.barcode })).toHaveCount(1)
  await expect(rows.filter({ hasText: oldTicket.barcode })).toHaveCount(0)
  await l.page.getByTestId('filter-all').click()
  await expect(rows.filter({ hasText: oldTicket.barcode }).getByTestId('row-missing-cost')).toHaveCount(0)

  // the cost can still be added by hand to the old ticket (net profit as usual)
  await openDetailsByBarcode(l.page, oldTicket.barcode)
  await saveCostFromDetails('500')
  await expect(l.page.getByTestId('parts-cost-dialog')).toHaveCount(0)
  await revealDetails()
  await expect(l.page.getByTestId('net-profit-value')).toContainText('1.500')
  await closeDetails(l.page)

  // switching it off again does not touch existing tickets either
  await go('settings')
  await l.page.getByTestId('settings-tab-categories').click()
  await card.getByTestId('settings-category-requires-cost').click()
  await expect(l.page.getByTestId('settings-category-cost-badge')).toHaveCount(1) // only the first category still requires one
  await go('tickets')
  await l.page.getByTestId('tickets-search').waitFor()
  await l.page.getByTestId('filter-missing_cost').click()
  await expect(rows.filter({ hasText: fresh.barcode })).toHaveCount(1)
  await l.page.getByTestId('filter-all').click()
})

test('(T004b) the delivery dialog hides the profit split until asked, and hides it again on close', async () => {
  const t = await apiTicket(2, 4000, 2600)
  await go('tickets')
  await openDetailsByBarcode(l.page, t.barcode)
  await l.page.getByTestId('status-to-ready').click()
  await l.page.getByTestId('open-delivery').click()
  const dialog = l.page.getByRole('dialog').last()

  // before the click: not in the visible DOM (no shares, no net profit, no percentage), debt + options are
  await expect(l.page.getByTestId('delivery-profit-hidden')).toBeVisible()
  await expect(l.page.getByTestId('profit-shares')).toHaveCount(0)
  await expect(l.page.getByTestId('share-owner-amount')).toHaveCount(0)
  const hiddenText = await dialog.innerText()
  for (const needle of ['700', '1.400', '1400', '50%', '2.600']) expect(hiddenText).not.toContain(needle)
  expect(await dialog.innerHTML()).not.toContain('1.400')
  await expect(dialog).toContainText('3.000') // the amount the customer still owes is always visible
  await expect(l.page.getByTestId('settle-full')).toBeVisible()
  await expect(l.page.getByTestId('settle-credit')).toBeVisible()
  await expect(l.page.getByTestId('confirm-delivery')).toBeEnabled()

  // after the click: shown
  await l.page.getByTestId('delivery-profit-toggle').click()
  await expect(l.page.getByTestId('share-owner-amount')).toContainText('700')
  await expect(l.page.getByTestId('share-partner-amount')).toContainText('700')
  await expect(l.page.getByTestId('profit-shares')).toContainText('1.400')

  // closing the dialog hides it again
  await l.page.keyboard.press('Escape')
  await l.page.getByTestId('open-delivery').click()
  await expect(l.page.getByTestId('delivery-profit-hidden')).toBeVisible()
  await expect(l.page.getByTestId('share-owner-amount')).toHaveCount(0)

  // delivering without ever showing it works
  await l.page.getByTestId('confirm-delivery').click()
  await l.page.getByTestId('status-back-to-ready').waitFor()

  // the details: price visible; cost, net profit and shares are hidden until the eye is pressed
  await expect(l.page.getByTestId('parts-cost-section')).toContainText('4.000')
  await expect(l.page.getByTestId('net-profit-value')).not.toContainText('1.400')
  await expect(l.page.getByTestId('compact-my-share')).not.toContainText('700')
  await expect(l.page.getByTestId('parts-cost-value')).not.toContainText('2.600')
  const section = await l.page.getByTestId('parts-cost-section').innerText()
  for (const needle of ['2.600', '1.400', '700']) expect(section).not.toContain(needle)
  await l.page.getByTestId('parts-cost-reveal').click()
  await expect(l.page.getByTestId('parts-cost-value')).toContainText('2.600')
  await expect(l.page.getByTestId('net-profit-value')).toContainText('1.400')
  await expect(l.page.getByTestId('compact-my-share')).toContainText('700')
  await closeDetails(l.page)
})
