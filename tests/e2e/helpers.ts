import { _electron as electron, expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { isTicketCode } from '../../src/shared/ticket-code'

// Shared helpers for the e2e specs that need real tickets (details / print modals).

export interface Launched {
  app: ElectronApplication
  page: Page
  dataDir: string
  problems: string[]
}

/**
 * Starts the built app on a data directory. On CI it also records a Playwright trace (DOM snapshots, screenshots,
 * actions): the config's `trace`/`screenshot` options only apply to the browser fixtures, never to an Electron app
 * launched by hand. The trace is written when the app is closed, next to the test's other outputs.
 */
export async function launchElectron(dataDir: string): Promise<ElectronApplication> {
  const app = await electron.launch({
    args: [resolve('out/main/index.js')],
    env: { ...process.env, WARSHATI_DATA_DIR: dataDir }
  })
  if (!process.env.CI) return app
  const tracing = app.context().tracing
  await tracing.start({ screenshots: true, snapshots: true, title: test.info().titlePath.join(' > ') })
  const close = app.close.bind(app)
  let traces = 0
  app.close = async () => {
    try {
      await tracing.stop({ path: test.info().outputPath(`electron-trace-${traces++}.zip`) })
    } catch {
      // the app may already be gone; the test's own error is what matters
    }
    await close()
  }
  return app
}

export async function launchApp(prefix: string): Promise<Launched> {
  const dataDir = mkdtempSync(join(tmpdir(), `warshati-e2e-${prefix}-`))
  const app = await launchElectron(dataDir)
  const page = await app.firstWindow()
  const problems: string[] = []
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`)
  })
  await page.waitForSelector('[data-testid="nav-tickets"]')
  return { app, page, dataDir, problems }
}

export async function shutdownApp(l: Launched | undefined): Promise<void> {
  await l?.app?.close()
  if (!l) return
  try {
    rmSync(l.dataDir, { recursive: true, force: true })
  } catch {
    // disposable temp dir
  }
}

/** Fills the New Ticket form and submits it; returns the new ticket's barcode. `type`: the payment type it must show. */
export async function createTicket(
  page: Page,
  o: { name: string; phone: string; price: number; paid: number; type: 'cash' | 'credit' }
): Promise<string> {
  await page.getByTestId('nav-new-ticket').click()
  const form = page.getByTestId('new-ticket-form')
  const textInputs = form.locator('input[type="text"]')
  // order: customer name (autocomplete), phone, notes, brand, model, short label
  await textInputs.nth(0).fill(o.name)
  await textInputs.nth(1).fill(o.phone)
  await textInputs.nth(3).fill('Samsung')
  await textInputs.nth(4).fill('Galaxy A54')
  await form.locator('input[type="number"]').nth(0).fill(String(o.price))
  await form.locator('input[type="number"]').nth(1).fill(String(o.paid))
  // The payment type is computed from the amounts, never chosen: check the form shows the expected one
  await expect(form.getByTestId('payment-type')).toHaveAttribute('data-value', o.type)
  await form.locator('button[type="submit"]').click()
  await page.waitForSelector('[data-testid="ticket-created-banner"]')
  const barcode = ((await page.getByTestId('ticket-created-barcode').textContent()) ?? '').trim()
  if (!isTicketCode(barcode)) throw new Error(`unexpected barcode: ${barcode}`)
  return barcode
}

/** Opens the details modal for a barcode via the header search box (details modal must be closed). */
export async function openDetailsByBarcode(page: Page, barcode: string): Promise<void> {
  const header = page.getByTestId('header-barcode-input')
  await header.fill(barcode)
  await header.press('Enter')
  await page.getByTestId('details-close').waitFor()
  await page.locator('strong', { hasText: barcode }).first().waitFor()
}

export async function closeDetails(page: Page): Promise<void> {
  await page.getByTestId('details-close').click()
  await page.getByTestId('details-close').waitFor({ state: 'hidden' })
}

/**
 * A hardware scanner's burst (Latin layout): every digit as a real, trusted key event sent at once through the
 * DevTools protocol, then Enter. It lands wherever focus is, exactly like the reader (scanner.spec.ts covers layouts
 * and suffixes in depth).
 */
export async function scanCode(page: Page, code: string): Promise<void> {
  const cdp = await page.context().newCDPSession(page)
  const key = (type: 'keyDown' | 'keyUp', k: string, physical: string, vk: number, text?: string): Promise<unknown> =>
    cdp.send(
      'Input.dispatchKeyEvent' as never,
      { type, key: k, code: physical, windowsVirtualKeyCode: vk, ...(text ? { text } : {}) } as never
    )
  const sends: Promise<unknown>[] = []
  for (const ch of code) {
    sends.push(key('keyDown', ch, `Digit${ch}`, 48 + Number(ch), ch), key('keyUp', ch, `Digit${ch}`, 48 + Number(ch)))
  }
  sends.push(key('keyDown', 'Enter', 'Enter', 13, '\r'), key('keyUp', 'Enter', 'Enter', 13))
  await Promise.all(sends)
  await cdp.detach()
}
