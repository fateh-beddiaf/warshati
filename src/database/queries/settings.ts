import type Database from 'better-sqlite3'

export const DEFAULT_OVERDUE_DAYS = 3

export function getSetting(db: Database.Database, key: string, defaultValue: string = ''): string {
  const row = db.prepare(`SELECT value FROM Setting WHERE key = ?`).get(key) as { value: string } | undefined
  return row ? row.value : defaultValue
}

export function setSetting(db: Database.Database, key: string, value: string): void {
  db.prepare(
    `
    INSERT INTO Setting (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `
  ).run(key, value)
}

export function getOverdueThresholdDays(db: Database.Database): number {
  const val = getSetting(db, 'overdue_ready_days', String(DEFAULT_OVERDUE_DAYS))
  const parsed = parseInt(val, 10)
  return isNaN(parsed) || parsed < 1 ? DEFAULT_OVERDUE_DAYS : parsed
}
