import Database from 'better-sqlite3'
import { initializeSchema } from '../src/database/schema'
import { seedInitialData } from '../src/database/seed'
import { createTicket, updateTicketStatus } from '../src/database/queries/tickets'
import { getFinancialReport } from '../src/database/queries/reports'
import { getFinancialReportLegacy } from './fixtures/reports.legacy'
import { parseLocalDateString, toLocalDateString } from '../src/shared/date-utils'
import type { CreateTicketDTO, ReportFilterDTO } from '../src/shared/types'

console.log('--- Running Reports Query Tests (equivalence with legacy, delivered-only, range robustness) ---')

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
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

// ---------------------------------------------------------------------------
// Date helper tests (parseLocalDateString)
// ---------------------------------------------------------------------------
{
  const d = parseLocalDateString('2026-03-01')!
  check(
    'parseLocalDateString: local midnight of that calendar day',
    toLocalDateString(d) === '2026-03-01' && d.getHours() === 0 && d.getMinutes() === 0
  )
  const e = parseLocalDateString('2026-03-01', true)!
  check(
    'parseLocalDateString(endOfDay): 23:59:59.999 of the same local day',
    toLocalDateString(e) === '2026-03-01' && e.getHours() === 23 && e.getMilliseconds() === 999
  )
  for (const bad of [
    '',
    'garbage',
    '2026-02-31',
    '2026-13-01',
    '2026-3-1',
    '01/03/2026',
    '2026-03-01T10:00',
    undefined,
    null
  ]) {
    check(`parseLocalDateString rejects ${JSON.stringify(bad)}`, parseLocalDateString(bad as string) === null)
  }
}

// ---------------------------------------------------------------------------
// Seeded dataset
// ---------------------------------------------------------------------------
const db = new Database(':memory:')
db.pragma('foreign_keys = ON')
initializeSchema(db)
seedInitialData(db)

const technicians = db.prepare(`SELECT id, is_partner FROM Technician ORDER BY id`).all() as {
  id: number
  is_partner: number
}[]
const ownerTech = technicians.find((t) => !t.is_partner)!.id
const partnerTech = technicians.find((t) => t.is_partner)!.id
const categories = db.prepare(`SELECT id FROM RepairCategory ORDER BY id`).all() as { id: number }[]
const [cat1, cat2, cat3] = [categories[0].id, categories[1].id, categories[2].id]

let phone = 555000000
function mk(price: number, paid: number, tech: number, cat: number): number {
  const dto: CreateTicketDTO = {
    customer: { name: `Customer ${phone}`, phone: `0${phone++}` },
    device: { brand: 'Samsung', model: 'Galaxy A54' },
    ticket: {
      repair_category_id: cat,
      price,
      payment_type: paid >= price ? 'cash' : 'credit',
      amount_paid: paid,
      technician_id: tech
    }
  }
  return createTicket(db, dto).ticketId
}
const toReady = (id: number): void => void updateTicketStatus(db, { ticketId: id, newStatus: 'ready' })
const toDelivered = (id: number, paid?: number): void =>
  void updateTicketStatus(db, {
    ticketId: id,
    newStatus: 'delivered',
    ...(paid !== undefined ? { paymentUpdate: { amount_paid: paid, payment_type: 'credit' as const } } : {})
  })
const setCreated = (id: number, iso: string): void =>
  void db.prepare(`UPDATE Ticket SET created_at = ? WHERE id = ?`).run(iso, id)
const setLogTime = (id: number, status: string, iso: string): void =>
  void db.prepare(`UPDATE StatusLog SET timestamp = ? WHERE ticket_id = ? AND new_status = ?`).run(iso, id, status)

// A: owner, delivered mid-March
const A = mk(10000, 10000, ownerTech, cat1)
toReady(A)
toDelivered(A)
setLogTime(A, 'delivered', '2026-03-10T12:00:00.000Z')
setCreated(A, '2026-03-02T12:00:00.000Z')

// B: partner, credit, delivered late March
const B = mk(6000, 2000, partnerTech, cat3)
toReady(B)
toDelivered(B, 2000)
setLogTime(B, 'delivered', '2026-03-20T12:00:00.000Z')
setCreated(B, '2026-03-15T12:00:00.000Z')

// C: delivered, reverted to ready, delivered again (two delivered log rows: the LATEST one counts)
const C = mk(8000, 8000, ownerTech, cat2)
toReady(C)
toDelivered(C)
updateTicketStatus(db, { ticketId: C, newStatus: 'ready' })
toDelivered(C)
{
  const logs = db
    .prepare(`SELECT id FROM StatusLog WHERE ticket_id = ? AND new_status = 'delivered' ORDER BY id`)
    .all(C) as { id: number }[]
  if (logs.length !== 2) throw new Error(`expected two delivered logs for C, got ${logs.length}`)
  db.prepare(`UPDATE StatusLog SET timestamp = '2026-03-01T12:00:00.000Z' WHERE id = ?`).run(logs[0].id)
  db.prepare(`UPDATE StatusLog SET timestamp = '2026-04-05T12:00:00.000Z' WHERE id = ?`).run(logs[1].id)
  setCreated(C, '2026-02-20T12:00:00.000Z')
}

// D: was delivered once, reverted to ready (not delivered now)
const D = mk(3000, 3000, ownerTech, cat1)
toReady(D)
toDelivered(D)
updateTicketStatus(db, { ticketId: D, newStatus: 'ready' })
setLogTime(D, 'delivered', '2026-03-12T12:00:00.000Z')
setCreated(D, '2026-03-11T12:00:00.000Z')

// E: in progress, F: ready
const E = mk(2000, 500, ownerTech, cat2)
setCreated(E, '2026-03-12T12:00:00.000Z')
const F = mk(4500, 4500, partnerTech, cat1)
toReady(F)
setCreated(F, '2026-04-01T12:00:00.000Z')

// G: legacy delivered ticket without a delivered StatusLog row and without frozen shares
const G = mk(5000, 5000, ownerTech, cat1)
toReady(G)
toDelivered(G)
db.prepare(`DELETE FROM StatusLog WHERE ticket_id = ? AND new_status = 'delivered'`).run(G)
db.prepare(`UPDATE Ticket SET my_share = NULL, partner_share = NULL WHERE id = ?`).run(G)
setCreated(G, '2026-03-14T12:00:00.000Z')

const deliveredIds = new Set([A, B, C, G])

// ---------------------------------------------------------------------------
// 1. New implementation == legacy implementation (numbers, breakdowns, displayed tickets)
// ---------------------------------------------------------------------------
const filters: { name: string; filter: ReportFilterDTO }[] = [
  { name: 'all_time', filter: { period: 'all_time' } },
  { name: 'default filter', filter: undefined as unknown as ReportFilterDTO },
  { name: 'custom March', filter: { period: 'custom', startDate: '2026-03-01', endDate: '2026-03-31' } },
  { name: 'custom April', filter: { period: 'custom', startDate: '2026-04-01', endDate: '2026-04-30' } },
  { name: 'custom single day (no end)', filter: { period: 'custom', startDate: '2026-03-10' } },
  {
    name: 'custom single day (start=end)',
    filter: { period: 'custom', startDate: '2026-03-20', endDate: '2026-03-20' }
  },
  { name: 'custom year', filter: { period: 'custom', startDate: '2026-01-01', endDate: '2026-12-31' } },
  {
    name: 'custom range with nothing in it',
    filter: { period: 'custom', startDate: '2025-01-01', endDate: '2025-01-31' }
  },
  { name: 'today', filter: { period: 'today' } },
  { name: 'this_week', filter: { period: 'this_week' } },
  { name: 'this_month', filter: { period: 'this_month' } },
  { name: 'all_time + owner technician', filter: { period: 'all_time', technicianFilter: String(ownerTech) } },
  { name: 'all_time + partner technician', filter: { period: 'all_time', technicianFilter: String(partnerTech) } },
  { name: 'all_time + category 1', filter: { period: 'all_time', categoryFilter: cat1 } },
  {
    name: 'March + category 2',
    filter: { period: 'custom', startDate: '2026-03-01', endDate: '2026-03-31', categoryFilter: cat2 }
  },
  {
    name: 'April + partner + category 1',
    filter: {
      period: 'custom',
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      technicianFilter: String(partnerTech),
      categoryFilter: cat1
    }
  }
]

// The parts cost added cost-related fields. Without any parts cost entered they must be neutral (net = revenue,
// nothing provisional, no loss) and everything ELSE must still be identical to the legacy output.
function withoutCostFields<T extends Record<string, unknown>>(report: T): Record<string, unknown> {
  const { totalPartsCost, totalNetProfit, provisionalTicketsCount, lossTicketsCount, ...rest } = report as Record<
    string,
    unknown
  >
  const strip = (rows: unknown): unknown =>
    (rows as Record<string, unknown>[]).map((r) => {
      const { partsCost, netProfit, ...kept } = r
      return kept
    })
  return {
    ...rest,
    technicianBreakdown: strip(rest.technicianBreakdown),
    categoryBreakdown: strip(rest.categoryBreakdown)
  }
}
function withoutTicketCostFields(rows: unknown[]): unknown[] {
  return (rows as Record<string, unknown>[]).map((r) => {
    const { net_profit, is_provisional, is_loss, parts_cost_missing, ...kept } = r
    return kept
  })
}

for (const { name, filter } of filters) {
  const next = getFinancialReport(db, filter)
  const legacy = getFinancialReportLegacy(db, filter)
  check(
    `[${name}] cost fields are neutral without costs (net = revenue, no cost, nothing provisional/loss)`,
    next.totalPartsCost === 0 &&
      next.totalNetProfit === next.totalRevenue &&
      next.provisionalTicketsCount === 0 &&
      next.lossTicketsCount === 0 &&
      next.tickets.every((t) => t.net_profit === t.price && !t.is_provisional && !t.is_loss && !t.parts_cost_missing)
  )
  const { tickets: nextTickets, ...nextRest } = withoutCostFields(next as unknown as Record<string, unknown>) as {
    tickets: unknown[]
  } & Record<string, unknown>
  const nextTicketsPlain = withoutTicketCostFields(next.tickets)
  void nextTickets
  const { tickets: legacyTickets, ...legacyRest } = legacy
  check(
    `[${name}] totals, counts, breakdowns and range are identical to legacy`,
    same(nextRest, legacyRest),
    `\nnew=${JSON.stringify(nextRest)}\nold=${JSON.stringify(legacyRest)}`
  )
  const displayed = legacyTickets.filter((t) => t.status === 'delivered')
  check(
    `[${name}] returned tickets == legacy's delivered tickets (same rows, order, fields)`,
    same(nextTicketsPlain, displayed),
    `\nnew=${next.tickets.map((t) => t.id)} old=${displayed.map((t) => t.id)}`
  )
}

// ---------------------------------------------------------------------------
// 2. Only displayed (delivered) tickets are returned
// ---------------------------------------------------------------------------
{
  const all = getFinancialReport(db, { period: 'all_time' })
  check(
    'all_time returns only delivered tickets',
    all.tickets.every((t) => t.status === 'delivered')
  )
  check(
    'in_progress / ready / reverted tickets are not returned',
    ![D, E, F].some((id) => all.tickets.some((t) => t.id === id))
  )
  check(
    'every delivered ticket is returned (incl. one without a delivered log in all_time)',
    all.tickets.length === deliveredIds.size && all.tickets.every((t) => deliveredIds.has(t.id)),
    `got ${all.tickets.map((t) => t.id)}`
  )
  check('ticket count equals completedTicketsCount', all.tickets.length === all.completedTicketsCount)
  check(
    'in-progress / ready counters are still reported (E in progress, D+F ready)',
    all.inProgressTicketsCount === 1 && all.readyTicketsCount === 2,
    `${all.inProgressTicketsCount}/${all.readyTicketsCount}`
  )
  const g = all.tickets.find((t) => t.id === G)!
  const cat1Split = (
    db.prepare(`SELECT default_split_percentage p FROM RepairCategory WHERE id = ?`).get(cat1) as { p: number }
  ).p
  check(
    'legacy delivered ticket (no frozen shares) gets shares computed from its category split',
    g.my_share === (5000 * cat1Split) / 100 && g.partner_share === 5000 - (5000 * cat1Split) / 100,
    `${g.my_share}/${g.partner_share}`
  )

  const march = getFinancialReport(db, { period: 'custom', startDate: '2026-03-01', endDate: '2026-03-31' })
  check(
    'March range: A and B delivered in March; C counts in April (latest delivery), G has no delivery date',
    same(march.tickets.map((t) => t.id).sort(), [A, B].sort()),
    `got ${march.tickets.map((t) => t.id)}`
  )
  const april = getFinancialReport(db, { period: 'custom', startDate: '2026-04-01', endDate: '2026-04-30' })
  check(
    'April range: only C (latest delivered log)',
    same(
      april.tickets.map((t) => t.id),
      [C]
    ),
    `got ${april.tickets.map((t) => t.id)}`
  )
  check(
    'delivered_at is the latest delivered log',
    (april.tickets[0] as unknown as { delivered_at: string }).delivered_at === '2026-04-05T12:00:00.000Z'
  )
}

// ---------------------------------------------------------------------------
// 3. Custom range robustness
// ---------------------------------------------------------------------------
{
  const inverted = getFinancialReport(db, { period: 'custom', startDate: '2026-12-31', endDate: '2026-01-01' })
  check(
    'from > to returns an empty report without error',
    inverted.tickets.length === 0 &&
      inverted.totalRevenue === 0 &&
      inverted.completedTicketsCount === 0 &&
      inverted.technicianBreakdown.length === 0 &&
      inverted.categoryBreakdown.length === 0 &&
      inverted.inProgressTicketsCount === 0 &&
      inverted.readyTicketsCount === 0
  )

  for (const [label, filter] of [
    ['garbage start', { period: 'custom', startDate: 'garbage', endDate: '2026-03-31' }],
    ['garbage end', { period: 'custom', startDate: '2026-03-01', endDate: 'nope' }],
    ['impossible date (Feb 31)', { period: 'custom', startDate: '2026-02-31', endDate: '2026-03-31' }],
    ['wrong format', { period: 'custom', startDate: '01/03/2026', endDate: '31/03/2026' }]
  ] as [string, ReportFilterDTO][]) {
    const msg = throws(() => getFinancialReport(db, filter))
    check(
      `invalid date (${label}) throws a clear Arabic error (the IPC layer turns it into success:false)`,
      msg !== null && /[؀-ۿ]/.test(msg) && !/Invalid time value/i.test(msg),
      String(msg)
    )
  }

  // Documented behaviour: a custom period with an empty start date means "no lower bound".
  const open = getFinancialReport(db, { period: 'custom', startDate: '', endDate: '' })
  const allTime = getFinancialReport(db, { period: 'all_time' })
  check('custom with empty start behaves like all_time', open.completedTicketsCount === allTime.completedTicketsCount)
}

if (!passed) process.exit(1)
console.log('\n🎉 ALL REPORTS QUERY TESTS PASSED! 🎉')
process.exit(0)
