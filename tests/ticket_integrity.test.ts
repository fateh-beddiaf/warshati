import Database from 'better-sqlite3'
import { initializeSchema } from '../src/database/schema'
import { seedInitialData } from '../src/database/seed'
import { createTicket, getTicketById, getTicketByBarcode } from '../src/database/queries/tickets'

console.log('--- Running Ticket Integrity Tests (getTicketById with missing Customer/TicketDevice) ---')

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

const make = (phone: string): { ticketId: number; barcode: string } =>
  createTicket(db, {
    customer: { name: 'زبون', phone },
    device: { brand: 'Samsung', model: 'Galaxy A54' },
    ticket: { repair_category_id: 1, price: 1000, payment_type: 'cash', amount_paid: 1000, technician_id: 1 },
    accessory_ids: []
  })

const ok = make('0555000001')
const full = getTicketById(db, ok.ticketId)
check('intact ticket loads with customer and device', !!full && !!full.customer.name && !!full.device.brand)
check('missing ticket id returns null', getTicketById(db, 99999) === null)

db.pragma('foreign_keys = OFF')

const noDevice = make('0555000002')
db.prepare(`DELETE FROM TicketDevice WHERE ticket_id = ?`).run(noDevice.ticketId)
const e1 = throws(() => getTicketById(db, noDevice.ticketId))
check('missing TicketDevice throws a clear Arabic error', !!e1 && e1.includes('بيانات التذكرة ناقصة'), String(e1))

const noCustomer = make('0555000003')
const cid = (
  db.prepare(`SELECT customer_id FROM Ticket WHERE id = ?`).get(noCustomer.ticketId) as { customer_id: number }
).customer_id
db.prepare(`DELETE FROM Customer WHERE id = ?`).run(cid)
const e2 = throws(() => getTicketById(db, noCustomer.ticketId))
check('missing Customer throws a clear Arabic error', !!e2 && e2.includes('بيانات التذكرة ناقصة'), String(e2))

const e3 = throws(() => getTicketByBarcode(db, noCustomer.barcode))
check('getTicketByBarcode propagates the same error', !!e3 && e3.includes('بيانات التذكرة ناقصة'), String(e3))

check('other intact tickets are unaffected', !!getTicketById(db, ok.ticketId))

if (!passed) process.exit(1)
console.log('\n🎉 ALL TICKET INTEGRITY TESTS PASSED! 🎉')
process.exit(0)
