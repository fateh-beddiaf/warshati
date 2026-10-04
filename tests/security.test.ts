import {
  assertCreateTicketDTO,
  assertId,
  assertNullableNumber,
  assertOptionalString,
  assertPrintLabelData,
  assertReportFilterDTO,
  assertString,
  assertUpdateTicketStatusDTO,
  MAX_TEXT_LENGTH
} from '../src/main/ipc-validate'
import { isSamePage } from '../src/main/security'
import { buildLabelHtml } from '../src/main/printer'

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`)
    throw new Error(`Assertion failed: ${message}`)
  }
  console.log(`✅ Passed: ${message}`)
}

function rejects(fn: () => void): boolean {
  try {
    fn()
    return false
  } catch (error) {
    return error instanceof Error && error.message.startsWith('Invalid input: ')
  }
}

function accepts(fn: () => void): boolean {
  return !rejects(fn)
}

console.log('--- IPC input guards ---')
assert(
  accepts(() => assertId(7, 'id')),
  'a positive integer is a valid id'
)
assert(
  rejects(() => assertId(0, 'id')),
  'id 0 is rejected'
)
assert(
  rejects(() => assertId(1.5, 'id')),
  'a fractional id is rejected'
)
assert(
  rejects(() => assertId('7', 'id')),
  'a numeric string is not an id'
)
assert(
  rejects(() => assertId(Number.NaN, 'id')),
  'NaN is not an id'
)
assert(
  accepts(() => assertString('', 'name')),
  'an empty string is still a string (emptiness is a business rule)'
)
assert(
  rejects(() => assertString('x'.repeat(MAX_TEXT_LENGTH + 1), 'name')),
  'over-long text is rejected'
)
assert(
  rejects(() => assertString(42, 'name')),
  'a number is not a string'
)
assert(
  accepts(() => assertOptionalString(undefined, 'q')),
  'an omitted optional string is fine'
)
assert(
  rejects(() => assertOptionalString(null, 'q')),
  'null is not an omitted optional'
)
assert(
  accepts(() => assertNullableNumber(null, 'cost')),
  'parts cost may be null (not entered)'
)
assert(
  accepts(() => assertNullableNumber(2600, 'cost')),
  'parts cost may be a number'
)
assert(
  rejects(() => assertNullableNumber(Infinity, 'cost')),
  'parts cost may not be Infinity'
)
assert(
  rejects(() => assertNullableNumber(undefined, 'cost')),
  'parts cost must be explicit (number or null)'
)

const validTicket = {
  customer: { name: 'زبون', phone: '0555000000', notes: undefined },
  device: { brand: 'Samsung', model: 'A54', brand_id: 3, model_id: undefined, short_label: 'A54' },
  ticket: {
    repair_category_id: 1,
    price: 4000,
    payment_type: 'cash',
    amount_paid: 4000,
    technician_id: 1,
    parts_cost: null
  },
  accessory_ids: [1, 2]
}
assert(
  accepts(() => assertCreateTicketDTO(validTicket)),
  'a ticket as the New Ticket form builds it is accepted'
)
assert(
  accepts(() => assertCreateTicketDTO({ ...validTicket, ticket: { ...validTicket.ticket, parts_cost: 2600 } })),
  'a ticket with a parts cost is accepted'
)
assert(
  rejects(() => assertCreateTicketDTO({ ...validTicket, ticket: { ...validTicket.ticket, price: '4000' } })),
  'a string price is rejected'
)
assert(
  rejects(() => assertCreateTicketDTO({ ...validTicket, ticket: { ...validTicket.ticket, payment_type: 'gift' } })),
  'an unknown payment type is rejected'
)
assert(
  rejects(() => assertCreateTicketDTO({ ...validTicket, accessory_ids: ['1'] })),
  'accessory ids must be ids'
)
assert(
  rejects(() => assertCreateTicketDTO({ ...validTicket, customer: null })),
  'a missing customer is rejected'
)
assert(
  rejects(() => assertCreateTicketDTO([])),
  'an array is not a ticket'
)

assert(
  accepts(() => assertUpdateTicketStatusDTO({ ticketId: 4, newStatus: 'ready', paymentUpdate: undefined })),
  'a plain status change is accepted'
)
assert(
  accepts(() =>
    assertUpdateTicketStatusDTO({
      ticketId: 4,
      newStatus: 'delivered',
      paymentUpdate: { amount_paid: 1000, payment_type: 'credit' }
    })
  ),
  'a delivery with a payment update is accepted'
)
assert(
  rejects(() => assertUpdateTicketStatusDTO({ ticketId: 4, newStatus: 'lost' })),
  'an unknown status is rejected'
)

assert(
  accepts(() => assertReportFilterDTO(undefined)),
  'the report filter is optional'
)
assert(
  accepts(() =>
    assertReportFilterDTO({
      period: 'custom',
      startDate: '2026-10-01',
      endDate: '2026-10-04',
      technicianFilter: undefined,
      categoryFilter: 3
    })
  ),
  'a custom-range report filter is accepted'
)
assert(
  accepts(() => assertReportFilterDTO({ period: 'today', categoryFilter: 'all' })),
  "category 'all' is accepted"
)
assert(
  rejects(() => assertReportFilterDTO({ period: 'forever' })),
  'an unknown period is rejected'
)

assert(
  accepts(() =>
    assertPrintLabelData({ barcode: 'W-1', customerName: 'زبون', shortLabel: 'A54', ticketId: 1, svgContent: '<svg/>' })
  ),
  'a label print request is accepted'
)
assert(
  rejects(() => assertPrintLabelData({ barcode: 1, customerName: 'x', shortLabel: 'y' })),
  'barcode must be text'
)

console.log('\n--- Navigation lock ---')
assert(isSamePage('file:///C:/app/out/renderer/index.html', 'file:///C:/app/out/renderer/index.html#x'), 'same file')
assert(!isSamePage('file:///C:/app/out/renderer/index.html', 'file:///C:/Windows/win.ini'), 'another local file')
assert(isSamePage('http://localhost:5173/', 'http://localhost:5173/?t=1'), 'dev server reload')
assert(!isSamePage('http://localhost:5173/', 'https://example.com/'), 'an external site')
assert(!isSamePage('http://localhost:5173/', 'not a url'), 'garbage')

console.log('\n--- Print window content ---')
const html = buildLabelHtml({ barcode: 'W-1', customerName: 'زبون', shortLabel: 'A54', svgContent: '<svg></svg>' })
assert(
  html.includes(`content="default-src 'none'; style-src 'unsafe-inline'"`),
  'the label page forbids every script and external resource'
)

console.log('\n🎉 ALL SECURITY TESTS PASSED! 🎉')
