import Database from 'better-sqlite3'
import { initializeSchema } from '../src/database/schema'
import { seedInitialData } from '../src/database/seed'
import { createTicket, getTicketByBarcode, getTicketsList } from '../src/database/queries/tickets'
import { generateTicketCode, isLegacyTicketCode, isTicketCode, looksLikeTicketCode } from '../src/shared/ticket-code'
import {
  BAR_HEIGHT_DOTS,
  DOT_MM,
  LABEL_BARCODE_MAX_WIDTH_MM,
  QUIET_ZONE_MODULES,
  buildLabelBarcode,
  encodeCode128
} from '../src/shared/label-barcode'
import { buildLabelHtml } from '../src/main/printer'

// Ticket codes and the label barcode: a format a 203 DPI thermal label can carry readably, its exact geometry,
// and the migration of tickets created with the old (unscannable) WSH codes.

let failures = 0
function check(condition: boolean, message: string): void {
  if (condition) console.log(`✅ ${message}`)
  else {
    failures++
    console.error(`❌ ${message}`)
  }
}

console.log('--- Code format ---')
const codes = Array.from({ length: 500 }, () => generateTicketCode())
check(
  codes.every((c) => /^2\d{7}$/.test(c)),
  'every generated code is "2" + 7 digits'
)
check(new Set(codes).size >= 490, 'generated codes are random (500 draws, almost no repeats)')
check(generateTicketCode(() => 0) === '20000000' && generateTicketCode(() => 0.9999) === '29999999', 'digit range')
check(
  !isTicketCode('0555123456') && !looksLikeTicketCode('0555123456'),
  'an Algerian phone number is not a ticket code'
)
check(!isTicketCode('2555123456') && !isTicketCode('2730491'), 'wrong length is not a ticket code')
check(!isTicketCode('6130000000017'), 'an EAN-13 product barcode is not a ticket code')
check(
  isLegacyTicketCode('WSH2610056T5197') && looksLikeTicketCode('WSH2610056T5197'),
  'the old WSH format is recognised'
)
check(!isLegacyTicketCode('WSH12'), 'too short to be an old ticket code')

console.log('\n--- Label barcode geometry (203 DPI) ---')
const code = '27304918'
const bits = encodeCode128(code)!
check(
  bits.length === 79,
  `8 digits in Code128 set C = start + 4 symbols + check + stop = 79 modules (got ${bits.length})`
)
const label = buildLabelBarcode(code)
check(label.modules === 79 + 2 * QUIET_ZONE_MODULES, `99 modules with both quiet zones (got ${label.modules})`)
check(label.moduleDots === 3, '3-dot modules (0.375mm)')
check(
  label.widthMm <= LABEL_BARCODE_MAX_WIDTH_MM && Math.abs(label.widthMm - 99 * 3 * DOT_MM) < 0.001,
  `99 x 3 dots = ${label.widthMm}mm fits the ${LABEL_BARCODE_MAX_WIDTH_MM}mm between the label paddings`
)
check(label.svg.includes('viewBox="0 0 297 63"'), 'viewBox in printer dots: 297 x 63')
check(label.svg.includes('shape-rendering="crispEdges"'), 'crisp edges (no grey anti-aliased bars)')
check(!/width="100%"|preserveAspectRatio="none"|transform/.test(label.svg), 'nothing in the SVG stretches the bars')
check(Math.abs(label.heightMm - BAR_HEIGHT_DOTS * DOT_MM) < 0.001, `bar height ${label.heightMm}mm`)
const leftDots = label.leftMm / DOT_MM
check(
  Math.abs(leftDots - Math.round(leftDots)) < 0.01,
  `placed a whole number of dots from the label edge (${leftDots.toFixed(3)})`
)

const rects = [...label.svg.matchAll(/<rect x="(\d+)" y="0" width="(\d+)" height="63"\/>/g)].map((m) => ({
  x: Number(m[1]),
  w: Number(m[2])
}))
check(rects.length === 22, `22 bars (got ${rects.length})`)
check(
  rects.every((r) => r.x % 3 === 0 && r.w % 3 === 0 && r.w >= 3 && r.w <= 12),
  'every bar starts and ends on a module boundary, 1-4 modules wide'
)
check(rects[0].x === QUIET_ZONE_MODULES * 3, 'quiet zone of 10 modules before the first bar')
const lastEnd = rects[rects.length - 1].x + rects[rects.length - 1].w
check(297 - lastEnd === QUIET_ZONE_MODULES * 3, 'quiet zone of 10 modules after the last bar')

check(
  buildLabelBarcode(code, 1.8).svg.includes('viewBox="0 0 297 63"'),
  'the zoomed preview is the same drawing, scaled'
)
check(buildLabelBarcode('274185296310').moduleDots === 2, 'a longer numeric value falls back to 2-dot modules')
let refused = ''
try {
  buildLabelBarcode('WSH2610056T5197')
} catch (error) {
  refused = (error as Error).message
}
check(
  refused === 'barcode too long for the label',
  'the old 15-character code cannot fit the label readably: refused, not squeezed'
)

const html = buildLabelHtml({ barcode: code, customerName: 'زبون', shortLabel: 'SA A54' })
check(
  html.includes('viewBox="0 0 297 63"') && html.includes(`data-barcode="${code}"`),
  'the print page draws the barcode itself'
)
check(
  !/svg\s*\{[^}]*(width|height|transform)\s*:/.test(html),
  'the print page never resizes the SVG (no width/height/transform in its CSS rule)'
)
check(html.includes(`<svg style="left: ${label.leftMm}mm"`), 'the print page places the SVG at its whole-dot offset')

console.log('\n--- New tickets and lookups ---')
const db = new Database(':memory:')
db.pragma('foreign_keys = ON')
initializeSchema(db)
seedInitialData(db)
const make = (name: string): { ticketId: number; barcode: string } =>
  createTicket(db, {
    customer: { name, phone: '0555000111' },
    device: { brand: 'Samsung', model: 'Galaxy A54', short_label: 'SA A54' },
    ticket: { repair_category_id: 1, price: 3000, payment_type: 'cash', amount_paid: 3000, technician_id: 1 }
  })
const fresh = make('زبون جديد')
check(isTicketCode(fresh.barcode), `a new ticket gets a code in the new format (${fresh.barcode})`)
check(getTicketByBarcode(db, fresh.barcode)?.ticket.id === fresh.ticketId, 'found by its code')
check(getTicketByBarcode(db, ` ${fresh.barcode} `)?.ticket.id === fresh.ticketId, 'surrounding spaces ignored')
check(getTicketByBarcode(db, '') === null, 'an empty scan finds nothing')

console.log('\n--- Migration of WSH codes ---')
const legacy = new Database(':memory:')
legacy.pragma('foreign_keys = ON')
initializeSchema(legacy)
seedInitialData(legacy)
const a = createTicket(legacy, {
  customer: { name: 'قديم أ', phone: '0555000222' },
  device: { brand: 'Samsung', model: 'Galaxy A54', short_label: 'SA A54' },
  ticket: { repair_category_id: 1, price: 3000, payment_type: 'cash', amount_paid: 3000, technician_id: 1 }
})
const b = createTicket(legacy, {
  customer: { name: 'قديم ب', phone: '0555000333' },
  device: { brand: 'Samsung', model: 'Galaxy A54', short_label: 'SA A54' },
  ticket: { repair_category_id: 1, price: 2000, payment_type: 'credit', amount_paid: 0, technician_id: 1 }
})
// Back to the shape of a database created before this change: WSH codes, no legacy column
legacy.exec(`DROP INDEX IF EXISTS idx_ticket_legacy_barcode`)
legacy.exec(`ALTER TABLE Ticket DROP COLUMN legacy_barcode_code`)
legacy.prepare(`UPDATE Ticket SET barcode_code = ? WHERE id = ?`).run('WSH2610056T5197', a.ticketId)
legacy.prepare(`UPDATE Ticket SET barcode_code = ? WHERE id = ?`).run('WSH2609301A2345', b.ticketId)
const before = legacy.prepare(`SELECT id, price, status, customer_id FROM Ticket ORDER BY id`).all()

initializeSchema(legacy)
type Row = { id: number; barcode_code: string; legacy_barcode_code: string | null }
const after = legacy.prepare(`SELECT id, barcode_code, legacy_barcode_code FROM Ticket ORDER BY id`).all() as Row[]
check(
  after.every((r) => isTicketCode(r.barcode_code)),
  'every ticket now has a code in the new format'
)
check(
  after[0].legacy_barcode_code === 'WSH2610056T5197' && after[1].legacy_barcode_code === 'WSH2609301A2345',
  'the old codes are kept in legacy_barcode_code'
)
check(new Set(after.map((r) => r.barcode_code)).size === after.length, 'new codes are unique')
check(
  JSON.stringify(legacy.prepare(`SELECT id, price, status, customer_id FROM Ticket ORDER BY id`).all()) ===
    JSON.stringify(before),
  'nothing else about the tickets changed'
)
check(
  getTicketByBarcode(legacy, 'WSH2610056T5197')?.ticket.id === a.ticketId,
  'an old WSH label still opens its ticket'
)
check(getTicketByBarcode(legacy, 'wsh2610056t5197')?.ticket.id === a.ticketId, 'old code found whatever the case')
check(getTicketByBarcode(legacy, after[1].barcode_code)?.ticket.id === b.ticketId, 'the new code opens the ticket too')
check(
  getTicketsList(legacy, 'WSH2609301')
    .map((t) => t.id)
    .join() === String(b.ticketId),
  'the list search finds a ticket by part of its old code'
)
check(
  getTicketsList(legacy, after[0].barcode_code)
    .map((t) => t.id)
    .join() === String(a.ticketId),
  'the list search finds a ticket by its new code'
)
initializeSchema(legacy)
const again = legacy.prepare(`SELECT id, barcode_code, legacy_barcode_code FROM Ticket ORDER BY id`).all() as Row[]
check(JSON.stringify(again) === JSON.stringify(after), 'a second launch changes nothing')
let duplicateRejected = false
try {
  legacy.prepare(`UPDATE Ticket SET legacy_barcode_code = ? WHERE id = ?`).run('WSH2610056T5197', b.ticketId)
} catch {
  duplicateRejected = true
}
check(duplicateRejected, 'two tickets can never share an old code (unique index)')

if (failures > 0) {
  console.error(`\n💥 ${failures} assertion(s) failed`)
  process.exit(1)
}
console.log('\n🎉 ALL TICKET CODE TESTS PASSED! 🎉')
