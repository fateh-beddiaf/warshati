import { existsSync, statSync } from 'fs'
import { basename, dirname, join, resolve } from 'path'
import type Database from 'better-sqlite3'
import { getSetting, setSetting } from '../database/queries/settings'
import {
  BACKUP_KEYS,
  BACKUP_SETTING_PREFIX,
  backupHealth,
  isBackupDue,
  normalizeKeep,
  sameVolume,
  type BackupRunResult,
  type BackupRunTrigger,
  type BackupStatus
} from '../shared/auto-backup'
import { dataFingerprint, isBackupDirAvailable, listBackups, writeBackup, type BackupWriter } from './auto-backup-core'

// The automatic backup's state and decisions, Electron-free so tests can drive it with a real database and a temp
// folder: configuration and status live in the Setting table (keys backup_*), a run backs up only when the data
// changed since the last backup in the same folder, and runs never overlap.

export interface AutoBackupServiceOptions {
  getDb: () => Database.Database
  /** the live database file (for the same-drive hint) */
  getDbPath: () => string
  now?: () => Date
  writer?: BackupWriter
}

export interface AutoBackupConfig {
  dir: string
  enabled: boolean
  keep: number
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function samePath(a: string, b: string): boolean {
  const ra = resolve(a)
  const rb = resolve(b)
  return process.platform === 'win32' ? ra.toLowerCase() === rb.toLowerCase() : ra === rb
}

/** Same disk: device ids when both exist (also right for mounted folders), else the drive letter / share. */
function onSameDrive(a: string, b: string): boolean {
  try {
    return statSync(a).dev === statSync(b).dev
  } catch {
    return sameVolume(a, b)
  }
}

export function createAutoBackupService(options: AutoBackupServiceOptions): {
  config: () => AutoBackupConfig
  status: () => BackupStatus
  setDir: (dir: string) => void
  setEnabled: (enabled: boolean) => void
  setKeep: (keep: number) => void
  run: (trigger: BackupRunTrigger) => Promise<BackupRunResult>
  isDue: () => boolean
  isRunning: () => boolean
  backupSettings: () => Array<[string, string]>
  restoreBackupSettings: (rows: Array<[string, string]>) => void
} {
  const now = options.now ?? ((): Date => new Date())
  let inFlight: Promise<BackupRunResult> | null = null

  const get = (key: string, fallback = ''): string => getSetting(options.getDb(), key, fallback)
  const set = (values: Record<string, string>): void => {
    const db = options.getDb()
    db.transaction(() => {
      for (const [key, value] of Object.entries(values)) setSetting(db, key, value)
    })()
  }

  const config = (): AutoBackupConfig => ({
    dir: get(BACKUP_KEYS.dir),
    enabled: get(BACKUP_KEYS.auto) === '1',
    keep: normalizeKeep(get(BACKUP_KEYS.keep, ''))
  })

  const status = (): BackupStatus => {
    const c = config()
    const dirAvailable = c.dir !== '' && isBackupDirAvailable(c.dir)
    const lastSuccessAt = get(BACKUP_KEYS.lastSuccessAt)
    const lastErrorAt = get(BACKUP_KEYS.lastErrorAt)
    return {
      ...c,
      dirAvailable,
      sameDriveAsDatabase: dirAvailable && onSameDrive(c.dir, options.getDbPath()),
      health: backupHealth({
        enabled: c.enabled,
        dir: c.dir,
        dirAvailable,
        upToDateAt: get(BACKUP_KEYS.upToDateAt) || null,
        enabledAt: get(BACKUP_KEYS.enabledAt) || null,
        now: now()
      }),
      lastSuccess: lastSuccessAt
        ? {
            at: lastSuccessAt,
            path: get(BACKUP_KEYS.lastPath),
            sizeBytes: Number(get(BACKUP_KEYS.lastSize, '0')) || 0
          }
        : null,
      lastError: lastErrorAt ? { at: lastErrorAt, message: get(BACKUP_KEYS.lastError) } : null,
      files: dirAvailable ? listBackups(c.dir) : [],
      running: inFlight !== null
    }
  }

  const setDir = (dir: string): void => {
    // A new folder holds no copy of the data yet: the next check backs up
    set({ [BACKUP_KEYS.dir]: dir, [BACKUP_KEYS.upToDateAt]: '' })
  }

  const setEnabled = (enabled: boolean): void => {
    if (enabled === config().enabled) return
    set(
      enabled ? { [BACKUP_KEYS.auto]: '1', [BACKUP_KEYS.enabledAt]: now().toISOString() } : { [BACKUP_KEYS.auto]: '0' }
    )
  }

  const setKeep = (keep: number): void => {
    set({ [BACKUP_KEYS.keep]: String(normalizeKeep(keep)) })
  }

  /** The last backup is in the chosen folder, still there, and holds exactly the current data. */
  const lastBackupIsCurrent = (dir: string, fingerprint: string): string | null => {
    const lastPath = get(BACKUP_KEYS.lastPath)
    if (!lastPath || get(BACKUP_KEYS.lastFingerprint) !== fingerprint) return null
    if (!samePath(dirname(lastPath), dir) || !existsSync(join(dir, basename(lastPath)))) return null
    return lastPath
  }

  const runOnce = async (trigger: BackupRunTrigger): Promise<BackupRunResult> => {
    const c = config()
    if (trigger !== 'manual' && !c.enabled) return { outcome: 'skipped', reason: 'disabled' }
    if (!c.dir) return { outcome: 'skipped', reason: 'no-folder' }
    const started = now()
    try {
      const db = options.getDb()
      const fingerprint = dataFingerprint(db)
      const current = isBackupDirAvailable(c.dir) ? lastBackupIsCurrent(c.dir, fingerprint) : null
      if (current) {
        set({ [BACKUP_KEYS.upToDateAt]: started.toISOString() })
        return { outcome: 'unchanged', path: current }
      }
      const written = await writeBackup(db, c.dir, started, c.keep, { writer: options.writer })
      if (written.rotationErrors.length > 0) console.warn('[backup] rotation:', written.rotationErrors.join('; '))
      set({
        [BACKUP_KEYS.lastSuccessAt]: started.toISOString(),
        [BACKUP_KEYS.lastPath]: written.path,
        [BACKUP_KEYS.lastSize]: String(written.sizeBytes),
        [BACKUP_KEYS.lastFingerprint]: fingerprint,
        [BACKUP_KEYS.upToDateAt]: started.toISOString(),
        [BACKUP_KEYS.lastError]: '',
        [BACKUP_KEYS.lastErrorAt]: ''
      })
      return { outcome: 'created', path: written.path, sizeBytes: written.sizeBytes, deleted: written.deleted }
    } catch (err) {
      const message = errMsg(err)
      console.error(`[backup] ${trigger} backup failed:`, message)
      try {
        set({ [BACKUP_KEYS.lastError]: message, [BACKUP_KEYS.lastErrorAt]: started.toISOString() })
      } catch {
        // the database itself is unavailable: the result still reports the failure
      }
      return { outcome: 'failed', error: message }
    }
  }

  /** One backup at a time: a run requested while another is writing gets that run's result. */
  const run = (trigger: BackupRunTrigger): Promise<BackupRunResult> => {
    if (!inFlight) {
      inFlight = runOnce(trigger).finally(() => {
        inFlight = null
      })
    }
    return inFlight
  }

  /** The backup_* settings, to carry them across a restore (the restored file holds its own, older ones). */
  const backupSettings = (): Array<[string, string]> =>
    (
      options
        .getDb()
        .prepare(`SELECT key, value FROM Setting WHERE substr(key, 1, ?) = ?`)
        .all(BACKUP_SETTING_PREFIX.length, BACKUP_SETTING_PREFIX) as Array<{ key: string; value: string }>
    ).map((r) => [r.key, r.value])

  const restoreBackupSettings = (rows: Array<[string, string]>): void => {
    const db = options.getDb()
    db.transaction(() => {
      db.prepare(`DELETE FROM Setting WHERE substr(key, 1, ?) = ?`).run(
        BACKUP_SETTING_PREFIX.length,
        BACKUP_SETTING_PREFIX
      )
      for (const [key, value] of rows) setSetting(db, key, value)
    })()
  }

  return {
    config,
    status,
    setDir,
    setEnabled,
    setKeep,
    run,
    isDue: () => {
      const c = config()
      return isBackupDue({
        enabled: c.enabled,
        dir: c.dir,
        upToDateAt: get(BACKUP_KEYS.upToDateAt) || null,
        now: now()
      })
    },
    isRunning: () => inFlight !== null,
    backupSettings,
    restoreBackupSettings
  }
}

export type AutoBackupService = ReturnType<typeof createAutoBackupService>
