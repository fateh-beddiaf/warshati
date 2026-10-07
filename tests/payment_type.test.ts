import Database from 'better-sqlite3'
import { initializeSchema } from '../src/database/schema'
import { seedInitialData } from '../src/database/seed'
import { createTicket, recordPayment, updateTicketStatus } from '../src/database/queries/tickets'
import { updateTicket } from '../src/database/queries/ticket-edit'
import { assertCreateTicketDTO, assertUpdateTicketStatusDTO } from '../src/main/ipc-validate'
import { paymentTypeFor } from '../src/shared/payment'
import type { CreateTicketDTO, PaymentType } from '../src/shared/types'

// The payment type follows the remaining amount on every write (creation, edit, delivery, debt payment):
// nothing left to pay = cash, a remaining balance = credit. Whatever type a caller sends is not used.
// Rows written before this rule keep their stored type until the app writes their payment again.

let failures = 0
function eq<T>(actual: T, expected: T, message: string): void {
  if (Object.is(actual, expected) || JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`✅ ${message}`)
  } else {
    failures++
    console.error(`❌ ${message}\n   expected: ${JSON.stringify(expected)}\n   actual:   ${JSON.stringify(actual)}`)
  }
}
function throws(fn: () => unknown): boolean {
  try {
    fn()
    return false
  } catch {
    return true
  }
}

const db = new Database(':memory:')
db.pragma('foreign_keys = ON')
initializeSchema(db)
seedInitialData(db)

type Row = { amount_paid: number; amount_remaining: number; payment_type: PaymentType; status: string }
const row = (id: number): Row =>
  db.prepare(`SELECT amount_paid, amount_remaining, payment_type, status FROM Ticket WHERE id = ?`).get(id) as Row
const money = (id: number): [number, PaymentType] => [row(id).amount_remaining, row(id).payment_type]
const typeLogs = (id: number): { old_value: string | null; new_value: string | null }[] =>
  db
    .prepare(
      `SELECT old_value, new_value FROM TicketEditLog WHERE ticket_id = ? AND field = 'payment_type' ORDER BY id`
    )
    .all(id) as { old_value: string | null; new_value: string | null }[]

let phone = 670000000
function mk(price: number, paid: number, sentType?: PaymentType): number {
  const dto: CreateTicketDTO = {
    customer: { name: `Payment ${phone}`, phone: `0${phone++}` },
    device: { brand: 'Nokia', model: 'G21' },
    ticket: {
      repair_category_id: 1,
      price,
      amount_paid: paid,
      technician_id: 1,
      ...(sentType ? { payment_type: sentType } : {})
    }
  }
  return createTicket(db, dto).ticketId
}
/** A row as 1.0.0 could leave it: fully paid but stored as credit (the form let the user keep "credit") */
function legacyCreditPaid(price: number): number {
  const id = mk(price, price)
  db.prepare(`UPDATE Ticket SET payment_type = 'credit' WHERE id = ?`).run(id)
  return id
}

console.log('\n--- 1. The rule ---')
eq(paymentTypeFor(0), 'cash', 'nothing left = cash')
eq(paymentTypeFor(500), 'credit', 'a remaining balance = credit')
eq(paymentTypeFor(0.5), 'credit', 'even a small remaining balance = credit')

console.log('\n--- 2. Creation ---')
eq(money(mk(3000, 3000, 'credit')), [0, 'cash'], 'fully paid but "credit" sent -> cash')
eq(money(mk(3000, 1000, 'cash')), [2000, 'credit'], 'partly paid but "cash" sent -> credit')
eq(money(mk(3000, 3000)), [0, 'cash'], 'no type sent, fully paid -> cash')
eq(money(mk(3000, 0)), [3000, 'credit'], 'no type sent, nothing paid -> credit')
eq(money(mk(0, 0, 'credit')), [0, 'cash'], 'a free repair -> cash')

console.log('\n--- 3. Edit ---')
{
  const id = mk(3000, 3000)
  updateTicket(db, id, { price: 3500 })
  eq(money(id), [500, 'credit'], 'price raised above the paid amount -> credit')
  updateTicket(db, id, { amount_paid: 3500 })
  eq(money(id), [0, 'cash'], 'paid up to the price -> cash')
  eq(
    typeLogs(id),
    [
      { old_value: 'cash', new_value: 'credit' },
      { old_value: 'credit', new_value: 'cash' }
    ],
    'both type changes are in the history'
  )

  const legacy = legacyCreditPaid(2000)
  updateTicket(db, legacy, { device: { brand: 'Nokia', model: 'G22' } })
  eq(money(legacy), [0, 'credit'], 'an edit that does not touch the money keeps the stored type')
  eq(typeLogs(legacy), [], 'and logs no type change')
  updateTicket(db, legacy, { price: 2500, amount_paid: 2500 })
  eq(money(legacy), [0, 'cash'], 'an edit of the money writes the computed type')
  eq(typeLogs(legacy), [{ old_value: 'credit', new_value: 'cash' }], 'logged')
}

console.log('\n--- 4. Status changes and delivery ---')
{
  const legacy = legacyCreditPaid(4000)
  updateTicketStatus(db, { ticketId: legacy, newStatus: 'ready' })
  updateTicketStatus(db, { ticketId: legacy, newStatus: 'in_progress' })
  updateTicketStatus(db, { ticketId: legacy, newStatus: 'ready' })
  eq(money(legacy), [0, 'credit'], 'ready <-> in progress keeps the stored type')
  updateTicketStatus(db, { ticketId: legacy, newStatus: 'delivered' })
  eq(money(legacy), [0, 'cash'], 'delivered with nothing left (no payment sent) -> cash')
  updateTicketStatus(db, { ticketId: legacy, newStatus: 'ready' })
  eq(money(legacy), [0, 'cash'], 'back from delivered keeps it')

  const full = mk(4000, 1000)
  updateTicketStatus(db, { ticketId: full, newStatus: 'ready' })
  updateTicketStatus(db, {
    ticketId: full,
    newStatus: 'delivered',
    paymentUpdate: { amount_paid: 4000, payment_type: 'credit' }
  })
  eq(money(full), [0, 'cash'], 'paid in full at delivery, "credit" sent -> cash')

  const partial = mk(4000, 1000)
  updateTicketStatus(db, { ticketId: partial, newStatus: 'ready' })
  updateTicketStatus(db, {
    ticketId: partial,
    newStatus: 'delivered',
    paymentUpdate: { amount_paid: 2500, payment_type: 'cash' }
  })
  eq(money(partial), [1500, 'credit'], 'partly paid at delivery, "cash" sent -> credit')

  const onCredit = mk(4000, 0)
  updateTicketStatus(db, { ticketId: onCredit, newStatus: 'ready' })
  updateTicketStatus(db, { ticketId: onCredit, newStatus: 'delivered', paymentUpdate: { amount_paid: 0 } })
  eq(money(onCredit), [4000, 'credit'], 'delivered on credit -> credit')

  console.log('\n--- 5. Debt payment ---')
  recordPayment(db, onCredit, 1000)
  eq(money(onCredit), [3000, 'credit'], 'part of the debt paid -> still credit')
  recordPayment(db, onCredit, 3000)
  eq(money(onCredit), [0, 'cash'], 'debt paid off -> cash')
}

console.log('\n--- 6. IPC guards ---')
{
  const dto = {
    customer: { name: 'A', phone: '0555' },
    device: { brand: 'A', model: 'B' },
    ticket: { repair_category_id: 1, price: 1000, amount_paid: 1000, technician_id: 1 }
  }
  eq(
    throws(() => assertCreateTicketDTO(dto)),
    false,
    'a new ticket without a payment type passes'
  )
  eq(
    throws(() => assertCreateTicketDTO({ ...dto, ticket: { ...dto.ticket, payment_type: 'gift' } })),
    true,
    'a malformed type is still refused'
  )
  eq(
    throws(() =>
      assertUpdateTicketStatusDTO({ ticketId: 1, newStatus: 'delivered', paymentUpdate: { amount_paid: 1000 } })
    ),
    false,
    'a delivery payment without a type passes'
  )
}

if (failures > 0) {
  console.error(`\n❌ ${failures} check(s) failed`)
  process.exit(1)
}
console.log('\n✅ payment type: all checks passed')
