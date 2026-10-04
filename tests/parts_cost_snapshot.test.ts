import Database from 'better-sqlite3'
import { initializeSchema } from '../src/database/schema'
import { seedInitialData } from '../src/database/seed'
import { addRepairCategory, updateRepairCategory } from '../src/database/queries/metadata'
import { createTicket, getTicketById, getTicketsList, setPartsCost, updateTicketStatus } from '../src/database/queries/tickets'
import { getFinancialReport } from '../src/database/queries/reports'
import { LEGACY_SCHEMA_BEFORE_PARTS_COST } from './fixtures/legacy-schemas'

// T004b: "requires a parts cost" is snapshotted on the ticket at creation. Turning the category switch on
// (or off) later never changes which existing tickets are "missing a cost" / provisional.

let failures = 0
function eq<T>(actual: T, expected: T, message: string): void {
  if (Object.is(actual, expected) || JSON.stringify(actual) === JSON.stringify(expected)) console.log(`✅ ${message}`)
  else {
    failures++
    console.error(`❌ ${message}\n   expected: ${JSON.stringify(expected)}\n   actual:   ${JSON.stringify(actual)}`)
  }
}

const db = new Database(':memory:')
db.pragma('foreign_keys = ON')
initializeSchema(db)
seedInitialData(db)
const cat = addRepairCategory(db, 'شاشات', 50, false) // switch OFF at first
let n = 0
const mk = (cost?: number | null): number =>
  createTicket(db, {
    customer: { name: `S${n}`, phone: `055600${String(n++).padStart(4, '0')}` },
    device: { brand: 'Realme', model: 'C51' },
    ticket: {
      repair_category_id: cat.id,
      price: 4000,
      payment_type: 'cash',
      amount_paid: 4000,
      technician_id: 1,
      ...(cost !== undefined ? { parts_cost: cost } : {})
    }
  }).ticketId
const deliver = (id: number): void => {
  updateTicketStatus(db, { ticketId: id, newStatus: 'ready' })
  updateTicketStatus(db, { ticketId: id, newStatus: 'delivered' })
}
const flag = (id: number): boolean => getTicketsList(db).find((x) => x.id === id)!.parts_cost_missing as boolean
const required = (id: number): unknown => (db.prepare(`SELECT parts_cost_required v FROM Ticket WHERE id = ?`).get(id) as { v: number }).v

console.log('--- snapshot at creation ---')
const oldInProgress = mk()
const oldDelivered = mk()
deliver(oldDelivered)
eq([required(oldInProgress), required(oldDelivered)], [0, 0], 'tickets created while the switch is off snapshot 0')

updateRepairCategory(db, cat.id, 'شاشات', 50, true) // the user turns the switch ON
const newNoCost = mk()
const newWithCost = mk(2600)
eq([required(newNoCost), required(newWithCost)], [1, 1], 'tickets created after the switch is on snapshot 1')

console.log('--- no retroactive effect ---')
eq([flag(oldInProgress), flag(oldDelivered)], [false, false], 'old tickets are NOT "missing a cost" after turning the switch on')
eq(flag(newNoCost), true, 'a new ticket without a cost IS missing it')
eq(flag(newWithCost), false, 'a new ticket with a cost is not')
const report = getFinancialReport(db, { period: 'all_time' })
eq(report.provisionalTicketsCount, 0, 'report: the old delivered ticket is not provisional')
eq(report.tickets.find((t) => t.id === oldDelivered)!.is_provisional, false, 'report row: not provisional')
eq(getTicketById(db, oldDelivered)!.ticket.parts_cost_required, 0, 'details carry the snapshot (0) of the old ticket')

deliver(newNoCost)
eq(getFinancialReport(db, { period: 'all_time' }).provisionalTicketsCount, 1, 'a NEW ticket delivered without a cost is provisional')

console.log('--- turning the switch off later ---')
updateRepairCategory(db, cat.id, 'شاشات', 50, false)
eq(required(newWithCost), 1, 'switching off does not change an existing snapshot')
const stillNoCost = mk()
eq(required(stillNoCost), 0, 'a ticket created after switching off snapshots 0')
eq(getFinancialReport(db, { period: 'all_time' }).provisionalTicketsCount, 1, 'the earlier new ticket stays provisional')

console.log('--- adding a cost manually to an old ticket is always possible ---')
const updated = setPartsCost(db, oldDelivered, 2600)
eq([updated.my_share, updated.partner_share], [700, 700], 'old delivered ticket: cost 2600 => 700 / 700 (net profit as usual)')
eq(flag(oldInProgress), false, 'unchanged flag for the untouched old ticket')

console.log('--- migration of a T004 database ---')
{
  const m = new Database(':memory:')
  m.exec(LEGACY_SCHEMA_BEFORE_PARTS_COST)
  m.exec(`
    INSERT INTO Technician (name, is_partner) VALUES ('أنا', 0), ('الشريك', 1);
    INSERT INTO RepairCategory (name, default_split_percentage) VALUES ('شاشات', 50);
    INSERT INTO Brand (name) VALUES ('Samsung');
    INSERT INTO Model (brand_id, name) VALUES (1, 'A');
    INSERT INTO Customer (name, phone) VALUES ('z', '1');
  `)
  initializeSchema(m) // adds the T004 columns and (T004b) the snapshot
  m.exec(`ALTER TABLE Ticket DROP COLUMN parts_cost_required`) // back to the exact T004 shape
  const ins = (code: string, cost: number | null): void => {
    m.prepare(
      `INSERT INTO Ticket (barcode_code, customer_id, created_at, technician, technician_id, repair_category_id, price, payment_type, amount_paid, amount_remaining, status, parts_cost)
       VALUES (?, 1, '2026-01-01T00:00:00.000Z', 'أنا', 1, 1, 4000, 'cash', 4000, 0, 'in_progress', ?)`
    ).run(code, cost)
  }
  ins('A', null)
  ins('B', 2600)
  ins('C', 0)
  m.prepare(`UPDATE RepairCategory SET requires_parts_cost = 1`).run() // already enabled by the user on T004
  const probe = `SELECT id, barcode_code, price, parts_cost, status, my_share FROM Ticket ORDER BY id`
  const before = JSON.stringify(m.prepare(probe).all())
  initializeSchema(m)
  eq(
    m.prepare(`SELECT barcode_code c, parts_cost_required r FROM Ticket ORDER BY id`).all(),
    [{ c: 'A', r: 0 }, { c: 'B', r: 1 }, { c: 'C', r: 1 }],
    'T004 database: no cost => 0 (not retroactive); with a cost (even 0) => 1'
  )
  eq(JSON.stringify(m.prepare(probe).all()), before, 'migration loses nothing')
  const snapshot = JSON.stringify(m.prepare(`SELECT * FROM Ticket ORDER BY id`).all())
  initializeSchema(m)
  initializeSchema(m)
  eq(JSON.stringify(m.prepare(`SELECT * FROM Ticket ORDER BY id`).all()), snapshot, 'second launch changes nothing')
  eq(getTicketsList(m).filter((x) => x.parts_cost_missing).length, 0, 'no old ticket is flagged after the migration')
  m.close()
}

if (failures > 0) {
  console.error(`\n💥 ${failures} assertion(s) failed`)
  process.exit(1)
}
console.log('\n🎉 ALL PARTS-COST SNAPSHOT TESTS PASSED! 🎉')
process.exit(0)
