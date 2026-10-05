/**
 * FROZEN schemas of databases created by earlier versions of the app. Used only by the migration tests:
 * they are NOT the current schema and must never be edited to follow it.
 */

/** Schema of main @ 33b4cfc (and main @ 2410a27: schema.ts is identical): before the parts cost columns. */
export const LEGACY_SCHEMA_BEFORE_PARTS_COST = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS Customer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS RepairCategory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    default_split_percentage REAL NOT NULL DEFAULT 50.0
  );

  CREATE TABLE IF NOT EXISTS Technician (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    is_partner INTEGER NOT NULL DEFAULT 0 CHECK(is_partner IN (0, 1))
  );

  CREATE TABLE IF NOT EXISTS Accessories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS Brand (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS Model (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY (brand_id) REFERENCES Brand(id) ON DELETE CASCADE,
    UNIQUE (brand_id, name)
  );

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

  CREATE TABLE IF NOT EXISTS TicketAccessories (
    ticket_id INTEGER NOT NULL,
    accessory_id INTEGER NOT NULL,
    PRIMARY KEY (ticket_id, accessory_id),
    FOREIGN KEY (ticket_id) REFERENCES Ticket(id) ON DELETE CASCADE,
    FOREIGN KEY (accessory_id) REFERENCES Accessories(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS StatusLog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (ticket_id) REFERENCES Ticket(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS Setting (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_customer_phone ON Customer(phone);
  CREATE INDEX IF NOT EXISTS idx_customer_name ON Customer(name);
  CREATE INDEX IF NOT EXISTS idx_ticket_barcode ON Ticket(barcode_code);
  CREATE INDEX IF NOT EXISTS idx_ticket_status ON Ticket(status);
  CREATE INDEX IF NOT EXISTS idx_ticket_customer ON Ticket(customer_id);
  CREATE INDEX IF NOT EXISTS idx_ticket_created ON Ticket(created_at);
  CREATE INDEX IF NOT EXISTS idx_model_brand ON Model(brand_id);
  CREATE INDEX IF NOT EXISTS idx_statuslog_ticket ON StatusLog(ticket_id);
`

/**
 * An older database than any of the above: no technician_id / brand_id / model_id / is_partner and no
 * profit-share columns, so the identity migration and the parts cost migration have to run together.
 */
export const LEGACY_SCHEMA_ANCIENT = `
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
`
