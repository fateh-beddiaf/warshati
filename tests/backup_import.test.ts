import Database from 'better-sqlite3'
import { existsSync, mkdtempSync, rmSync, writeFileSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { closeDatabase, getDatabase, initDatabase } from '../src/database'
import { initializeSchema } from '../src/database/schema'
import { seedInitialData } from '../src/database/seed'
import { createTicket } from '../src/database/queries/tickets'
import { getBrands, getModelsByBrand } from '../src/database/queries/metadata'
import { getRequiredTables, importDatabaseFromFile } from '../src/main/backup-core'
import type { CreateTicketDTO } from '../src/shared/types'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`)
  console.log(`✅ ${message}`)
}

function ticketDto(db: Database.Database, phone: string): CreateTicketDTO {
  const brand = getBrands(db).find((b) => b.name === 'Samsung')!
  const model = getModelsByBrand(db, brand.id).find((m) => m.name === 'Galaxy A54')!
  return {
    customer: { name: 'عميل', phone },
    device: { brand: brand.name, model: model.name, brand_id: brand.id, model_id: model.id },
    ticket: { repair_category_id: 1, price: 1000, payment_type: 'cash', amount_paid: 1000, technician_id: 1 }
  }
}

function countTickets(db: Database.Database): number {
  return (db.prepare('SELECT COUNT(*) AS c FROM Ticket').get() as { c: number }).c
}

function phones(db: Database.Database): string[] {
  return (db.prepare('SELECT phone FROM Customer ORDER BY phone').all() as { phone: string }[]).map((r) => r.phone)
}

/** Build a valid standalone .db file containing `phone` as its only customer. */
function makeSourceDb(path: string, phone: string): void {
  const db = new Database(path)
  initializeSchema(db)
  seedInitialData(db)
  createTicket(db, ticketDto(db, phone))
  db.pragma('journal_mode = DELETE')
  db.close()
}

/** Old-style DB: all tables exist but Ticket lacks technician_id etc. and the partner technician is missing. */
function makeUnmigratableLegacyDb(path: string): void {
  const db = new Database(path)
  db.exec(`
    CREATE TABLE Customer (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL, notes TEXT);
    CREATE TABLE RepairCategory (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, default_split_percentage REAL NOT NULL DEFAULT 50);
    CREATE TABLE Technician (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
    CREATE TABLE Accessories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
    CREATE TABLE Brand (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
    CREATE TABLE Model (id INTEGER PRIMARY KEY AUTOINCREMENT, brand_id INTEGER NOT NULL, name TEXT NOT NULL, UNIQUE (brand_id, name));
    CREATE TABLE Ticket (
      id INTEGER PRIMARY KEY AUTOINCREMENT, barcode_code TEXT NOT NULL UNIQUE, customer_id INTEGER NOT NULL,
      created_at TEXT NOT NULL, technician TEXT NOT NULL, repair_category_id INTEGER NOT NULL,
      price REAL NOT NULL DEFAULT 0, payment_type TEXT NOT NULL, amount_paid REAL NOT NULL DEFAULT 0,
      amount_remaining REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'in_progress'
    );
    CREATE TABLE TicketDevice (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER NOT NULL UNIQUE, brand TEXT NOT NULL, model TEXT NOT NULL, short_label TEXT NOT NULL);
    CREATE TABLE TicketAccessories (ticket_id INTEGER NOT NULL, accessory_id INTEGER NOT NULL, PRIMARY KEY (ticket_id, accessory_id));
    CREATE TABLE StatusLog (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER NOT NULL, old_status TEXT, new_status TEXT NOT NULL, timestamp TEXT NOT NULL);
    CREATE TABLE Setting (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO Technician (name) VALUES ('أنا');
  `)
  db.close()
}

/** The live DB must be open, queryable, and still hold exactly the original customer. */
function assertOriginalIntactAndOpen(originalPhone: string, label: string): void {
  const db = getDatabase()
  assert(db.open, `${label}: DB handle is open`)
  const p = phones(db)
  assert(p.length === 1 && p[0] === originalPhone, `${label}: original data intact`)
  assert(countTickets(db) === 1, `${label}: original ticket count unchanged`)
  // Still writable
  db.prepare("INSERT INTO Setting (key, value) VALUES ('probe', '1') ON CONFLICT(key) DO UPDATE SET value = '1'").run()
}

async function run(): Promise<void> {
  console.log('🚀 Safe database import tests\n')
  const dir = mkdtempSync(join(tmpdir(), 'warshati-import-'))
  const livePath = join(dir, 'live', 'warshati.db')
  const safetyPath = join(dir, 'safety', 'auto-backup-before-import.db')

  try {
    // Required tables are derived from schema.ts
    const required = getRequiredTables()
    assert(required.length >= 11 && required.includes('TicketAccessories') && required.includes('Setting') && required.includes('StatusLog'),
      `required table list derived from schema (${required.length} tables)`)

    closeDatabase()
    const live = initDatabase(livePath)
    createTicket(live, ticketDto(live, '0555000001'))
    live.prepare("INSERT INTO Setting (key, value) VALUES ('uncheckpointed', 'yes') ON CONFLICT(key) DO UPDATE SET value='yes'").run()

    // (b) not a SQLite file
    console.log('\n--- (b) not a SQLite file ---')
    const garbage = join(dir, 'garbage.db')
    writeFileSync(garbage, 'this is definitely not a sqlite database, just text. '.repeat(100))
    let res = await importDatabaseFromFile(garbage, livePath, { safetyBackupPath: safetyPath })
    assert(res.success === false && !!res.error, `non-SQLite rejected: ${res.error}`)
    assertOriginalIntactAndOpen('0555000001', 'non-SQLite')
    assert(!existsSync(`${livePath}.import-tmp`), 'non-SQLite: temp copy cleaned up')

    // missing source
    res = await importDatabaseFromFile(join(dir, 'nope.db'), livePath, { safetyBackupPath: safetyPath })
    assert(res.success === false, 'missing source file rejected')
    assertOriginalIntactAndOpen('0555000001', 'missing source')

    // (c) SQLite but missing required tables (the old 4-table check would pass this one)
    console.log('\n--- (c) SQLite file missing required tables ---')
    const partial = join(dir, 'partial.db')
    const pdb = new Database(partial)
    pdb.exec(`
      CREATE TABLE Ticket (id INTEGER PRIMARY KEY);
      CREATE TABLE Customer (id INTEGER PRIMARY KEY);
      CREATE TABLE RepairCategory (id INTEGER PRIMARY KEY);
      CREATE TABLE Brand (id INTEGER PRIMARY KEY);
    `)
    pdb.close()
    res = await importDatabaseFromFile(partial, livePath, { safetyBackupPath: safetyPath })
    assert(res.success === false && /مفقودة/.test(res.error ?? ''), `missing tables rejected: ${res.error}`)
    assertOriginalIntactAndOpen('0555000001', 'missing tables')

    const emptyDb = join(dir, 'empty.db')
    new Database(emptyDb).close()
    res = await importDatabaseFromFile(emptyDb, livePath, { safetyBackupPath: safetyPath })
    assert(res.success === false, 'empty SQLite file rejected')
    assertOriginalIntactAndOpen('0555000001', 'empty sqlite')

    // (d) migration/schema init throws on the temp copy
    console.log('\n--- (d) schema/migration failure on temp copy ---')
    const legacy = join(dir, 'legacy.db')
    makeUnmigratableLegacyDb(legacy)
    res = await importDatabaseFromFile(legacy, livePath, { safetyBackupPath: safetyPath })
    assert(res.success === false && /ترحيل/.test(res.error ?? ''), `real migration failure reported: ${res.error}`)
    assertOriginalIntactAndOpen('0555000001', 'migration failure')
    assert(!existsSync(`${livePath}.import-tmp`), 'migration failure: temp copy cleaned up')

    const valid = join(dir, 'valid.db')
    makeSourceDb(valid, '0666000009')
    res = await importDatabaseFromFile(valid, livePath, {
      safetyBackupPath: safetyPath,
      prepareDatabase: () => {
        throw new Error('injected prepare failure')
      }
    })
    assert(res.success === false && (res.error ?? '').includes('injected prepare failure'), 'injected prepare failure reported')
    assertOriginalIntactAndOpen('0555000001', 'injected prepare failure')

    // Safety backup failure stops the import before touching live
    res = await importDatabaseFromFile(valid, livePath, {
      safetyBackupPath: safetyPath,
      createSafetyBackup: async () => {
        throw new Error('simulated safety failure')
      }
    })
    assert(res.success === false && (res.error ?? '').includes('لم يبدأ الاستيراد'), 'safety backup failure aborts import')
    assertOriginalIntactAndOpen('0555000001', 'safety failure')
    assert(!existsSync(`${safetyPath}.partial`), 'safety failure: partial file cleaned up')

    // Failure AFTER closeDatabase()/swap -> safety copy restored, DB reopened
    console.log('\n--- post-swap failure restores original ---')
    res = await importDatabaseFromFile(valid, livePath, {
      safetyBackupPath: safetyPath,
      afterSwap: () => {
        throw new Error('injected post-swap failure')
      }
    })
    assert(res.success === false && (res.error ?? '').includes('تمت استعادة بياناتك الأصلية'), `post-swap failure restored: ${res.error}`)
    assertOriginalIntactAndOpen('0555000001', 'post-swap failure')
    assert(
      (getDatabase().prepare("SELECT value FROM Setting WHERE key='uncheckpointed'").get() as { value: string }).value === 'yes',
      'post-swap failure: data written before import (incl. WAL content) preserved'
    )

    // (a) valid import
    console.log('\n--- (a) valid import ---')
    // add a stale-WAL-producing write to the live db first
    getDatabase().prepare("INSERT INTO Customer (name, phone) VALUES ('x', '0777000000')").run()
    res = await importDatabaseFromFile(valid, livePath, { safetyBackupPath: safetyPath })
    assert(res.success === true && res.safetyBackupPath === safetyPath, `valid import succeeds: ${res.error ?? ''}`)
    const after = getDatabase()
    assert(after.open, 'valid import: DB handle open')
    const p = phones(after)
    assert(p.length === 1 && p[0] === '0666000009', 'valid import: live DB now holds imported data only')
    assert(countTickets(after) === 1, 'valid import: imported ticket present')
    assert(
      (after.prepare("SELECT COUNT(*) AS c FROM Setting WHERE key='uncheckpointed'").get() as { c: number }).c === 0,
      'valid import: no leftover live data from before'
    )
    assert(existsSync(safetyPath), 'valid import: safety copy exists')
    const sdb = new Database(safetyPath, { readonly: true })
    const sp = phones(sdb)
    const hasWalData = (sdb.prepare("SELECT COUNT(*) AS c FROM Setting WHERE key='uncheckpointed'").get() as { c: number }).c === 1
    sdb.close()
    assert(sp.includes('0555000001') && sp.includes('0777000000') && hasWalData, 'valid import: safety copy has full pre-import data (WAL consistent)')
    assert(!existsSync(`${livePath}.import-tmp`), 'valid import: temp copy cleaned up')
    assert(!readdirSync(join(dir, 'live')).some((f) => f.endsWith('.swap-tmp')), 'valid import: no staging leftovers')

    // Imported DB is fully usable afterwards
    createTicket(after, ticketDto(after, '0888000000'))
    assert(countTickets(after) === 2, 'valid import: DB is writable after import')

    console.log('\n🎉 SAFE IMPORT TESTS PASSED 🎉\n')
  } finally {
    closeDatabase()
    rmSync(dir, { recursive: true, force: true })
  }
  process.exit(0)
}

run().catch((error) => {
  console.error(error)
  try {
    closeDatabase()
  } catch {
    // ignore
  }
  process.exit(1)
})
