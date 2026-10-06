import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import Database from 'better-sqlite3'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'fs'
import { join } from 'path'
import { launchApp, shutdownApp, createTicket, type Launched } from './helpers'
import { BACKUP_FILE_PATTERN } from '../../src/shared/auto-backup'

// Automatic backups through the real app: the folder dialog is replaced (in the main process) by a temp folder,
// everything else is real: "back up now", the list, restore from the list, the backup on quit, and the warning
// banner when the folder disappears (a USB drive removed).
// Every test starts its own app on fresh data and sets up what it needs, so any test can run alone.

let l: Launched
let backupDir: string

/** Replaces the main process's open dialog: folders resolve to `dir`, files are cancelled; options are recorded. */
async function stubDialogs(app: ElectronApplication, dir: string): Promise<void> {
  await app.evaluate(({ dialog }, folder) => {
    const g = globalThis as unknown as { __dialogCalls: Electron.OpenDialogOptions[] }
    g.__dialogCalls = []
    const fake = async (...args: unknown[]): Promise<Electron.OpenDialogReturnValue> => {
      const options = (args.length > 1 ? args[1] : args[0]) as Electron.OpenDialogOptions
      g.__dialogCalls.push(JSON.parse(JSON.stringify(options)))
      return options.properties?.includes('openDirectory')
        ? { canceled: false, filePaths: [folder] }
        : { canceled: true, filePaths: [] }
    }
    dialog.showOpenDialog = fake as typeof dialog.showOpenDialog
  }, dir)
}

async function openBackupSettings(page: Page): Promise<void> {
  await page.getByTestId('nav-settings').click()
  await page.getByTestId('settings-tab-backup').click()
  await page.getByTestId('auto-backup-card').waitFor()
}

function backupFiles(): string[] {
  return readdirSync(backupDir).filter((n) => BACKUP_FILE_PATTERN.test(n))
}

/** Ticket codes stored in a backup file (read directly, not through the app) */
function codesIn(file: string): string[] {
  const db = new Database(join(backupDir, file), { readonly: true, fileMustExist: true })
  try {
    return (db.prepare(`SELECT barcode_code FROM Ticket`).all() as { barcode_code: string }[]).map(
      (r) => r.barcode_code
    )
  } finally {
    db.close()
  }
}

/** Toasts sit over the bottom of the page and pause while hovered: move away and let them expire. */
async function waitForToasts(page: Page): Promise<void> {
  await page.mouse.move(5, 5)
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 })
}

/** The backup health the main process reports: what the warning banner shows after its next refresh. */
async function backupHealth(page: Page): Promise<string | undefined> {
  const res = await page.evaluate(() => window.api.getBackupStatus())
  return res.data?.health
}

async function ticketExists(page: Page, code: string): Promise<boolean> {
  const res = await page.evaluate((c) => window.api.getTicketByBarcode(c), code)
  return res.success && !!res.data
}

/** Picks the backup folder through the (stubbed) folder dialog, from the backup settings. */
async function chooseBackupFolder(page: Page): Promise<void> {
  await openBackupSettings(page)
  await page.getByTestId('backup-choose-dir').click()
  await expect(page.getByTestId('backup-dir')).toHaveText(backupDir)
}

/** Turns automatic backups on, from the backup settings. */
async function enableAutoBackup(page: Page): Promise<void> {
  const autoSwitch = page.getByTestId('backup-auto-switch')
  await autoSwitch.click()
  await expect(autoSwitch).toHaveAttribute('data-state', 'checked')
}

test.beforeEach(async () => {
  l = await launchApp('auto-backup')
  backupDir = join(l.dataDir, 'usb-drive')
  mkdirSync(backupDir)
  await stubDialogs(l.app, backupDir)
})
test.afterEach(async () => {
  try {
    expect(l.problems, 'renderer errors').toEqual([])
  } finally {
    await shutdownApp(l)
  }
})

test('choose a folder, back up now: the file appears in the list', async () => {
  const first = await createTicket(l.page, {
    name: 'قبل النسخ',
    phone: '0555000001',
    price: 1000,
    paid: 0,
    type: 'credit'
  })
  await openBackupSettings(l.page)
  await expect(l.page.getByTestId('backup-dir-empty')).toBeVisible()
  await expect(l.page.getByTestId('backup-auto-switch')).toBeDisabled()

  await l.page.getByTestId('backup-choose-dir').click()
  await expect(l.page.getByTestId('backup-dir')).toHaveText(backupDir)
  // the temp folder is on the same drive as the database: the hint shows
  await expect(l.page.getByTestId('backup-same-drive')).toBeVisible()
  await expect(l.page.getByTestId('backup-list-empty')).toBeVisible()

  await l.page.getByTestId('backup-run-now').click()
  await expect(l.page.getByTestId('backup-list-row')).toHaveCount(1)
  const files = backupFiles()
  expect(files).toHaveLength(1)
  expect(readdirSync(backupDir)).toEqual(files) // no partial / -wal / -shm beside it
  expect(codesIn(files[0])).toContain(first)
  await expect(l.page.getByTestId('backup-last-success')).toContainText(files[0])

  // Nothing changed: no second file
  await l.page.getByTestId('backup-run-now').click()
  await expect(l.page.locator('[data-sonner-toast]').filter({ hasText: files[0] }).first()).toBeVisible()
  expect(backupFiles()).toHaveLength(1)
})

test('backup settings cannot be written by the page, and the import dialog opens in the backup folder', async () => {
  await chooseBackupFolder(l.page)
  const res = await l.page.evaluate(() => window.api.setSetting('backup_dir', 'C:\\Windows'))
  expect(res.success).toBe(false)
  await expect(l.page.getByTestId('backup-dir')).toHaveText(backupDir)

  await waitForToasts(l.page)
  await l.page.getByTestId('settings-import').click()
  await l.page.getByTestId('settings-import-confirm').click()
  await expect
    .poll(() =>
      l.app.evaluate(() =>
        (globalThis as unknown as { __dialogCalls: Electron.OpenDialogOptions[] }).__dialogCalls.map(
          (o) => o.defaultPath
        )
      )
    )
    .toContain(backupDir)
})

test('restore a backup from the list', async () => {
  const first = await createTicket(l.page, {
    name: 'قبل النسخ',
    phone: '0555000001',
    price: 1000,
    paid: 0,
    type: 'credit'
  })
  await chooseBackupFolder(l.page)
  await l.page.getByTestId('backup-run-now').click()
  await expect(l.page.getByTestId('backup-list-row')).toHaveCount(1)

  const afterBackup = await createTicket(l.page, {
    name: 'بعد النسخ',
    phone: '0555000002',
    price: 2000,
    paid: 0,
    type: 'credit'
  })
  expect(await ticketExists(l.page, afterBackup)).toBe(true)

  await openBackupSettings(l.page)
  await waitForToasts(l.page)
  await l.page.getByTestId('backup-restore').first().click()
  await l.page.getByTestId('backup-restore-dialog').waitFor()
  await l.page.getByTestId('settings-import-confirm').click()
  await expect(l.page.getByTestId('backup-restore-dialog')).toBeHidden()
  await expect.poll(() => ticketExists(l.page, afterBackup)).toBe(false)
  expect(await ticketExists(l.page, first)).toBe(true)
  // the backup folder survived the replaced database
  await expect(l.page.getByTestId('backup-dir')).toHaveText(backupDir)
  await expect(l.page.getByTestId('backup-list-row')).toHaveCount(1)
})

test('closing the app backs up the latest change', async () => {
  await chooseBackupFolder(l.page)
  await enableAutoBackup(l.page)
  // Turning backups on backs up at once (a new folder holds no copy yet)
  await expect(l.page.getByTestId('backup-list-row')).toHaveCount(1)
  const before = backupFiles()

  const last = await createTicket(l.page, {
    name: 'قبل الإغلاق',
    phone: '0555000003',
    price: 500,
    paid: 0,
    type: 'credit'
  })
  await l.app.close()

  // Same minute = same file name, replaced by the newer copy; either way the newest file holds the last ticket
  const after = backupFiles().sort()
  expect(after.length).toBeGreaterThanOrEqual(before.length)
  expect(codesIn(after[after.length - 1])).toContain(last)
})

test('the folder disappears (USB drive removed): a warning banner on every screen', async () => {
  await chooseBackupFolder(l.page)
  await enableAutoBackup(l.page)
  await expect(l.page.getByTestId('backup-list-row')).toHaveCount(1)
  await expect.poll(() => backupHealth(l.page)).toBe('ok')
  await l.page.getByTestId('nav-tickets').click()
  const banner = l.page.getByTestId('backup-warning-banner')
  await expect(banner).toHaveCount(0)

  // Windows may hold the fresh backup file open for a moment (e.g. an antivirus scan): retry the removal
  rmSync(backupDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
  await expect.poll(() => backupHealth(l.page)).toBe('unavailable')
  // The banner re-reads that status on navigation (and every few minutes)
  await l.page.getByTestId('nav-reports').click()
  await expect(banner).toBeVisible()
  await expect(banner).toHaveAttribute('data-health', 'unavailable')
  await l.page.getByTestId('nav-tickets').click()
  await expect(banner).toBeVisible()

  // Its button opens Settings on the backup tab, which explains the problem
  await l.page.getByTestId('backup-warning-open-settings').click()
  await expect(l.page.getByTestId('backup-dir-unavailable')).toBeVisible()

  // A backup now fails cleanly: error shown, the folder is not recreated
  await l.page.getByTestId('backup-run-now').click()
  await expect(l.page.getByTestId('backup-last-error')).toBeVisible()
  expect(existsSync(backupDir)).toBe(false)

  // Plugged back in: the banner goes away. The failure's toast pauses under the mouse and may cover the button.
  mkdirSync(backupDir)
  await waitForToasts(l.page)
  await l.page.getByTestId('backup-run-now').click()
  await expect(l.page.getByTestId('backup-last-error')).toHaveCount(0)
  await expect(banner).toHaveCount(0)
})
