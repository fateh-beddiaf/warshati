import type Database from 'better-sqlite3'
import type { Customer } from '../types'

export function searchCustomers(db: Database.Database, query: string): Customer[] {
  const cleanQuery = query.trim()
  if (!cleanQuery) {
    return db.prepare(`SELECT * FROM Customer ORDER BY id DESC LIMIT 20`).all() as Customer[]
  }

  const searchTerm = `%${cleanQuery}%`
  return db
    .prepare(
      `SELECT * FROM Customer 
       WHERE name LIKE ? OR phone LIKE ? 
       ORDER BY id DESC LIMIT 20`
    )
    .all(searchTerm, searchTerm) as Customer[]
}

export function getCustomerById(db: Database.Database, id: number): Customer | null {
  const result = db.prepare(`SELECT * FROM Customer WHERE id = ?`).get(id) as Customer | undefined
  return result || null
}

export function findOrCreateCustomer(
  db: Database.Database,
  customer: { id?: number; name: string; phone: string; notes?: string }
): number {
  if (customer.id) {
    // Update existing customer info if needed
    db.prepare(`UPDATE Customer SET name = ?, phone = ?, notes = ? WHERE id = ?`).run(
      customer.name.trim(),
      customer.phone.trim(),
      customer.notes?.trim() || null,
      customer.id
    )
    return customer.id
  }

  // Check if customer with same phone already exists
  const existing = db
    .prepare(`SELECT id FROM Customer WHERE phone = ?`)
    .get(customer.phone.trim()) as { id: number } | undefined

  if (existing) {
    db.prepare(`UPDATE Customer SET name = ?, notes = COALESCE(?, notes) WHERE id = ?`).run(
      customer.name.trim(),
      customer.notes?.trim() || null,
      existing.id
    )
    return existing.id
  }

  // Create new customer
  const info = db
    .prepare(`INSERT INTO Customer (name, phone, notes) VALUES (?, ?, ?)`)
    .run(customer.name.trim(), customer.phone.trim(), customer.notes?.trim() || null)

  return Number(info.lastInsertRowid)
}
