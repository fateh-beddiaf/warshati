// Manual acceptance script (not part of `npm test`) for the "requires a parts cost" snapshot: builds a database with the REAL code from before the snapshot
// (main @ 97286fb, extracted next to this repo so node_modules resolve) and opens it with the current code.
//
//   git archive 97286fb src | tar -x -C .legacy-97286fb
//   LEGACY_SRC=.legacy-97286fb LEGACY_DB=<path.db> electron -r tsx tests/legacy_cost_snapshot.manual.ts build
//   LEGACY_DB=<path.db>                           electron -r tsx tests/legacy_cost_snapshot.manual.ts verify
import Database from 'better-sqlite3'
import { resolve } from 'path'

const mode = process.argv[process.argv.length - 1]
const dbPath = process.env.LEGACY_DB as string

type Row = Record<string, unknown>
const all = (db: Database.Database, sql: string): Row[] => db.prepare(sql).all() as Row[]

function build(): void {
  const legacySrc = resolve(process.env.LEGACY_SRC as string)
  /* eslint-disable @typescript-eslint/no-require-imports */
  const legacy = require(`${legacySrc}/src/database/index.ts`)
  const queries = require(`${legacySrc}/src/database/queries/tickets.ts`)
  const db = legacy.initDatabase(dbPath) as Database.Database
  // The user had already enabled the switch on categories 1 and 2 before the snapshot existed
  db.prepare(`UPDATE RepairCategory SET requires_parts_cost = 1 WHERE id IN (1, 2)`).run()
  const make = (price: number, category: number, tech: number, cost: number | null, status: string): number => {
    const { ticketId } = queries.createTicket(db, {
      customer: {
        name: `c${price}${category}${status}${cost}`,
        phone: `055${Math.floor(Math.random() * 9000000 + 1000000)}`
      },
      device: { brand: 'Samsung', model: 'Galaxy A54' },
      ticket: {
        repair_category_id: category,
        price,
        payment_type: 'cash',
        amount_paid: price,
        technician_id: tech,
        parts_cost: cost
      },
      accessory_ids: []
    })
    if (status !== 'in_progress') queries.updateTicketStatus(db, { ticketId, newStatus: 'ready' })
    if (status === 'delivered') queries.updateTicketStatus(db, { ticketId, newStatus: 'delivered' })
    return ticketId
  }
  make(4000, 2, 1, 2600, 'delivered') // 1: with a cost
  make(4000, 2, 1, null, 'delivered') // 2: delivered WITHOUT a cost (provisional before the snapshot)
  make(3000, 1, 1, null, 'ready') //     3: ready without a cost (flagged before the snapshot)
  make(2500, 1, 2, null, 'in_progress') // 4: in progress, partner, no cost (flagged)
  make(1500, 4, 1, null, 'delivered') //  5: category without the switch
  make(5000, 2, 1, 0, 'delivered') //     6: explicit zero
  legacy.closeDatabase()
  console.log('built pre-snapshot DB with', all(new Database(dbPath), 'SELECT id FROM Ticket').length, 'tickets')
}

function verify(): void {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const current = require('../src/database/index.ts')
  const tickets = require('../src/database/queries/tickets.ts')
  const reports = require('../src/database/queries/reports.ts')
  const pre = new Database(dbPath)
  const preTickets = all(pre, 'SELECT * FROM Ticket ORDER BY id')
  const preCats = all(pre, 'SELECT * FROM RepairCategory ORDER BY id')
  pre.close()

  const db = current.initDatabase(dbPath) as Database.Database
  const post = all(db, 'SELECT * FROM Ticket ORDER BY id')
  const checks: [string, boolean][] = []
  const check = (name: string, ok: boolean): number => checks.push([name, ok])

  check('same 6 tickets', post.length === 6 && preTickets.length === 6)
  check(
    'every parts cost column unchanged',
    post.every((row, i) => Object.keys(preTickets[i]).every((k) => Object.is(row[k], preTickets[i][k])))
  )
  check(
    'categories unchanged (switch still on for 1 and 2)',
    all(db, 'SELECT * FROM RepairCategory ORDER BY id').every((row, i) =>
      Object.keys(preCats[i]).every((k) => Object.is(row[k], preCats[i][k]))
    )
  )
  const snap = post.map((r) => r.parts_cost_required)
  check(
    `snapshot: tickets with a cost (even 0) => 1, without => 0 (got ${JSON.stringify(snap)})`,
    JSON.stringify(snap) === JSON.stringify([1, 0, 0, 0, 0, 1])
  )
  const list = tickets.getTicketsList(db) as Row[]
  check(
    'nothing is flagged "missing a cost" after the upgrade',
    list.every((r) => r.parts_cost_missing === false)
  )
  const report = reports.getFinancialReport(db, { period: 'all_time' })
  check(
    'report: no provisional ticket, costs counted (2600)',
    report.provisionalTicketsCount === 0 && report.totalPartsCost === 2600
  )
  check('report: stored shares unchanged', report.totalMyShare + report.totalPartnerShare === report.totalNetProfit)

  // a ticket created now, in a category that requires a cost, snapshots 1 and is flagged without one
  const made = tickets.createTicket(db, {
    customer: { name: 'new', phone: '0555000000' },
    device: { brand: 'Samsung', model: 'Galaxy A54' },
    ticket: { repair_category_id: 2, price: 1000, payment_type: 'cash', amount_paid: 1000, technician_id: 1 }
  })
  check(
    'a new ticket in a requiring category snapshots 1 and is flagged',
    (tickets.getTicketsList(db) as Row[]).filter((r) => r.parts_cost_missing).length === 1 && made.ticketId === 7
  )
  // adding the cost by hand to an old ticket still works (id 2 = delivered without cost, 50%)
  tickets.setPartsCost(db, 2, 2600)
  const t2 = all(db, 'SELECT my_share a, partner_share b FROM Ticket WHERE id = 2')[0]
  check('manual cost on an old delivered ticket => 700 / 700', t2.a === 700 && t2.b === 700)

  let ok = true
  for (const [name, pass] of checks) {
    console.log(pass ? '✅' : '❌', name)
    ok = ok && pass
  }
  const dump = (d: Database.Database): string =>
    JSON.stringify(['Ticket', 'RepairCategory', 'StatusLog'].map((t) => all(d, `SELECT * FROM ${t} ORDER BY 1`)))
  const before = dump(db)
  current.closeDatabase()
  const db2 = current.initDatabase(dbPath) as Database.Database
  const same = dump(db2) === before
  console.log(same ? '✅' : '❌', 'second launch changes nothing')
  current.closeDatabase()
  process.exit(ok && same ? 0 : 1)
}

if (mode === 'build') {
  build()
  process.exit(0)
} else {
  verify()
}
