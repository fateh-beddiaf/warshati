import Database from 'better-sqlite3'
import { copyFileSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { initializeSchema, MIGRATION_ADDED_TABLES } from '../src/database/schema'
import { seedInitialData } from '../src/database/seed'
import { closeDatabase, getDatabase, initDatabase } from '../src/database'
import {
  createTicket,
  getTicketById,
  recordPayment,
  setPartsCost,
  updateTicketStatus
} from '../src/database/queries/tickets'
import { updateTicket } from '../src/database/queries/ticket-edit'
import { getFinancialReport } from '../src/database/queries/reports'
import { getRequiredTables, importDatabaseFromFile } from '../src/main/backup-core'
import { SCHEMA_1_0_0 } from './fixtures/legacy-schemas'
import type { CreateTicketDTO } from '../src/shared/types'

// The TicketEditLog migration on a database from the 1.0.0 release (the build the shop runs on real data):
// the table is added in one transaction, NOTHING else changes, a second launch is a no-op, a failing migration leaves
// nothing behind, editing works on the upgraded data, and a 1.0.0 backup can still be imported.

let failures = 0
function eq<T>(actual: T, expected: T, message: string): void {
  if (Object.is(actual, expected) || JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`✅ ${message}`)
  } else {
    failures++
    console.error(`❌ ${message}\n   expected: ${JSON.stringify(expected)}\n   actual:   ${JSON.stringify(actual)}`)
  }
}

type Row = Record<string, unknown>
const all = (db: Database.Database, sql: string, ...p: unknown[]): Row[] => db.prepare(sql).all(...p) as Row[]
const OLD_TABLES = [
  'Customer',
  'RepairCategory',
  'Technician',
  'Accessories',
  'Brand',
  'Model',
  'Ticket',
  'TicketDevice',
  'TicketAccessories',
  'StatusLog',
  'Setting'
]
/** Every row of every 1.0.0 table, and the definition of every 1.0.0 schema object. */
const dumpOld = (db: Database.Database): string =>
  JSON.stringify({
    rows: OLD_TABLES.map((t) => all(db, `SELECT * FROM ${t} ORDER BY 1`)),
    schema: all(db, `SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE '%EditLog%' ORDER BY name`)
  })
const dumpAll = (db: Database.Database): string =>
  JSON.stringify({ old: dumpOld(db), log: all(db, `SELECT * FROM TicketEditLog ORDER BY id`) })
const hasTable = (db: Database.Database, name: string): boolean =>
  all(db, `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`, name).length === 1

/**
 * A database shaped like the shop's: the 1.0.0 schema (frozen), the seed, categories with and without the cost switch,
 * a customer with two tickets, tickets in every status, a debt paid later, a partner ticket, a missing cost,
 * a ticket with an old WSH code. Written only with operations 1.0.0 also had (none of them touches TicketEditLog).
 */
function buildShopDatabase(path: string): Record<string, number> {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.exec(SCHEMA_1_0_0)
  seedInitialData(db)
  db.prepare(`UPDATE RepairCategory SET requires_parts_cost = 1 WHERE name IN ('تغيير شاشة', 'بطارية ومنفذ شحن')`).run()
  db.prepare(`UPDATE RepairCategory SET default_split_percentage = 50 WHERE name = 'بطارية ومنفذ شحن'`).run()
  db.prepare(`INSERT INTO Setting (key, value) VALUES ('backup_auto_enabled', '1')`).run()
  const cat = (name: string): number =>
    (db.prepare(`SELECT id FROM RepairCategory WHERE name = ?`).get(name) as { id: number }).id
  const tech = (partner: number): number =>
    (db.prepare(`SELECT id FROM Technician WHERE is_partner = ?`).get(partner) as { id: number }).id
  const acc = (name: string): number =>
    (db.prepare(`SELECT id FROM Accessories WHERE name = ?`).get(name) as { id: number }).id

  const make = (o: {
    customer: CreateTicketDTO['customer']
    cat: string
    price: number
    paid: number
    partner?: boolean
    cost?: number | null
    accessories?: string[]
  }): number =>
    createTicket(db, {
      customer: o.customer,
      device: { brand: 'Samsung', model: 'Galaxy A54' },
      ticket: {
        repair_category_id: cat(o.cat),
        price: o.price,
        payment_type: o.paid >= o.price ? 'cash' : 'credit',
        amount_paid: o.paid,
        technician_id: tech(o.partner ? 1 : 0),
        parts_cost: o.cost ?? null
      },
      accessory_ids: (o.accessories ?? []).map(acc)
    }).ticketId
  const step = (id: number, ...statuses: ('ready' | 'delivered')[]): void => {
    for (const s of statuses) updateTicketStatus(db, { ticketId: id, newStatus: s })
  }

  const ids: Record<string, number> = {}
  ids.screen = make({
    customer: { name: 'محمد', phone: '0555 12 34 56' },
    cat: 'بطارية ومنفذ شحن',
    price: 4000,
    paid: 4000,
    cost: 2600,
    accessories: ['شاحن']
  })
  step(ids.screen, 'ready', 'delivered')
  const mohamed = (db.prepare(`SELECT customer_id FROM Ticket WHERE id = ?`).get(ids.screen) as { customer_id: number })
    .customer_id
  ids.second = make({
    customer: { id: mohamed, name: 'محمد', phone: '0555 12 34 56' },
    cat: 'صيانة عامة وأخرى',
    price: 1500,
    paid: 500
  })
  step(ids.second, 'ready')
  ids.partner = make({
    customer: { name: 'سارة', phone: '0666000000' },
    cat: 'صيانة بورد وسوفتوير',
    price: 3000,
    paid: 3000,
    partner: true,
    cost: 500
  })
  step(ids.partner, 'ready', 'delivered')
  ids.debt = make({
    customer: { name: 'كريم', phone: '0777000000' },
    cat: 'تغيير شاشة',
    price: 5000,
    paid: 1000,
    cost: 3000
  })
  step(ids.debt, 'ready', 'delivered')
  recordPayment(db, ids.debt, 1500)
  ids.missingCost = make({
    customer: { name: 'ليلى', phone: '0550000000' },
    cat: 'تغيير شاشة',
    price: 2500,
    paid: 2500
  })
  step(ids.missingCost, 'ready', 'delivered')
  ids.inProgress = make({
    customer: { name: 'ياسين', phone: '0551111111' },
    cat: 'تغيير شاشة',
    price: 6000,
    paid: 0,
    accessories: ['شاحن', 'شريحة SIM']
  })
  // A ticket migrated from the old code format keeps its WSH code next to the new one
  db.prepare(`UPDATE Ticket SET legacy_barcode_code = 'WSH0001' WHERE id = ?`).run(ids.inProgress)
  db.close()
  return ids
}

async function main(): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'warshati-editlog-mig-'))
  try {
    // =============================================================================================
    console.log('\n--- 1. First launch of the new version on a 1.0.0 database ---')
    const path = join(dir, 'shop.db')
    const ids = buildShopDatabase(path)
    const pristine = join(dir, 'shop-1.0.0-copy.db')
    {
      const pre = new Database(path)
      pre.pragma('wal_checkpoint(TRUNCATE)')
      eq(hasTable(pre, 'TicketEditLog'), false, 'the 1.0.0 database has no TicketEditLog')
      pre.close()
    }
    copyFileSync(path, pristine) // a backup taken by 1.0.0, used by the import test below
    const before = (() => {
      const pre = new Database(path, { readonly: true })
      const d = dumpOld(pre)
      const report = JSON.stringify(getFinancialReport(pre, { period: 'all_time' }))
      pre.close()
      return { d, report }
    })()

    closeDatabase()
    const db = initDatabase(path) // exactly the app's boot path: schema + migrations + seed
    eq(hasTable(db, 'TicketEditLog'), true, 'TicketEditLog created')
    eq(
      all(db, `PRAGMA table_info(TicketEditLog)`).map((c) => [c.name, c.type, c.notnull]),
      [
        ['id', 'INTEGER', 0],
        ['ticket_id', 'INTEGER', 1],
        ['field', 'TEXT', 1],
        ['old_value', 'TEXT', 0],
        ['new_value', 'TEXT', 0],
        ['timestamp', 'TEXT', 1]
      ],
      'TicketEditLog columns'
    )
    eq(
      all(db, `PRAGMA foreign_key_list(TicketEditLog)`).map((f) => [f.table, f.from, f.on_delete]),
      [['Ticket', 'ticket_id', 'CASCADE']],
      'ticket_id references Ticket (cascade)'
    )
    eq(all(db, `SELECT name FROM sqlite_master WHERE name = 'idx_ticketeditlog_ticket'`).length, 1, 'index created')
    eq(all(db, `SELECT * FROM TicketEditLog`), [], 'the history starts empty')
    eq(dumpOld(db), before.d, 'every 1.0.0 row and schema object is exactly as it was')
    eq(JSON.stringify(getFinancialReport(db, { period: 'all_time' })), before.report, 'reports are identical')
    eq(db.pragma('integrity_check', { simple: true }), 'ok', 'integrity_check ok')
    eq(db.pragma('foreign_key_check'), [], 'no foreign key problem')
    const d = getTicketById(db, ids.screen)!
    eq([d.editLogs, d.customerTicketCount], [[], 2], 'details: empty history, the customer has 2 tickets')

    // =============================================================================================
    console.log('\n--- 2. A second launch changes nothing ---')
    const afterFirst = dumpAll(db)
    closeDatabase()
    const db2 = initDatabase(path)
    eq(dumpAll(db2), afterFirst, 'second launch: identical')

    // =============================================================================================
    console.log('\n--- 3. Editing works on the upgraded real-shaped data ---')
    const priced = updateTicket(db2, ids.screen, { price: 5000, amount_paid: 5000, confirm_delivered: true })
    eq(
      [priced.details.ticket.my_share, priced.details.ticket.partner_share],
      [1200, 1200],
      '4000/2600 -> 5000 at 50%: 1200 / 1200'
    )
    const toPartner = updateTicket(db2, ids.debt, { technician_id: 2, confirm_delivered: true })
    eq(
      [
        toPartner.details.ticket.my_share,
        toPartner.details.ticket.partner_share,
        toPartner.details.ticket.amount_remaining
      ],
      [0, 2000, 2500],
      'debt ticket to the partner: 0 / net, the debt is untouched'
    )
    setPartsCost(db2, ids.missingCost, 900)
    eq(
      getTicketById(db2, ids.missingCost)!.editLogs.map((l) => l.field),
      ['parts_cost'],
      'setPartsCost logs on the upgraded data'
    )
    const renamed = updateTicket(db2, ids.second, { customer: { name: 'محمد أمين', phone: '0555 12 34 56' } })
    eq(getTicketById(db2, ids.screen)!.customer.name, 'محمد أمين', 'customer edit reaches the customer’s other ticket')
    eq(renamed.changedFields, ['customer_name'], 'only the name changed')
    eq(db2.pragma('foreign_key_check'), [], 'still no foreign key problem')
    closeDatabase()

    // =============================================================================================
    console.log('\n--- 4. A migration that fails leaves nothing behind ---')
    {
      const broken = join(dir, 'broken.db')
      buildShopDatabase(broken)
      const b = new Database(broken)
      b.pragma('wal_checkpoint(TRUNCATE)')
      // An object already holds the index name: CREATE INDEX fails after CREATE TABLE succeeded
      b.exec(`CREATE VIEW idx_ticketeditlog_ticket AS SELECT 1`)
      const pre = dumpOld(b)
      let error: string | null = null
      try {
        initializeSchema(b)
      } catch (err) {
        error = err instanceof Error ? err.message : String(err)
      }
      eq(error !== null, true, `the migration failed (${error})`)
      eq(hasTable(b, 'TicketEditLog'), false, 'the table created before the failure was rolled back')
      eq(dumpOld(b), pre, 'nothing else changed')
      b.close()
    }

    // =============================================================================================
    console.log('\n--- 5. A backup taken by 1.0.0 can still be imported ---')
    {
      eq(MIGRATION_ADDED_TABLES.includes('TicketEditLog'), true, 'TicketEditLog is a migration-added table')
      eq(getRequiredTables().includes('TicketEditLog'), false, 'it is not required in an imported file')
      eq(getRequiredTables().includes('StatusLog'), true, 'the 1.0.0 tables still are')
      const live = join(dir, 'live', 'warshati.db')
      closeDatabase()
      initDatabase(live)
      const result = await importDatabaseFromFile(pristine, live, { safetyBackupPath: join(dir, 'safety.db') })
      eq(result.success, true, `1.0.0 backup imported (${result.error ?? 'ok'})`)
      const imported = getDatabase()
      eq(hasTable(imported, 'TicketEditLog'), true, 'the imported database got TicketEditLog')
      eq(dumpOld(imported), before.d, 'the imported data is exactly the 1.0.0 data')
      const edited = updateTicket(imported, ids.inProgress, { accessory_ids: [] })
      eq(edited.changedFields, ['accessories'], 'editing works right after the import')
      closeDatabase()
    }
  } finally {
    closeDatabase()
    rmSync(dir, { recursive: true, force: true })
  }
}

main().then(
  () => {
    if (failures > 0) {
      console.error(`\n❌ ${failures} check(s) failed`)
      process.exit(1)
    }
    console.log('\n✅ ticket edit log migration: all checks passed')
  },
  (err) => {
    console.error(err)
    process.exit(1)
  }
)
