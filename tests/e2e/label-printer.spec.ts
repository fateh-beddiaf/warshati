import { test, expect } from '@playwright/test'
import { launchApp, shutdownApp, createTicket, openDetailsByBarcode, closeDetails, type Launched } from './helpers'

// The label printer is remembered: after a label prints successfully on a printer, the next print dialog
// preselects it (the OS default is often the receipt printer); a failed print changes nothing; a printer that is
// no longer installed falls back to the default; Settings > Preferences can choose or clear it.
// Fake printers: the main window's getPrintersAsync is replaced (the real printer:getPrinters handler and settings
// run) and webContents.print never reaches a device. None of the fake names exists on a real machine.
// One app for the file; each test first sets the printers, the print outcome and the remembered printer it starts
// from (given), so any test can run alone.

test.describe.configure({ mode: 'serial' })

const RECEIPT = 'Warshati Fake Receipt 80 (does not exist)'
const LABEL = 'Warshati Fake Label 350B (does not exist)'

let l: Launched
let barcode = ''

interface Fakes {
  __fakePrinters: Array<{ name: string; displayName: string; description: string; options: Record<string, string> }>
  __printOk: boolean
  __printedOn: string[]
}

test.beforeAll(async () => {
  l = await launchApp('label-printer')
  await l.app.evaluate(
    ({ app, BrowserWindow }, names) => {
      const g = globalThis as unknown as Fakes
      g.__fakePrinters = names.map((name) => ({ name, displayName: name, description: '', options: {} }))
      g.__printOk = true
      g.__printedOn = []
      BrowserWindow.getAllWindows()[0].webContents.getPrintersAsync = async () =>
        g.__fakePrinters as unknown as Electron.PrinterInfo[]
      app.on('web-contents-created', (_event, contents) => {
        contents.print = (options, callback) => {
          g.__printedOn.push(options?.deviceName ?? '')
          callback?.(g.__printOk, g.__printOk ? '' : 'paper out')
        }
      })
    },
    [RECEIPT, LABEL]
  )
  barcode = await createTicket(l.page, {
    name: 'Printer Test',
    phone: '0555123000',
    price: 1000,
    paid: 1000,
    type: 'cash'
  })
})
test.afterAll(async () => {
  await shutdownApp(l)
})
test.afterEach(() => {
  expect(l.problems, 'renderer errors').toEqual([])
})

const savedLabelPrinter = (): Promise<string | undefined> =>
  l.page.evaluate(async () => (await window.api.getSetting('label_printer', '')).data)

/** The state a test starts from: the installed (fake) printers, whether printing succeeds, the remembered printer. */
async function given(o: { printers: string[]; printOk: boolean; remembered: string }): Promise<void> {
  await l.app.evaluate(
    (_electron, { printers, printOk }) => {
      const g = globalThis as unknown as Fakes
      g.__fakePrinters = printers.map((name) => ({ name, displayName: name, description: '', options: {} }))
      g.__printOk = printOk
    },
    { printers: o.printers, printOk: o.printOk }
  )
  const res = await l.page.evaluate((name) => window.api.setSetting('label_printer', name), o.remembered)
  expect(res.success).toBe(true)
}

async function openPrint(): Promise<void> {
  await openDetailsByBarcode(l.page, barcode)
  await l.page.getByTestId('details-reprint').click()
  await l.page.getByTestId('print-submit').waitFor()
}

async function closePrint(): Promise<void> {
  await l.page.getByTestId('print-close').click()
  await l.page.getByTestId('print-submit').waitFor({ state: 'hidden' })
  await closeDetails(l.page)
}

async function choosePrinter(name: string): Promise<void> {
  await l.page.getByTestId('print-printer').click()
  await l.page.getByRole('option', { name: new RegExp(name.replace(/[()]/g, '\\$&')) }).click()
  await expect(l.page.getByTestId('print-printer')).toContainText(name)
}

test('nothing remembered yet: the system default entry is selected', async () => {
  await given({ printers: [RECEIPT, LABEL], printOk: true, remembered: '' })
  await openPrint()
  await expect(l.page.getByTestId('print-printer')).toContainText('الطابعة الافتراضية للنظام')
  await closePrint()
})

test('a successful print remembers the printer, the next dialog preselects it', async () => {
  await given({ printers: [RECEIPT, LABEL], printOk: true, remembered: '' })
  await openPrint()
  await choosePrinter(LABEL)
  await l.page.getByTestId('print-submit').click()
  await expect(l.page.getByTestId('print-status')).toHaveAttribute('role', 'status')
  expect(await savedLabelPrinter()).toBe(LABEL)
  await closePrint()

  await openPrint()
  await expect(l.page.getByTestId('print-printer')).toContainText(LABEL)
  await expect(l.page.getByTestId('print-printer')).toContainText('(طابعة الملصقات)')
  await closePrint()
})

test('a failed print does not change the remembered printer', async () => {
  await given({ printers: [RECEIPT, LABEL], printOk: false, remembered: LABEL })
  await openPrint()
  await choosePrinter(RECEIPT)
  await l.page.getByTestId('print-submit').click()
  await expect(l.page.getByTestId('print-status')).toHaveAttribute('role', 'alert')
  expect(await savedLabelPrinter()).toBe(LABEL)
  await closePrint()
})

test('a remembered printer that is no longer installed falls back to the default', async () => {
  await given({ printers: [RECEIPT], printOk: true, remembered: LABEL })
  expect(await l.page.evaluate(async () => (await window.api.getPrinters()).data?.map((p) => p.name))).toEqual([
    RECEIPT
  ])
  await openPrint()
  await expect(l.page.getByTestId('print-printer')).toContainText('الطابعة الافتراضية للنظام')
  await closePrint()
  expect(await savedLabelPrinter()).toBe(LABEL) // kept: it is used again when the printer is back
})

test('Settings > Preferences shows, clears and chooses the label printer', async () => {
  // the remembered label printer is no longer installed
  await given({ printers: [RECEIPT], printOk: true, remembered: LABEL })
  await l.page.getByTestId('nav-settings').click()
  await l.page.getByTestId('settings-tab-preferences').click()
  const card = l.page.getByTestId('label-printer-card')
  await expect(card.getByTestId('label-printer-select')).toContainText(LABEL)
  await expect(card.getByTestId('label-printer-missing')).toBeVisible()

  await card.getByTestId('label-printer-clear').click()
  await expect.poll(savedLabelPrinter).toBe('')
  await expect(card.getByTestId('label-printer-missing')).toHaveCount(0)
  await expect(card.getByTestId('label-printer-clear')).toBeDisabled()

  await card.getByTestId('label-printer-select').click()
  await l.page.getByRole('option', { name: new RegExp(RECEIPT.replace(/[()]/g, '\\$&')) }).click()
  await expect.poll(savedLabelPrinter).toBe(RECEIPT)

  await l.page.getByTestId('nav-tickets').click()
  await openPrint()
  await expect(l.page.getByTestId('print-printer')).toContainText(RECEIPT)
  await closePrint()
})
