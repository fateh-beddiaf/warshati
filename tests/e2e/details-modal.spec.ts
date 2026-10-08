import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  launchApp,
  shutdownApp,
  createTicket,
  openDetailsByBarcode,
  closeDetails,
  resetUi,
  type Launched
} from './helpers'

// Ticket details modal: internal state is reset between tickets, invalid custom payments are
// rejected, and the debt-payment section works for delivered tickets with a remaining balance.
// One app for the file: beforeAll creates the two tickets the tests share, and every test leaves the modal closed
// and the tickets as it found them, so any test can run alone.

test.describe.configure({ mode: 'serial' })

let l: Launched
let barcodeA = ''
let barcodeB = ''

test.beforeAll(async () => {
  l = await launchApp('details')
  // Two credit tickets moved to ready
  barcodeA = await createTicket(l.page, { name: 'Alpha', phone: '0555000001', price: 5000, paid: 1000, type: 'credit' })
  barcodeB = await createTicket(l.page, { name: 'Beta', phone: '0555000002', price: 4000, paid: 500, type: 'credit' })
  for (const code of [barcodeA, barcodeB]) {
    await openDetailsByBarcode(l.page, code)
    await l.page.getByTestId('status-to-ready').click()
    await l.page.getByTestId('open-delivery').waitFor()
    await closeDetails(l.page)
  }
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

interface Snapshot {
  status: string
  amount_paid: number
  amount_remaining: number
  payment_type: string
}
async function snapshot(barcode: string): Promise<Snapshot> {
  return l.page.evaluate(async (code) => {
    const res = await window.api.getTicketByBarcode(code)
    const t = res.data!.ticket
    return {
      status: t.status,
      amount_paid: t.amount_paid,
      amount_remaining: t.amount_remaining,
      payment_type: t.payment_type
    }
  }, barcode)
}

/** The delivery confirmation is a nested modal dialog: Esc closes only that one (not the details modal). */
async function dismissDeliveryDialog(page: Page): Promise<void> {
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('confirm-delivery')).toHaveCount(0)
  await expect(page.getByTestId('details-close')).toBeVisible()
}

/** Types a barcode like a HID scanner (fast burst + Enter) with no field focused, so the global listener handles it. */
async function scanBarcode(page: Page, code: string): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.keyboard.type(code, { delay: 0 })
  await page.keyboard.press('Enter')
}

test('closing the modal resets the delivery dialog, its fields and messages', async () => {
  const page = l.page
  await openDetailsByBarcode(page, barcodeA)

  await page.getByTestId('open-delivery').click()
  await page.getByTestId('settle-partial').check()
  await page.getByTestId('settle-partial-amount').fill('-500')
  await page.getByTestId('confirm-delivery').click()
  await expect(page.getByTestId('details-error')).toBeVisible()
  await page.getByTestId('settle-partial-amount').fill('777')
  await expect(page.getByTestId('confirm-delivery')).toBeVisible()
  await dismissDeliveryDialog(page)
  await closeDetails(page)

  // ticket B: everything pristine
  await openDetailsByBarcode(page, barcodeB)
  await expect(page.getByTestId('confirm-delivery')).toHaveCount(0)
  await expect(page.getByTestId('details-error')).toHaveCount(0)
  await expect(page.getByTestId('details-success')).toHaveCount(0)
  await page.getByTestId('open-delivery').click()
  await expect(page.getByTestId('settle-full')).toBeChecked()
  await page.getByTestId('settle-partial').check()
  await expect(page.getByTestId('settle-partial-amount')).toHaveValue('')
  await dismissDeliveryDialog(page)
  await closeDetails(page)

  // reopening A (same ticket) also starts clean
  await openDetailsByBarcode(page, barcodeA)
  await expect(page.getByTestId('confirm-delivery')).toHaveCount(0)
  await expect(page.getByTestId('details-error')).toHaveCount(0)
  await closeDetails(page)
})

test('switching to another ticket while a delete dialog is open resets it', async () => {
  const page = l.page
  await openDetailsByBarcode(page, barcodeA)
  await page.getByTestId('details-delete').click()
  await page.getByTestId('delete-next').click()
  await page.getByTestId('delete-next').click()
  await page.getByTestId('delete-confirm-input').fill(barcodeA)
  await expect(page.getByTestId('delete-confirm-input')).toHaveValue(barcodeA)

  // the modal stays open but displays ticket B (a barcode scan: the header field sits behind the
  // modal overlay, so the scan goes through the app-wide scanner listener)
  await scanBarcode(page, barcodeB)
  await expect(page.locator('strong', { hasText: barcodeB }).first()).toBeVisible()
  await expect(page.getByTestId('delete-confirm-input')).toHaveCount(0)
  await expect(page.getByTestId('delete-next')).toHaveCount(0)

  // opening the delete dialog again starts at step 1 with an empty confirmation
  await page.getByTestId('details-delete').click()
  await expect(page.getByTestId('delete-confirm-input')).toHaveCount(0)
  await page.getByTestId('delete-next').click()
  await page.getByTestId('delete-next').click()
  await expect(page.getByTestId('delete-confirm-input')).toHaveValue('')
  // nothing was deleted
  expect((await snapshot(barcodeA)).status).toBe('ready')
  expect((await snapshot(barcodeB)).status).toBe('ready')

  // back out of the delete dialog (step 3) and close the modal
  for (let i = 0; i < 3; i++) await page.getByTestId('delete-back').click()
  await expect(page.getByTestId('delete-back')).toHaveCount(0)
  await closeDetails(page)
})

test('a negative custom payment is rejected and never lowers amount_paid', async () => {
  const page = l.page
  const before = await snapshot(barcodeA)
  await openDetailsByBarcode(page, barcodeA)
  await page.getByTestId('open-delivery').click()
  await page.getByTestId('settle-partial').check()
  await page.getByTestId('settle-partial-amount').fill('-500')
  await page.getByTestId('confirm-delivery').click()
  await expect(page.getByTestId('details-error')).toBeVisible()
  await expect(page.getByTestId('confirm-delivery')).toBeVisible()
  const after = await snapshot(barcodeA)
  expect(after).toEqual(before)
  expect(after.status).toBe('ready')
  expect(after.amount_paid).toBe(1000)
  await dismissDeliveryDialog(page)
  await closeDetails(page)
})

test('debt payment section: partial, overpay, invalid and full settlement', async () => {
  const page = l.page
  const code = await createTicket(page, { name: 'Gamma', phone: '0555000003', price: 5000, paid: 1000, type: 'credit' })
  await openDetailsByBarcode(page, code)

  // not offered before delivery
  await expect(page.getByTestId('record-payment-section')).toHaveCount(0)
  await page.getByTestId('status-to-ready').click()
  await page.getByTestId('open-delivery').waitFor()
  await expect(page.getByTestId('record-payment-section')).toHaveCount(0)

  // deliver as debt (credit)
  await page.getByTestId('open-delivery').click()
  await page.getByTestId('settle-credit').check()
  await page.getByTestId('confirm-delivery').click()
  await page.getByTestId('status-back-to-ready').waitFor()
  await expect(page.getByTestId('record-payment-section')).toBeVisible()
  expect(await snapshot(code)).toMatchObject({
    status: 'delivered',
    amount_paid: 1000,
    amount_remaining: 4000,
    payment_type: 'credit'
  })

  // pay 2000 -> remaining 2000, still delivered, still credit
  await page.getByTestId('record-payment-input').fill('2000')
  await page.getByTestId('record-payment-submit').click()
  await expect(page.getByTestId('details-success')).toBeVisible()
  await expect(page.getByTestId('record-payment-input')).toHaveValue('')
  expect(await snapshot(code)).toMatchObject({
    status: 'delivered',
    amount_paid: 3000,
    amount_remaining: 2000,
    payment_type: 'credit'
  })
  await expect(page.getByTestId('record-payment-section')).toBeVisible()
  await expect(page.getByTestId('status-back-to-ready')).toBeVisible()

  // overpay -> error, nothing changes
  await page.getByTestId('record-payment-input').fill('2500')
  await page.getByTestId('record-payment-submit').click()
  await expect(page.getByTestId('details-error')).toBeVisible()
  expect(await snapshot(code)).toMatchObject({ amount_paid: 3000, amount_remaining: 2000 })

  // zero / negative -> error, nothing changes
  for (const bad of ['0', '-100']) {
    await page.getByTestId('record-payment-input').fill(bad)
    await page.getByTestId('record-payment-submit').click()
    await expect(page.getByTestId('details-error')).toBeVisible()
    expect(await snapshot(code)).toMatchObject({ amount_paid: 3000, amount_remaining: 2000 })
  }

  // pay the exact remaining -> section disappears, payment type becomes cash
  await page.getByTestId('record-payment-input').fill('2000')
  await page.getByTestId('record-payment-submit').click()
  await expect(page.getByTestId('record-payment-section')).toHaveCount(0)
  expect(await snapshot(code)).toMatchObject({
    status: 'delivered',
    amount_paid: 5000,
    amount_remaining: 0,
    payment_type: 'cash'
  })
  await closeDetails(page)
})
