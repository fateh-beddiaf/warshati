// Automatic backups: the pure rules (file names, rotation, when a backup is due, the warning state, same-drive check).
// No Node/Electron/DOM dependency: the main process applies them (main/auto-backup*.ts), the renderer shows the
// result, and tests/auto_backup.test.ts checks them in isolation.

/** Setting keys (Setting table). Written only by the main process: `settings:set` refuses this prefix. */
export const BACKUP_SETTING_PREFIX = 'backup_'
export const BACKUP_KEYS = {
  /** the folder the user chose ('' = none) */
  dir: 'backup_dir',
  /** '1' = automatic backups on */
  auto: 'backup_auto',
  /** how many automatic backups the folder keeps */
  keep: 'backup_keep',
  /** when automatic backups were turned on (ISO): the warning counts from here until the first success */
  enabledAt: 'backup_enabled_at',
  lastSuccessAt: 'backup_last_success_at',
  lastPath: 'backup_last_path',
  lastSize: 'backup_last_size',
  /** fingerprint of the data in the last successful backup (see main/auto-backup-core.ts) */
  lastFingerprint: 'backup_last_fingerprint',
  /** last time the folder was known to hold a backup of the current data (a backup, or a check that found no change) */
  upToDateAt: 'backup_up_to_date_at',
  lastError: 'backup_last_error',
  lastErrorAt: 'backup_last_error_at'
} as const

export const DEFAULT_BACKUP_KEEP = 30
export const MIN_BACKUP_KEEP = 1
export const MAX_BACKUP_KEEP = 365
/** An automatic backup is due once the last one is this old */
export const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000
/** How often the running app checks whether a backup is due */
export const BACKUP_CHECK_INTERVAL_MS = 60 * 60 * 1000
/** The warning banner shows when automatic backups are on and none succeeded for this long */
export const BACKUP_STALE_MS = 3 * 24 * 60 * 60 * 1000
/** Closing the app never waits longer than this for its backup */
export const BACKUP_ON_QUIT_TIMEOUT_MS = 10_000

/** warshati-YYYY-MM-DD_HH-mm.db: the only files rotation may ever delete */
export const BACKUP_FILE_PATTERN = /^warshati-(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})\.db$/

const pad = (n: number): string => String(n).padStart(2, '0')

/** The backup file name for `date` (local time, to the minute). */
export function backupFileName(date: Date): string {
  return (
    `warshati-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}-${pad(date.getMinutes())}.db`
  )
}

/** The local time encoded in a backup file name, or null when `name` is not exactly a backup file name. */
export function parseBackupFileName(name: string): Date | null {
  const m = BACKUP_FILE_PATTERN.exec(name)
  if (!m) return null
  const [year, month, day, hour, minute] = m.slice(1).map(Number)
  const date = new Date(year, month - 1, day, hour, minute)
  // Reject impossible dates (2026-02-31 would silently roll over to March)
  if (date.getMonth() !== month - 1 || date.getDate() !== day || hour > 23 || minute > 59) return null
  return date
}

/** Backup files among `names`, newest first. Anything that is not exactly a backup file name is left out. */
export function sortBackupNames(names: readonly string[]): string[] {
  return names
    .map((name) => ({ name, date: parseBackupFileName(name) }))
    .filter((f): f is { name: string; date: Date } => f.date !== null)
    .sort((a, b) => b.date.getTime() - a.date.getTime() || b.name.localeCompare(a.name))
    .map((f) => f.name)
}

/**
 * The files to delete so the folder keeps the `keep` newest backups. Only names matching the backup pattern are
 * ever returned (the user's other files in the folder are never touched), and `justWritten` (the backup that has
 * just succeeded) is never among them. Call it only after the new backup has succeeded.
 */
export function planRotation(names: readonly string[], keep: number, justWritten?: string): string[] {
  const safeKeep = normalizeKeep(keep)
  const others = sortBackupNames(names).filter((n) => n !== justWritten)
  const room = justWritten ? safeKeep - 1 : safeKeep
  return others.slice(Math.max(room, 0))
}

/** The number of backups to keep: whole, within [MIN_BACKUP_KEEP, MAX_BACKUP_KEEP], else the default. */
export function normalizeKeep(value: unknown): number {
  // '' (never set) must not read as 0
  const n = typeof value === 'string' ? (value.trim() === '' ? NaN : Number(value.trim())) : value
  if (typeof n !== 'number' || !Number.isInteger(n)) return DEFAULT_BACKUP_KEEP
  return Math.min(Math.max(n, MIN_BACKUP_KEEP), MAX_BACKUP_KEEP)
}

function time(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : t
}

/**
 * Whether an automatic backup should be attempted now: automatic backups on, a folder chosen, and the folder not
 * known to hold a copy of the current data for BACKUP_INTERVAL_MS (or never). A clock set back (a time in the
 * future) also counts as due.
 */
export function isBackupDue(o: { enabled: boolean; dir: string; upToDateAt: string | null; now: Date }): boolean {
  if (!o.enabled || !o.dir) return false
  const last = time(o.upToDateAt)
  if (last === null) return true
  const age = o.now.getTime() - last
  return age >= BACKUP_INTERVAL_MS || age < 0
}

export type BackupHealth =
  /** automatic backups are off */
  | 'off'
  /** on, but no folder chosen yet */
  | 'no-folder'
  /** on, and the folder holds a recent copy of the data */
  | 'ok'
  /** on, and no backup succeeded for more than BACKUP_STALE_MS */
  | 'stale'
  /** on, and the chosen folder cannot be reached (deleted, USB drive removed) */
  | 'unavailable'

/** What the warning banner shows ('stale' and 'unavailable' warn, the rest does not). */
export function backupHealth(o: {
  enabled: boolean
  dir: string
  dirAvailable: boolean
  upToDateAt: string | null
  enabledAt: string | null
  now: Date
}): BackupHealth {
  if (!o.enabled) return 'off'
  if (!o.dir) return 'no-folder'
  if (!o.dirAvailable) return 'unavailable'
  const since = time(o.upToDateAt) ?? time(o.enabledAt)
  if (since === null) return 'ok'
  return o.now.getTime() - since > BACKUP_STALE_MS ? 'stale' : 'ok'
}

/** Whether a health state should show the warning banner. */
export function healthWarns(health: BackupHealth): boolean {
  return health === 'stale' || health === 'unavailable'
}

/**
 * The volume a Windows or POSIX path lives on, for the "same drive" hint: `C:` for `c:\...`, `\\server\share`
 * for a UNC path, `/` for a POSIX path (callers on POSIX compare device ids instead). Case-insensitive on Windows.
 */
export function volumeOf(path: string): string {
  const p = path.replace(/\//g, '\\')
  const drive = /^(?:\\\\[?.]\\)?([a-zA-Z]):/.exec(p)
  if (drive) return `${drive[1].toUpperCase()}:`
  const unc = /^\\\\(?:\?\\UNC\\)?([^\\]+)\\([^\\]+)/i.exec(p)
  if (unc) return `\\\\${unc[1].toLowerCase()}\\${unc[2].toLowerCase()}`
  return path.startsWith('/') ? '/' : ''
}

/** True when both paths are on the same Windows drive / network share. Unknown volumes are not "the same". */
export function sameVolume(a: string, b: string): boolean {
  const va = volumeOf(a)
  return va !== '' && va !== '/' && va === volumeOf(b)
}

/** One backup file of the chosen folder, as the settings list shows it */
export interface BackupFileInfo {
  name: string
  /** ISO time from the file name */
  createdAt: string
  sizeBytes: number
}

export interface BackupStatus {
  dir: string
  enabled: boolean
  keep: number
  dirAvailable: boolean
  /** the folder is on the same drive as the database: a damaged drive would take both */
  sameDriveAsDatabase: boolean
  health: BackupHealth
  lastSuccess: { at: string; path: string; sizeBytes: number } | null
  lastError: { at: string; message: string } | null
  /** backups in the folder, newest first ([] when the folder is not available) */
  files: BackupFileInfo[]
  /** a backup is being written right now */
  running: boolean
}

export type BackupRunTrigger = 'manual' | 'auto' | 'quit' | 'startup'

export type BackupRunResult =
  | { outcome: 'created'; path: string; sizeBytes: number; deleted: string[] }
  | { outcome: 'unchanged'; path: string }
  | { outcome: 'skipped'; reason: 'disabled' | 'no-folder' }
  | { outcome: 'failed'; error: string }

/** Pushed by the main process to the window after every backup run and every periodic check */
export interface BackupStatusEvent {
  status: BackupStatus
  run?: { trigger: BackupRunTrigger; result: BackupRunResult }
}
