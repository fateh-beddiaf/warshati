import type Database from 'better-sqlite3'
import type { Customer } from '../../shared/types'

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

/** Trim, collapse inner whitespace, case-fold — used to decide whether two names are the same person. */
export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Phones are compared without any whitespace ("0555 12 34 56" = "0555123456"). */
export function normalizePhone(value: string): string {
  return value.replace(/\s+/g, '')
}

/**
 * Never renames or re-numbers an existing customer silently.
 * - With `customer.id`: reuse it only if the name and phone in the form still match the stored ones;
 *   otherwise the form describes someone else, so a new customer is created.
 * - Without an id: reuse an existing customer only when BOTH phone and name match
 *   (after normalisation); anything else creates a new customer.
 * Only the notes of a reused customer may be updated (when provided).
 */
export function findOrCreateCustomer(
  db: Database.Database,
  customer: { id?: number; name: string; phone: string; notes?: string }
): number {
  const name = customer.name.trim().replace(/\s+/g, ' ')
  const phone = customer.phone.trim()
  const notes = customer.notes?.trim() || null

  const reuse = (id: number): number => {
    if (notes) db.prepare(`UPDATE Customer SET notes = ? WHERE id = ?`).run(notes, id)
    return id
  }

  if (customer.id) {
    const stored = db.prepare(`SELECT id, name, phone FROM Customer WHERE id = ?`).get(customer.id) as
      { id: number; name: string; phone: string } | undefined
    if (
      stored &&
      normalizeName(stored.name) === normalizeName(name) &&
      normalizePhone(stored.phone) === normalizePhone(phone)
    ) {
      return reuse(stored.id)
    }
  }

  const candidates = db
    .prepare(`SELECT id, name FROM Customer WHERE replace(replace(phone, ' ', ''), char(9), '') = ?`)
    .all(normalizePhone(phone)) as { id: number; name: string }[]
  const match = candidates.find((c) => normalizeName(c.name) === normalizeName(name))
  if (match) return reuse(match.id)

  const info = db.prepare(`INSERT INTO Customer (name, phone, notes) VALUES (?, ?, ?)`).run(name, phone, notes)
  return Number(info.lastInsertRowid)
}
