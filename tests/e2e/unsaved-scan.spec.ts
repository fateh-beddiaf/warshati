import { test, expect } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { launchApp, shutdownApp, openDetailsByBarcode, closeDetails, scanCode, type Launched } from './helpers'

// A label scanned while a form holds unsaved changes never throws them away silently.
//  (a) edit form with changes: "Discard them and open ticket X?" with focus on Cancel; Cancel (or Enter) keeps the
//      form exactly as it was; Discard opens the scanned ticket and nothing was saved
//  (b) edit form without changes (or changed and put back): the scan opens the scanned ticket as before
//  (c) New Ticket with changes: same question; Cancel keeps every field (the header search, a barcode field, still
//      receives the scan); Discard empties the form and opens the ticket
//  (d) New Ticket right after saving: the form still shows the saved ticket but has nothing unsaved
// Every test starts its own app on fresh data and creates its tickets through the app's API, so any test can run alone.

let l: Launched

test.beforeEach(async () => {
  l = await launchApp('unsaved')
})
test.afterEach(async () => {
  try {
    expect(l.problems, 'renderer errors').toEqual([])
  } finally {
    await shutdownApp(l)
  }
})

/** Creates a ticket through the app's API (Realme C51, fully paid); returns its id and barcode. */
async function apiTicket(name: string, phone: string, price: number): Promise<{ id: number; barcode: string }> {
  const result = await l.page.evaluate(
    async (t) => {
      const meta = (await window.api.getMetadata()).data
      if (!meta) return { error: 'no metadata' }
      const created = await window.api.createTicket({
        customer: { name: t.name, phone: t.phone },
        device: { brand: 'Realme', model: 'C51' },
        ticket: {
          repair_category_id: meta.repairCategories[0].id,
          price: t.price,
          amount_paid: t.price,
          technician_id: meta.technicians[0].id
        },
        accessory_ids: []
      })
      if (!created.success || !created.data) return { error: created.error ?? 'create failed' }
      return { id: created.data.ticketId, barcode: created.data.barcode }
    },
    { name, phone, price }
  )
  expect(result.error).toBeUndefined()
  return result as { id: number; barcode: string }
}

async function openEdit(): Promise<Locator> {
  await l.page.getByTestId('details-edit').click()
  const dialog = l.page.getByTestId('edit-ticket-dialog')
  await dialog.getByTestId('edit-ticket-form').waitFor()
  return dialog
}

/** The details modal shows this ticket */
const detailsShow = (barcode: string): Promise<void> =>
  expect(l.page.getByRole('dialog').locator('strong', { hasText: barcode }).first()).toBeVisible()

async function expectQuestion(barcode: string): Promise<void> {
  await expect(l.page.getByTestId('unsaved-scan-dialog')).toBeVisible()
  await expect(l.page.getByTestId('unsaved-scan-code')).toHaveText(barcode)
  await expect(l.page.getByTestId('unsaved-scan-cancel')).toBeFocused()
}

test('edit form with unsaved changes: a scan asks first, Cancel keeps the form, Discard opens the scanned ticket', async () => {
  const a = await apiTicket('Unsaved Edit', '0550200001', 3000)
  const b = await apiTicket('Scanned Next', '0550200002', 1500)
  await openDetailsByBarcode(l.page, a.barcode)
  const dialog = await openEdit()

  await dialog.getByTestId('device-model').fill('C53')
  await dialog.getByRole('heading').first().click() // close the type-ahead list
  const price = dialog.getByTestId('payment-price')
  await price.fill('3500')
  await price.focus()

  await scanCode(l.page, b.barcode)
  await expectQuestion(b.barcode)
  await expect(l.page.getByTestId('unsaved-scan-dialog')).toContainText('غير محفوظة')
  // The burst typed into the focused price field was taken back out
  await expect(price).toHaveValue('3500')

  // Enter on the focused Cancel keeps everything: same form, same values, same ticket
  await l.page.keyboard.press('Enter')
  await expect(l.page.getByTestId('unsaved-scan-dialog')).toHaveCount(0)
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText(`#${a.id}`)
  await expect(dialog.getByTestId('device-model')).toHaveValue('C53')
  await expect(price).toHaveValue('3500')
  await expect(price).toBeFocused()

  // Second scan: Discard -> the scanned ticket opens, the edit form is gone and nothing was saved
  await scanCode(l.page, b.barcode)
  await expectQuestion(b.barcode)
  await l.page.getByTestId('unsaved-scan-discard').click()
  await expect(l.page.getByTestId('edit-ticket-dialog')).toHaveCount(0)
  await detailsShow(b.barcode)
  const storedA = await l.page.evaluate(async (id) => (await window.api.getTicketById(id)).data, a.id)
  expect([storedA?.ticket.price, storedA?.device.model, storedA?.editLogs.length]).toEqual([3000, 'C51', 0])
})

test('edit form without unsaved changes: a scan opens the scanned ticket as before', async () => {
  const a = await apiTicket('Clean Edit', '0550200003', 3000)
  const b = await apiTicket('Scanned Clean', '0550200004', 1500)
  await openDetailsByBarcode(l.page, a.barcode)
  await openEdit()

  await scanCode(l.page, b.barcode)
  await detailsShow(b.barcode)
  await expect(l.page.getByTestId('edit-ticket-dialog')).toHaveCount(0)
  await expect(l.page.getByTestId('unsaved-scan-dialog')).toHaveCount(0)

  // Changed and put back = nothing unsaved
  await closeDetails(l.page)
  await openDetailsByBarcode(l.page, a.barcode)
  const price = (await openEdit()).getByTestId('payment-price')
  await price.fill('3500')
  await price.fill('3000')
  await scanCode(l.page, b.barcode)
  await detailsShow(b.barcode)
  await expect(l.page.getByTestId('edit-ticket-dialog')).toHaveCount(0)
  await expect(l.page.getByTestId('unsaved-scan-dialog')).toHaveCount(0)
})

test('New Ticket with unsaved changes: Cancel keeps every field, Discard empties the form and opens the ticket', async () => {
  const b = await apiTicket('Scanned From New', '0550200005', 2000)
  await l.page.getByTestId('nav-new-ticket').click()
  const form = l.page.getByTestId('new-ticket-form')
  const text = form.locator('input[type="text"]')
  await text.nth(0).fill('Half Typed')
  await text.nth(1).fill('0550200006')
  await form.getByTestId('device-brand').fill('Samsung')
  await form.getByTestId('payment-price').fill('4000')
  await l.page.getByTestId('screen-new-ticket').getByRole('heading').first().click() // close the type-ahead list
  await l.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())

  await scanCode(l.page, b.barcode)
  await expectQuestion(b.barcode)
  await l.page.getByTestId('unsaved-scan-cancel').click()
  await expect(l.page.getByTestId('unsaved-scan-dialog')).toHaveCount(0)
  await expect(l.page.getByTestId('details-close')).toBeHidden()
  await expect(text.nth(0)).toHaveValue('Half Typed')
  await expect(text.nth(1)).toHaveValue('0550200006')
  await expect(form.getByTestId('device-brand')).toHaveValue('Samsung')
  await expect(form.getByTestId('payment-price')).toHaveValue('4000')

  // The header search is a barcode field: it still receives the scan, and opening the ticket from it asks too
  const header = l.page.getByTestId('header-barcode-input')
  await header.focus()
  await scanCode(l.page, b.barcode)
  await expectQuestion(b.barcode)
  await l.page.getByTestId('unsaved-scan-cancel').click()
  await expect(text.nth(0)).toHaveValue('Half Typed')

  // Discard: the ticket opens, and the form it replaced is empty afterwards
  await l.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await scanCode(l.page, b.barcode)
  await expectQuestion(b.barcode)
  await l.page.getByTestId('unsaved-scan-discard').click()
  await detailsShow(b.barcode)
  await l.page.getByTestId('details-close').click()
  await l.page.getByTestId('details-close').waitFor({ state: 'hidden' })
  await expect(l.page.getByTestId('screen-new-ticket')).toBeVisible()
  await expect(text.nth(0)).toHaveValue('')
  await expect(text.nth(1)).toHaveValue('')
  await expect(form.getByTestId('device-brand')).toHaveValue('')
  await expect(form.getByTestId('payment-price')).toHaveValue('')

  // Nothing typed any more: the next scan opens straight away
  await scanCode(l.page, b.barcode)
  await detailsShow(b.barcode)
  await expect(l.page.getByTestId('unsaved-scan-dialog')).toHaveCount(0)
})

test('New Ticket right after saving: the saved ticket on screen is not an unsaved change', async () => {
  const b = await apiTicket('Scanned After Save', '0550200007', 2000)
  await l.page.getByTestId('nav-new-ticket').click()
  const form = l.page.getByTestId('new-ticket-form')
  const text = form.locator('input[type="text"]')
  await text.nth(0).fill('Saved Customer')
  await text.nth(1).fill('0550200008')
  await form.getByTestId('device-brand').fill('Samsung')
  await form.getByTestId('device-model').fill('Galaxy A54')
  await form.getByTestId('payment-price').fill('2500')
  await form.getByTestId('payment-paid').fill('2500')
  await form.locator('button[type="submit"]').click()
  await l.page.getByTestId('ticket-created-banner').waitFor()

  await scanCode(l.page, b.barcode)
  await detailsShow(b.barcode)
  await expect(l.page.getByTestId('unsaved-scan-dialog')).toHaveCount(0)
  await closeDetails(l.page)

  // Typing over the saved values is a change again
  await l.page.getByTestId('nav-new-ticket').click()
  await expect(text.nth(0)).toHaveValue('Saved Customer')
  await text.nth(0).fill('Saved Customer 2')
  await l.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await scanCode(l.page, b.barcode)
  await expectQuestion(b.barcode)
  await l.page.getByTestId('unsaved-scan-cancel').click()
  await expect(text.nth(0)).toHaveValue('Saved Customer 2')
})
