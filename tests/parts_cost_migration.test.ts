import Database from 'better-sqlite3'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { initializeSchema } from '../src/database/schema'
import { seedInitialData } from '../src/database/seed'
import { setPartsCost, getTicketById } from '../src/database/queries/tickets'
import { getFinancialReport } from '../src/database/queries/reports'
import { getRepairCategories } from '../src/database/queries/metadata'
import { importDatabaseFromFile } from '../src/main/backup-core'
import { closeDatabase } from '../src/database'
import { calculateProfitSplit } from '../src/shared/profit'
import { LEGACY_SCHEMA_ANCIENT, LEGACY_SCHEMA_BEFORE_PARTS_COST } from './fixtures/legacy-schemas'

// T004 migration: databases from main @ 33b4cfc / main @ 2410a27 (identical schema) and from an older
// layout are upgraded without losing anything; the back-fill is right; a second launch changes nothing;
// a failing migration rolls EVERYTHING back (one transaction).

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
const one = (db: Database.Database, sql: string, ...p: unknown[]): Row => db.prepare(sql).get(...p) as Row
const columns = (db: Database.Database, table: string): string[] =>
  (all(db, `PRAGMA table_info(${table})`) as { name: string }[]).map((c) => c.name)
const dump = (db: Database.Database): string =>
  JSON.stringify(
    [
      'Customer',
      'RepairCategory',
      'Technician',
      'Ticket',
      'TicketDevice',
      'StatusLog',
      'Setting',
      'Brand',
      'Model'
    ].map((t) => all(db, `SELECT * FROM ${t} ORDER BY 1`))
  )

// The old code froze my_share = round2(price x my%) on the price
const oldShare = (price: number, pct: number): number => Math.round(price * (pct / 100) * 100) / 100

// ---------------------------------------------------------------------------------------------
// Build a populated database exactly as main @ 33b4cfc would have left it
// ---------------------------------------------------------------------------------------------
function buildLegacyV1(path: string): { ids: Record<string, number> } {
  const db = new Database(path)
  db.exec(LEGACY_SCHEMA_BEFORE_PARTS_COST)
  db.exec(`
    INSERT INTO Technician (name, is_partner) VALUES ('أنا', 0), ('الشريك', 1);
    INSERT INTO RepairCategory (name, default_split_percentage) VALUES ('شاشات', 40), ('بطارية', 50), ('بورد', 70), ('عام', 33.33);
    INSERT INTO Brand (name) VALUES ('Samsung');
    INSERT INTO Model (brand_id, name) VALUES (1, 'Galaxy A54');
    INSERT INTO Customer (name, phone) VALUES ('زبون', '0555000000');
    INSERT INTO Setting (key, value) VALUES ('seed_version', '2');
  `)
  const ids: Record<string, number> = {}
  let n = 0
  const add = (
    key: string,
    o: { tech: 1 | 2; cat: number; price: number; status: string; shares?: 'old' | 'none'; pct?: number; paid?: number }
  ): void => {
    n++
    const id = Number(
      db
        .prepare(
          `INSERT INTO Ticket (barcode_code, customer_id, created_at, technician, technician_id, repair_category_id, price, payment_type, amount_paid, amount_remaining, status, my_share, partner_share)
           VALUES (?, 1, ?, ?, ?, ?, ?, 'cash', ?, ?, ?, ?, ?)`
        )
        .run(
          `WSHMIG${n}`,
          '2026-03-01T10:00:00.000Z',
          o.tech === 1 ? 'أنا' : 'الشريك',
          o.tech,
          o.cat,
          o.price,
          o.paid ?? o.price,
          o.price - (o.paid ?? o.price),
          o.status,
          o.status === 'delivered' && o.shares !== 'none' ? (o.tech === 2 ? 0 : oldShare(o.price, o.pct ?? 50)) : null,
          o.status === 'delivered' && o.shares !== 'none'
            ? o.tech === 2
              ? o.price
              : Math.round((o.price - oldShare(o.price, o.pct ?? 50)) * 100) / 100
            : null
        ).lastInsertRowid
    )
    db.prepare(
      `INSERT INTO TicketDevice (ticket_id, brand, model, brand_id, model_id, short_label) VALUES (?, 'Samsung', 'Galaxy A54', 1, 1, 'SA A54')`
    ).run(id)
    db.prepare(
      `INSERT INTO StatusLog (ticket_id, old_status, new_status, timestamp) VALUES (?, NULL, 'in_progress', '2026-03-01T10:00:00.000Z')`
    ).run(id)
    if (o.status !== 'in_progress')
      db.prepare(
        `INSERT INTO StatusLog (ticket_id, old_status, new_status, timestamp) VALUES (?, 'in_progress', 'ready', '2026-03-02T10:00:00.000Z')`
      ).run(id)
    if (o.status === 'delivered')
      db.prepare(
        `INSERT INTO StatusLog (ticket_id, old_status, new_status, timestamp) VALUES (?, 'ready', 'delivered', '2026-03-03T10:00:00.000Z')`
      ).run(id)
    ids[key] = id
  }
  add('fractional70', { tech: 1, cat: 3, price: 1255.5, status: 'delivered', pct: 70 })
  add('screen40', { tech: 1, cat: 1, price: 8000, status: 'delivered', pct: 40 })
  add('odd3333', { tech: 1, cat: 4, price: 3333, status: 'delivered', pct: 33.33 })
  add('partner', { tech: 2, cat: 1, price: 10000, status: 'delivered' })
  add('freeRepair', { tech: 1, cat: 2, price: 0, status: 'delivered', pct: 50 })
  add('noShares', { tech: 1, cat: 2, price: 2000, status: 'delivered', shares: 'none' })
  add('inProgress', { tech: 1, cat: 1, price: 4000, status: 'in_progress' })
  add('ready', { tech: 1, cat: 1, price: 4000, status: 'ready' })
  add('debt', { tech: 1, cat: 2, price: 5000, status: 'delivered', pct: 50, paid: 2000 })
  db.pragma('journal_mode = DELETE')
  db.close()
  return { ids }
}

const dir = mkdtempSync(join(tmpdir(), 'warshati-parts-cost-mig-'))

async function main(): Promise<void> {
  try {
    console.log('--- Section 1: database from main @ 33b4cfc / @ 2410a27 ---')
    {
      const path = join(dir, 'v1.db')
      const { ids } = buildLegacyV1(path)

      // Snapshot of every legacy column BEFORE the upgrade
      const pre = new Database(path)
      const legacyCols = columns(pre, 'Ticket')
      const preTickets = all(pre, `SELECT * FROM Ticket ORDER BY id`)
      const preCategories = all(pre, `SELECT * FROM RepairCategory ORDER BY id`)
      const preOther = JSON.stringify([
        all(pre, `SELECT * FROM Customer`),
        all(pre, `SELECT * FROM TicketDevice`),
        all(pre, `SELECT * FROM StatusLog`),
        all(pre, `SELECT * FROM Technician`)
      ])
      eq(
        legacyCols.includes('parts_cost') || legacyCols.includes('split_percentage_applied'),
        false,
        'precondition: the legacy Ticket has no T004 columns'
      )
      eq(
        columns(pre, 'RepairCategory').includes('requires_parts_cost'),
        false,
        'precondition: the legacy RepairCategory has no requires_parts_cost'
      )
      pre.close()

      const db = new Database(path)
      db.pragma('foreign_keys = ON')
      initializeSchema(db)
      seedInitialData(db)

      eq(columns(db, 'Ticket').includes('parts_cost'), true, 'Ticket.parts_cost added')
      eq(columns(db, 'Ticket').includes('split_percentage_applied'), true, 'Ticket.split_percentage_applied added')
      eq(
        columns(db, 'RepairCategory').includes('requires_parts_cost'),
        true,
        'RepairCategory.requires_parts_cost added'
      )

      const info = (table: string, col: string): Row =>
        (all(db, `PRAGMA table_info(${table})`) as Row[]).find((c) => c.name === col)!
      eq(
        [
          info('RepairCategory', 'requires_parts_cost').notnull,
          info('RepairCategory', 'requires_parts_cost').dflt_value
        ],
        [1, '0'],
        'requires_parts_cost is NOT NULL DEFAULT 0'
      )
      eq(
        [info('Ticket', 'parts_cost').notnull, info('Ticket', 'parts_cost').dflt_value],
        [0, 'NULL'],
        'parts_cost is nullable, default NULL'
      )
      eq(info('Ticket', 'split_percentage_applied').notnull, 0, 'split_percentage_applied is nullable')

      // Nothing lost: every legacy column of every row is identical
      const postTickets = all(db, `SELECT * FROM Ticket ORDER BY id`)
      eq(postTickets.length, preTickets.length, 'same number of tickets')
      // barcode_code is the one exception: old-format codes are replaced by scannable ones and kept, unchanged,
      // in legacy_barcode_code (see ticket_codes.test.ts)
      const legacyOnly = (rows: Row[]): Row[] =>
        rows.map((r) =>
          Object.fromEntries(legacyCols.map((c) => [c, c === 'barcode_code' ? r.legacy_barcode_code : r[c]]))
        )
      eq(
        JSON.stringify(legacyOnly(postTickets)),
        JSON.stringify(preTickets),
        'every legacy ticket column is byte-identical after the upgrade (old code kept in legacy_barcode_code)'
      )
      const postCategories = all(db, `SELECT * FROM RepairCategory ORDER BY id`)
      eq(
        JSON.stringify(postCategories.map(({ requires_parts_cost, ...rest }) => (void requires_parts_cost, rest))),
        JSON.stringify(preCategories),
        'every legacy category column is identical'
      )
      eq(
        postCategories.every((c) => c.requires_parts_cost === 0),
        true,
        'every existing category defaults to NOT requiring a cost'
      )
      eq(
        postTickets.every((t) => t.parts_cost === null),
        true,
        'every existing ticket has parts_cost NULL (not entered)'
      )
      eq(
        JSON.stringify([
          all(db, `SELECT * FROM Customer`),
          all(db, `SELECT * FROM TicketDevice`),
          all(db, `SELECT * FROM StatusLog`),
          all(db, `SELECT * FROM Technician`)
        ]),
        preOther,
        'customers, devices, status log and technicians untouched'
      )

      // Back-fill of the frozen percentage
      const applied = (key: string): unknown =>
        one(db, `SELECT split_percentage_applied a FROM Ticket WHERE id = ?`, ids[key]).a
      eq(applied('fractional70'), 70, 'back-fill: 1255.5 / 878.85 => 70')
      eq(applied('screen40'), 40, 'back-fill: 8000 / 3200 => 40')
      eq(applied('odd3333'), 33.33, 'back-fill: 33.33% reproduced exactly')
      eq(applied('partner'), null, 'back-fill: partner ticket => NULL (always 100%)')
      eq(applied('freeRepair'), null, 'back-fill: price 0 => NULL (documented fallback to the category percentage)')
      eq(applied('noShares'), null, 'back-fill: delivered ticket without stored shares => NULL')
      eq(applied('inProgress'), null, 'back-fill: in progress => NULL')
      eq(applied('ready'), null, 'back-fill: ready => NULL')
      eq(applied('debt'), 50, 'back-fill: a delivered ticket with debt => 50')
      // The back-filled percentage reproduces the stored share (what a later cost edit relies on)
      for (const key of ['fractional70', 'screen40', 'odd3333', 'debt']) {
        const t = one(db, `SELECT price, my_share, split_percentage_applied a FROM Ticket WHERE id = ?`, ids[key]) as {
          price: number
          my_share: number
          a: number
        }
        const again = calculateProfitSplit({ price: t.price, isPartner: false, appliedSplitPercentage: t.a })
        eq(again.myShare, t.my_share, `back-fill of "${key}" reproduces the stored my_share`)
      }

      // Reports are unchanged by the upgrade (no costs entered => net = price)
      const report = getFinancialReport(db, { period: 'all_time' })
      const rawMy = (
        all(db, `SELECT my_share FROM Ticket WHERE status = 'delivered' AND my_share IS NOT NULL`) as {
          my_share: number
        }[]
      ).reduce((s, r) => s + r.my_share, 0)
      eq(report.totalPartsCost, 0, 'report after upgrade: no costs')
      eq(report.totalNetProfit, report.totalRevenue, 'report after upgrade: net profit = revenue')
      eq(
        report.provisionalTicketsCount,
        0,
        'report after upgrade: nothing provisional (no category requires a cost yet)'
      )
      eq(
        report.totalMyShare >= Math.round(rawMy * 100) / 100,
        true,
        'report after upgrade: stored shares still counted (plus the share-less one computed)'
      )

      // A cost added later to a back-filled ticket uses the back-filled percentage, not the category's
      db.prepare(`UPDATE RepairCategory SET default_split_percentage = 10 WHERE id = 3`).run()
      setPartsCost(db, ids.fractional70, 100.25)
      eq(
        [
          one(db, `SELECT my_share a FROM Ticket WHERE id = ?`, ids.fractional70).a,
          one(db, `SELECT partner_share a FROM Ticket WHERE id = ?`, ids.fractional70).a
        ],
        [808.68, 346.57],
        'cost added to a legacy ticket uses its back-filled 70% (category now says 10%)'
      )
      // price 0 + no frozen percentage: documented fallback = category percentage (50%)
      setPartsCost(db, ids.freeRepair, 800)
      eq(
        [
          one(db, `SELECT my_share a FROM Ticket WHERE id = ?`, ids.freeRepair).a,
          one(db, `SELECT partner_share a FROM Ticket WHERE id = ?`, ids.freeRepair).a
        ],
        [-400, -400],
        "price-0 legacy ticket: fallback to the category's 50% => -400 / -400"
      )
      eq(
        one(db, `SELECT split_percentage_applied a FROM Ticket WHERE id = ?`, ids.freeRepair).a,
        50,
        'the fallback percentage is frozen on first use'
      )
      setPartsCost(db, ids.partner, 2600)
      eq(
        [
          one(db, `SELECT my_share a FROM Ticket WHERE id = ?`, ids.partner).a,
          one(db, `SELECT partner_share a FROM Ticket WHERE id = ?`, ids.partner).a
        ],
        [0, 7400],
        'partner legacy ticket: 100% of the net (10000 - 2600)'
      )
      // restore to compare the second boot
      db.prepare(`UPDATE RepairCategory SET default_split_percentage = 70 WHERE id = 3`).run()
      db.close()

      // Second boot: nothing changes, not even the back-filled values
      const db2 = new Database(path)
      db2.pragma('foreign_keys = ON')
      const before = dump(db2)
      initializeSchema(db2)
      seedInitialData(db2)
      initializeSchema(db2)
      eq(dump(db2), before, 'a second (and third) launch changes nothing at all')
      eq(
        getRepairCategories(db2).every((c) => c.requires_parts_cost === false),
        true,
        'the categories still do not require a cost'
      )
      db2.close()
    }

    console.log('\n--- Section 2: an older layout (identity columns missing too) migrates in one go ---')
    {
      const path = join(dir, 'ancient.db')
      const db0 = new Database(path)
      db0.exec(LEGACY_SCHEMA_ANCIENT)
      db0.exec(`
      INSERT INTO Technician (name) VALUES ('أنا'), ('الشريك');
      INSERT INTO RepairCategory (name, default_split_percentage) VALUES ('شاشات', 40);
      INSERT INTO Brand (name) VALUES ('Samsung');
      INSERT INTO Model (brand_id, name) VALUES (1, 'Galaxy A54');
      INSERT INTO Customer (name, phone) VALUES ('زبون', '0555');
      INSERT INTO Ticket (barcode_code, customer_id, created_at, technician, repair_category_id, price, payment_type, amount_paid, amount_remaining, status)
        VALUES ('WSHOLD1', 1, '2025-01-01T10:00:00.000Z', 'أنا', 1, 6000, 'cash', 6000, 0, 'delivered'),
               ('WSHOLD2', 1, '2025-01-02T10:00:00.000Z', 'الشريك', 1, 3000, 'cash', 3000, 0, 'ready');
      INSERT INTO TicketDevice (ticket_id, brand, model, short_label) VALUES (1, 'Samsung', 'Galaxy A54', 'SA'), (2, 'Samsung', 'Galaxy A54', 'SA');
      INSERT INTO StatusLog (ticket_id, old_status, new_status, timestamp) VALUES (1, NULL, 'in_progress', '2025-01-01T10:00:00.000Z'), (1, 'ready', 'delivered', '2025-01-03T10:00:00.000Z');
    `)
      db0.close()

      const db = new Database(path)
      db.pragma('foreign_keys = ON')
      initializeSchema(db)
      seedInitialData(db)
      const t = columns(db, 'Ticket')
      eq(
        ['technician_id', 'my_share', 'partner_share', 'parts_cost', 'split_percentage_applied'].every((c) =>
          t.includes(c)
        ),
        true,
        'all identity, profit and T004 columns exist'
      )
      eq(columns(db, 'RepairCategory').includes('requires_parts_cost'), true, 'category switch exists')
      eq(all(db, `SELECT COUNT(*) c FROM Ticket`)[0].c, 2, 'tickets kept')
      eq(
        all(db, `SELECT split_percentage_applied a FROM Ticket ORDER BY id`).map((r) => r.a),
        [null, null],
        'no shares existed => nothing to back-fill (NULL)'
      )
      eq(
        all(db, `SELECT is_partner p FROM Technician ORDER BY id`).map((r) => r.p),
        [0, 1],
        'partner flagged by the identity migration'
      )
      // The upgraded ticket works end to end
      const updated = setPartsCost(db, 1, 1000)
      eq(
        [updated.my_share, updated.partner_share],
        [2000, 3000],
        "delivered ticket without shares: cost 1000 on 6000 at the category's 40% => 2000 / 3000"
      )
      const details = getTicketById(db, 1)!
      eq(details.category!.requires_parts_cost, false, 'details work after the upgrade')
      const before = dump(db)
      initializeSchema(db)
      seedInitialData(db)
      eq(dump(db), before, 'second launch changes nothing (older layout)')
      db.close()
    }

    console.log('\n--- Section 3: a failing migration rolls everything back ---')
    {
      const path = join(dir, 'broken.db')
      const db0 = new Database(path)
      db0.exec(LEGACY_SCHEMA_ANCIENT)
      // no technician named "الشريك": the identity migration cannot decide who the partner is and throws
      db0.exec(`
      INSERT INTO Technician (name) VALUES ('أنا');
      INSERT INTO RepairCategory (name, default_split_percentage) VALUES ('شاشات', 40);
      INSERT INTO Customer (name, phone) VALUES ('زبون', '0555');
    `)
      db0.close()
      const db = new Database(path)
      let message = ''
      try {
        initializeSchema(db)
      } catch (err) {
        message = err instanceof Error ? err.message : String(err)
      }
      eq(message.length > 0, true, 'the migration failed with a message')
      eq(columns(db, 'Ticket').includes('parts_cost'), false, 'rolled back: Ticket.parts_cost was NOT left behind')
      eq(
        columns(db, 'Ticket').includes('split_percentage_applied'),
        false,
        'rolled back: Ticket.split_percentage_applied was NOT left behind'
      )
      eq(
        columns(db, 'Ticket').includes('my_share'),
        false,
        'rolled back: even the profit columns are gone (all-or-nothing)'
      )
      eq(columns(db, 'RepairCategory').includes('requires_parts_cost'), false, 'rolled back: RepairCategory unchanged')
      eq(all(db, `SELECT COUNT(*) c FROM RepairCategory`)[0].c, 1, 'rolled back: data intact')
      db.close()
    }

    console.log('\n--- Section 4: importing an old backup file brings it up to date ---')
    {
      const livePath = join(dir, 'live.db')
      const live = new Database(livePath)
      initializeSchema(live)
      seedInitialData(live)
      live.pragma('journal_mode = DELETE')
      live.close()

      const srcPath = join(dir, 'old-backup.db')
      buildLegacyV1(srcPath)
      const res = await importDatabaseFromFile(srcPath, livePath, { safetyBackupPath: join(dir, 'safety.db') })
      eq(res.success, true, `importing a pre-T004 backup succeeds (${res.error ?? ''})`)
      const imported = new Database(livePath, { readonly: true })
      eq(
        columns(imported, 'Ticket').includes('parts_cost') &&
          columns(imported, 'Ticket').includes('split_percentage_applied'),
        true,
        'imported backup has the new ticket columns'
      )
      eq(
        columns(imported, 'RepairCategory').includes('requires_parts_cost'),
        true,
        'imported backup has the category switch'
      )
      eq(all(imported, `SELECT COUNT(*) c FROM Ticket`)[0].c, 9, 'imported backup kept all 9 tickets')
      eq(
        all(imported, `SELECT split_percentage_applied a FROM Ticket WHERE legacy_barcode_code = 'WSHMIG1'`)[0].a,
        70,
        'imported backup: frozen percentage back-filled'
      )
      imported.close()
      eq(existsSync(join(dir, 'safety.db')), true, 'the safety copy was made')
    }
  } finally {
    closeDatabase() // the import flow keeps the live database open
    rmSync(dir, { recursive: true, force: true })
  }
}

main().then(
  () => {
    if (failures > 0) {
      console.error(`\n💥 ${failures} assertion(s) failed`)
      process.exit(1)
    }
    console.log('\n🎉 ALL PARTS-COST MIGRATION TESTS PASSED! 🎉')
    process.exit(0)
  },
  (err) => {
    console.error(err)
    process.exit(1)
  }
)
