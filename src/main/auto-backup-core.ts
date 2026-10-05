import { createHash } from 'crypto'
import { existsSync, readdirSync, renameSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'
import Database from 'better-sqlite3'
import {
  BACKUP_FILE_PATTERN,
  BACKUP_SETTING_PREFIX,
  backupFileName,
  parseBackupFileName,
  planRotation,
  sortBackupNames,
  type BackupFileInfo
} from '../shared/auto-backup'

// Electron-free core of the automatic backup (testable under plain node/electron -r tsx, like backup-core.ts).
// Nothing here writes outside the chosen folder: the folder is never created, and only files named like a backup
// (BACKUP_FILE_PATTERN) plus the one temporary file of the backup being written are ever created or deleted in it.

/** Suffix of the file a backup is written to before it is verified and renamed to its final name */
export const PARTIAL_SUFFIX = '.partial'
/** A partial file this old was left by an interrupted backup (the app closed mid-copy) and is removed */
const STALE_PARTIAL_MS = 10 * 60 * 1000

export type BackupWriter = (db: Database.Database, destinationPath: string) => Promise<unknown>

export interface WriteBackupOptions {
  /** Override how the copy is produced (default: better-sqlite3 online backup). Tests inject failures here. */
  writer?: BackupWriter
}

export interface WriteBackupResult {
  path: string
  name: string
  sizeBytes: number
  /** backups removed by rotation */
  deleted: string[]
  /** rotation deletions that failed (the backup itself succeeded) */
  rotationErrors: string[]
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function safeRemove(path: string): void {
  try {
    if (existsSync(path)) unlinkSync(path)
  } catch {
    // best effort: a leftover .partial file is never mistaken for a backup
  }
}

/** Throws a readable error when `dir` is not an existing folder (deleted, USB drive removed, a file). */
export function assertBackupDir(dir: string): void {
  if (!dir) throw new Error('لم يُختر مجلد للنسخ الاحتياطي.')
  let isDir: boolean
  try {
    isDir = statSync(dir).isDirectory()
  } catch {
    isDir = false
  }
  if (!isDir) throw new Error(`مجلد النسخ الاحتياطي غير متاح: ${dir}`)
}

export function isBackupDirAvailable(dir: string): boolean {
  try {
    assertBackupDir(dir)
    return true
  } catch {
    return false
  }
}

/** Removes `<backup name>.partial` files older than STALE_PARTIAL_MS: ours, left by an interrupted backup. */
function removeStalePartials(dir: string, now: Date): void {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return
  }
  for (const name of names) {
    if (!name.endsWith(PARTIAL_SUFFIX) || !BACKUP_FILE_PATTERN.test(name.slice(0, -PARTIAL_SUFFIX.length))) continue
    try {
      const path = join(dir, name)
      if (now.getTime() - statSync(path).mtimeMs > STALE_PARTIAL_MS) unlinkSync(path)
    } catch {
      // in use or already gone
    }
  }
}

/**
 * Makes the copy one self-contained file: the online backup keeps the live database's WAL mode, and a WAL database
 * opened later (even read-only) leaves -wal/-shm files beside it. Rollback-journal mode needs neither.
 */
function makeStandalone(path: string): void {
  const db = new Database(path, { fileMustExist: true })
  try {
    db.pragma('journal_mode = DELETE')
  } finally {
    db.close()
  }
}

function removeWithSidecars(path: string): void {
  for (const p of [path, `${path}-wal`, `${path}-shm`, `${path}-journal`]) safeRemove(p)
}

/** Opens a written copy read-only and checks it page by page; throws unless SQLite answers "ok". */
export function verifyBackupFile(path: string): void {
  const db = new Database(path, { readonly: true, fileMustExist: true })
  try {
    const result = db.pragma('integrity_check', { simple: true })
    if (result !== 'ok') throw new Error(`integrity_check: ${String(result)}`)
  } finally {
    db.close()
  }
}

/**
 * Writes a backup of `db` into `dir` as warshati-YYYY-MM-DD_HH-mm.db:
 *   1. online backup (consistent even while the app writes, WAL included) to `<final name>.partial`, made a
 *      single self-contained file (no -wal/-shm beside it),
 *   2. integrity_check on that copy, opened read-only,
 *   3. atomic rename to the final name (a backup taken in the same minute is replaced by the newer one),
 *   4. rotation: only now, and only files named like a backup, keeping the `keep` newest.
 * On any failure before step 3 the partial file is removed and nothing else in the folder has changed, so a file
 * with a final backup name is always a complete, verified copy.
 */
export async function writeBackup(
  db: Database.Database,
  dir: string,
  now: Date,
  keep: number,
  options: WriteBackupOptions = {}
): Promise<WriteBackupResult> {
  assertBackupDir(dir)
  const name = backupFileName(now)
  const finalPath = join(dir, name)
  const partialPath = finalPath + PARTIAL_SUFFIX
  const writer: BackupWriter = options.writer ?? ((database, dest) => database.backup(dest))

  removeStalePartials(dir, now)
  removeWithSidecars(partialPath)
  try {
    await writer(db, partialPath)
    makeStandalone(partialPath)
    verifyBackupFile(partialPath)
    renameSync(partialPath, finalPath)
  } catch (err) {
    removeWithSidecars(partialPath)
    throw new Error(`فشل إنشاء النسخة الاحتياطية: ${errMsg(err)}`, { cause: err })
  }

  const sizeBytes = statSync(finalPath).size
  const deleted: string[] = []
  const rotationErrors: string[] = []
  let names: string[] = []
  try {
    names = readdirSync(dir)
  } catch (err) {
    rotationErrors.push(errMsg(err))
  }
  for (const old of planRotation(names, keep, name)) {
    // planRotation only returns backup names; checked again here because this is the one place that deletes
    if (!BACKUP_FILE_PATTERN.test(old)) continue
    try {
      unlinkSync(join(dir, old))
      deleted.push(old)
    } catch (err) {
      rotationErrors.push(`${old}: ${errMsg(err)}`)
    }
  }
  return { path: finalPath, name, sizeBytes, deleted, rotationErrors }
}

/** The backups in `dir`, newest first, with their sizes. [] when the folder cannot be read. */
export function listBackups(dir: string): BackupFileInfo[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  const files: BackupFileInfo[] = []
  for (const name of sortBackupNames(names)) {
    try {
      const stat = statSync(join(dir, name))
      if (!stat.isFile()) continue
      files.push({ name, createdAt: parseBackupFileName(name)!.toISOString(), sizeBytes: stat.size })
    } catch {
      // vanished between listing and stat
    }
  }
  return files
}

/**
 * A fingerprint of the data: SHA-256 over every table's rows (in rowid order), so it changes exactly when the
 * data changes. The backup's own bookkeeping (Setting rows named backup_*) is left out, otherwise recording a backup
 * would itself count as a change. (PRAGMA data_version cannot be used: it only moves when ANOTHER connection
 * writes, and the app writes through a single connection.)
 */
export function dataFingerprint(db: Database.Database): string {
  const hash = createHash('sha256')
  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
    .all() as { name: string }[]
  for (const { name } of tables) {
    const quoted = `"${name.replace(/"/g, '""')}"`
    const where = name === 'Setting' ? ` WHERE substr(key, 1, ?) != ?` : ''
    const params = name === 'Setting' ? [BACKUP_SETTING_PREFIX.length, BACKUP_SETTING_PREFIX] : []
    hash.update(`\u0000table:${name}\u0000`)
    const rows = db
      .prepare(`SELECT * FROM ${quoted}${where} ORDER BY rowid`)
      .raw()
      .iterate(...params) as Iterable<unknown[]>
    for (const row of rows) {
      hash.update(JSON.stringify(row, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v)))
      hash.update('\n')
    }
  }
  return hash.digest('hex')
}
