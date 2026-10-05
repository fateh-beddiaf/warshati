import type Database from 'better-sqlite3'
import { generateTicketCode } from '../shared/ticket-code'

/**
 * Calculates amount_remaining accurately.
 * Guaranteed to be non-negative.
 */
export function calculateRemaining(price: number, amountPaid: number): number {
  const safePrice = Number(price) || 0
  const safePaid = Number(amountPaid) || 0
  const remaining = safePrice - safePaid
  return remaining > 0 ? remaining : 0
}

/**
 * A ticket code that no ticket uses yet, neither as its code nor as its legacy (pre-migration) code.
 * Format and reasons: src/shared/ticket-code.ts.
 */
export function generateUniqueTicketCode(db: Database.Database): string {
  const taken = db.prepare(`SELECT 1 FROM Ticket WHERE barcode_code = ? OR legacy_barcode_code = ?`)
  for (let attempt = 0; attempt < 1000; attempt++) {
    const code = generateTicketCode()
    if (!taken.get(code, code)) return code
  }
  throw new Error('تعذر توليد رمز تذكرة فريد. أعد المحاولة.')
}
