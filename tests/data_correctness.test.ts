import Database from 'better-sqlite3'
import { initializeSchema } from '../src/database/schema'
import { seedInitialData } from '../src/database/seed'
import { createTicket, recordPayment, updateTicketStatus, getTicketById } from '../src/database/queries/tickets'
import { addRepairCategory, updateRepairCategory } from '../src/database/queries/metadata'
import { searchCustomers } from '../src/database/queries/customers'
import type { CreateTicketDTO } from '../src/shared/types'

console.log('--- Running Data Correctness Tests (customers, partial payment, debt payment, split validation) ---')

let passed = true
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`✅ ${name}`)
  else {
    console.error(`❌ ${name} ${detail}`)
    passed = false
  }
}
function throws(fn: () => unknown): string | null {
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

const dto = (over: {
  customer?: CreateTicketDTO['customer']
  price?: number
  paid?: number
  type?: 'cash' | 'credit'
}): CreateTicketDTO => ({
  customer: over.customer ?? { name: 'أحمد', phone: '0555123456' },
  device: { brand: 'Samsung', model: 'Galaxy A54' },
  ticket: {
    repair_category_id: 1,
    price: over.price ?? 5000,
    payment_type: over.type ?? 'cash',
    amount_paid: over.paid ?? 5000,
    technician_id: 1
  },
  accessory_ids: []
})
const customerCount = (): number => (db.prepare(`SELECT COUNT(*) c FROM Customer`).get() as { c: number }).c

// ---- B2: customers are never renamed silently ----
{
  const t1 = createTicket(db, dto({ customer: { name: 'أحمد بن علي', phone: '0555123456', notes: 'n1' } }))
  const c1 = getTicketById(db, t1.ticketId)!.customer

  // same phone, DIFFERENT name -> a new customer, the old one is untouched
  const t2 = createTicket(db, dto({ customer: { name: 'محمد', phone: '0555123456' } }))
  const c2 = getTicketById(db, t2.ticketId)!.customer
  check('same phone + different name creates a new customer', c2.id !== c1.id)
  check('existing customer keeps its name', (db.prepare(`SELECT name FROM Customer WHERE id = ?`).get(c1.id) as { name: string }).name === 'أحمد بن علي')

  // same phone + same name (extra spaces / case) -> reused
  const before = customerCount()
  const t3 = createTicket(db, dto({ customer: { name: '  أحمد   بن  علي ', phone: '0555 123 456' } }))
  check('same phone + same name (normalised) reuses the customer', getTicketById(db, t3.ticketId)!.customer.id === c1.id && customerCount() === before)

  const tl = createTicket(db, dto({ customer: { name: 'Karim Test', phone: '0777000111' } }))
  const tl2 = createTicket(db, dto({ customer: { name: 'KARIM  test', phone: '0777000111' } }))
  check('name comparison is case-insensitive', getTicketById(db, tl.ticketId)!.customer.id === getTicketById(db, tl2.ticketId)!.customer.id)

  // explicit id but the form no longer matches -> not a rename of that customer
  const t4 = createTicket(db, dto({ customer: { id: c1.id, name: 'شخص آخر', phone: '0666999888' } }))
  const c4 = getTicketById(db, t4.ticketId)!.customer
  check('explicit id with different name/phone does not rename the stored customer', c4.id !== c1.id && (db.prepare(`SELECT name, phone FROM Customer WHERE id = ?`).get(c1.id) as { name: string; phone: string }).name === 'أحمد بن علي')

  // explicit id with matching data -> reused
  const t5 = createTicket(db, dto({ customer: { id: c1.id, name: 'أحمد بن علي', phone: '0555123456' } }))
  check('explicit id with matching data is reused', getTicketById(db, t5.ticketId)!.customer.id === c1.id)

  check('searching by phone finds the matching customers', searchCustomers(db, '0555123456').length >= 2)
}

// ---- B6: partial payment at creation => credit ----
{
  const partial = createTicket(db, dto({ price: 5000, paid: 2000, type: 'cash' }))
  const p = getTicketById(db, partial.ticketId)!.ticket
  check('partial payment at creation is stored as credit even if the form said cash', p.payment_type === 'credit' && p.amount_remaining === 3000)
  const full = createTicket(db, dto({ price: 5000, paid: 5000, type: 'cash' }))
  check('full payment at creation stays cash', getTicketById(db, full.ticketId)!.ticket.payment_type === 'cash')
}

// ---- B3: debt payment after delivery ----
{
  const t = createTicket(db, dto({ price: 6000, paid: 1000, type: 'credit' }))
  updateTicketStatus(db, { ticketId: t.ticketId, newStatus: 'ready' })
  updateTicketStatus(db, { ticketId: t.ticketId, newStatus: 'delivered' })
  const delivered = getTicketById(db, t.ticketId)!
  const logsBefore = delivered.statusLogs.length
  const sharesBefore = [delivered.ticket.my_share, delivered.ticket.partner_share]
  const readyAtBefore = delivered.ready_at

  const afterPartial = recordPayment(db, t.ticketId, 2000)
  check('partial debt payment updates paid/remaining', afterPartial.amount_paid === 3000 && afterPartial.amount_remaining === 3000)
  check('partial debt payment keeps credit and delivered status', afterPartial.payment_type === 'credit' && afterPartial.status === 'delivered')

  check('rejects zero / negative / NaN amounts', throws(() => recordPayment(db, t.ticketId, 0)) !== null && throws(() => recordPayment(db, t.ticketId, -5)) !== null && throws(() => recordPayment(db, t.ticketId, NaN)) !== null)
  check('rejects an amount above the remaining balance', throws(() => recordPayment(db, t.ticketId, 3001)) !== null)
  check('rejected payments changed nothing', getTicketById(db, t.ticketId)!.ticket.amount_remaining === 3000)

  const afterFull = recordPayment(db, t.ticketId, 3000)
  check('full settlement zeroes the debt and flips to cash', afterFull.amount_remaining === 0 && afterFull.payment_type === 'cash')
  const finalDetails = getTicketById(db, t.ticketId)!
  check('no StatusLog entry was added', finalDetails.statusLogs.length === logsBefore)
  check('profit shares are unchanged', finalDetails.ticket.my_share === sharesBefore[0] && finalDetails.ticket.partner_share === sharesBefore[1])
  check('delivery date (ready_at) is unchanged and status still delivered', finalDetails.ready_at === readyAtBefore && finalDetails.ticket.status === 'delivered')
  check('paying a settled ticket is rejected', throws(() => recordPayment(db, t.ticketId, 1)) !== null)
  check('unknown ticket is rejected', throws(() => recordPayment(db, 999999, 10)) !== null)
}

// ---- B7: split percentage validation ----
{
  const bad: unknown[] = [NaN, Infinity, undefined, null, '', 'abc', {}]
  for (const value of bad) {
    const msgAdd = throws(() => addRepairCategory(db, `cat-${String(value)}`, value as number))
    check(`addRepairCategory rejects ${JSON.stringify(value) ?? String(value)} with a clear message`, msgAdd !== null && msgAdd.includes('نسبة'))
  }
  const cat = addRepairCategory(db, 'اختبار نسبة', 45)
  check('valid split is accepted', cat.default_split_percentage === 45)
  check('updateRepairCategory rejects NaN', throws(() => updateRepairCategory(db, cat.id, 'اختبار نسبة', NaN)) !== null)
  check('rejected update left the old value', (db.prepare(`SELECT default_split_percentage p FROM RepairCategory WHERE id = ?`).get(cat.id) as { p: number }).p === 45)
  updateRepairCategory(db, cat.id, 'اختبار نسبة', '60' as unknown as number)
  check('numeric strings are coerced', (db.prepare(`SELECT default_split_percentage p FROM RepairCategory WHERE id = ?`).get(cat.id) as { p: number }).p === 60)
}

if (!passed) process.exit(1)
console.log('\n🎉 ALL DATA CORRECTNESS TESTS PASSED! 🎉')
process.exit(0)
