// Manual acceptance script (not part of `npm test`): builds a database with the ORIGINAL code
// (main @ 2410a27, extracted to LEGACY_SRC) and then opens it with the current code.
// Usage: LEGACY_SRC=<dir containing src/database> LEGACY_DB=<path.db> electron -r tsx tests/legacy_migration.manual.ts build|verify
import Database from 'better-sqlite3'

const mode = process.argv[process.argv.length - 1]
const dbPath = process.env.LEGACY_DB as string
const legacySrc = process.env.LEGACY_SRC as string

function count(db: Database.Database, sql: string, ...p: unknown[]): number {
  return (db.prepare(sql).get(...p) as { c: number }).c
}

async function build(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const legacy = require(`${legacySrc}/src/database/index.ts`)
  const queries = require(`${legacySrc}/src/database/queries/tickets.ts`)
  const db = legacy.initDatabase(dbPath) as Database.Database
  // user customisation on the old app: delete a seeded brand + category, add own brand, make tickets
  db.prepare(`DELETE FROM Brand WHERE name = 'Honor'`).run()
  db.prepare(`DELETE FROM RepairCategory WHERE name = 'صيانة عامة وأخرى'`).run()
  db.prepare(`INSERT INTO Brand (name) VALUES ('Condor')`).run() // same as a new catalog brand
  db.prepare(`INSERT INTO Brand (name) VALUES ('محلي')`).run()
  for (let i = 0; i < 3; i++) {
    queries.createTicket(db, {
      customer: { name: `زبون ${i}`, phone: `055500000${i}` },
      device: { brand: 'Samsung', model: 'Galaxy A54' },
      ticket: { repair_category_id: 1, price: 4000, payment_type: 'cash', amount_paid: 4000, technician_id: 1 },
      accessory_ids: []
    })
  }
  console.log('built legacy DB:', count(db, 'SELECT COUNT(*) c FROM Brand'), 'brands,', count(db, 'SELECT COUNT(*) c FROM Ticket'), 'tickets')
  legacy.closeDatabase()
}

async function verify(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const current = require('../src/database/index.ts')
  const db = current.initDatabase(dbPath) as Database.Database
  const brands = count(db, 'SELECT COUNT(*) c FROM Brand')
  const checks: [string, boolean][] = [
    ['tickets intact (3)', count(db, 'SELECT COUNT(*) c FROM Ticket') === 3],
    ['customers intact (3)', count(db, 'SELECT COUNT(*) c FROM Customer') === 3],
    ['deleted seeded brand Honor comes back only via the new catalog (pack 2), once', count(db, `SELECT COUNT(*) c FROM Brand WHERE name = 'Honor'`) === 1],
    ['deleted category not resurrected', count(db, `SELECT COUNT(*) c FROM RepairCategory WHERE name = 'صيانة عامة وأخرى'`) === 0],
    ['user brand "محلي" kept', count(db, `SELECT COUNT(*) c FROM Brand WHERE name = 'محلي'`) === 1],
    ['no duplicate Condor', count(db, `SELECT COUNT(*) c FROM Brand WHERE lower(name) = 'condor'`) === 1],
    ['catalog added (60+ brands)', brands >= 60],
    ['no duplicate brands (case-insensitive)', count(db, `SELECT COUNT(*) c FROM (SELECT lower(name) n FROM Brand GROUP BY n HAVING COUNT(*) > 1)`) === 0],
    ['seed_version stamped', count(db, `SELECT COUNT(*) c FROM Setting WHERE key = 'seed_version'`) === 1]
  ]
  let ok = true
  for (const [name, pass] of checks) {
    console.log(pass ? '✅' : '❌', name)
    ok = ok && pass
  }
  // reopen again: nothing changes
  current.closeDatabase()
  const db2 = current.initDatabase(dbPath) as Database.Database
  const same = count(db2, 'SELECT COUNT(*) c FROM Brand') === brands
  console.log(same ? '✅' : '❌', 'second launch changes nothing')
  console.log('brands:', brands, 'models:', count(db2, 'SELECT COUNT(*) c FROM Model'))
  process.exit(ok && same ? 0 : 1)
}

;(mode === 'build' ? build() : verify()).then(() => mode === 'build' && process.exit(0))
