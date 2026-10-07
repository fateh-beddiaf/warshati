import Database from 'better-sqlite3'
import { initializeSchema } from '../src/database/schema'
import { seedInitialData } from '../src/database/seed'
import {
  createTicket,
  updateTicketStatus,
  setPartsCost,
  getTicketById,
  deleteTicket
} from '../src/database/queries/tickets'
import { updateTicket } from '../src/database/queries/ticket-edit'
import { getFinancialReport } from '../src/database/queries/reports'
import { addRepairCategory, addTechnician, updateRepairCategory } from '../src/database/queries/metadata'
import { assertUpdateTicketPatch } from '../src/main/ipc-validate'
import type { CreateTicketDTO, UpdateTicketPatch } from '../src/shared/types'

// Ticket editing (updateTicket): every profit recalculation rule, payments, the customer record vs attaching the
// ticket to another customer, the edit history (TicketEditLog), forbidden fields, and full rollback on any error.

let failures = 0
function eq<T>(actual: T, expected: T, message: string): void {
  if (Object.is(actual, expected) || JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`✅ ${message}`)
  } else {
    failures++
    console.error(`❌ ${message}\n   expected: ${JSON.stringify(expected)}\n   actual:   ${JSON.stringify(actual)}`)
  }
}
function throwsMessage(fn: () => unknown): string | null {
  try {
    fn()
    return null
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

const db = new Database(':memory:')
db.pragma('foreign_keys = ON')
initializeSchema(db)
seedInitialData(db)

type Row = Record<string, unknown>
const one = (sql: string, ...p: unknown[]): Row => db.prepare(sql).get(...p) as Row
const all = (sql: string, ...p: unknown[]): Row[] => db.prepare(sql).all(...p) as Row[]
/** Every row of every table: proves an edit that failed left NOTHING behind. */
const dump = (): string =>
  JSON.stringify(
    [
      'Customer',
      'Ticket',
      'TicketDevice',
      'TicketAccessories',
      'StatusLog',
      'TicketEditLog',
      'RepairCategory',
      'Technician'
    ].map((t) => all(`SELECT * FROM ${t} ORDER BY 1, 2`))
  )
const ticketRow = (id: number): Row => one(`SELECT * FROM Ticket WHERE id = ?`, id)
const logs = (id: number): Row[] =>
  all(`SELECT field, old_value, new_value FROM TicketEditLog WHERE ticket_id = ? ORDER BY id`, id)
const shares = (id: number): [unknown, unknown, unknown] => {
  const r = ticketRow(id)
  return [r.my_share, r.partner_share, r.split_percentage_applied]
}

const techs = all(`SELECT id, is_partner FROM Technician ORDER BY id`) as { id: number; is_partner: number }[]
const ME = techs.find((t) => !t.is_partner)!.id
const PARTNER = techs.find((t) => t.is_partner)!.id
const HELPER = addTechnician(db, 'فني مساعد').id // a second non-partner technician

const cat50 = addRepairCategory(db, 'شاشات 50 (اختبار)', 50, true) // requires a cost
const cat70 = addRepairCategory(db, 'بورد 70 (اختبار)', 70, false)
const cat40 = addRepairCategory(db, 'عام 40 (اختبار)', 40, false)
const acc = all(`SELECT id, name FROM Accessories ORDER BY id`) as { id: number; name: string }[]
const CHARGER = acc.find((a) => a.name === 'شاحن')!
const SIM = acc.find((a) => a.name === 'شريحة SIM')!
const COVER = acc.find((a) => a.name === 'كفر / جراب')!

let phoneSeq = 660000000
function mk(o: {
  price: number
  paid?: number
  cat?: number
  tech?: number
  cost?: number | null
  customer?: { id?: number; name: string; phone: string }
  accessories?: number[]
}): number {
  const dto: CreateTicketDTO = {
    customer: o.customer ?? { name: `Customer ${phoneSeq}`, phone: `0${phoneSeq++}` },
    device: { brand: 'Realme', model: 'C51' },
    ticket: {
      repair_category_id: o.cat ?? cat50.id,
      price: o.price,
      payment_type: (o.paid ?? o.price) >= o.price ? 'cash' : 'credit',
      amount_paid: o.paid ?? o.price,
      technician_id: o.tech ?? ME,
      ...(o.cost !== undefined ? { parts_cost: o.cost } : {})
    },
    accessory_ids: o.accessories ?? []
  }
  return createTicket(db, dto).ticketId
}
const deliver = (id: number): void => {
  updateTicketStatus(db, { ticketId: id, newStatus: 'ready' })
  updateTicketStatus(db, { ticketId: id, newStatus: 'delivered' })
}
const edit = (id: number, patch: UpdateTicketPatch) => updateTicket(db, id, patch)

// =============================================================================================
console.log('\n--- 1. Non-delivered ticket: device + accessories + price, edit log exact ---')
{
  const id = mk({ price: 3000, paid: 1000, accessories: [CHARGER.id] })
  const before = ticketRow(id)
  const statusLogs = all(`SELECT * FROM StatusLog WHERE ticket_id = ?`, id)
  const result = edit(id, {
    device: { brand: 'Samsung', model: 'Galaxy A54', short_label: '' },
    accessory_ids: [CHARGER.id, SIM.id],
    price: 3500
  })
  eq(
    result.changedFields,
    ['brand', 'model', 'short_label', 'accessories', 'price'],
    'changedFields lists exactly the changed fields'
  )
  const d = result.details
  eq(
    [d.device.brand, d.device.model, d.device.short_label],
    ['Samsung', 'Galaxy A54', 'SA A54'],
    'device saved, empty label regenerated'
  )
  eq(
    d.accessories.map((a) => a.name),
    [CHARGER.name, SIM.name],
    'accessories replaced'
  )
  eq(
    [d.ticket.price, d.ticket.amount_paid, d.ticket.amount_remaining, d.ticket.payment_type],
    [3500, 1000, 2500, 'credit'],
    'price saved, remaining recomputed'
  )
  eq(shares(id), [null, null, null], 'not delivered: no shares computed')
  eq(
    [d.ticket.barcode_code, d.ticket.created_at, d.ticket.status],
    [before.barcode_code, before.created_at, before.status],
    'barcode, created_at and status untouched'
  )
  eq(all(`SELECT * FROM StatusLog WHERE ticket_id = ?`, id), statusLogs, 'StatusLog untouched')
  eq(
    logs(id),
    [
      { field: 'brand', old_value: 'Realme', new_value: 'Samsung' },
      { field: 'model', old_value: 'C51', new_value: 'Galaxy A54' },
      { field: 'short_label', old_value: 'RL C51', new_value: 'SA A54' },
      { field: 'accessories', old_value: CHARGER.name, new_value: `${CHARGER.name}, ${SIM.name}` },
      { field: 'price', old_value: '3000', new_value: '3500' }
    ],
    'one TicketEditLog row per changed field, readable values'
  )
  const stamps = all(`SELECT DISTINCT timestamp FROM TicketEditLog WHERE ticket_id = ?`, id)
  eq(stamps.length, 1, 'all rows of one edit share one timestamp')
  eq(d.editLogs.length, 5, 'getTicketById returns the edit history')

  // A second, empty-ish edit: nothing differs -> nothing written
  const again = edit(id, { price: 3500, accessory_ids: [SIM.id, CHARGER.id, SIM.id] })
  eq(again.changedFields, [], 'same values (accessories in another order, duplicates) = no change')
  eq(logs(id).length, 5, 'a no-op edit writes no history row')

  // Accessories cleared
  edit(id, { accessory_ids: [] })
  eq(
    logs(id).slice(-1),
    [{ field: 'accessories', old_value: `${CHARGER.name}, ${SIM.name}`, new_value: null }],
    'cleared accessories log NULL'
  )
  // An explicit short label is kept as typed (trimmed)
  edit(id, { device: { brand: 'Samsung', model: 'Galaxy A54', short_label: '  ABC 1 ' } })
  eq(getTicketById(db, id)!.device.short_label, 'ABC 1', 'explicit short label kept (trimmed)')
}

// =============================================================================================
console.log('\n--- 2. Delivered: price change (4000 / 2600 at 50% -> 700/700; price 5000 -> 1200/1200) ---')
{
  const id = mk({ price: 4000, cost: 2600, cat: cat50.id })
  deliver(id)
  eq(shares(id), [700, 700, 50], 'delivered: 1400 net at 50% = 700 / 700')

  const before = dump()
  const refused = throwsMessage(() => edit(id, { price: 5000 }))
  eq(refused !== null && refused.includes('مسلَّمة'), true, 'a delivered ticket needs confirm_delivered')
  eq(dump(), before, 'refused edit changed nothing')

  // The category percentage changes in Settings: the frozen 50% must still be used
  updateRepairCategory(db, cat50.id, cat50.name, 90)
  const r = edit(id, { price: 5000, amount_paid: 5000, confirm_delivered: true })
  eq(shares(id), [1200, 1200, 50], 'price 5000 - 2600 = 2400 at the FROZEN 50% = 1200 / 1200')
  eq([r.details.ticket.amount_remaining, r.details.ticket.payment_type], [0, 'cash'], 'payment follows the new price')
  eq(r.details.ticket.status, 'delivered', 'status unchanged')

  const report = getFinancialReport(db, { period: 'all_time', categoryFilter: cat50.id })
  const inReport = report.tickets.find((t) => t.id === id)!
  eq(
    [inReport.my_share, inReport.partner_share, inReport.net_profit],
    [1200, 1200, 2400],
    'the report reads the new shares'
  )

  // Price raised without raising the paid amount: a debt appears
  edit(id, { price: 6000, confirm_delivered: true })
  eq(
    [ticketRow(id).amount_remaining, ticketRow(id).payment_type],
    [1000, 'credit'],
    'price above paid = remaining + credit'
  )
  eq(shares(id), [1700, 1700, 50], '6000 - 2600 = 3400 -> 1700 / 1700')
  updateRepairCategory(db, cat50.id, cat50.name, 50)
}

// =============================================================================================
console.log('\n--- 3. Delivered: parts cost change uses the frozen percentage ---')
{
  const id = mk({ price: 4000, cost: 2600, cat: cat50.id })
  deliver(id)
  updateRepairCategory(db, cat50.id, cat50.name, 80)
  edit(id, { parts_cost: 3000, confirm_delivered: true })
  eq(shares(id), [500, 500, 50], 'cost 3000 -> net 1000 at the frozen 50%')
  edit(id, { parts_cost: null, confirm_delivered: true })
  eq(shares(id), [2000, 2000, 50], 'cost cleared -> provisional on the price, still 50%')
  edit(id, { parts_cost: 4500, confirm_delivered: true })
  eq(shares(id), [-250, -250, 50], 'a loss is split by the same rule (negative shares)')
  eq(
    logs(id).map((l) => [l.old_value, l.new_value]),
    [
      ['2600', '3000'],
      ['3000', null],
      [null, '4500']
    ],
    'cost edits logged (NULL = not entered)'
  )
  updateRepairCategory(db, cat50.id, cat50.name, 50)
}

// =============================================================================================
console.log('\n--- 4. Delivered: technician <-> partner ---')
{
  const id = mk({ price: 4000, cost: 2600, cat: cat50.id })
  deliver(id)
  edit(id, { technician_id: PARTNER, confirm_delivered: true })
  eq(shares(id), [0, 1400, null], 'to the partner: 0 / net, frozen percentage cleared')
  eq(ticketRow(id).technician_id, PARTNER, 'technician id updated')
  eq(ticketRow(id).technician, 'الشريك', 'technician name snapshot updated')
  eq(logs(id), [{ field: 'technician', old_value: 'أنا', new_value: 'الشريك' }], 'technician change logged by name')

  // Back to a non-partner: no frozen value -> the category's CURRENT percentage, which is then frozen
  updateRepairCategory(db, cat50.id, cat50.name, 40)
  edit(id, { technician_id: ME, confirm_delivered: true })
  eq(shares(id), [560, 840, 40], 'partner -> me: category current 40% -> 560 / 840, frozen 40')
  updateRepairCategory(db, cat50.id, cat50.name, 50)
  edit(id, { price: 4600, amount_paid: 4600, confirm_delivered: true })
  eq(shares(id), [800, 1200, 40], 'the new frozen 40% is used afterwards (2000 -> 800 / 1200)')

  // Non-partner -> another non-partner: the frozen value stays
  edit(id, { technician_id: HELPER, confirm_delivered: true })
  eq(shares(id), [800, 1200, 40], 'me -> another non-partner technician keeps the frozen 40%')

  // Partner ticket from the start, moved to me
  const p = mk({ price: 4000, cost: 2600, cat: cat70.id, tech: PARTNER })
  deliver(p)
  eq(shares(p), [0, 1400, null], 'partner ticket delivered: 0 / 1400')
  edit(p, { technician_id: ME, confirm_delivered: true })
  eq(shares(p), [980, 420, 70], 'partner -> me on a 70% category: 980 / 420, frozen 70')
}

// =============================================================================================
console.log('\n--- 5. Category change: re-freeze from the NEW category, re-snapshot parts_cost_required ---')
{
  const id = mk({ price: 4000, cost: 2600, cat: cat50.id })
  deliver(id)
  eq(ticketRow(id).parts_cost_required, 1, 'created in a category that requires a cost')
  const r = edit(id, { repair_category_id: cat70.id, confirm_delivered: true })
  eq(shares(id), [980, 420, 70], 'new category 70%: 1400 -> 980 / 420, frozen 70')
  eq(ticketRow(id).parts_cost_required, 0, 'parts_cost_required re-snapshotted from the new category')
  eq(r.details.category?.id, cat70.id, 'category saved')
  eq(
    logs(id),
    [{ field: 'repair_category', old_value: cat50.name, new_value: cat70.name }],
    'category change logged by name'
  )

  // Back to the 50% category whose percentage changed in the meantime: its CURRENT percentage is frozen
  updateRepairCategory(db, cat50.id, cat50.name, 60)
  edit(id, { repair_category_id: cat50.id, confirm_delivered: true })
  eq(shares(id), [840, 560, 60], 'back to the first category at its current 60%')
  eq(ticketRow(id).parts_cost_required, 1, 'snapshot follows the category again')
  updateRepairCategory(db, cat50.id, cat50.name, 50)

  // A delivered ticket without a cost moved into a category that requires one becomes provisional
  const plain = mk({ price: 2000, cat: cat40.id })
  deliver(plain)
  eq(shares(plain), [800, 1200, 40], 'no cost, 40%: 800 / 1200')
  edit(plain, { repair_category_id: cat50.id, confirm_delivered: true })
  eq(shares(plain), [1000, 1000, 50], 'moved to 50%: 1000 / 1000')
  const report = getFinancialReport(db, { period: 'all_time' })
  eq(report.tickets.find((t) => t.id === plain)?.is_provisional, true, 'now provisional (its category requires a cost)')

  // Category AND technician to the partner in one edit: the partner rule wins
  edit(plain, { repair_category_id: cat70.id, technician_id: PARTNER, confirm_delivered: true })
  eq(shares(plain), [0, 2000, null], 'category + partner together: 0 / net, nothing frozen')

  // Not delivered: the category is just saved (no shares), but the snapshot still follows the category
  const open = mk({ price: 1000, cat: cat40.id })
  edit(open, { repair_category_id: cat50.id })
  eq(
    [ticketRow(open).parts_cost_required, ...shares(open)],
    [1, null, null, null],
    'not delivered: snapshot updated, no shares'
  )
  updateTicketStatus(db, { ticketId: open, newStatus: 'ready' })
  updateTicketStatus(db, { ticketId: open, newStatus: 'delivered' })
  eq(shares(open), [500, 500, 50], 'delivered later with the edited category')
}

// =============================================================================================
console.log('\n--- 6. Delivered: fields that do not touch the profit keep the frozen shares ---')
{
  const id = mk({ price: 4000, cost: 2600, cat: cat50.id })
  deliver(id)
  updateRepairCategory(db, cat50.id, cat50.name, 90)
  edit(id, { accessory_ids: [COVER.id], device: { brand: 'Realme', model: 'C55' }, confirm_delivered: true })
  eq(shares(id), [700, 700, 50], 'accessories / device edits do not recompute (and never pick up the new 90%)')
  updateRepairCategory(db, cat50.id, cat50.name, 50)
}

// =============================================================================================
console.log('\n--- 7. Payments ---')
{
  const id = mk({ price: 4000, paid: 3000 })
  const before = dump()
  let msg = throwsMessage(() => edit(id, { price: 2500 }))
  eq(msg !== null && msg.includes('لا يمكن أن يقل عن المبلغ المدفوع'), true, 'price below the paid amount is rejected')
  eq(dump(), before, 'rejected: nothing changed')
  msg = throwsMessage(() => edit(id, { amount_paid: 4500 }))
  eq(msg !== null && msg.includes('لا يمكن أن يتجاوز'), true, 'paid above the price is rejected')
  eq(dump(), before, 'rejected: nothing changed')
  msg = throwsMessage(() => edit(id, { price: -1 }))
  eq(msg !== null && msg.includes('سعر الإصلاح'), true, 'negative price rejected')

  // Lowering the paid amount needs a confirmation (creates / increases a debt)
  msg = throwsMessage(() => edit(id, { amount_paid: 1000 }))
  eq(msg !== null && msg.includes('تأكيداً'), true, 'paid lowered without confirmation is rejected')
  eq(dump(), before, 'rejected: nothing changed')
  edit(id, { amount_paid: 1000, confirm_paid_lowered: true })
  eq(
    [ticketRow(id).amount_paid, ticketRow(id).amount_remaining, ticketRow(id).payment_type],
    [1000, 3000, 'credit'],
    'paid lowered -> debt 3000, credit'
  )

  // Price lowered to the paid amount + both at once
  edit(id, { price: 2500, amount_paid: 2500, payment_type: 'cash' })
  eq([ticketRow(id).amount_remaining, ticketRow(id).payment_type], [0, 'cash'], 'fully paid with cash chosen')
  // A partial payment is a debt whatever the requested type
  edit(id, { price: 3000, payment_type: 'cash' })
  eq([ticketRow(id).amount_remaining, ticketRow(id).payment_type], [500, 'credit'], 'partial -> credit forced')
  eq(
    logs(id).slice(-2),
    [
      { field: 'price', old_value: '2500', new_value: '3000' },
      { field: 'payment_type', old_value: 'cash', new_value: 'credit' }
    ],
    'payment type change logged'
  )
  // Price lowered to exactly the paid amount: accepted
  edit(id, { price: 2500 })
  eq(ticketRow(id).amount_remaining, 0, 'price = paid accepted, nothing left to pay')
}

// =============================================================================================
console.log('\n--- 8. Forbidden / unknown fields ---')
{
  const id = mk({ price: 1000 })
  const before = dump()
  const forbidden: Record<string, unknown>[] = [
    { barcode_code: '20000000' },
    { created_at: '2020-01-01T00:00:00.000Z' },
    { status: 'delivered' },
    { my_share: 5 },
    { split_percentage_applied: 10 },
    { technician: 'X' },
    { id: 99 },
    { price: 1500, status: 'ready' },
    { customer: { id: 2, name: 'A', phone: '0555' } },
    { device: { brand: 'A', model: 'B', ticket_id: 3 } },
    { reassign_customer: { name: 'A', phone: '0555', barcode_code: 'x' } }
  ]
  for (const patch of forbidden) {
    const msg = throwsMessage(() => edit(id, patch as UpdateTicketPatch))
    eq(msg !== null && msg.includes('غير قابل للتعديل'), true, `rejected: ${JSON.stringify(patch)}`)
  }
  eq(dump(), before, 'no forbidden edit changed anything')
  eq(
    throwsMessage(() =>
      edit(id, { customer: { name: 'A', phone: '1' }, reassign_customer: { name: 'B', phone: '2' } })
    ) !== null,
    true,
    'customer edit and reattachment together are rejected'
  )
  eq(throwsMessage(() => edit(999999, { price: 1 }))?.includes('غير موجودة'), true, 'unknown ticket rejected')
}

// =============================================================================================
console.log('\n--- 9. Rollback: an error anywhere leaves the database exactly as it was ---')
{
  const customer = { name: 'Rollback Customer', phone: '0770000001' }
  const id = mk({ price: 2000, customer, accessories: [CHARGER.id] })
  const before = dump()
  const cases: [string, UpdateTicketPatch][] = [
    ['unknown technician', { customer: { name: 'New Name', phone: '0770000001' }, price: 2500, technician_id: 99999 }],
    ['unknown category', { device: { brand: 'Samsung', model: 'Galaxy A54' }, repair_category_id: 99999 }],
    ['unknown accessory', { price: 2200, accessory_ids: [CHARGER.id, 99999] }],
    ['model of another brand', { price: 2200, device: { brand: 'X', model: 'Y', brand_id: 1, model_id: 999999 } }],
    ['invalid cost', { price: 2200, parts_cost: -5 }],
    ['empty customer name', { price: 2200, customer: { name: '   ', phone: '0770000001' } }]
  ]
  for (const [label, patch] of cases) {
    eq(throwsMessage(() => edit(id, patch)) !== null, true, `rejected: ${label}`)
    eq(dump(), before, `nothing changed after: ${label}`)
  }

  // A failure while WRITING (after validation): the history insert is made to fail -> everything rolls back
  db.exec(
    `CREATE TEMP TRIGGER fail_edit_log BEFORE INSERT ON TicketEditLog BEGIN SELECT RAISE(ABORT, 'disk full'); END`
  )
  const msg = throwsMessage(() =>
    edit(id, {
      customer: { name: 'Renamed', phone: '0770000099' },
      device: { brand: 'Samsung', model: 'Galaxy A54' },
      accessory_ids: [SIM.id],
      price: 2600
    })
  )
  db.exec(`DROP TRIGGER fail_edit_log`)
  eq(msg, 'disk full', 'the log write failed')
  eq(dump(), before, 'customer, device, accessories and price were all rolled back with it')
}

// =============================================================================================
console.log('\n--- 10. Customer record vs attaching to another customer ---')
{
  const ali = { name: 'Ali Test', phone: '0661111111' }
  const t1 = mk({ price: 1000, customer: ali })
  const aliId = ticketRow(t1).customer_id as number
  const t2 = mk({ price: 1000, customer: { id: aliId, ...ali } })
  eq(ticketRow(t2).customer_id, aliId, 'two tickets, one customer')
  eq(getTicketById(db, t1)!.customerTicketCount, 2, 'details tell how many tickets the customer has')

  // Editing the record changes it for every ticket of that customer
  const r = edit(t1, { customer: { name: 'Ali  Ben Test ', phone: '0661111112', notes: 'VIP' } })
  eq(r.changedFields, ['customer_name', 'customer_phone', 'customer_notes'], 'name, phone, notes changed')
  eq(getTicketById(db, t2)!.customer.name, 'Ali Ben Test', 'the other ticket shows the new name (cleaned)')
  eq(getTicketById(db, t2)!.customer.phone, '0661111112', 'and the new phone')
  eq(
    logs(t1),
    [
      { field: 'customer_name', old_value: 'Ali Test', new_value: 'Ali Ben Test' },
      { field: 'customer_phone', old_value: '0661111111', new_value: '0661111112' },
      { field: 'customer_notes', old_value: null, new_value: 'VIP' }
    ],
    'customer edit logged on the edited ticket'
  )
  eq(logs(t2), [], 'the other ticket has no edit of its own')
  edit(t1, { customer: { name: 'Ali Ben Test', phone: '0661111112' } })
  eq(getTicketById(db, t1)!.customer.notes, 'VIP', 'notes omitted = kept')
  edit(t1, { customer: { name: 'Ali Ben Test', phone: '0661111112', notes: '' } })
  eq(getTicketById(db, t1)!.customer.notes, null, 'notes "" = cleared')

  // Renaming into another existing customer is refused (never two records for one person)
  const sara = { name: 'Sara Test', phone: '0662222222' }
  const t3 = mk({ price: 1000, customer: sara })
  const saraId = ticketRow(t3).customer_id as number
  const before = dump()
  const msg = throwsMessage(() => edit(t1, { customer: { name: 'sara  test', phone: '0662 222 222' } }))
  eq(
    msg !== null && msg.includes('ربط التذكرة بزبون آخر'),
    true,
    'renaming into another customer is refused, pointing at "attach"'
  )
  eq(dump(), before, 'nothing changed')

  // Attach t1 to Sara (picked from the list: id + matching name/phone)
  const moved = edit(t1, { reassign_customer: { id: saraId, ...sara } })
  eq(moved.details.customer.id, saraId, 'ticket attached to the picked customer')
  eq(getTicketById(db, t2)!.customer.name, 'Ali Ben Test', 'the old customer is NOT renamed')
  eq(one(`SELECT COUNT(*) c FROM Customer WHERE id = ?`, aliId).c, 1, 'old customer kept: still has a ticket')
  eq(
    logs(t1).slice(-1),
    [{ field: 'customer', old_value: 'Ali Ben Test · 0661111112', new_value: 'Sara Test · 0662222222' }],
    'reattachment logged as name · phone'
  )

  // An id whose name no longer matches the form = someone else: a NEW customer (the New Ticket matching rule), Sara untouched
  edit(t1, { reassign_customer: { id: saraId, name: 'Karim Test', phone: '0662222222' } })
  const karim = getTicketById(db, t1)!.customer
  eq([karim.name, karim.id !== saraId], ['Karim Test', true], 'mismatched id -> a new customer, never a rename')
  eq(one(`SELECT name FROM Customer WHERE id = ?`, saraId).name, 'Sara Test', 'Sara is untouched')

  // Typed name + phone that match an existing customer exactly (no id) -> that customer
  edit(t1, { reassign_customer: { name: ' ali ben test', phone: '0661 111 112' } })
  eq(ticketRow(t1).customer_id, aliId, 'exact name + phone match -> the existing customer')
  eq(one(`SELECT COUNT(*) c FROM Customer WHERE id = ?`, karim.id).c, 0, 'the customer left without tickets is removed')

  // Same customer again: no change
  eq(
    edit(t1, { reassign_customer: { id: aliId, name: 'Ali Ben Test', phone: '0661111112' } }).changedFields,
    [],
    'reattaching to the same customer = no change'
  )
}

// =============================================================================================
console.log('\n--- 11. Delivered ticket: reattachment / customer edit also need the confirmation ---')
{
  const id = mk({ price: 1000, cost: 0 })
  deliver(id)
  const before = dump()
  eq(
    throwsMessage(() => edit(id, { reassign_customer: { name: 'Other', phone: '0663333333' } }))?.includes('مسلَّمة'),
    true,
    'reattach refused without confirm'
  )
  eq(
    throwsMessage(() => edit(id, { accessory_ids: [SIM.id] }))?.includes('مسلَّمة'),
    true,
    'accessories refused without confirm'
  )
  eq(dump(), before, 'nothing changed')
  eq(edit(id, { confirm_delivered: true }).changedFields, [], 'only a confirmation = nothing to do')
}

// =============================================================================================
console.log('\n--- 12. setPartsCost writes the history too; deleting a ticket removes its history ---')
{
  const id = mk({ price: 3000 })
  setPartsCost(db, id, 1200)
  setPartsCost(db, id, 1200)
  setPartsCost(db, id, null)
  eq(
    logs(id),
    [
      { field: 'parts_cost', old_value: null, new_value: '1200' },
      { field: 'parts_cost', old_value: '1200', new_value: null }
    ],
    'cost set and cleared are logged; the same value again is not'
  )
  deleteTicket(db, id)
  eq(one(`SELECT COUNT(*) c FROM TicketEditLog WHERE ticket_id = ?`, id).c, 0, 'history removed with the ticket')
}

// =============================================================================================
console.log('\n--- 13. IPC guard: strict patch shape ---')
{
  const ok = (patch: unknown): boolean => throwsMessage(() => assertUpdateTicketPatch(patch)) === null
  eq(ok({ price: 5000, confirm_delivered: true }), true, 'a valid patch passes')
  eq(
    ok({ customer: { name: 'A', phone: '1', notes: '' }, device: { brand: 'A', model: 'B', short_label: '' } }),
    true,
    'customer + device pass'
  )
  eq(ok({ parts_cost: null }), true, 'parts_cost null passes')
  eq(ok({ status: 'delivered' }), false, 'status refused')
  eq(ok({ barcode_code: '1' }), false, 'barcode refused')
  eq(ok({ created_at: 'x' }), false, 'created_at refused')
  eq(ok({ customer: { id: 1, name: 'A', phone: '1' } }), false, 'customer.id refused (use reassign_customer)')
  eq(ok({ price: '5000' }), false, 'a string price refused')
  eq(ok({ price: Number.NaN }), false, 'NaN refused')
  eq(ok({ accessory_ids: [1, 0] }), false, 'a bad accessory id refused')
  eq(ok({ payment_type: 'card' }), false, 'unknown payment type refused')
  eq(ok({ confirm_delivered: 'yes' }), false, 'a non-boolean confirmation refused')
  eq(ok(null), false, 'null refused')
  eq(ok([]), false, 'an array refused')
}

if (failures > 0) {
  console.error(`\n❌ ${failures} check(s) failed`)
  process.exit(1)
}
console.log('\n✅ ticket edit: all checks passed')
