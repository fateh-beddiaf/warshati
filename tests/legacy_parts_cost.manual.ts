// Manual acceptance script (not part of `npm test`), T004: builds a database with the REAL older code
// (main @ 33b4cfc or main @ 2410a27, extracted next to this repo so node_modules resolve) and opens it
// with the current code.
//
//   git archive 33b4cfc src | tar -x -C .legacy-33b4cfc
//   LEGACY_SRC=.legacy-33b4cfc LEGACY_DB=<path.db> electron -r tsx tests/legacy_parts_cost.manual.ts build
//   LEGACY_DB=<path.db>                           electron -r tsx tests/legacy_parts_cost.manual.ts verify
import Database from 'better-sqlite3'
import { resolve } from 'path'

const mode = process.argv[process.argv.length - 1]
const dbPath = process.env.LEGACY_DB as string

type Row = Record<string, unknown>
const one = (db: Database.Database, sql: string, ...p: unknown[]): Row => db.prepare(sql).get(...p) as Row
const all = (db: Database.Database, sql: string, ...p: unknown[]): Row[] => db.prepare(sql).all(...p) as Row[]
const dump = (db: Database.Database): string =>
  JSON.stringify(
    ['Ticket', 'RepairCategory', 'StatusLog', 'Setting'].map((t) => all(db, `SELECT * FROM ${t} ORDER BY 1`))
  )

function build(): void {
  const legacySrc = resolve(process.env.LEGACY_SRC as string)
  /* eslint-disable @typescript-eslint/no-require-imports */
  const legacy = require(`${legacySrc}/src/database/index.ts`)
  const queries = require(`${legacySrc}/src/database/queries/tickets.ts`)
  const db = legacy.initDatabase(dbPath) as Database.Database
  const make = (
    price: number,
    category: number,
    technician: number,
    paid: number,
    deliver: boolean,
    ready = true
  ): number => {
    const { ticketId } = queries.createTicket(db, {
      customer: {
        name: `زبون ${price}-${category}-${technician}`,
        phone: `055${String(price).replace(/\D/g, '').padEnd(7, '0').slice(0, 7)}`
      },
      device: { brand: 'Samsung', model: 'Galaxy A54' },
      ticket: {
        repair_category_id: category,
        price,
        payment_type: paid >= price ? 'cash' : 'credit',
        amount_paid: paid,
        technician_id: technician
      },
      accessory_ids: []
    })
    if (ready) queries.updateTicketStatus(db, { ticketId, newStatus: 'ready' })
    if (deliver) queries.updateTicketStatus(db, { ticketId, newStatus: 'delivered' })
    return ticketId
  }
  make(1255.5, 3, 1, 1255.5, true) // 70%  -> 878.85 / 376.65
  make(8000, 1, 1, 3000, true) //   40%  -> 3200 / 4800, with a debt
  make(10000, 1, 2, 10000, true) //  partner -> 0 / 10000
  make(4000, 2, 1, 4000, true) //   50%  -> 2000 / 2000
  make(2500, 2, 1, 2500, false, false) // in progress
  make(3000, 2, 1, 3000, false, true) //  ready
  legacy.closeDatabase()
  console.log('built legacy DB:', one(new Database(dbPath), 'SELECT COUNT(*) c FROM Ticket').c as number, 'tickets')
}

function verify(): void {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const current = require('../src/database/index.ts')
  const tickets = require('../src/database/queries/tickets.ts')
  const reports = require('../src/database/queries/reports.ts')

  // Snapshot of the legacy columns before the upgrade
  const pre = new Database(dbPath)
  const preTickets = all(pre, 'SELECT * FROM Ticket ORDER BY id')
  const preCategories = all(pre, 'SELECT * FROM RepairCategory ORDER BY id')
  const preLogs = JSON.stringify(all(pre, 'SELECT * FROM StatusLog ORDER BY id'))
  pre.close()

  const db = current.initDatabase(dbPath) as Database.Database
  const post = all(db, 'SELECT * FROM Ticket ORDER BY id')
  const checks: [string, boolean][] = []
  const check = (name: string, ok: boolean): number => checks.push([name, ok])

  check('same tickets', post.length === preTickets.length && post.length === 6)
  check(
    'every legacy ticket column unchanged',
    post.every((row, i) => Object.keys(preTickets[i]).every((k) => Object.is(row[k], preTickets[i][k])))
  )
  check(
    'every legacy category column unchanged, none requires a cost',
    all(db, 'SELECT * FROM RepairCategory ORDER BY id').every(
      (row, i) =>
        row.requires_parts_cost === 0 &&
        Object.keys(preCategories[i]).every((k) => Object.is(row[k], preCategories[i][k]))
    )
  )
  check('status log unchanged', JSON.stringify(all(db, 'SELECT * FROM StatusLog ORDER BY id')) === preLogs)
  check(
    'parts_cost NULL everywhere',
    post.every((r) => r.parts_cost === null)
  )
  const applied = post.map((r) => r.split_percentage_applied)
  check(
    `back-fill: [70, 40, NULL (partner), 50, NULL, NULL] (got ${JSON.stringify(applied)})`,
    JSON.stringify(applied) === JSON.stringify([70, 40, null, 50, null, null])
  )

  const report = reports.getFinancialReport(db, { period: 'all_time' })
  check('report unchanged by the upgrade: revenue 23255.5', report.totalRevenue === 23255.5)
  check(
    'report: no cost, net = revenue, nothing provisional',
    report.totalPartsCost === 0 && report.totalNetProfit === 23255.5 && report.provisionalTicketsCount === 0
  )
  check(
    'report: shares on the price as before (my 6078.85 / partner 17176.65)',
    report.totalMyShare === 6078.85 && report.totalPartnerShare === 17176.65
  )

  // The user's example on the upgraded database: 4000 ticket (id 4, category 2 at 50%), cost 2600
  tickets.setPartsCost(db, 4, 2600)
  const t4 = one(
    db,
    'SELECT my_share a, partner_share b, split_percentage_applied c, amount_remaining d FROM Ticket WHERE id = 4'
  )
  check(
    'cost 2600 on the 4000 ticket => 700 / 700 with the frozen 50%',
    t4.a === 700 && t4.b === 700 && t4.c === 50 && t4.d === 0
  )
  // ... even if the category percentage changes afterwards
  db.prepare('UPDATE RepairCategory SET default_split_percentage = 90 WHERE id = 2').run()
  tickets.setPartsCost(db, 4, 2000)
  const t4b = one(db, 'SELECT my_share a, partner_share b FROM Ticket WHERE id = 4')
  check(
    'category changed to 90%: a new cost still uses the frozen 50% (2000 => 1000 / 1000)',
    t4b.a === 1000 && t4b.b === 1000
  )
  db.prepare('UPDATE RepairCategory SET default_split_percentage = 50 WHERE id = 2').run()
  // partner ticket (id 3)
  tickets.setPartsCost(db, 3, 2600)
  const t3 = one(db, 'SELECT my_share a, partner_share b FROM Ticket WHERE id = 3')
  check('partner ticket 10000 - 2600 => 0 / 7400', t3.a === 0 && t3.b === 7400)
  // fractional 70% ticket (id 1)
  tickets.setPartsCost(db, 1, 100.25)
  const t1 = one(db, 'SELECT my_share a, partner_share b FROM Ticket WHERE id = 1')
  check('70% ticket 1255.50 - 100.25 => 808.68 / 346.57', t1.a === 808.68 && t1.b === 346.57)
  // loss on the 8000 ticket (id 2, 40%)
  tickets.setPartsCost(db, 2, 9000)
  const t2 = one(db, 'SELECT my_share a, partner_share b, amount_remaining c FROM Ticket WHERE id = 2')
  check(
    'loss 8000 / 9000 at 40% => -400 / -600, debt untouched (5000)',
    t2.a === -400 && t2.b === -600 && t2.c === 5000
  )

  let ok = true
  for (const [name, pass] of checks) {
    console.log(pass ? '✅' : '❌', name)
    ok = ok && pass
  }
  // reopen again: nothing changes
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
