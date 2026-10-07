import { test, expect } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { launchApp, shutdownApp, openDetailsByBarcode, closeDetails, type Launched } from './helpers'

// Editing a ticket, end to end on the built app.
//  (a) not delivered: device + accessories + price -> list, details and history follow
//  (b) delivered: price 4000 -> 5000 (cost 2600, 50%) after a review -> shares 1200 / 1200, reports follow
//  (c) delivered: technician -> partner after a review -> 0 / net
//  (d) the customer record: "N tickets" note, the change shows on every ticket of the customer
//  (e) a printed field changed -> "reprint the label?" -> the preview shows the new name, same code
//  (f) the parts cost in the history is masked until the eye is clicked
//  (g) the wrong customer: attach the ticket to another one, nobody is renamed
//  (h) the price can never go below the amount paid
// Every test starts its own app on fresh data and creates its tickets through the app's API, so any test can run alone.

let l: Launched
const CATEGORY = 'بطارية ومنفذ شحن' // seeded, 50%
const OTHER_CATEGORY = 'صيانة بورد وسوفتوير' // seeded, 70%

test.beforeEach(async () => {
  l = await launchApp('edit')
})
test.afterEach(async () => {
  try {
    expect(l.problems, 'renderer errors').toEqual([])
  } finally {
    await shutdownApp(l)
  }
})

interface ApiTicket {
  name: string
  phone: string
  customerId?: number
  category?: string
  price: number
  paid?: number
  cost?: number | null
  partner?: boolean
  deliver?: boolean
  accessories?: string[]
}

/** Creates (and optionally delivers) a ticket through the app's API; returns its id, barcode and customer id. */
async function apiTicket(o: ApiTicket): Promise<{ id: number; barcode: string; customerId: number }> {
  const result = await l.page.evaluate(
    async (t) => {
      const meta = (await window.api.getMetadata()).data
      if (!meta) return { error: 'no metadata' }
      const category = meta.repairCategories.find((c) => c.name === t.category)
      const technician = meta.technicians.find((x) => x.is_partner === Boolean(t.partner))
      if (!category || !technician) return { error: 'no category / technician' }
      const paid = t.paid ?? t.price
      const created = await window.api.createTicket({
        customer: { ...(t.customerId ? { id: t.customerId } : {}), name: t.name, phone: t.phone },
        device: { brand: 'Realme', model: 'C51' },
        ticket: {
          repair_category_id: category.id,
          price: t.price,
          payment_type: paid >= t.price ? 'cash' : 'credit',
          amount_paid: paid,
          technician_id: technician.id,
          parts_cost: t.cost ?? null
        },
        accessory_ids: meta.accessories.filter((a) => (t.accessories ?? []).includes(a.name)).map((a) => a.id)
      })
      if (!created.success || !created.data) return { error: created.error ?? 'create failed' }
      if (t.deliver) {
        for (const newStatus of ['ready', 'delivered'] as const) {
          const res = await window.api.updateTicketStatus({ ticketId: created.data.ticketId, newStatus })
          if (!res.success) return { error: res.error ?? `${newStatus} failed` }
        }
      }
      const details = (await window.api.getTicketById(created.data.ticketId)).data
      return { id: created.data.ticketId, barcode: created.data.barcode, customerId: details?.customer.id ?? 0 }
    },
    { ...o, category: o.category ?? CATEGORY }
  )
  expect(result.error).toBeUndefined()
  return result as { id: number; barcode: string; customerId: number }
}

/** The stored ticket, read through the API (the numbers the reports use). */
async function stored(id: number) {
  return l.page.evaluate(async (ticketId) => (await window.api.getTicketById(ticketId)).data, id)
}

async function openEdit(): Promise<Locator> {
  await l.page.getByTestId('details-edit').click()
  const dialog = l.page.getByTestId('edit-ticket-dialog')
  await dialog.getByTestId('edit-ticket-form').waitFor()
  return dialog
}

async function revealDetails(): Promise<void> {
  const eye = l.page.getByTestId('parts-cost-reveal')
  if ((await eye.getAttribute('aria-pressed')) !== 'true') await eye.click()
}

/** Toasts can sit over buttons: wait until they are gone before the next click there. */
const waitForToasts = (): Promise<void> =>
  expect(l.page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 })

test('not delivered: device, accessories and price are saved; the list, the details and the history follow', async () => {
  const t = await apiTicket({ name: 'Edit One', phone: '0550100001', price: 3000, paid: 1000, accessories: ['شاحن'] })
  await l.page.getByTestId('nav-tickets').click()
  await openDetailsByBarcode(l.page, t.barcode)
  const dialog = await openEdit()

  // The form starts from the saved ticket
  await expect(dialog.getByTestId('device-brand')).toHaveValue('Realme')
  await expect(dialog.getByTestId('payment-price')).toHaveValue('3000')
  await expect(dialog.getByRole('button', { name: 'شاحن' })).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog.getByTestId('edit-delivered-banner')).toHaveCount(0)

  await dialog.getByTestId('device-brand').fill('Samsung')
  await dialog.getByTestId('device-model').fill('Galaxy A54')
  await dialog.getByRole('heading').first().click() // close the type-ahead list
  await expect(dialog.getByTestId('device-short-label')).toHaveValue('SA A54') // regenerated: it was not typed
  await dialog.getByRole('button', { name: 'شريحة SIM' }).click()
  await dialog.getByTestId('payment-price').fill('3500')
  await dialog.getByTestId('edit-save').click()

  // Not delivered, nothing lowered: saved without a review
  await expect(l.page.getByTestId('edit-ticket-dialog')).toHaveCount(0)
  await expect(l.page.getByTestId('edit-review-dialog')).toHaveCount(0)
  // The short label is printed on the label: a new one is offered
  await l.page.getByTestId('reprint-later').click()
  await expect(l.page.getByTestId('reprint-prompt')).toHaveCount(0)
  const details = l.page.getByRole('dialog')
  await expect(details).toContainText('Samsung Galaxy A54')
  await expect(details).toContainText('شريحة SIM')
  await expect(details).toContainText('3.500')
  await expect(details).toContainText('2.500') // remaining = 3500 - 1000

  const edits = l.page.getByTestId('history-edit')
  await expect(edits).toHaveCount(1)
  await expect(edits.getByTestId('edit-change-brand')).toContainText('Realme')
  await expect(edits.getByTestId('edit-change-brand')).toContainText('Samsung')
  await expect(edits.getByTestId('edit-change-model')).toContainText('Galaxy A54')
  await expect(edits.getByTestId('edit-change-short_label')).toContainText('SA A54')
  await expect(edits.getByTestId('edit-change-accessories')).toContainText('شاحن, شريحة SIM')
  await expect(edits.getByTestId('edit-change-price')).toContainText('3.000')
  await expect(edits.getByTestId('edit-change-price')).toContainText('3.500')

  const s = await stored(t.id)
  expect([s?.ticket.price, s?.ticket.amount_remaining, s?.ticket.status, s?.ticket.my_share]).toEqual([
    3500,
    2500,
    'in_progress',
    null
  ])
  expect(s?.ticket.barcode_code).toBe(t.barcode)

  // The list row follows
  await closeDetails(l.page)
  await l.page.getByTestId('tickets-search').fill(t.barcode)
  await expect(l.page.locator('tbody tr')).toHaveCount(1)
  await expect(l.page.locator('tbody tr').first()).toContainText('Galaxy A54')
})

test('delivered: the price change is reviewed first, then the shares and the reports follow (5000 - 2600 at 50%)', async () => {
  const t = await apiTicket({ name: 'Edit Two', phone: '0550100002', price: 4000, cost: 2600, deliver: true })
  expect([(await stored(t.id))?.ticket.my_share, (await stored(t.id))?.ticket.partner_share]).toEqual([700, 700])
  await openDetailsByBarcode(l.page, t.barcode)
  const dialog = await openEdit()
  await expect(dialog.getByTestId('edit-delivered-banner')).toBeVisible()

  await dialog.getByTestId('payment-price').fill('5000')
  await dialog.getByTestId('payment-paid').fill('5000')
  await dialog.getByTestId('edit-save').click()

  const review = l.page.getByTestId('edit-review-dialog')
  await expect(review).toBeVisible()
  await expect(review.getByTestId('edit-review-delivered')).toContainText('سيُعاد حساب')
  await expect(review.getByTestId('edit-change-price')).toContainText('4.000')
  await expect(review.getByTestId('edit-change-price')).toContainText('5.000')
  // Nothing is saved until confirmed
  expect((await stored(t.id))?.ticket.price).toBe(4000)
  await review.getByTestId('edit-review-confirm').click()
  await expect(review).toHaveCount(0)
  await expect(l.page.getByTestId('edit-ticket-dialog')).toHaveCount(0)

  await revealDetails()
  await expect(l.page.getByTestId('net-profit-value')).toContainText('2.400')
  await expect(l.page.getByTestId('compact-my-share')).toContainText('1.200')
  await expect(l.page.getByTestId('compact-partner-share')).toContainText('1.200')
  const s = await stored(t.id)
  expect([s?.ticket.my_share, s?.ticket.partner_share, s?.ticket.split_percentage_applied, s?.ticket.status]).toEqual([
    1200,
    1200,
    50,
    'delivered'
  ])

  await closeDetails(l.page)
  await waitForToasts()
  await l.page.getByTestId('nav-reports').click()
  await l.page.getByTestId('period-all_time').click()
  await expect(l.page.getByTestId('stat-net-profit')).toContainText('2.400')
  await expect(l.page.getByTestId('stat-my-share')).toContainText('1.200')
  await expect(l.page.getByTestId('stat-partner-share')).toContainText('1.200')
})

test('delivered: technician changed to the partner -> 0 / the whole net profit', async () => {
  const t = await apiTicket({ name: 'Edit Three', phone: '0550100003', price: 4000, cost: 2600, deliver: true })
  const partnerId = await l.page.evaluate(
    async () => (await window.api.getMetadata()).data?.technicians.find((x) => x.is_partner)?.id
  )
  await openDetailsByBarcode(l.page, t.barcode)
  const dialog = await openEdit()
  await dialog.getByTestId(`technician-${partnerId}`).click()
  await dialog.getByTestId('edit-save').click()
  const review = l.page.getByTestId('edit-review-dialog')
  await expect(review.getByTestId('edit-change-technician')).toContainText('الشريك')
  await review.getByTestId('edit-review-confirm').click()
  await expect(review).toHaveCount(0)

  await revealDetails()
  await expect(l.page.getByTestId('compact-my-share')).toContainText('0')
  await expect(l.page.getByTestId('compact-partner-share')).toContainText('1.400')
  await expect(l.page.getByTestId('compact-partner-share')).toContainText('100%')
  const s = await stored(t.id)
  expect([s?.ticket.my_share, s?.ticket.partner_share, s?.ticket.split_percentage_applied]).toEqual([0, 1400, null])
  expect(s?.ticket.technician).toBe('الشريك')
})

test('the customer record: the form says how many tickets it has, and the change shows on all of them', async () => {
  const first = await apiTicket({ name: 'Ali Edit', phone: '0550100004', price: 1000 })
  const second = await apiTicket({ customerId: first.customerId, name: 'Ali Edit', phone: '0550100004', price: 2000 })
  await openDetailsByBarcode(l.page, first.barcode)
  const dialog = await openEdit()
  await expect(dialog.getByTestId('edit-customer-ticket-count')).toContainText('2')
  await expect(dialog.getByTestId('edit-customer-name')).toHaveValue('Ali Edit')
  await dialog.getByTestId('edit-customer-phone').fill('0550100099')
  await dialog.getByTestId('edit-save').click()
  await expect(l.page.getByTestId('edit-ticket-dialog')).toHaveCount(0)
  // The phone is printed on the label: offer a new one, then decline
  await l.page.getByTestId('reprint-later').click()
  await expect(l.page.getByTestId('reprint-prompt')).toHaveCount(0)
  await closeDetails(l.page)

  await openDetailsByBarcode(l.page, second.barcode)
  await expect(l.page.getByRole('dialog')).toContainText('0550100099')
  await expect(l.page.getByTestId('history-edit')).toHaveCount(0) // the edit is logged on the edited ticket
  await openEdit()
  await expect(l.page.getByTestId('edit-customer-ticket-count')).toContainText('2')
})

test('a printed field changed: "reprint the label?" opens the preview with the new name and the same code', async () => {
  const t = await apiTicket({ name: 'Old Name', phone: '0550100005', price: 1000 })
  await openDetailsByBarcode(l.page, t.barcode)

  // A change that is not on the label: no prompt
  let dialog = await openEdit()
  await dialog.getByTestId('payment-price').fill('1200')
  await dialog.getByTestId('edit-save').click()
  await expect(l.page.getByTestId('edit-ticket-dialog')).toHaveCount(0)
  await expect(l.page.getByTestId('history-edit')).toHaveCount(1)
  await expect(l.page.getByTestId('reprint-prompt')).toHaveCount(0)

  dialog = await openEdit()
  await dialog.getByTestId('edit-customer-name').fill('New Name')
  await dialog.getByTestId('edit-save').click()
  const prompt = l.page.getByTestId('reprint-prompt')
  await expect(prompt).toBeVisible()
  await prompt.getByTestId('reprint-now').click()
  await expect(prompt).toHaveCount(0)
  await l.page.getByTestId('print-submit').waitFor()
  const preview = l.page.getByRole('dialog').filter({ has: l.page.getByTestId('print-submit') })
  await expect(preview).toContainText('New Name')
  await expect(preview).not.toContainText('Old Name')
  await expect(preview).toContainText(t.barcode)
})

test('the parts cost in the history stays masked until the eye is clicked', async () => {
  const t = await apiTicket({ name: 'Cost Edit', phone: '0550100006', price: 4000, cost: 2600 })
  await openDetailsByBarcode(l.page, t.barcode)
  const dialog = await openEdit()
  const cost = dialog.getByTestId('edit-parts-cost')
  await expect(cost).toHaveValue('2600')
  await expect(cost).toHaveCSS('-webkit-text-security', 'disc') // masked in the form too
  await cost.fill('3100')
  await dialog.getByTestId('edit-save').click()
  await expect(l.page.getByTestId('edit-ticket-dialog')).toHaveCount(0)

  const line = l.page.getByTestId('history-edit').getByTestId('edit-change-parts_cost')
  await expect(line).toHaveAttribute('data-masked', 'true')
  await expect(line).not.toContainText('2.600')
  await expect(line).not.toContainText('3.100')
  await expect(line).toContainText('••••••')
  await l.page.getByTestId('history-edit').getByTestId('edit-cost-reveal').click()
  await expect(line).toHaveAttribute('data-masked', 'false')
  await expect(line).toContainText('2.600')
  await expect(line).toContainText('3.100')
  expect((await stored(t.id))?.ticket.parts_cost).toBe(3100)
})

test('the wrong customer: the ticket is attached to another one, and nobody is renamed', async () => {
  const sara = await apiTicket({ name: 'Sara Edit', phone: '0550100007', price: 1000 })
  const t = await apiTicket({ name: 'Wrong Person', phone: '0550100008', price: 1500, category: OTHER_CATEGORY })
  await openDetailsByBarcode(l.page, t.barcode)
  const dialog = await openEdit()
  await dialog.getByTestId('edit-customer-reassign').click()
  // The New Ticket picker: typing the phone offers the registered customer
  await dialog.locator('input[type="text"]').nth(1).fill('0550100007')
  await dialog.getByTestId('phone-match').first().click()
  await dialog.getByTestId('edit-save').click()
  await expect(l.page.getByTestId('edit-ticket-dialog')).toHaveCount(0)
  await l.page.getByTestId('reprint-later').click()

  await expect(l.page.getByTestId('history-edit').getByTestId('edit-change-customer')).toContainText('Sara Edit')
  const s = await stored(t.id)
  expect(s?.customer.id).toBe(sara.customerId)
  expect((await stored(sara.id))?.customer.name).toBe('Sara Edit')
  // The mistaken customer had no other ticket: it is gone, nobody was renamed into it
  const left = await l.page.evaluate(async () => (await window.api.searchCustomers('Wrong Person')).data ?? [])
  expect(left).toEqual([])
})

test('the price can never go below the amount paid', async () => {
  const t = await apiTicket({ name: 'Paid Edit', phone: '0550100009', price: 3000, paid: 2000 })
  await openDetailsByBarcode(l.page, t.barcode)
  const dialog = await openEdit()
  await dialog.getByTestId('payment-price').fill('1500')
  await dialog.getByTestId('edit-save').click()
  await expect(dialog.getByTestId('edit-error')).toContainText('لا يمكن أن يقل عن المبلغ المدفوع')
  await expect(l.page.getByTestId('edit-review-dialog')).toHaveCount(0)
  expect((await stored(t.id))?.ticket.price).toBe(3000)

  // Lowering the paid amount first is allowed, after a review that names the new debt
  await dialog.getByTestId('payment-paid').fill('1000')
  await dialog.getByTestId('edit-save').click()
  const review = l.page.getByTestId('edit-review-dialog')
  await expect(review).toContainText('500') // 1500 - 1000 left to pay
  await review.getByTestId('edit-review-confirm').click()
  await expect(l.page.getByTestId('edit-ticket-dialog')).toHaveCount(0)
  const s = await stored(t.id)
  expect([s?.ticket.price, s?.ticket.amount_paid, s?.ticket.amount_remaining, s?.ticket.payment_type]).toEqual([
    1500,
    1000,
    500,
    'credit'
  ])
})
