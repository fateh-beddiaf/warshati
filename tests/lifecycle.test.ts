import Database from 'better-sqlite3'
import { initializeSchema } from '../src/database/schema'
import { seedInitialData } from '../src/database/seed'
import { createTicket, updateTicketStatus, getTicketById, getTicketsList } from '../src/database/queries/tickets'
import { setSetting, getOverdueThresholdDays } from '../src/database/queries/settings'
import type { CreateTicketDTO } from '../src/shared/types'

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`)
    throw new Error(`Assertion failed: ${message}`)
  }
  console.log(`✅ Passed: ${message}`)
}

console.log('🚀 Running Unit Tests for Milestone 3: Ticket Lifecycle & Status Transitions...\n')

// Use in-memory SQLite database for fast, isolated testing
const db = new Database(':memory:')
db.pragma('foreign_keys = ON')
initializeSchema(db)
seedInitialData(db)

// 1. Test Ticket Creation with Initial in_progress status and StatusLog
console.log('--- Test 1: Ticket Creation and Initial Status ---')
const sampleDTO: CreateTicketDTO = {
  customer: {
    name: 'أحمد بن علي',
    phone: '0555123456',
    notes: 'زبون دائم'
  },
  device: {
    brand: 'Samsung',
    model: 'Galaxy A54',
    short_label: 'SA A54'
  },
  ticket: {
    repair_category_id: 1,
    price: 5000,
    payment_type: 'cash',
    amount_paid: 2000,
    technician_id: 1
  },
  accessory_ids: [2, 3] // شاحن + كفر
}

const { ticketId, barcode } = createTicket(db, sampleDTO)
assert(ticketId > 0, `Ticket created with ID: ${ticketId}`)
assert(barcode.startsWith('WSH'), `Barcode format is correct: ${barcode}`)

let details = getTicketById(db, ticketId)
assert(details !== null, 'Ticket details retrieved successfully')
assert(details!.ticket.status === 'in_progress', 'Initial status is in_progress')
assert(details!.ticket.price === 5000, 'Price is 5000')
assert(details!.ticket.amount_paid === 2000, 'Amount paid is 2000')
assert(details!.ticket.amount_remaining === 3000, 'Amount remaining is 3000')
assert(details!.statusLogs.length === 1, 'Initial StatusLog entry exists')
assert(details!.statusLogs[0].old_status === null, 'Initial StatusLog old_status is null')
assert(details!.statusLogs[0].new_status === 'in_progress', 'Initial StatusLog new_status is in_progress')

// 2. Test Invalid Direct Transition (in_progress -> delivered)
console.log('\n--- Test 2: Invalid Transition Validation ---')
let threwError = false
try {
  updateTicketStatus(db, {
    ticketId,
    newStatus: 'delivered'
  })
} catch (err: any) {
  threwError = true
  assert(
    err.message.includes('غير مسموح به'),
    `Direct in_progress -> delivered rejected with descriptive Arabic error: "${err.message}"`
  )
}
assert(threwError, 'Direct in_progress -> delivered threw an error as expected')

// 3. Test Valid Transition (in_progress -> ready)
console.log('\n--- Test 3: Valid Transition to ready ---')
const readyRes = updateTicketStatus(db, {
  ticketId,
  newStatus: 'ready'
})
assert(readyRes.success === true, 'Transition to ready succeeded')
assert(readyRes.ticket.status === 'ready', 'Ticket status updated to ready')

details = getTicketById(db, ticketId)
assert(details!.statusLogs.length === 2, 'StatusLog now has 2 entries')
assert(details!.statusLogs[1].old_status === 'in_progress', 'Second log old_status is in_progress')
assert(details!.statusLogs[1].new_status === 'ready', 'Second log new_status is ready')

// 4. Test Valid Reversion (ready -> in_progress) & back to ready
console.log('\n--- Test 4: Reversion ready -> in_progress and back ---')
updateTicketStatus(db, { ticketId, newStatus: 'in_progress' })
details = getTicketById(db, ticketId)
assert(details!.ticket.status === 'in_progress', 'Reverted back to in_progress')
assert(details!.statusLogs.length === 3, 'StatusLog now has 3 entries')

updateTicketStatus(db, { ticketId, newStatus: 'ready' })
details = getTicketById(db, ticketId)
assert(details!.ticket.status === 'ready', 'Moved back to ready')
assert(details!.statusLogs.length === 4, 'StatusLog now has 4 entries')

// 5. Test Transition to delivered with remaining balance settlement (Cash Full Settlement)
console.log('\n--- Test 5: Delivery with Full Balance Settlement ---')
const deliveredRes = updateTicketStatus(db, {
  ticketId,
  newStatus: 'delivered',
  paymentUpdate: {
    amount_paid: 5000,
    payment_type: 'cash'
  }
})
assert(deliveredRes.success === true, 'Transition to delivered succeeded')
assert(deliveredRes.ticket.status === 'delivered', 'Ticket status updated to delivered')
assert(deliveredRes.ticket.amount_paid === 5000, 'Amount paid updated to 5000 (full)')
assert(deliveredRes.ticket.amount_remaining === 0, 'Amount remaining updated to 0 (khales)')
assert(deliveredRes.ticket.payment_type === 'cash', 'Payment type is cash')

details = getTicketById(db, ticketId)
assert(details!.statusLogs.length === 5, 'StatusLog has 5 recorded transitions')
assert(details!.statusLogs[4].old_status === 'ready', 'Last log old_status is ready')
assert(details!.statusLogs[4].new_status === 'delivered', 'Last log new_status is delivered')

// 6. Test Delivery with Unsettled Balance (Debt / Credit Allowed and Tracked)
console.log('\n--- Test 6: Delivery with Debt (Credit) Allowed & Tracked ---')
const creditDTO: CreateTicketDTO = {
  customer: { name: 'عمر الدين', phone: '0777889900' },
  device: { brand: 'Xiaomi', model: 'Redmi Note 12' },
  ticket: {
    repair_category_id: 2,
    price: 4000,
    payment_type: 'cash',
    amount_paid: 1000,
    technician_id: 2
  }
}
const creditTicket = createTicket(db, creditDTO)
updateTicketStatus(db, { ticketId: creditTicket.ticketId, newStatus: 'ready' })

// Deliver without paying remaining balance (allowed as credit/دين)
const creditDelivered = updateTicketStatus(db, {
  ticketId: creditTicket.ticketId,
  newStatus: 'delivered',
  paymentUpdate: {
    amount_paid: 1000,
    payment_type: 'credit'
  }
})
assert(creditDelivered.ticket.status === 'delivered', 'Ticket delivered on credit')
assert(creditDelivered.ticket.amount_paid === 1000, 'Paid amount is 1000')
assert(creditDelivered.ticket.amount_remaining === 3000, 'Remaining balance 3000 is preserved as debt')
assert(creditDelivered.ticket.payment_type === 'credit', 'Payment type correctly recorded as credit')

// 7. Test Overdue Ready Tickets Calculation
console.log('\n--- Test 7: Overdue Ready Tickets Calculation ---')
const overdueDTO: CreateTicketDTO = {
  customer: { name: 'زبون متأخر', phone: '0666112233' },
  device: { brand: 'Apple', model: 'iPhone 13' },
  ticket: {
    repair_category_id: 1,
    price: 8000,
    payment_type: 'cash',
    amount_paid: 8000,
    technician_id: 1
  }
}
const overdueTicket = createTicket(db, overdueDTO)
updateTicketStatus(db, { ticketId: overdueTicket.ticketId, newStatus: 'ready' })

// Mock the StatusLog timestamp for the ready status to 5 days ago
const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
db.prepare(
  `
  UPDATE StatusLog 
  SET timestamp = ? 
  WHERE ticket_id = ? AND new_status = 'ready'
`
).run(fiveDaysAgo, overdueTicket.ticketId)

let overdueDetails = getTicketById(db, overdueTicket.ticketId)
assert(overdueDetails!.is_overdue === true, 'Ticket is detected as overdue with default 3-day threshold')
assert(overdueDetails!.overdue_days === 5, `Overdue days computed accurately: ${overdueDetails!.overdue_days}`)

// Test changing threshold setting to 7 days (now 5 days is no longer overdue)
setSetting(db, 'overdue_ready_days', '7')
assert(getOverdueThresholdDays(db) === 7, 'Overdue threshold setting updated to 7 days')

overdueDetails = getTicketById(db, overdueTicket.ticketId)
assert(overdueDetails!.is_overdue === false, 'Ticket is NOT overdue under 7-day threshold')

// Test TicketsList query with overdue calculations
setSetting(db, 'overdue_ready_days', '3')
const listItems = getTicketsList(db)
const overdueInList = listItems.find((item) => item.id === overdueTicket.ticketId)
assert(overdueInList !== undefined, 'Ticket found in list')
assert(overdueInList!.is_overdue === true, 'Ticket in list has is_overdue = true')
assert(overdueInList!.overdue_days === 5, 'Ticket in list has overdue_days = 5')

console.log('\n🎉 ALL LIFECYCLE & STATUS UNIT TESTS PASSED SUCCESSFULLY! 🎉\n')
process.exit(0)
