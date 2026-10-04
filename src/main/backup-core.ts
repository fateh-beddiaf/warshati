import { existsSync, statSync, copyFileSync, unlinkSync, renameSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import Database from 'better-sqlite3'
import { getDatabase, closeDatabase, initDatabase } from '../database'
import { initializeSchema } from '../database/schema'
import { seedInitialData } from '../database/seed'

// Electron-free core of the database import flow (testable under plain node/electron -r tsx).

export type SafetyBackupCreator = (database: Database.Database, destinationPath: string) => Promise<unknown>

export interface ImportDatabaseFromFileOptions {
  /** Where to keep the pre-import copy of the live DB. Default: <live dir>/auto-backup-before-import.db */
  safetyBackupPath?: string
  /** Override how the safety copy is produced (default: better-sqlite3 online backup). */
  createSafetyBackup?: SafetyBackupCreator
  /** Override schema init + seed run against the TEMP copy (default: initializeSchema + seedInitialData). */
  prepareDatabase?: (db: Database.Database) => void
  /** Called right after the live file was replaced and before it is reopened (failure-injection hook). */
  afterSwap?: () => void
}

export interface ImportDatabaseFromFileResult {
  success: boolean
  safetyBackupPath?: string
  error?: string
}

let requiredTablesCache: string[] | null = null

/** Every table the app creates, derived from schema.ts itself so it can never drift. */
export function getRequiredTables(): string[] {
  if (!requiredTablesCache) {
    const mem = new Database(':memory:')
    try {
      initializeSchema(mem)
      requiredTablesCache = (
        mem
          .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
          .all() as { name: string }[]
      ).map((row) => row.name)
    } finally {
      mem.close()
    }
  }
  return requiredTablesCache
}

function errMsg(err: unknown, fallback = 'خطأ غير معروف'): string {
  return err instanceof Error ? err.message : fallback
}

function removeIfExists(path: string): void {
  if (existsSync(path)) unlinkSync(path)
}

function removeSidecars(dbPath: string): void {
  removeIfExists(`${dbPath}-wal`)
  removeIfExists(`${dbPath}-shm`)
}

function safeRemove(path: string): void {
  try {
    removeIfExists(path)
  } catch {
    // best effort cleanup
  }
}

/** Replace `target` with `source` file contents atomically (copy to sibling temp, then rename). */
function replaceFile(source: string, target: string): void {
  const staging = `${target}.swap-tmp`
  safeRemove(staging)
  copyFileSync(source, staging)
  try {
    renameSync(staging, target)
  } catch (err) {
    safeRemove(staging)
    throw err
  }
}

/**
 * Validate a candidate DB file (already a private temp copy) and bring it up to the current schema.
 * Throws a descriptive Error when the file is not usable. The file is left as a single standalone file.
 */
function validateAndPrepareCopy(tempPath: string, prepare: (db: Database.Database) => void): void {
  let db: Database.Database | null = null
  try {
    try {
      db = new Database(tempPath, { fileMustExist: true })
      const integrity = db.pragma('integrity_check', { simple: true })
      if (integrity !== 'ok') throw new Error(`integrity_check: ${String(integrity)}`)
    } catch (err) {
      throw new Error(`الملف المحدد ليس قاعدة بيانات SQLite صالحة (${errMsg(err)}).`, { cause: err })
    }

    const existing = new Set(
      (db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as { name: string }[]).map((r) => r.name)
    )
    const missing = getRequiredTables().filter((name) => !existing.has(name))
    if (missing.length > 0) {
      throw new Error(`الملف المحدد ليس قاعدة بيانات صالحة لتطبيق ورشتي (جداول مفقودة: ${missing.join(', ')}).`)
    }

    db.pragma('foreign_keys = ON')
    try {
      prepare(db)
    } catch (err) {
      throw new Error(`فشل ترحيل قاعدة البيانات المستوردة إلى النسخة الحالية: ${errMsg(err)}`, { cause: err })
    }

    // Fold everything into the main file so the temp copy is self-contained
    db.pragma('journal_mode = DELETE')
  } finally {
    if (db) {
      try {
        db.close()
      } catch {
        // ignore
      }
    }
  }
}

function verifySafetyCopy(path: string): void {
  const db = new Database(path, { readonly: true, fileMustExist: true })
  try {
    const res = db.pragma('quick_check', { simple: true })
    if (res !== 'ok') throw new Error(`quick_check: ${String(res)}`)
  } finally {
    db.close()
  }
}

/**
 * Safely import the SQLite file at `srcPath` as the live database at `livePath`.
 * The live DB is only touched after the candidate has been validated and migrated on a temp copy.
 * On every failure path the original data is intact and the DB handle is left open.
 */
export async function importDatabaseFromFile(
  srcPath: string,
  livePath: string,
  options: ImportDatabaseFromFileOptions = {}
): Promise<ImportDatabaseFromFileResult> {
  if (!existsSync(srcPath) || !statSync(srcPath).isFile()) {
    return { success: false, error: 'الملف المحدد غير موجود' }
  }

  const tempPath = `${livePath}.import-tmp`
  const safetyPath = options.safetyBackupPath ?? join(dirname(livePath), 'auto-backup-before-import.db')
  const safetyPartial = `${safetyPath}.partial`
  const prepare =
    options.prepareDatabase ??
    ((db: Database.Database): void => {
      initializeSchema(db)
      seedInitialData(db)
    })

  try {
    // 1. Validate + migrate a private temp copy; the live DB is untouched so far.
    try {
      mkdirSync(dirname(livePath), { recursive: true })
      safeRemove(tempPath)
      copyFileSync(srcPath, tempPath)
      validateAndPrepareCopy(tempPath, prepare)
    } catch (err) {
      return { success: false, error: errMsg(err, 'ملف غير صالح') }
    }

    // 2. Mandatory consistent safety copy of the live DB (online backup handles WAL).
    try {
      mkdirSync(dirname(safetyPath), { recursive: true })
      const live = initDatabase(livePath)
      try {
        live.pragma('wal_checkpoint(TRUNCATE)')
      } catch {
        // ignore
      }
      const createSafetyBackup: SafetyBackupCreator =
        options.createSafetyBackup ?? ((database, dest) => database.backup(dest))
      safeRemove(safetyPartial)
      await createSafetyBackup(live, safetyPartial)
      verifySafetyCopy(safetyPartial)
      safeRemove(safetyPath)
      renameSync(safetyPartial, safetyPath)
    } catch (err) {
      safeRemove(safetyPartial)
      return {
        success: false,
        error: `تعذر إنشاء النسخة الاحتياطية الإلزامية قبل الاستيراد؛ لم يبدأ الاستيراد. ${errMsg(err, '')}`.trim()
      }
    }

    // 3. Swap. From here any failure restores the safety copy and reopens the DB.
    try {
      closeDatabase()
      removeSidecars(livePath)
      renameSync(tempPath, livePath)
      options.afterSwap?.()
      const reopened = initDatabase(livePath)
      reopened.pragma('wal_checkpoint(TRUNCATE)')
      return { success: true, safetyBackupPath: safetyPath }
    } catch (swapErr) {
      console.error('Import swap failed, restoring safety backup:', swapErr)
      try {
        closeDatabase()
        removeSidecars(livePath)
        replaceFile(safetyPath, livePath)
        initDatabase(livePath)
      } catch (restoreErr) {
        console.error('CRITICAL: failed to restore safety backup:', restoreErr)
        // Last attempt to leave a usable handle open
        try {
          getDatabase()
        } catch {
          // ignore
        }
        return {
          success: false,
          safetyBackupPath: safetyPath,
          error: `فشل الاستيراد وتعذرت الاستعادة التلقائية (${errMsg(restoreErr)}). النسخة الاحتياطية محفوظة في: ${safetyPath}`
        }
      }
      return {
        success: false,
        safetyBackupPath: safetyPath,
        error: `فشل الاستيراد؛ تمت استعادة بياناتك الأصلية. ${errMsg(swapErr, '')}`.trim()
      }
    }
  } finally {
    safeRemove(tempPath)
  }
}
