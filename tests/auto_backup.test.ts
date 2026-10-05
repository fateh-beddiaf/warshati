import Database from 'better-sqlite3'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { initializeSchema } from '../src/database/schema'
import { seedInitialData } from '../src/database/seed'
import {
  BACKUP_INTERVAL_MS,
  BACKUP_KEYS,
  BACKUP_STALE_MS,
  DEFAULT_BACKUP_KEEP,
  backupFileName,
  backupHealth,
  isBackupDue,
  normalizeKeep,
  parseBackupFileName,
  planRotation,
  sameVolume,
  sortBackupNames,
  volumeOf
} from '../src/shared/auto-backup'
import { dataFingerprint, listBackups, PARTIAL_SUFFIX, writeBackup } from '../src/main/auto-backup-core'
import { createAutoBackupService } from '../src/main/auto-backup-service'

// Automatic backups: the pure rules (names, rotation, schedule, warning, same drive), then real backups of a real
// database into temp folders (complete and identical copies, failures leave no file under a final name, rotation
// never touches other files, no backup when nothing changed).

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`)
    throw new Error(`Assertion failed: ${message}`)
  }
  console.log(`✅ Passed: ${message}`)
}

const root = mkdtempSync(join(tmpdir(), 'warshati-auto-backup-'))
let folders = 0
function newFolder(): string {
  const dir = join(root, `f${folders++}`)
  mkdirSync(dir)
  return dir
}

function newDatabase(): { db: Database.Database; path: string } {
  const path = join(newFolder(), 'warshati.db')
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  initializeSchema(db)
  seedInitialData(db)
  return { db, path }
}

function addCustomer(db: Database.Database, name: string): void {
  db.prepare(`INSERT INTO Customer (name, phone) VALUES (?, ?)`).run(name, '0555000000')
}

function customerNames(path: string): string[] {
  const copy = new Database(path, { readonly: true, fileMustExist: true })
  try {
    return (copy.prepare(`SELECT name FROM Customer ORDER BY id`).all() as { name: string }[]).map((r) => r.name)
  } finally {
    copy.close()
  }
}

/** A clock the tests move forward by hand */
function clock(start = new Date(2026, 9, 5, 9, 0)): { now: () => Date; advance: (ms: number) => void } {
  let t = start.getTime()
  return { now: () => new Date(t), advance: (ms) => (t += ms) }
}

const MINUTE = 60_000

function testNames(): void {
  console.log('\n[1] File names')
  assert(
    backupFileName(new Date(2026, 9, 5, 7, 3)) === 'warshati-2026-10-05_07-03.db',
    'name is warshati-YYYY-MM-DD_HH-mm.db'
  )
  const parsed = parseBackupFileName('warshati-2026-01-31_23-59.db')
  assert(parsed?.getTime() === new Date(2026, 0, 31, 23, 59).getTime(), 'a name parses back to its local time')
  for (const bad of [
    'warshati-2026-02-31_10-00.db',
    'warshati-2026-10-05_24-00.db',
    'warshati-2026-10-05_10-00.db.partial',
    'warshati-2026-10-05_10-00.DB',
    'Warshati-2026-10-05_10-00.db',
    'warshati-2026-10-05_10-00 (1).db',
    'warshati_backup_2026-10-05_10-00.db',
    'x-warshati-2026-10-05_10-00.db',
    'notes.txt'
  ]) {
    assert(parseBackupFileName(bad) === null, `not a backup file name: ${bad}`)
  }
  assert(
    JSON.stringify(sortBackupNames(['notes.txt', 'warshati-2026-01-01_10-00.db', 'warshati-2026-03-01_10-00.db'])) ===
      JSON.stringify(['warshati-2026-03-01_10-00.db', 'warshati-2026-01-01_10-00.db']),
    'listing keeps only backup names, newest first'
  )
}

function testRotation(): void {
  console.log('\n[2] Rotation plan')
  const backups = Array.from({ length: 5 }, (_, i) => `warshati-2026-10-0${i + 1}_10-00.db`)
  const strangers = [
    'notes.txt',
    'warshati.db',
    'warshati-2026-10-01_10-00.db.bak',
    'warshati-2026-10-01_10-00.db.partial'
  ]
  const plan = planRotation([...strangers, ...backups], 3, backups[4])
  assert(
    JSON.stringify(plan) === JSON.stringify([backups[1], backups[0]]),
    'keeps the 3 newest (the new one included) and deletes the 2 oldest'
  )
  assert(
    plan.every((n) => !strangers.includes(n)),
    'never plans to delete a file that is not a backup'
  )
  assert(
    planRotation(backups, 1, backups[0]).includes(backups[0]) === false,
    'the backup just written is never deleted'
  )
  assert(planRotation(backups, 1, backups[0]).length === 4, 'keep=1 keeps only the backup just written')
  assert(planRotation(backups.slice(0, 2), 30, backups[1]).length === 0, 'nothing to delete below the limit')
  assert(normalizeKeep('') === DEFAULT_BACKUP_KEEP && normalizeKeep('abc') === DEFAULT_BACKUP_KEEP, 'default keep = 30')
  assert(
    normalizeKeep(0) === 1 && normalizeKeep(5000) === 365 && normalizeKeep(2.5) === DEFAULT_BACKUP_KEEP,
    'keep bounded'
  )
}

function testSchedule(): void {
  console.log('\n[3] When a backup is due')
  const now = new Date(2026, 9, 5, 12, 0)
  const ago = (ms: number): string => new Date(now.getTime() - ms).toISOString()
  const base = { enabled: true, dir: 'D:\\backups', now }
  assert(isBackupDue({ ...base, upToDateAt: null }), 'never backed up: due (also right after startup)')
  assert(!isBackupDue({ ...base, upToDateAt: ago(BACKUP_INTERVAL_MS - MINUTE) }), 'backed up 23h59 ago: not due')
  assert(isBackupDue({ ...base, upToDateAt: ago(BACKUP_INTERVAL_MS) }), 'backed up 24h ago: due')
  assert(isBackupDue({ ...base, upToDateAt: ago(-60 * MINUTE) }), 'last backup in the future (clock set back): due')
  assert(!isBackupDue({ ...base, enabled: false, upToDateAt: null }), 'automatic backups off: never due')
  assert(!isBackupDue({ ...base, dir: '', upToDateAt: null }), 'no folder: never due')
}

function testHealth(): void {
  console.log('\n[4] Warning banner state')
  const now = new Date(2026, 9, 5, 12, 0)
  const ago = (ms: number): string => new Date(now.getTime() - ms).toISOString()
  const base = { enabled: true, dir: 'E:\\', dirAvailable: true, enabledAt: ago(10 * BACKUP_STALE_MS), now }
  assert(backupHealth({ ...base, upToDateAt: ago(MINUTE) }) === 'ok', 'recent backup: ok')
  assert(backupHealth({ ...base, upToDateAt: ago(BACKUP_STALE_MS + MINUTE) }) === 'stale', 'over 3 days: stale')
  assert(
    backupHealth({ ...base, dirAvailable: false, upToDateAt: ago(MINUTE) }) === 'unavailable',
    'folder gone: unavailable'
  )
  assert(backupHealth({ ...base, enabled: false, dirAvailable: false, upToDateAt: null }) === 'off', 'off: no warning')
  assert(backupHealth({ ...base, dir: '', upToDateAt: null }) === 'no-folder', 'no folder yet: no-folder')
  assert(
    backupHealth({ ...base, enabledAt: ago(MINUTE), upToDateAt: null }) === 'ok',
    'never succeeded, but turned on a minute ago: not stale yet'
  )
  assert(
    backupHealth({ ...base, enabledAt: ago(BACKUP_STALE_MS + MINUTE), upToDateAt: null }) === 'stale',
    'never succeeded since turned on 3 days ago: stale'
  )
}

function testSameDrive(): void {
  console.log('\n[5] Same drive as the database')
  assert(
    volumeOf('c:\\Users\\x\\warshati.db') === 'C:' && volumeOf('E:/backups') === 'E:',
    'drive letters, any case or slash'
  )
  assert(volumeOf('\\\\NAS\\Share\\backups') === '\\\\nas\\share', 'network share')
  assert(sameVolume('C:\\Users\\x\\AppData\\warshati.db', 'c:\\backups'), 'C: and c: are the same drive')
  assert(!sameVolume('C:\\Users\\x\\warshati.db', 'E:\\'), 'C: and E: (USB drive) are not')
  assert(!sameVolume('\\\\nas\\share\\a', '\\\\nas\\other\\a'), 'two shares are not the same drive')
  assert(!sameVolume('relative\\path', 'relative\\other'), 'unknown volumes are never "the same"')
}

async function testRealBackup(): Promise<void> {
  console.log('\n[6] A real backup in a temp folder')
  const { db } = newDatabase()
  addCustomer(db, 'زبون قبل النسخ')
  const dir = newFolder()
  const result = await writeBackup(db, dir, new Date(2026, 9, 5, 10, 30), 30)
  assert(
    result.name === 'warshati-2026-10-05_10-30.db' && existsSync(result.path),
    'the backup file exists under its final name'
  )
  assert(readdirSync(dir).length === 1, 'nothing else is left in the folder (no partial file)')
  const copy = new Database(result.path, { readonly: true, fileMustExist: true })
  assert(copy.pragma('integrity_check', { simple: true }) === 'ok', 'the copy passes integrity_check')
  copy.close()
  assert(JSON.stringify(customerNames(result.path)).includes('زبون قبل النسخ'), 'the copy holds the same data')
  assert(result.sizeBytes > 0 && listBackups(dir)[0].sizeBytes === result.sizeBytes, 'size is reported')
  db.close()
}

async function testFailures(): Promise<void> {
  console.log('\n[7] A failed backup leaves nothing under a final name and deletes nothing')
  const { db } = newDatabase()
  const dir = newFolder()
  const old = ['warshati-2026-10-01_10-00.db', 'warshati-2026-10-02_10-00.db']
  for (const name of old) writeFileSync(join(dir, name), 'old backup')
  writeFileSync(join(dir, 'notes.txt'), 'mine')

  let threw = false
  try {
    await writeBackup(db, dir, new Date(2026, 9, 5, 11, 0), 1, {
      writer: async (_db, dest) => {
        writeFileSync(dest, Buffer.alloc(4096, 1)) // half-written copy
        throw new Error('disk full (simulated)')
      }
    })
  } catch (err) {
    threw = String(err).includes('disk full')
  }
  assert(threw, 'the failure is reported')
  assert(!existsSync(join(dir, 'warshati-2026-10-05_11-00.db')), 'no file under the final name')
  assert(!existsSync(join(dir, `warshati-2026-10-05_11-00.db${PARTIAL_SUFFIX}`)), 'the partial file is removed')
  assert(
    old.every((n) => existsSync(join(dir, n))),
    'rotation did not run: the old backups are all still there'
  )

  let rejected = false
  try {
    await writeBackup(db, dir, new Date(2026, 9, 5, 11, 1), 1, {
      writer: async (_db, dest) => writeFileSync(dest, 'not a database at all, but a complete file')
    })
  } catch {
    rejected = true
  }
  assert(
    rejected && !existsSync(join(dir, 'warshati-2026-10-05_11-01.db')),
    'a copy that fails verification is not kept'
  )

  const missing = join(dir, 'unplugged-usb')
  let missingFailed = false
  try {
    await writeBackup(db, missing, new Date(2026, 9, 5, 11, 2), 1)
  } catch {
    missingFailed = true
  }
  assert(missingFailed && !existsSync(missing), 'a missing folder fails and is NOT created')

  const ok = await writeBackup(db, dir, new Date(2026, 9, 5, 11, 3), 1)
  assert(
    ok.deleted.length === 2 && old.every((n) => !existsSync(join(dir, n))),
    'after a success, rotation deletes old backups'
  )
  assert(readFileSync(join(dir, 'notes.txt'), 'utf8') === 'mine', 'a file that is not a backup is never touched')
  db.close()
}

async function testService(): Promise<void> {
  console.log('\n[8] The service: no backup without a change, status, folder errors')
  const { db, path } = newDatabase()
  const t = clock()
  const s = createAutoBackupService({ getDb: () => db, getDbPath: () => path, now: t.now })
  assert((await s.run('auto')).outcome === 'skipped', 'automatic run while disabled: skipped')
  assert((await s.run('manual')).outcome === 'skipped', 'no folder: skipped')

  const dir = newFolder()
  s.setDir(dir)
  s.setEnabled(true)
  s.setKeep(3)
  assert(s.isDue(), 'a new folder: due')
  const first = await s.run('auto')
  assert(first.outcome === 'created', 'first run creates a backup')
  assert(!s.isDue(), 'right after a backup: not due')

  t.advance(5 * MINUTE)
  const again = await s.run('quit')
  assert(again.outcome === 'unchanged' && readdirSync(dir).length === 1, 'nothing changed: no second backup')

  // data_version cannot detect this: it only moves for writes made by ANOTHER connection
  const versionBefore = db.pragma('data_version', { simple: true })
  addCustomer(db, 'زبون جديد')
  assert(db.pragma('data_version', { simple: true }) === versionBefore, 'data_version does not see our own writes')
  t.advance(5 * MINUTE)
  const changed = await s.run('quit')
  assert(changed.outcome === 'created' && readdirSync(dir).length === 2, 'after a change: a new backup')
  assert(
    changed.outcome === 'created' && customerNames(changed.path).includes('زبون جديد'),
    'the new backup holds the change'
  )

  const before = dataFingerprint(db)
  s.setKeep(4)
  assert(dataFingerprint(db) === before, "the backup's own settings do not count as a change")

  for (let i = 0; i < 4; i++) {
    t.advance(5 * MINUTE)
    addCustomer(db, `زبون ${i}`)
    await s.run('manual')
  }
  assert(listBackups(dir).length === 4, 'rotation keeps the configured number (4)')

  // The last backup deleted by hand: an unchanged database is backed up again
  t.advance(5 * MINUTE)
  rmSync(s.status().lastSuccess!.path)
  assert((await s.run('manual')).outcome === 'created', 'last backup missing: backed up again even without a change')

  // Folder unplugged
  const usb = newFolder()
  s.setDir(usb)
  rmSync(usb, { recursive: true })
  t.advance(5 * MINUTE)
  const failed = await s.run('auto')
  const status = s.status()
  assert(failed.outcome === 'failed', 'missing folder: the run fails without throwing')
  assert(status.lastError !== null && status.lastError.message.includes(usb), 'the error is recorded with the folder')
  assert(status.health === 'unavailable' && status.files.length === 0, 'status: unavailable, no files listed')
  assert(!existsSync(usb), 'the folder was not recreated')

  s.setDir(dir)
  t.advance(BACKUP_STALE_MS + MINUTE)
  assert(s.status().health === 'stale', '3 days later without a backup: stale')
  t.advance(MINUTE)
  addCustomer(db, 'آخر')
  await s.run('auto')
  const healthy = s.status()
  assert(healthy.health === 'ok' && healthy.lastError === null, 'a success clears the error and the warning')

  // Backup settings survive a restore
  const kept = s.backupSettings()
  db.prepare(`UPDATE Setting SET value = 'X:\\old' WHERE key = ?`).run(BACKUP_KEYS.dir)
  db.prepare(`INSERT INTO Setting (key, value) VALUES ('backupXother', 'not ours')`).run()
  s.restoreBackupSettings(kept)
  assert(s.config().dir === dir, 'restoreBackupSettings puts the backup folder back')
  assert(
    (db.prepare(`SELECT value FROM Setting WHERE key = 'backupXother'`).get() as { value: string }).value ===
      'not ours',
    'only backup_* keys are replaced (the _ is not a LIKE wildcard)'
  )
  db.close()
}

async function testSingleFlight(): Promise<void> {
  console.log('\n[9] Runs never overlap')
  const { db, path } = newDatabase()
  const dir = newFolder()
  let writes = 0
  const s = createAutoBackupService({
    getDb: () => db,
    getDbPath: () => path,
    writer: async (database, dest) => {
      writes++
      await new Promise((r) => setTimeout(r, 50))
      await database.backup(dest)
    }
  })
  s.setDir(dir)
  const [a, b] = await Promise.all([s.run('manual'), s.run('auto')])
  assert(writes === 1 && a === b, 'two simultaneous requests share one backup')
  db.close()
}

async function main(): Promise<void> {
  try {
    testNames()
    testRotation()
    testSchedule()
    testHealth()
    testSameDrive()
    await testRealBackup()
    await testFailures()
    await testService()
    await testSingleFlight()
    console.log('\n🎉 auto_backup: all tests passed')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
