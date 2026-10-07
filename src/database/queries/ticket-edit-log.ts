import type Database from 'better-sqlite3'
import type { TicketEditField, TicketEditLog } from '../../shared/types'

// TicketEditLog: one row per changed field of a ticket edit, written in the same transaction as the edit.
// Values are readable text snapshots (see TicketEditLog in shared/types.ts for the format of each field).

export interface EditLogChange {
  field: TicketEditField
  old_value: string | null
  new_value: string | null
}

/** A money amount as logged: the plain number ("4000", "1255.5"); null (cost not entered) stays null. */
export function moneyLogValue(amount: number | null | undefined): string | null {
  return amount === null || amount === undefined ? null : String(amount)
}

/** Writes the rows of one edit (all with the same timestamp). Call it inside the edit's transaction. */
export function insertEditLogs(
  db: Database.Database,
  ticketId: number,
  changes: readonly EditLogChange[],
  timestamp: string
): void {
  const insert = db.prepare(
    `INSERT INTO TicketEditLog (ticket_id, field, old_value, new_value, timestamp) VALUES (?, ?, ?, ?, ?)`
  )
  for (const change of changes) insert.run(ticketId, change.field, change.old_value, change.new_value, timestamp)
}

export function getTicketEditLogs(db: Database.Database, ticketId: number): TicketEditLog[] {
  return db.prepare(`SELECT * FROM TicketEditLog WHERE ticket_id = ? ORDER BY id ASC`).all(ticketId) as TicketEditLog[]
}
