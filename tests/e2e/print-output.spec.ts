import { test, expect } from '@playwright/test'
import { launchApp, shutdownApp, createTicket, openDetailsByBarcode, closeDetails, type Launched } from './helpers'

// What actually reaches the printer: the real `printer:printLabel` handler and the real hidden print window run,
// only `webContents.print` itself is replaced (in the main process) so nothing is sent to a device.
//   - the options passed to `webContents.print` are pinned exactly: an Electron upgrade must not change them
//   - the same label page rendered with `printToPDF` at the same size is ONE page of 40x20mm
// The printer list is stubbed with a name that does not exist, so even a broken stub cannot print on a real device.

test.describe.configure({ mode: 'serial' })

const FAKE_PRINTER = 'Warshati Test Label Printer (does not exist)'
const PT_TO_MM = 25.4 / 72

let l: Launched
let barcode = ''

interface CapturedPrint {
  options: Record<string, unknown>
  pdfBase64: string
}

test.beforeAll(async () => {
  l = await launchApp('print-output')
  await l.app.evaluate(({ app, ipcMain }, printerName) => {
    const g = globalThis as unknown as { __printCalls: CapturedPrint[] }
    g.__printCalls = []
    app.on('web-contents-created', (_event, contents) => {
      contents.print = function (options, callback) {
        // Same page, same paper and margins, rendered to PDF instead of a device
        contents
          .printToPDF({
            pageSize: { width: 40 / 25.4, height: 20 / 25.4 },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            printBackground: true
          })
          .then((pdf) => {
            g.__printCalls.push({
              options: JSON.parse(JSON.stringify(options ?? {})),
              pdfBase64: Buffer.from(pdf).toString('base64')
            })
            callback?.(true, '')
          })
          .catch((error: Error) => callback?.(false, `printToPDF failed: ${error.message}`))
      }
    })
    ipcMain.removeHandler('printer:getPrinters')
    ipcMain.handle('printer:getPrinters', () => ({
      success: true,
      data: [{ name: printerName, displayName: printerName, description: '', isDefault: true }]
    }))
  }, FAKE_PRINTER)
})
test.afterAll(async () => {
  await shutdownApp(l)
})
test.afterEach(() => {
  expect(l.problems, 'renderer errors').toEqual([])
})

async function printCalls(): Promise<CapturedPrint[]> {
  return l.app.evaluate(() => (globalThis as unknown as { __printCalls: CapturedPrint[] }).__printCalls)
}

/** Page count and MediaBox sizes (in points) of a PDF written by Chromium. */
function pdfPages(base64: string): { count: number; sizes: Array<{ width: number; height: number }> } {
  const text = Buffer.from(base64, 'base64').toString('latin1')
  expect(text.startsWith('%PDF-')).toBe(true)
  const pageObjects = text.match(/\/Type\s*\/Page(?!s)\b/g) ?? []
  const sizes = [...text.matchAll(/\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/g)].map(
    (m) => ({ width: Number(m[3]) - Number(m[1]), height: Number(m[4]) - Number(m[2]) })
  )
  return { count: pageObjects.length, sizes }
}

test('setup: a ticket to print', async () => {
  barcode = await createTicket(l.page, {
    name: 'Label Test',
    phone: '0555123456',
    price: 2500,
    paid: 0,
    type: 'credit'
  })
})

test('printing from the modal passes exactly the same print options', async () => {
  await openDetailsByBarcode(l.page, barcode)
  await l.page.getByTestId('details-reprint').click()
  await l.page.getByTestId('print-submit').waitFor()
  // the default printer is preselected
  await expect(l.page.getByTestId('print-printer')).toContainText(FAKE_PRINTER)

  await l.page.getByTestId('print-submit').click()
  await expect(l.page.getByTestId('print-status')).toHaveAttribute('role', 'status')
  await expect.poll(async () => (await printCalls()).length).toBe(1)

  const [call] = await printCalls()
  // Pinned before the Electron upgrade: pageSize in microns (40x20mm), no margins, silent to the chosen printer.
  expect(call.options).toEqual({
    silent: true,
    deviceName: FAKE_PRINTER,
    printBackground: true,
    margins: { marginType: 'none' },
    pageSize: { width: 40000, height: 20000 }
  })

  await l.page.getByTestId('print-close').click()
  await l.page.getByTestId('print-submit').waitFor({ state: 'hidden' })
  await closeDetails(l.page)
})

test('without a chosen printer the system print dialog is used (not silent)', async () => {
  const result = await l.page.evaluate(
    (code) =>
      window.api.printLabel({ barcode: code, customerName: 'Label Test', shortLabel: 'A54', printerName: undefined }),
    barcode
  )
  expect(result).toEqual({ success: true })
  const calls = await printCalls()
  expect(calls).toHaveLength(2)
  expect(calls[1].options).toEqual({
    silent: false,
    printBackground: true,
    margins: { marginType: 'none' },
    pageSize: { width: 40000, height: 20000 }
  })
})

test('the label renders as exactly one 40x20mm page', async () => {
  for (const call of await printCalls()) {
    const { count, sizes } = pdfPages(call.pdfBase64)
    expect(count).toBe(1)
    expect(sizes.length).toBeGreaterThanOrEqual(1)
    // Chromium snaps the page to whole device units (114 x 56.88pt = 40.2 x 20.1mm)
    for (const size of sizes) {
      expect(Math.abs(size.width * PT_TO_MM - 40)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(size.height * PT_TO_MM - 20)).toBeLessThanOrEqual(0.5)
    }
  }
})
