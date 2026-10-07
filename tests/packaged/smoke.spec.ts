import { test, expect, chromium } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'
import { spawn, type ChildProcess } from 'child_process'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { FuseV1Options, getCurrentFuseWire } from '@electron/fuses'
import { createTicket, openDetailsByBarcode } from '../e2e/helpers'

// Smoke test of the PACKAGED app (release/win-unpacked, built by `npm run dist`): the build the user installs, with
// its fuses, its ASAR archive and better-sqlite3 unpacked next to it.
//   npm run test:packaged
// Playwright's `_electron` launcher cannot drive it: it attaches through `--inspect`, which the
// EnableNodeCliInspectArguments fuse turns off. The test starts the .exe itself and connects to the window over the
// Chrome DevTools Protocol instead. Nothing is printed: the print dialog is checked up to the print button.

const APP_DIR = resolve('release/win-unpacked')
const EXE = join(APP_DIR, 'Warshati.exe')

// A fuse is one byte in the executable: ASCII '1' when on, '0' when off
const ON = '1'.charCodeAt(0)
const OFF = '0'.charCodeAt(0)

let dataDir: string
let child: ChildProcess | undefined
let browser: Browser | undefined
let page: Page
const problems: string[] = []

/** Starts the .exe on a scratch data folder and resolves with the DevTools URL it prints on stderr. */
function startApp(): Promise<string> {
  return new Promise((resolveUrl, reject) => {
    child = spawn(EXE, ['--remote-debugging-port=0'], {
      env: { ...process.env, WARSHATI_DATA_DIR: dataDir },
      stdio: ['ignore', 'ignore', 'pipe']
    })
    let stderr = ''
    const timer = setTimeout(() => reject(new Error(`no DevTools URL after 30s:\n${stderr}`)), 30_000)
    child.stderr!.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(stderr)
      if (match) {
        clearTimeout(timer)
        resolveUrl(match[1])
      }
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`the app exited (code ${code}) before it opened a window:\n${stderr}`))
    })
  })
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  expect(existsSync(EXE), `${EXE} is missing: run npm run dist first`).toBe(true)
  dataDir = mkdtempSync(join(tmpdir(), 'warshati-packaged-'))
  browser = await chromium.connectOverCDP(await startApp())
  await expect.poll(() => browser!.contexts()[0]?.pages().length ?? 0, { timeout: 30_000 }).toBeGreaterThan(0)
  page = browser.contexts()[0].pages()[0]
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`)
  })
  await page.waitForSelector('[data-testid="nav-tickets"]')
})

test.afterAll(async () => {
  // Closing the only window quits the app (window-all-closed)
  await page?.evaluate(() => window.close()).catch(() => undefined)
  await browser?.close().catch(() => undefined)
  if (child && child.exitCode === null) {
    const exited = new Promise((r) => child!.once('exit', r))
    await Promise.race([exited, new Promise((r) => setTimeout(r, 10_000))])
    if (child.exitCode === null) child.kill()
  }
  try {
    rmSync(dataDir, { recursive: true, force: true })
  } catch {
    // disposable temp dir
  }
})

test('the executable carries the hardening fuses', async () => {
  const wire = await getCurrentFuseWire(EXE)
  expect({
    runAsNode: wire[FuseV1Options.RunAsNode],
    cookieEncryption: wire[FuseV1Options.EnableCookieEncryption],
    nodeOptions: wire[FuseV1Options.EnableNodeOptionsEnvironmentVariable],
    inspectArguments: wire[FuseV1Options.EnableNodeCliInspectArguments],
    asarIntegrity: wire[FuseV1Options.EnableEmbeddedAsarIntegrityValidation],
    onlyAsar: wire[FuseV1Options.OnlyLoadAppFromAsar],
    fileProtocolExtraPrivileges: wire[FuseV1Options.GrantFileProtocolExtraPrivileges]
  }).toEqual({
    runAsNode: OFF,
    cookieEncryption: ON,
    nodeOptions: OFF,
    inspectArguments: OFF,
    asarIntegrity: ON,
    onlyAsar: ON,
    fileProtocolExtraPrivileges: OFF
  })
  expect(existsSync(join(APP_DIR, 'resources', 'app.asar'))).toBe(true)
})

test('the window shows the UI from app://, with its fonts, styles and no CSP violation', async () => {
  // Served by the app's own scheme from app.asar (src/main/app-url.ts), not from file://
  expect(page.url()).toBe('app://warshati/index.html')
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready
    return {
      // a face of the bundled font actually loaded from app:// (check() alone is also true for an unknown family)
      font: [...document.fonts].some(
        (f) => f.family.replace(/"/g, '') === 'IBM Plex Sans Arabic' && f.status === 'loaded'
      ),
      styled: getComputedStyle(document.body).fontFamily
    }
  })
  expect(loaded.font).toBe(true)
  expect(loaded.styled).toContain('IBM Plex Sans Arabic')
  expect(problems).toEqual([])
})

test('the installed app starts, creates its database, saves a ticket and edits it', async () => {
  // better-sqlite3 loaded from app.asar.unpacked, schema and seed applied in the scratch folder
  expect(existsSync(join(dataDir, 'data', 'warshati.db'))).toBe(true)
  const barcode = await createTicket(page, {
    name: 'Packaged Smoke',
    phone: '0555000111',
    price: 3000,
    paid: 1000,
    type: 'credit'
  })
  const found = await page.evaluate((code) => window.api.getTicketByBarcode(code), barcode)
  expect(found).toMatchObject({
    success: true,
    data: { ticket: { barcode_code: barcode }, customer: { name: 'Packaged Smoke' } }
  })
  // Editing it: the TicketEditLog migration ran and the edit is recorded
  const edited = await page.evaluate(
    async (id) => window.api.updateTicket(id, { price: 3500 }),
    (found as { data: { ticket: { id: number } } }).data.ticket.id
  )
  expect(edited.success).toBe(true)
  expect(edited.data?.changedFields).toEqual(['price'])
  expect(edited.data?.details.editLogs.map((row) => [row.field, row.old_value, row.new_value])).toEqual([
    ['price', '3000', '3500']
  ])
  expect(problems).toEqual([])
})

test('the print dialog shows the label and the installed printers', async () => {
  const barcode = await createTicket(page, {
    name: 'Packaged Print',
    phone: '0555000222',
    price: 2000,
    paid: 2000,
    type: 'cash'
  })
  await openDetailsByBarcode(page, barcode)
  await page.getByTestId('details-reprint').click()
  await expect(page.getByTestId('print-submit')).toBeEnabled()
  // The barcode is drawn by the same code that renders the printed page
  await expect(page.locator('[role="dialog"] svg rect').first()).toBeAttached()
  // The printer list goes through the main process (Electron's printer list and the registry default)
  const printers = await page.evaluate(() => window.api.getPrinters())
  expect(printers.success).toBe(true)
  await page.getByTestId('print-close-footer').click()
  await expect(page.getByTestId('print-submit')).toBeHidden()
  expect(problems).toEqual([])
})

test('the main process loads jsbarcode from app.asar (a code too long for the label is refused, nothing printed)', async () => {
  // The refusal comes from drawing the bars with jsbarcode, before any print window loads a page: no printer is used
  const result = await page.evaluate(() =>
    window.api.printLabel({ barcode: 'WSH2610056T5197', customerName: 'x', shortLabel: 'y' })
  )
  expect(result).toEqual({ success: false, error: 'barcode too long for the label' })
})
