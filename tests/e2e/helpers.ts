import { _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

// Shared helpers for the e2e specs that need real tickets (details / print modals).

export interface Launched {
  app: ElectronApplication
  page: Page
  dataDir: string
  problems: string[]
}

export async function launchApp(prefix: string): Promise<Launched> {
  const dataDir = mkdtempSync(join(tmpdir(), `warshati-e2e-${prefix}-`))
  const app = await electron.launch({
    args: [resolve('out/main/index.js')],
    env: { ...process.env, WARSHATI_DATA_DIR: dataDir }
  })
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

/** Fills the New Ticket form and submits it; returns the new ticket's barcode. */
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
  await form.locator(`input[name="paymentType"][value="${o.type}"]`).check()
  await form.locator('button[type="submit"]').click()
  await page.waitForSelector('[data-testid="ticket-created-banner"]')
  const barcode = ((await page.getByTestId('ticket-created-barcode').textContent()) ?? '').trim()
  if (!/^WSH[A-Z0-9]+$/.test(barcode)) throw new Error(`unexpected barcode: ${barcode}`)
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
