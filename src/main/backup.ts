import { dialog, BrowserWindow, app } from 'electron'
import { existsSync, statSync, copyFileSync, unlinkSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import Database from 'better-sqlite3'
import { getDatabase, closeDatabase, initDatabase, getDatabasePath } from '../database'
import type { DatabaseInfo } from '../database/types'

export type SafetyBackupCreator = (
  database: Database.Database,
  destinationPath: string
) => Promise<unknown>

export interface ImportDatabaseBackupOptions {
  createSafetyBackup?: SafetyBackupCreator
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function getDatabaseInfo(): DatabaseInfo {
  const filePath = getDatabasePath()
  if (!existsSync(filePath)) {
    return {
      filePath,
      fileSizeBytes: 0,
      fileSizeFormatted: '0 KB',
      lastModified: new Date().toISOString()
    }
  }

  const stats = statSync(filePath)
  return {
    filePath,
    fileSizeBytes: stats.size,
    fileSizeFormatted: formatBytes(stats.size),
    lastModified: stats.mtime.toISOString()
  }
}

export async function exportDatabaseBackup(
  targetWindow?: BrowserWindow | null,
  customDestinationPath?: string
): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }> {
  try {
    let destPath = customDestinationPath

    if (!destPath) {
      const now = new Date()
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`
      const defaultFilename = `warshati_backup_${timestamp}.db`

      const win = targetWindow || BrowserWindow.getFocusedWindow() || undefined
      const saveResult = await dialog.showSaveDialog(win!, {
        title: 'تصدير نسخة احتياطية من قاعدة البيانات',
        defaultPath: defaultFilename,
        filters: [
          { name: 'ملف قاعدة بيانات SQLite (*.db)', extensions: ['db'] },
          { name: 'جميع الملفات (*.*)', extensions: ['*'] }
        ]
      })

      if (saveResult.canceled || !saveResult.filePath) {
        return { success: false, canceled: true }
      }
      destPath = saveResult.filePath
    }

    // Ensure directory exists
    const destDir = dirname(destPath)
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true })
    }

    const db = getDatabase()
    // Perform WAL checkpoint to flush all pending transactions to main file
    try {
      db.pragma('wal_checkpoint(TRUNCATE)')
    } catch (e) {
      console.warn('WAL checkpoint warning during export:', e)
    }

    // Online atomic backup using better-sqlite3 native backup
    await db.backup(destPath)

    return {
      success: true,
      filePath: destPath
    }
  } catch (err) {
    console.error('Failed to export database backup:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'فشل تصدير النسخة الاحتياطية'
    }
  }
}

export async function importDatabaseBackup(
  targetWindow?: BrowserWindow | null,
  customSourcePath?: string,
  options: ImportDatabaseBackupOptions = {}
): Promise<{
  success: boolean
  filePath?: string
  safetyBackupPath?: string
  canceled?: boolean
  error?: string
}> {
  try {
    let sourcePath = customSourcePath

    if (!sourcePath) {
      const win = targetWindow || BrowserWindow.getFocusedWindow() || undefined
      const openResult = await dialog.showOpenDialog(win!, {
        title: 'استيراد واستعادة قاعدة بيانات ورشتي',
        properties: ['openFile'],
        filters: [
          { name: 'ملفات قواعد بيانات SQLite (*.db, *.sqlite)', extensions: ['db', 'sqlite', 'sqlite3'] },
          { name: 'جميع الملفات (*.*)', extensions: ['*'] }
        ]
      })

      if (openResult.canceled || !openResult.filePaths || openResult.filePaths.length === 0) {
        return { success: false, canceled: true }
      }
      sourcePath = openResult.filePaths[0]
    }

    if (!existsSync(sourcePath)) {
      return { success: false, error: 'الملف المحدد غير موجود' }
    }

    // 1. Sanity Check on the imported file
    let tempDb: Database.Database | null = null
    try {
      tempDb = new Database(sourcePath, { readonly: true, fileMustExist: true })
      const tables = tempDb
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('Ticket', 'Customer', 'RepairCategory', 'Brand')`)
        .all() as { name: string }[]

      if (tables.length < 4) {
        tempDb.close()
        return {
          success: false,
          error: 'الملف المحدد ليس قاعدة بيانات صالحة لتطبيق ورشتي (جداول النظام الأساسية مفقودة).'
        }
      }
      tempDb.close()
      tempDb = null
    } catch (sanityErr) {
      if (tempDb) {
        try {
          tempDb.close()
        } catch {
          // ignore
        }
      }
      return {
        success: false,
        error: `فشل التحقق من سلامة الملف: ${sanityErr instanceof Error ? sanityErr.message : 'ملف غير صالح'}`
      }
    }

    // 2. Pre-import safety backup. Import must never continue if this fails.
    const activeDbPath = getDatabasePath()
    let safetyBackupPath = ''
    try {
      let backupDir = dirname(activeDbPath)
      try {
        if (app && app.getPath) {
          backupDir = app.getPath('userData')
        }
      } catch {
        // use active dir in tests or fallback
      }
      safetyBackupPath = join(backupDir, 'auto-backup-before-import.db')

      const currentDb = getDatabase()
      try {
        currentDb.pragma('wal_checkpoint(TRUNCATE)')
      } catch {
        // ignore
      }
      const createSafetyBackup: SafetyBackupCreator = options.createSafetyBackup || ((database, destinationPath) => database.backup(destinationPath))
      await createSafetyBackup(currentDb, safetyBackupPath)
      console.log(`[Safety Backup] Pre-import backup created at: ${safetyBackupPath}`)
    } catch (safetyErr) {
      console.error('Failed to create required pre-import safety backup:', safetyErr)
      return {
        success: false,
        error: `تعذر إنشاء النسخة الاحتياطية الإلزامية قبل الاستيراد؛ لم يبدأ الاستيراد. ${safetyErr instanceof Error ? safetyErr.message : ''}`.trim()
      }
    }

    // 3. Close active database connection
    closeDatabase()

    // 4. Overwrite active database file
    copyFileSync(sourcePath, activeDbPath)

    // Remove WAL & SHM files to ensure clean state
    const walPath = `${activeDbPath}-wal`
    const shmPath = `${activeDbPath}-shm`
    if (existsSync(walPath)) {
      try {
        unlinkSync(walPath)
      } catch {
        // ignore
      }
    }
    if (existsSync(shmPath)) {
      try {
        unlinkSync(shmPath)
      } catch {
        // ignore
      }
    }

    // 5. Re-open and verify database
    const reopenedDb = initDatabase(activeDbPath)
    reopenedDb.pragma('wal_checkpoint(TRUNCATE)')

    return {
      success: true,
      filePath: sourcePath,
      safetyBackupPath
    }
  } catch (err) {
    console.error('Failed to import database:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'فشل استيراد واستعادة قاعدة البيانات'
    }
  }
}
