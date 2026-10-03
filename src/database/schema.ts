import type Database from 'better-sqlite3'

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
      default_split_percentage REAL NOT NULL DEFAULT 50.0
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

  const needsLegacyIdentityMigration =
    !ticketColumns.includes('technician_id') ||
    !deviceColumns.includes('brand_id') ||
    !deviceColumns.includes('model_id') ||
    !technicianColumns.includes('is_partner')
  const needsProfitMigration = !ticketColumns.includes('my_share') || !ticketColumns.includes('partner_share')

  if (!needsLegacyIdentityMigration && !needsProfitMigration) return

  const migrateLegacySchema = db.transaction(() => {
    if (!ticketColumns.includes('my_share')) {
      db.prepare(`ALTER TABLE Ticket ADD COLUMN my_share REAL DEFAULT NULL`).run()
    }
    if (!ticketColumns.includes('partner_share')) {
      db.prepare(`ALTER TABLE Ticket ADD COLUMN partner_share REAL DEFAULT NULL`).run()
    }
    if (!needsLegacyIdentityMigration) return

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
  })

  migrateLegacySchema()
}
