import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { closeDatabase, getDatabase, initDatabase } from '../src/database'
import { initializeSchema } from '../src/database/schema'
import { seedInitialData } from '../src/database/seed'
import { createTicket, getTicketById, updateTicketStatus } from '../src/database/queries/tickets'
import {
  checkBrandUsage,
  checkModelUsage,
  checkTechnicianUsage,
  getBrands,
  getModelsByBrand,
  getTechnicians,
  updateBrand,
  updateModel,
  updateTechnician
} from '../src/database/queries/metadata'
import { importDatabaseBackup } from '../src/main/backup'
import type { CreateTicketDTO } from '../src/shared/types'

// Data integrity guards: payments can never be negative or exceed the price (creation and delivery),
// technicians / brands / models are referenced by id (renaming keeps the delete guards; the identity migration is
// strict and all-or-nothing), and a backup import stops before touching anything when the safety copy fails.

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`)
  console.log(`✅ ${message}`)
}

function assertThrows(action: () => void, messageFragment: string, message: string): void {
  try {
    action()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    assert(errorMessage.includes(messageFragment), `${message} (رسالة واضحة)`)
    return
  }
  throw new Error(`Assertion failed: ${message}`)
}

function createReferenceTicketDto(
  db: Database.Database,
  overrides: Partial<CreateTicketDTO['ticket']> = {}
): CreateTicketDTO {
  const brand = getBrands(db).find((item) => item.name === 'Samsung')!
  const model = getModelsByBrand(db, brand.id).find((item) => item.name === 'Galaxy A54')!

  return {
    customer: { name: 'عميل اختبار', phone: '0555000001' },
    device: {
      brand: brand.name,
      model: model.name,
      brand_id: brand.id,
      model_id: model.id
    },
    ticket: {
      repair_category_id: 1,
      price: 10000,
      payment_type: 'cash',
      amount_paid: 2000,
      technician_id: 1,
      ...overrides
    }
  }
}

function createSeededMemoryDatabase(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  initializeSchema(db)
  seedInitialData(db)
  return db
}

function testPaymentBounds(): void {
  console.log('\n--- الدفع: منع القيم السالبة والزائدة في الإنشاء والتسليم ---')
  const db = createSeededMemoryDatabase()

  assertThrows(
    () => createTicket(db, createReferenceTicketDto(db, { price: 1000, amount_paid: 1001 })),
    'لا يمكن أن يتجاوز',
    'إنشاء تذكرة بمبلغ أكبر من السعر مرفوض'
  )
  assert(
    (db.prepare('SELECT COUNT(*) AS count FROM Ticket').get() as { count: number }).count === 0,
    'الإنشاء المرفوض لا يترك تذكرة جزئية'
  )
  assert(
    (db.prepare('SELECT COUNT(*) AS count FROM Customer').get() as { count: number }).count === 0,
    'الإنشاء المرفوض لا يترك عميلاً جزئياً'
  )

  const created = createTicket(db, createReferenceTicketDto(db))
  updateTicketStatus(db, { ticketId: created.ticketId, newStatus: 'ready' })
  const logCountBeforeRejectedSettlement = (
    db.prepare('SELECT COUNT(*) AS count FROM StatusLog WHERE ticket_id = ?').get(created.ticketId) as { count: number }
  ).count

  assertThrows(
    () =>
      updateTicketStatus(db, {
        ticketId: created.ticketId,
        newStatus: 'delivered',
        paymentUpdate: { amount_paid: -1, payment_type: 'credit' }
      }),
    'أكبر من أو يساوي صفر',
    'تسوية سالبة عند التسليم مرفوضة'
  )
  assertThrows(
    () =>
      updateTicketStatus(db, {
        ticketId: created.ticketId,
        newStatus: 'delivered',
        paymentUpdate: { amount_paid: 10001, payment_type: 'cash' }
      }),
    'لا يمكن أن يتجاوز',
    'تسوية أكبر من السعر عند التسليم مرفوضة'
  )

  const afterRejectedSettlement = getTicketById(db, created.ticketId)!
  assert(afterRejectedSettlement.ticket.status === 'ready', 'فشل التسوية يبقي الحالة جاهزة')
  assert(afterRejectedSettlement.ticket.amount_paid === 2000, 'فشل التسوية لا يغير المبلغ المدفوع')
  assert(
    afterRejectedSettlement.statusLogs.length === logCountBeforeRejectedSettlement,
    'فشل التسوية لا يسجل انتقالاً جزئياً'
  )
  db.close()
}

function testStableReferenceIdentitiesAndStrictMigration(): void {
  console.log('\n--- الهويات: الاعتماد على ID والترحيل الصارم ---')
  const db = createSeededMemoryDatabase()
  const partner = getTechnicians(db).find((item) => item.is_partner)!
  const brand = getBrands(db).find((item) => item.name === 'Samsung')!
  const model = getModelsByBrand(db, brand.id).find((item) => item.name === 'Galaxy A54')!
  const created = createTicket(db, createReferenceTicketDto(db, { technician_id: partner.id, amount_paid: 10000 }))

  updateBrand(db, brand.id, 'سامسونج باسم جديد')
  updateModel(db, model.id, 'A54 باسم جديد')
  updateTechnician(db, partner.id, 'فني الشريك باسم جديد')

  assert(checkBrandUsage(db, brand.id).canDelete === false, 'حارس حذف الماركة يستمر بعد تغيير الاسم')
  assert(checkModelUsage(db, model.id).canDelete === false, 'حارس حذف الموديل يستمر بعد تغيير الاسم')
  assert(checkTechnicianUsage(db, partner.id).canDelete === false, 'حارس حذف الفني يستمر بعد تغيير الاسم')

  updateTicketStatus(db, { ticketId: created.ticketId, newStatus: 'ready' })
  updateTicketStatus(db, { ticketId: created.ticketId, newStatus: 'delivered' })
  const delivered = getTicketById(db, created.ticketId)!
  assert(
    delivered.ticket.my_share === 0 && delivered.ticket.partner_share === 10000,
    'صفة الشريك عبر ID تحفظ قاعدة 100% بعد تغيير الاسم'
  )
  db.close()

  const legacyDb = new Database(':memory:')
  legacyDb.exec(`
    CREATE TABLE Customer (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL, notes TEXT);
    CREATE TABLE RepairCategory (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, default_split_percentage REAL NOT NULL DEFAULT 50.0);
    CREATE TABLE Technician (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
    CREATE TABLE Brand (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
    CREATE TABLE Model (id INTEGER PRIMARY KEY AUTOINCREMENT, brand_id INTEGER NOT NULL, name TEXT NOT NULL, UNIQUE (brand_id, name));
    CREATE TABLE Ticket (
      id INTEGER PRIMARY KEY AUTOINCREMENT, barcode_code TEXT NOT NULL UNIQUE, customer_id INTEGER NOT NULL,
      created_at TEXT NOT NULL, technician TEXT NOT NULL, repair_category_id INTEGER NOT NULL,
      price REAL NOT NULL DEFAULT 0, payment_type TEXT NOT NULL, amount_paid REAL NOT NULL DEFAULT 0,
      amount_remaining REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'in_progress'
    );
    CREATE TABLE TicketDevice (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER NOT NULL UNIQUE, brand TEXT NOT NULL,
      model TEXT NOT NULL, short_label TEXT NOT NULL
    );
  `)
  legacyDb.prepare("INSERT INTO Customer (name, phone) VALUES ('عميل قديم', '0555000000')").run()
  legacyDb.prepare("INSERT INTO RepairCategory (name, default_split_percentage) VALUES ('فئة', 50)").run()
  legacyDb.prepare("INSERT INTO Technician (name) VALUES ('أنا'), ('الشريك')").run()
  legacyDb.prepare("INSERT INTO Brand (name) VALUES ('Samsung')").run()
  legacyDb.prepare("INSERT INTO Model (brand_id, name) VALUES (1, 'Galaxy A54')").run()
  legacyDb
    .prepare(
      `
    INSERT INTO Ticket (barcode_code, customer_id, created_at, technician, repair_category_id, price, payment_type, amount_paid, amount_remaining, status)
    VALUES ('WSH-LEGACY', 1, '2026-01-01T00:00:00.000Z', 'أنا', 1, 5000, 'cash', 5000, 0, 'in_progress')
  `
    )
    .run()
  legacyDb
    .prepare(
      "INSERT INTO TicketDevice (ticket_id, brand, model, short_label) VALUES (1, 'Unknown Brand', 'Unknown Model', 'UNK')"
    )
    .run()

  assertThrows(
    () => initializeSchema(legacyDb),
    'لم تُطبَّق أي تغييرات',
    'الترحيل يتوقف بوضوح عند عدم تطابق اسم مرجعي قديم'
  )
  const legacyTicketColumns = legacyDb.prepare('PRAGMA table_info(Ticket)').all() as { name: string }[]
  const legacyDeviceColumns = legacyDb.prepare('PRAGMA table_info(TicketDevice)').all() as { name: string }[]
  assert(
    !legacyTicketColumns.some((column) => column.name === 'technician_id'),
    'فشل الترحيل يعيد عمود technician_id بالكامل'
  )
  assert(!legacyTicketColumns.some((column) => column.name === 'my_share'), 'فشل الترحيل يعيد أعمدة الأرباح بالكامل')
  assert(
    !legacyDeviceColumns.some((column) => column.name === 'brand_id'),
    'فشل الترحيل لا يترك TicketDevice بحالة جزئية'
  )
  legacyDb.close()
}

async function testBackupFailureStopsImport(): Promise<void> {
  console.log('\n--- النسخ الاحتياطي: إيقاف الاستيراد عند فشل نسخة الأمان ---')
  const tempDir = mkdtempSync(join(tmpdir(), 'warshati-audit-fixes-'))

  const activePath = join(tempDir, 'active.db')
  const sourcePath = join(tempDir, 'source.db')
  const sourceDb = new Database(sourcePath)
  initializeSchema(sourceDb)
  seedInitialData(sourceDb)
  sourceDb.close()

  closeDatabase()
  const activeDb = initDatabase(activePath)
  const activeTicket = createTicket(activeDb, createReferenceTicketDto(activeDb))

  const result = await importDatabaseBackup(undefined, sourcePath, {
    createSafetyBackup: async () => {
      throw new Error('فشل محاكى لنسخة الأمان')
    }
  })
  assert(result.success === false, 'فشل نسخة الأمان يجعل الاستيراد يفشل')
  assert(result.error?.includes('لم يبدأ الاستيراد') === true, 'رسالة الفشل تشرح أن الاستيراد لم يبدأ')
  assert(
    (
      getDatabase().prepare('SELECT COUNT(*) AS count FROM Ticket WHERE id = ?').get(activeTicket.ticketId) as {
        count: number
      }
    ).count === 1,
    'فشل نسخة الأمان يبقي قاعدة البيانات النشطة بلا استبدال'
  )

  closeDatabase()
  rmSync(tempDir, { recursive: true, force: true })
}

async function run(): Promise<void> {
  testPaymentBounds()
  testStableReferenceIdentitiesAndStrictMigration()
  await testBackupFailureStopsImport()
  console.log('\n🎉 اكتملت اختبارات حدود الدفع وثبات الهويات وحماية الاستيراد بنجاح.\n')
  process.exit(0)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
