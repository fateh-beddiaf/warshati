import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'path'
import { getDatabase, getDatabasePath } from '../database'
import {
  BACKUP_CHECK_INTERVAL_MS,
  BACKUP_FILE_PATTERN,
  BACKUP_ON_QUIT_TIMEOUT_MS,
  type BackupRunResult,
  type BackupRunTrigger,
  type BackupStatusEvent
} from '../shared/auto-backup'
import { withTimeout } from '../shared/with-timeout'
import { createAutoBackupService, type AutoBackupService } from './auto-backup-service'
import { isBackupDirAvailable } from './auto-backup-core'
import { importDatabaseBackup } from './backup'
import { assertString } from './ipc-validate'

// Automatic backups in the running app: when they happen (startup if due, an hourly check that backs up at most
// every 24h, on quit, on demand), the IPC the settings screen uses, and the status pushed to the window.

/** First check after startup: late enough not to slow the first screen */
const STARTUP_CHECK_DELAY_MS = 5_000

let service: AutoBackupService | null = null

function getService(): AutoBackupService {
  service ??= createAutoBackupService({ getDb: getDatabase, getDbPath: () => getDatabasePath() })
  return service
}

function broadcast(event: BackupStatusEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('backup:status', event)
  }
}

async function runAndReport(trigger: BackupRunTrigger): Promise<BackupRunResult> {
  const result = await getService().run(trigger)
  broadcast({ status: getService().status(), run: { trigger, result } })
  return result
}

/** Startup and hourly: back up when due, and refresh the window's warning state either way. */
async function periodicCheck(trigger: BackupRunTrigger): Promise<void> {
  try {
    const s = getService()
    if (s.isDue()) {
      await runAndReport(trigger)
    } else {
      broadcast({ status: s.status() })
    }
  } catch (err) {
    console.error('[backup] periodic check failed:', err)
  }
}

/**
 * Restores through the safe import (validated temp copy, safety copy of the live data, atomic swap), keeping the
 * backup settings: the restored file carries its own, older backup folder and status.
 */
export async function importKeepingBackupSettings(
  win: BrowserWindow | null,
  sourcePath?: string
): ReturnType<typeof importDatabaseBackup> {
  const s = getService()
  const kept = s.backupSettings()
  const { dir } = s.config()
  const defaultPath = dir && isBackupDirAvailable(dir) ? dir : undefined
  const result = await importDatabaseBackup(win, sourcePath, { defaultPath })
  if (result.success) {
    try {
      s.restoreBackupSettings(kept)
    } catch (err) {
      console.error('[backup] could not keep the backup settings after the import:', err)
    }
  }
  broadcast({ status: s.status() })
  return result
}

function fail(error: unknown, fallback: string): { success: false; error: string } {
  return { success: false, error: error instanceof Error ? error.message : fallback }
}

function registerHandlers(): void {
  ipcMain.handle('backup:auto:status', () => {
    try {
      return { success: true, data: getService().status() }
    } catch (error) {
      return fail(error, 'Failed to read the backup status')
    }
  })

  ipcMain.handle('backup:auto:chooseDir', async (event) => {
    try {
      const s = getService()
      const current = s.config().dir
      const win = BrowserWindow.fromWebContents(event.sender)
      const options: Electron.OpenDialogOptions = {
        title: 'اختر مجلد النسخ الاحتياطي',
        properties: ['openDirectory', 'createDirectory'],
        defaultPath: current && isBackupDirAvailable(current) ? current : undefined
      }
      const picked = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
      if (picked.canceled || picked.filePaths.length === 0) return { success: true, canceled: true }
      s.setDir(picked.filePaths[0])
      // A new folder holds no copy yet: back up right away when automatic backups are on
      if (s.config().enabled) void runAndReport('auto')
      return { success: true, data: s.status() }
    } catch (error) {
      return fail(error, 'Failed to choose the backup folder')
    }
  })

  ipcMain.handle('backup:auto:setEnabled', (_event, enabled: unknown) => {
    try {
      if (typeof enabled !== 'boolean') throw new Error('Invalid input: enabled must be a boolean')
      const s = getService()
      s.setEnabled(enabled)
      if (enabled) void periodicCheck('auto')
      return { success: true, data: s.status() }
    } catch (error) {
      return fail(error, 'Failed to change automatic backups')
    }
  })

  ipcMain.handle('backup:auto:setKeep', (_event, keep: unknown) => {
    try {
      if (typeof keep !== 'number' || !Number.isInteger(keep)) throw new Error('Invalid input: keep must be an integer')
      const s = getService()
      s.setKeep(keep)
      return { success: true, data: s.status() }
    } catch (error) {
      return fail(error, 'Failed to change the number of backups')
    }
  })

  ipcMain.handle('backup:auto:runNow', async () => {
    try {
      const result = await runAndReport('manual')
      return { success: true, data: { result, status: getService().status() } }
    } catch (error) {
      return fail(error, 'Backup failed')
    }
  })

  ipcMain.handle('backup:auto:restore', async (event, name: unknown) => {
    try {
      assertString(name, 'name', 100)
      // Only a backup file name, never a path: the file must be in the chosen folder
      if (!BACKUP_FILE_PATTERN.test(name)) throw new Error('Invalid input: not a backup file name')
      const { dir } = getService().config()
      if (!dir || !isBackupDirAvailable(dir)) throw new Error(`مجلد النسخ الاحتياطي غير متاح: ${dir}`)
      return await importKeepingBackupSettings(BrowserWindow.fromWebContents(event.sender), join(dir, name))
    } catch (error) {
      return fail(error, 'Restore failed')
    }
  })
}

let quitBackupDone = false

/**
 * Closing the app backs up first when automatic backups are on and the data changed (the run itself skips an
 * unchanged database). The quit is held at most BACKUP_ON_QUIT_TIMEOUT_MS, then goes on whatever happened.
 */
function onBeforeQuit(event: Electron.Event): void {
  if (quitBackupDone) return
  let wanted: boolean
  try {
    const { enabled, dir } = getService().config()
    wanted = enabled && dir !== ''
  } catch {
    wanted = false // the database is already closed
  }
  quitBackupDone = true
  if (!wanted) return
  event.preventDefault()
  const backup = getService()
    .run('quit')
    .catch((err: unknown) => console.error('[backup] quit backup failed:', err))
  void withTimeout(backup, BACKUP_ON_QUIT_TIMEOUT_MS, () => {
    console.error(`[backup] the quit backup took more than ${BACKUP_ON_QUIT_TIMEOUT_MS / 1000}s; closing anyway`)
  }).finally(() => app.quit())
}

/** Call once the database is open and the window created. */
export function startAutoBackup(): void {
  registerHandlers()
  const startup = setTimeout(() => void periodicCheck('startup'), STARTUP_CHECK_DELAY_MS)
  const hourly = setInterval(() => void periodicCheck('auto'), BACKUP_CHECK_INTERVAL_MS)
  app.on('before-quit', (event) => {
    clearTimeout(startup)
    clearInterval(hourly)
    onBeforeQuit(event)
  })
}
