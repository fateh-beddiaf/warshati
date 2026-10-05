import Database from 'better-sqlite3'
import { readFileSync, readdirSync } from 'fs'
import { join, resolve } from 'path'
import { initializeSchema } from '../src/database/schema'
import { seedInitialData } from '../src/database/seed'
import { addRepairCategory } from '../src/database/queries/metadata'
import { createTicket, getTicketById, getTicketsList, updateTicketStatus } from '../src/database/queries/tickets'
import { buildLabelHtml } from '../src/main/printer'
import type { PrintLabelData } from '../src/shared/types'

// T004 privacy: the parts cost must never reach the customer. The printed label (and its preview) is
// built only from the barcode, customer name / phone and short label, never from money. This test
// proves it three ways: the label HTML for a ticket with a distinctive cost, a structural check of the
// label data type, and a source guard over every file that renders or prints the label.

let failures = 0
function check(condition: boolean, message: string): void {
  if (condition) console.log(`✅ ${message}`)
  else {
    failures++
    console.error(`❌ ${message}`)
  }
}

const COST = 7431.77
const COST_TEXTS = ['7431', '7.431', '7,431', '7431.77', '7 431']

const db = new Database(':memory:')
db.pragma('foreign_keys = ON')
initializeSchema(db)
seedInitialData(db)
const category = addRepairCategory(db, 'شاشات', 50, true)
const { ticketId, barcode } = createTicket(db, {
  customer: { name: 'زبون الملصق', phone: '0555123987' },
  device: { brand: 'Realme', model: 'C51', short_label: 'RL C51' },
  ticket: {
    repair_category_id: category.id,
    price: 9000,
    payment_type: 'cash',
    amount_paid: 9000,
    technician_id: 1,
    parts_cost: COST
  }
})
updateTicketStatus(db, { ticketId, newStatus: 'ready' })
updateTicketStatus(db, { ticketId, newStatus: 'delivered' })

const details = getTicketById(db, ticketId)!
check(details.ticket.parts_cost === COST, 'precondition: the ticket really stores the cost')

// The same fields the app passes to the print preview (see App.tsx): nothing but identity + barcode
const labelData: PrintLabelData & { svgContent?: string } = {
  barcode,
  customerName: details.customer.name,
  customerPhone: details.customer.phone,
  shortLabel: details.device.short_label,
  ticketId
}
const html = buildLabelHtml(labelData)
check(
  html.includes(barcode) && html.includes('زبون الملصق'),
  'the label HTML is built (contains the barcode and the customer name)'
)
// The barcode / phone are random-ish digits: take them out so a coincidence cannot fail the money checks
const stripped = html.split(barcode).join('').split('0555123987').join('')
for (const text of COST_TEXTS) check(!stripped.includes(text), `label HTML does not contain "${text}"`)
for (const word of ['parts_cost', 'partsCost', 'تكلفة', 'cost', 'Cost'])
  check(!stripped.includes(word), `label HTML does not mention "${word}"`)
for (const amount of ['9000', '9.000', '9,000', '784'])
  check(!stripped.includes(amount), `label HTML does not contain money ("${amount}")`)

// The label data type has no money field at all, so no caller can hand one to the printer
const types = readFileSync(resolve('src/shared/types.ts'), 'utf8')
const labelInterface = /export interface PrintLabelData \{[^}]*\}/.exec(types)?.[0] ?? ''
check(labelInterface.length > 0, 'found the PrintLabelData interface')
check(!/price|cost|share|profit|amount|paid/i.test(labelInterface), 'PrintLabelData declares no money field')

// Source guard: nothing that renders / prints the label may reference the cost
const guarded = [
  'src/main/printer.ts',
  'src/shared/label-barcode.ts',
  ...readdirSync(resolve('src/renderer/components/barcode')).map((f) => join('src/renderer/components/barcode', f))
]
for (const file of guarded) {
  const source = readFileSync(resolve(file), 'utf8')
  check(
    !/parts_?cost|partsCost|requires_parts_cost|net_?profit|split_percentage/i.test(source),
    `${file} never references the parts cost`
  )
}

// The list payload (used by the "reprint" button in the tickets table) carries no cost amount either
const row = getTicketsList(db).find((x) => x.id === ticketId)!
check(!JSON.stringify(row).includes('7431'), 'the tickets-list row (source of the reprint data) holds no cost amount')

if (failures > 0) {
  console.error(`\n💥 ${failures} assertion(s) failed`)
  process.exit(1)
}
console.log('\n🎉 ALL LABEL PRIVACY TESTS PASSED! 🎉')
process.exit(0)
