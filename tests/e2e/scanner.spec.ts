import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page, CDPSession } from '@playwright/test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

// Barcode scanner (HID keyboard wedge) behaviour, app-wide regardless of focus.
// Bursts are sent through the DevTools protocol as real (trusted) key events carrying a
// physical `code` and a layout-dependent `key`, so the characters really land in the focused
// field exactly like a hardware scanner's would. Runs on the built app with a temp data dir.

test.describe.configure({ mode: 'serial' })

let app: ElectronApplication
let page: Page
let cdp: CDPSession
let dataDir: string
let barcode = ''
const problems: string[] = []

// Arabic (non-Latin) characters for the physical US keys, to simulate an Arabic keyboard layout.
const ARABIC_LETTERS: Record<string, string> = {
  Q: 'ض', W: 'ص', E: 'ث', R: 'ق', T: 'ف', Y: 'غ', U: 'ع', I: 'ه', O: 'خ', P: 'ح',
  A: 'ش', S: 'س', D: 'ي', F: 'ب', G: 'ل', H: 'ا', J: 'ت', K: 'ن', L: 'م',
  Z: 'ئ', X: 'ء', C: 'ؤ', V: 'ر', B: 'لا', N: 'ى', M: 'ة'
}
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/** Sends a scanner burst: every character as fast as possible, then Enter. */
async function scan(code: string, layout: 'latin' | 'arabic', withEnter = true): Promise<void> {
  const sends: Promise<unknown>[] = []
  for (const ch of code) {
    const isDigit = /[0-9]/.test(ch)
    const physical = isDigit ? `Digit${ch}` : `Key${ch}`
    const key =
      layout === 'latin'
        ? isDigit ? ch : ch.toLowerCase()
        : isDigit ? ARABIC_DIGITS[Number(ch)] : ARABIC_LETTERS[ch]
    const vk = isDigit ? 48 + Number(ch) : ch.charCodeAt(0)
    sends.push(
      cdp.send('Input.dispatchKeyEvent' as never, {
        type: 'keyDown', key, code: physical, text: key, windowsVirtualKeyCode: vk
      } as never)
    )
    sends.push(
      cdp.send('Input.dispatchKeyEvent' as never, {
        type: 'keyUp', key, code: physical, windowsVirtualKeyCode: vk
      } as never)
    )
  }
  if (withEnter) {
    sends.push(
      cdp.send('Input.dispatchKeyEvent' as never, {
        type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13
      } as never)
    )
    sends.push(
      cdp.send('Input.dispatchKeyEvent' as never, {
        type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13
      } as never)
    )
  }
  await Promise.all(sends)
}

async function go(tab: 'tickets' | 'new-ticket'): Promise<void> {
  await page.getByTestId(`nav-${tab}`).click()
  await page.waitForTimeout(200)
}

async function closeDetailsIfOpen(): Promise<void> {
  const close = page.getByTestId('details-close')
  if (await close.isVisible().catch(() => false)) {
    await close.click()
    await close.waitFor({ state: 'hidden' })
  }
}

/** Counts Enter keydowns reaching the page's bubble phase (a stopped event never arrives). */
async function installEnterProbe(): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __enter: { count: number; prevented: boolean[] }; __submits: number }
    w.__enter = { count: 0, prevented: [] }
    w.__submits = 0
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        w.__enter.count++
        w.__enter.prevented.push(e.defaultPrevented)
      }
    })
    document.addEventListener('submit', () => { w.__submits++ }, true)
  })
}

async function probe(): Promise<{ enters: number; prevented: boolean[]; submits: number }> {
  return page.evaluate(() => {
    const w = window as unknown as { __enter: { count: number; prevented: boolean[] }; __submits: number }
    return { enters: w.__enter.count, prevented: w.__enter.prevented, submits: w.__submits }
  })
}

test.beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'warshati-e2e-scan-'))
  app = await electron.launch({
    args: [resolve('out/main/index.js')],
    env: { ...process.env, WARSHATI_DATA_DIR: dataDir }
  })
  page = await app.firstWindow()
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`)
  })
  await page.waitForSelector('[data-testid="nav-tickets"]')
  cdp = await page.context().newCDPSession(page)
})

test.afterAll(async () => {
  await app?.close()
  try {
    rmSync(dataDir, { recursive: true, force: true })
  } catch {
    // disposable temp dir
  }
})

test.afterEach(() => {
  expect(problems, 'renderer errors').toEqual([])
})

test('setup: create a ticket and read its barcode', async () => {
  await go('new-ticket')
  const form = page.getByTestId('new-ticket-form')
  const textInputs = form.locator('input[type="text"]')
  await textInputs.nth(0).fill('Scanner Customer')
  await textInputs.nth(1).fill('0555000111')
  await textInputs.nth(3).fill('Samsung')
  await textInputs.nth(4).fill('Galaxy A54')
  await form.locator('input[type="number"]').nth(0).fill('5000')
  await form.locator('input[type="number"]').nth(1).fill('5000')
  await form.locator('input[name="paymentType"][value="cash"]').check()
  await form.locator('button[type="submit"]').click()
  await page.waitForSelector('.bg-emerald-50')
  barcode = ((await page.locator('.bg-emerald-50 span.font-mono').first().textContent()) ?? '').trim()
  expect(barcode).toMatch(/^WSH[A-Z0-9]+$/)
  await installEnterProbe()
})

test('scan under an Arabic layout while the customer-name field holds "abc"', async () => {
  const name = page.getByTestId('new-ticket-form').locator('input[type="text"]').nth(0)
  await name.fill('abc')
  await name.focus()
  const before = await probe()

  await scan(barcode, 'arabic')

  await page.getByTestId('details-close').waitFor()
  await expect(page.getByTestId('details-close')).toBeVisible()
  await expect(page.locator('strong', { hasText: barcode })).toBeVisible()
  // the typed Arabic/Latin chars did not stay in the field
  await expect(name).toHaveValue('abc')
  // Enter never reached the form: no submit, no keydown at bubble phase
  const after = await probe()
  expect(after.submits).toBe(before.submits)
  expect(after.enters).toBe(before.enters)

  // React state is in sync: typing continues from "abc", not from the burst text
  await closeDetailsIfOpen()
  await name.focus()
  await page.keyboard.press('End')
  await page.keyboard.type('d', { delay: 150 })
  await expect(name).toHaveValue('abcd')
})

test('scan with a Latin layout also works from another field, and with no focus', async () => {
  const phone = page.getByTestId('new-ticket-form').locator('input[type="text"]').nth(1)
  await phone.fill('0555')
  await phone.focus()
  await scan(barcode, 'latin')
  await page.getByTestId('details-close').waitFor()
  await expect(phone).toHaveValue('0555')
  await closeDetailsIfOpen()

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await scan(barcode, 'latin')
  await page.getByTestId('details-close').waitFor()
  await closeDetailsIfOpen()
})

test('normal human typing in a field is unaffected', async () => {
  const name = page.getByTestId('new-ticket-form').locator('input[type="text"]').nth(0)
  await name.fill('')
  await name.focus()

  // slow typing of plain text
  await page.keyboard.type('Ali Ben', { delay: 150 })
  await expect(name).toHaveValue('Ali Ben')

  // slow typing of a WSH-looking string (slower than scanner speed) is not a scan
  await name.fill('')
  await page.keyboard.type('WSH1234567', { delay: 100 })
  await expect(name).toHaveValue('WSH1234567')
  await expect(page.getByTestId('details-close')).toBeHidden()

  // a fast burst that is NOT WSH-prefixed: left alone, Enter is not intercepted
  await name.fill('')
  await name.focus()
  const before = await probe()
  await scan('ABC12345', 'latin')
  await expect(name).toHaveValue('abc12345'.toLowerCase())
  const after = await probe()
  expect(after.enters).toBe(before.enters + 1)
  expect(after.prevented.slice(before.prevented.length)).toEqual([false])
  await expect(page.getByTestId('details-close')).toBeHidden()
})

test('header search input is emptied after a scan and after a manual submit', async () => {
  const header = page.getByTestId('header-barcode-input')

  // scanner burst typed straight into the header field
  await header.fill('zz')
  await header.focus()
  await scan(barcode, 'arabic')
  await page.getByTestId('details-close').waitFor()
  await expect(header).toHaveValue('')
  await closeDetailsIfOpen()

  // manual typing + Enter (human speed) still opens the ticket and clears the field
  await header.focus()
  await page.keyboard.type(barcode, { delay: 90 })
  await expect(header).toHaveValue(barcode)
  await page.keyboard.press('Enter')
  await page.getByTestId('details-close').waitFor()
  await expect(header).toHaveValue('')
  await closeDetailsIfOpen()
})

test('delete-confirmation field (data-barcode-input) receives the scan instead of opening the ticket', async () => {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await scan(barcode, 'latin')
  await page.getByTestId('details-close').waitFor()

  await page.getByTestId('details-delete').click()
  await page.getByTestId('delete-next').click()
  await page.getByTestId('delete-next').click()
  const confirm = page.getByTestId('delete-confirm-input')
  await expect(confirm).toBeFocused()
  await expect(confirm).toHaveAttribute('data-barcode-input', 'true')
  await expect(confirm).toHaveValue('')

  // scanner burst under an Arabic layout: the field gets the real barcode, nothing else happens
  await scan(barcode, 'arabic')
  await expect(confirm).toHaveValue(barcode)
  await expect(page.getByTestId('delete-confirm-input')).toBeVisible()
  await expect(page.getByTestId('delete-back')).toBeVisible()
  await expect(page.getByRole('button', { name: /تأكيد الحذف النهائي/ })).toBeEnabled()

  // a second burst replaces the content (still the same barcode), the dialog is still open
  await scan(barcode, 'latin')
  await expect(confirm).toHaveValue(barcode)
  await expect(page.getByTestId('delete-confirm-input')).toBeVisible()

  // human typing in the same field is untouched
  await confirm.fill('')
  await page.keyboard.type('abc', { delay: 120 })
  await expect(confirm).toHaveValue('abc')

  // back out without deleting
  for (let i = 0; i < 3; i++) await page.getByTestId('delete-back').click()
  await expect(page.getByTestId('delete-back')).toHaveCount(0)
  await closeDetailsIfOpen()
})
