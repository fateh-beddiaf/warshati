import type Database from 'better-sqlite3'
import { calculateProfitSplit } from '../shared/profit'

export function initializeSchema(db: Database.Database): void {
  db.exec(`
    PRAGMA foreign_keys = ON;

    -- Customer Table
    CREATE TABLE IF NOT EXISTS Customer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      notes TEXT
    );

    -- RepairCategory Table
    CREATE TABLE IF NOT EXISTS RepairCategory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      default_split_percentage REAL NOT NULL DEFAULT 50.0,
      requires_parts_cost INTEGER NOT NULL DEFAULT 0 CHECK(requires_parts_cost IN (0, 1))
    );

    -- Technician Table
    CREATE TABLE IF NOT EXISTS Technician (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      is_partner INTEGER NOT NULL DEFAULT 0 CHECK(is_partner IN (0, 1))
    );

    -- Accessories Table
    CREATE TABLE IF NOT EXISTS Accessories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    -- Brand Table
    CREATE TABLE IF NOT EXISTS Brand (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    -- Model Table
    CREATE TABLE IF NOT EXISTS Model (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY (brand_id) REFERENCES Brand(id) ON DELETE CASCADE,
      UNIQUE (brand_id, name)
    );

    -- Ticket Table (مع أعمدة حفظ حصص الأرباح الفعلية تاريخياً)
    CREATE TABLE IF NOT EXISTS Ticket (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode_code TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      technician TEXT NOT NULL,
      technician_id INTEGER NOT NULL,
      repair_category_id INTEGER NOT NULL,
      price REAL NOT NULL DEFAULT 0.0,
      payment_type TEXT NOT NULL CHECK(payment_type IN ('cash', 'credit')),
      amount_paid REAL NOT NULL DEFAULT 0.0,
      amount_remaining REAL NOT NULL DEFAULT 0.0,
      status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'ready', 'delivered')),
      my_share REAL DEFAULT NULL,
      partner_share REAL DEFAULT NULL,
      parts_cost REAL DEFAULT NULL CHECK(parts_cost IS NULL OR parts_cost >= 0),
      split_percentage_applied REAL DEFAULT NULL,
      parts_cost_required INTEGER NOT NULL DEFAULT 0 CHECK(parts_cost_required IN (0, 1)),
      FOREIGN KEY (customer_id) REFERENCES Customer(id),
      FOREIGN KEY (repair_category_id) REFERENCES RepairCategory(id),
      FOREIGN KEY (technician_id) REFERENCES Technician(id) ON DELETE RESTRICT
    );

    -- TicketDevice Table
    CREATE TABLE IF NOT EXISTS TicketDevice (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL UNIQUE,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      brand_id INTEGER,
      model_id INTEGER,
      short_label TEXT NOT NULL,
      FOREIGN KEY (ticket_id) REFERENCES Ticket(id) ON DELETE CASCADE,
      FOREIGN KEY (brand_id) REFERENCES Brand(id) ON DELETE RESTRICT,
      FOREIGN KEY (model_id) REFERENCES Model(id) ON DELETE RESTRICT
    );

    -- TicketAccessories Table (M2M)
    CREATE TABLE IF NOT EXISTS TicketAccessories (
      ticket_id INTEGER NOT NULL,
      accessory_id INTEGER NOT NULL,
      PRIMARY KEY (ticket_id, accessory_id),
      FOREIGN KEY (ticket_id) REFERENCES Ticket(id) ON DELETE CASCADE,
      FOREIGN KEY (accessory_id) REFERENCES Accessories(id) ON DELETE CASCADE
    );

    -- StatusLog Table
    CREATE TABLE IF NOT EXISTS StatusLog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (ticket_id) REFERENCES Ticket(id) ON DELETE CASCADE
    );

    -- Setting Table (Key-Value)
    CREATE TABLE IF NOT EXISTS Setting (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_customer_phone ON Customer(phone);
    CREATE INDEX IF NOT EXISTS idx_customer_name ON Customer(name);
    CREATE INDEX IF NOT EXISTS idx_ticket_barcode ON Ticket(barcode_code);
    CREATE INDEX IF NOT EXISTS idx_ticket_status ON Ticket(status);
    CREATE INDEX IF NOT EXISTS idx_ticket_customer ON Ticket(customer_id);
    CREATE INDEX IF NOT EXISTS idx_ticket_created ON Ticket(created_at);
    CREATE INDEX IF NOT EXISTS idx_model_brand ON Model(brand_id);
    CREATE INDEX IF NOT EXISTS idx_statuslog_ticket ON StatusLog(ticket_id);
  `)

  // Migrations for existing databases
  runMigrations(db)
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_technician_single_partner
    ON Technician(is_partner)
    WHERE is_partner = 1;
  `)
}

function getColumnNames(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((column) => column.name)
}

function describeUnmatchedRows(db: Database.Database): string[] {
  const unmatchedTechnicians = db.prepare(`
    SELECT t.id
    FROM Ticket t
    LEFT JOIN Technician tech ON tech.name = t.technician
    WHERE tech.id IS NULL
  `).all() as { id: number }[]

  const unmatchedBrands = db.prepare(`
    SELECT td.ticket_id
    FROM TicketDevice td
    LEFT JOIN Brand b ON b.name = td.brand
    WHERE b.id IS NULL
  `).all() as { ticket_id: number }[]

  const unmatchedModels = db.prepare(`
    SELECT td.ticket_id
    FROM TicketDevice td
    LEFT JOIN Brand b ON b.name = td.brand
    LEFT JOIN Model m ON m.brand_id = b.id AND m.name = td.model
    WHERE m.id IS NULL
  `).all() as { ticket_id: number }[]

  const messages: string[] = []
  if (unmatchedTechnicians.length > 0) {
    messages.push(`الفني: تذاكر #${unmatchedTechnicians.map((row) => row.id).join(', #')}`)
  }
  if (unmatchedBrands.length > 0) {
    messages.push(`الماركة: تذاكر #${unmatchedBrands.map((row) => row.ticket_id).join(', #')}`)
  }
  if (unmatchedModels.length > 0) {
    messages.push(`الموديل: تذاكر #${unmatchedModels.map((row) => row.ticket_id).join(', #')}`)
  }
  return messages
}

function runMigrations(db: Database.Database): void {
  const ticketColumns = getColumnNames(db, 'Ticket')
  const deviceColumns = getColumnNames(db, 'TicketDevice')
  const technicianColumns = getColumnNames(db, 'Technician')
  const categoryColumns = getColumnNames(db, 'RepairCategory')

  const needsLegacyIdentityMigration =
    !ticketColumns.includes('technician_id') ||
    !deviceColumns.includes('brand_id') ||
    !deviceColumns.includes('model_id') ||
    !technicianColumns.includes('is_partner')
  const needsProfitMigration = !ticketColumns.includes('my_share') || !ticketColumns.includes('partner_share')
  const needsPartsCostMigration =
    !ticketColumns.includes('parts_cost') ||
    !ticketColumns.includes('split_percentage_applied') ||
    !categoryColumns.includes('requires_parts_cost')

  const needsCostRequiredMigration = !ticketColumns.includes('parts_cost_required')

  if (!needsLegacyIdentityMigration && !needsProfitMigration && !needsPartsCostMigration && !needsCostRequiredMigration) return

  // One transaction for every step: a failure leaves the database exactly as it was.
  const migrateLegacySchema = db.transaction(() => {
    if (!ticketColumns.includes('my_share')) {
      db.prepare(`ALTER TABLE Ticket ADD COLUMN my_share REAL DEFAULT NULL`).run()
    }
    if (!ticketColumns.includes('partner_share')) {
      db.prepare(`ALTER TABLE Ticket ADD COLUMN partner_share REAL DEFAULT NULL`).run()
    }
    if (needsLegacyIdentityMigration) migrateLegacyIdentities(db, ticketColumns, deviceColumns, technicianColumns)
    if (needsPartsCostMigration) migratePartsCost(db, ticketColumns, categoryColumns)
    if (needsCostRequiredMigration) migrateCostRequiredSnapshot(db)
  })

  migrateLegacySchema()
}

/** T002: stable technician / brand / model identities for databases from the original app. */
function migrateLegacyIdentities(
  db: Database.Database,
  ticketColumns: string[],
  deviceColumns: string[],
  technicianColumns: string[]
): void {
  if (!technicianColumns.includes('is_partner')) {
    db.prepare(`ALTER TABLE Technician ADD COLUMN is_partner INTEGER NOT NULL DEFAULT 0`).run()
  }
  if (!ticketColumns.includes('technician_id')) {
    db.prepare(`ALTER TABLE Ticket ADD COLUMN technician_id INTEGER`).run()
  }
  if (!deviceColumns.includes('brand_id')) {
    db.prepare(`ALTER TABLE TicketDevice ADD COLUMN brand_id INTEGER`).run()
  }
  if (!deviceColumns.includes('model_id')) {
    db.prepare(`ALTER TABLE TicketDevice ADD COLUMN model_id INTEGER`).run()
  }

  const canonicalPartner = db.prepare(`SELECT id FROM Technician WHERE name = ?`).all('الشريك') as { id: number }[]
  if (canonicalPartner.length !== 1) {
    throw new Error('تعذر تحديد الفني الشريك الوحيد بالاسم التاريخي "الشريك". راجع بيانات الفنيين يدوياً قبل الترحيل.')
  }

  db.prepare(`UPDATE Technician SET is_partner = CASE WHEN id = ? THEN 1 ELSE 0 END`).run(canonicalPartner[0].id)

  const unmatched = describeUnmatchedRows(db)
  if (unmatched.length > 0) {
    throw new Error(`تعذر ترحيل هويات السجلات القديمة بسبب تطابقات غير دقيقة: ${unmatched.join(' | ')}. لم تُطبَّق أي تغييرات؛ راجع هذه السجلات يدوياً ثم أعد التشغيل.`)
  }

  db.prepare(`
    UPDATE Ticket
    SET technician_id = (SELECT id FROM Technician WHERE name = Ticket.technician)
  `).run()
  db.prepare(`
    UPDATE TicketDevice
    SET brand_id = (SELECT id FROM Brand WHERE name = TicketDevice.brand)
  `).run()
  db.prepare(`
    UPDATE TicketDevice
    SET model_id = (
      SELECT m.id
      FROM Model m
      JOIN Brand b ON b.id = m.brand_id
      WHERE b.name = TicketDevice.brand AND m.name = TicketDevice.model
    )
  `).run()

  const incompleteCount = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM Ticket WHERE technician_id IS NULL) +
      (SELECT COUNT(*) FROM TicketDevice WHERE brand_id IS NULL OR model_id IS NULL) AS count
  `).get() as { count: number }
  if (incompleteCount.count > 0) {
    throw new Error('تعذر إكمال ترحيل هويات السجلات القديمة. لم تُطبَّق أي تغييرات؛ راجع البيانات يدوياً.')
  }
}

/**
 * T004: parts cost.
 *  - RepairCategory.requires_parts_cost (0 for every existing category: the user opts in from Settings)
 *  - Ticket.parts_cost (NULL = not entered yet)
 *  - Ticket.split_percentage_applied, back-filled for tickets already delivered: before this change
 *    the shares were my_share = price x my%, so my% = my_share / price x 100. The value is rounded
 *    to the simplest precision that reproduces the stored my_share exactly. Partner tickets and
 *    tickets with price 0 get NULL (documented fallback: a later cost edit on such a ticket uses
 *    the category's current percentage; the partner always takes 100%).
 * Runs only when a column is missing, so a second launch changes nothing.
 */
function migratePartsCost(db: Database.Database, ticketColumns: string[], categoryColumns: string[]): void {
  if (!categoryColumns.includes('requires_parts_cost')) {
    db.prepare(
      `ALTER TABLE RepairCategory ADD COLUMN requires_parts_cost INTEGER NOT NULL DEFAULT 0 CHECK(requires_parts_cost IN (0, 1))`
    ).run()
  }
  if (!ticketColumns.includes('parts_cost')) {
    db.prepare(`ALTER TABLE Ticket ADD COLUMN parts_cost REAL DEFAULT NULL CHECK(parts_cost IS NULL OR parts_cost >= 0)`).run()
  }
  if (ticketColumns.includes('split_percentage_applied')) return

  db.prepare(`ALTER TABLE Ticket ADD COLUMN split_percentage_applied REAL DEFAULT NULL`).run()

  const delivered = db.prepare(`
    SELECT t.id AS id, t.price AS price, t.my_share AS my_share
    FROM Ticket t
    JOIN Technician tech ON tech.id = t.technician_id
    WHERE t.status = 'delivered'
      AND tech.is_partner = 0
      AND t.price > 0
      AND t.my_share IS NOT NULL
      AND t.partner_share IS NOT NULL
  `).all() as { id: number; price: number; my_share: number }[]

  const setApplied = db.prepare(`UPDATE Ticket SET split_percentage_applied = ? WHERE id = ?`)
  for (const row of delivered) {
    const exact = Math.max(0, Math.min(100, (row.my_share / row.price) * 100))
    const candidates = [Math.round(exact * 100) / 100, Math.round(exact * 10000) / 10000, exact]
    const applied =
      candidates.find(
        (pct) =>
          calculateProfitSplit({ price: row.price, isPartner: false, appliedSplitPercentage: pct }).myShare === row.my_share
      ) ?? candidates[1]
    setApplied.run(applied, row.id)
  }
}

/**
 * T004b: Ticket.parts_cost_required is a snapshot of the category's "requires a parts cost" switch taken
 * when the ticket is CREATED. Everything about "missing cost / provisional" reads this snapshot, so turning
 * the switch on later never turns old tickets into "missing cost".
 * Existing tickets get 0 (even if their category requires a cost now), except tickets that already HAVE a
 * cost: those get 1 (harmless, and it keeps them consistent). Runs only when the column is missing.
 */
function migrateCostRequiredSnapshot(db: Database.Database): void {
  db.prepare(
    `ALTER TABLE Ticket ADD COLUMN parts_cost_required INTEGER NOT NULL DEFAULT 0 CHECK(parts_cost_required IN (0, 1))`
  ).run()
  db.prepare(`UPDATE Ticket SET parts_cost_required = 1 WHERE parts_cost IS NOT NULL`).run()
}
