import { test, expect } from '@playwright/test'
import { writeFileSync } from 'fs'
import { launchApp, shutdownApp, createTicket, openDetailsByBarcode, closeDetails, type Launched } from './helpers'
import { measureBars, readCode128 } from './barcode-decode'
import { generateTicketCode, isTicketCode } from '../../src/shared/ticket-code'

// Can a scanner read the printed label? The real `printer:printLabel` handler builds the real label page in the
// hidden print window; `webContents.print` is replaced (nothing reaches a device) by a step that renders that SAME
// page in an offscreen window at 203 DPI (a thermal printer's resolution: 1 px = 1 printer dot) and returns the
// bitmap. The test then
//   - decodes it with zxing (strict settings) and expects exactly the ticket code,
//   - measures every bar and space: each must be a whole number of 3-dot modules (no 1.5-dot modules rounded
//     differently from bar to bar), with >= 10 white modules on each side (Code128 quiet zone),
//   - checks the text rows keep a side margin on BOTH edges of the 40mm paper: every text box and every text run
//     measured in the page, and the ink itself (no dark dot in the outer 1mm on either side).
// The printer list is stubbed with a printer name that does not exist.

test.describe.configure({ mode: 'serial' })

const FAKE_PRINTER = 'Warshati Test Label Printer (does not exist)'
const DPI = 203
const MODULE_DOTS = 3
const QUIET_MODULES = 10
/** 40mm at 203 DPI: the bars and their quiet zones are measured inside the label, not to the window's edge */
const LABEL_DOTS = Math.floor((40 / 25.4) * DPI)
/** Longest name the customer field realistically gets; the header truncates it, the barcode must not move */
const LONG_NAME = 'عبد الرحمان بن محمد الأمين بوعلام الشريف القسنطيني'
/** Minimum white margin (mm) between any text and either side edge of the paper */
const SIDE_MARGIN_MM = 1
const MM_DOTS = DPI / 25.4

/** A text box or text run of the printed page, in mm from the paper's left edge */
interface TextRect {
  what: string
  left: number
  right: number
}

interface Raster {
  barcode: string
  png: string
  bgra: string
  width: number
  height: number
  /** the page's text boxes and runs, and the width of the page and of the label's content (mm) */
  text: TextRect[]
  pageWidthMm: number
}

let l: Launched

test.beforeAll(async () => {
  l = await launchApp('label-scan')
  await l.app.evaluate(
    ({ app, ipcMain, BrowserWindow }, { printerName, dpi }) => {
      const g = globalThis as unknown as { __rasters: Raster[] }
      g.__rasters = []
      app.on('web-contents-created', (_event, contents) => {
        contents.print = function (_options, callback) {
          const scale = dpi / 96 // CSS px -> printer dots
          const shot = new BrowserWindow({
            show: false,
            // 192x96 CSS px = exactly 406x203 dots: a window whose size is not a whole number of dots is rescaled
            // by the compositor (e.g. 321.4 -> 322 px), which would shift bars by itself. The label is the top-left
            // 40x20mm; the rest of the page is white.
            width: 192,
            height: 96,
            useContentSize: true,
            webPreferences: { offscreen: { deviceScaleFactor: scale }, sandbox: true, contextIsolation: true }
          })
          const url = contents.getURL()
          const barcode = /data-barcode%3D%22([^%]+)%22/.exec(url)?.[1] ?? ''
          let text: TextRect[] = []
          let pageWidthMm = 0
          shot.webContents
            .loadURL(url)
            .then(() => new Promise((r) => setTimeout(r, 150)))
            .then(() =>
              // Boxes of the text elements, and the runs of text inside them (a Range: what the glyphs occupy)
              shot.webContents.executeJavaScript(`(() => {
                const mm = 25.4 / 96
                const rects = []
                for (const el of document.querySelectorAll('.label *')) {
                  if (el.closest('svg')) continue
                  for (const node of el.childNodes) {
                    if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) continue
                    const box = el.getBoundingClientRect()
                    rects.push({ what: 'box ' + el.className, left: box.left * mm, right: box.right * mm })
                    const range = document.createRange()
                    range.selectNodeContents(node)
                    const run = range.getBoundingClientRect()
                    // a clipped run (the long name's ellipsis) only shows inside its box
                    const clip = getComputedStyle(el).overflowX !== 'visible'
                    const left = clip ? Math.max(run.left, box.left) : run.left
                    const right = clip ? Math.min(run.right, box.right) : run.right
                    rects.push({ what: 'text ' + node.textContent.trim(), left: left * mm, right: right * mm })
                  }
                }
                // the page's own width (the viewport is wider) and anything overflowing the label
                const page = document.documentElement.getBoundingClientRect().width
                return { rects, pageWidthMm: Math.max(page, document.querySelector('.label').scrollWidth) * mm }
              })()`)
            )
            .then((measured: { rects: TextRect[]; pageWidthMm: number }) => {
              text = measured.rects
              pageWidthMm = measured.pageWidthMm
              return shot.webContents.capturePage()
            })
            .then((image) => {
              const size = image.getSize(scale)
              g.__rasters.push({
                barcode,
                png: image.toPNG({ scaleFactor: scale }).toString('base64'),
                bgra: Buffer.from(image.toBitmap({ scaleFactor: scale })).toString('base64'),
                width: size.width,
                height: size.height,
                text,
                pageWidthMm
              })
              shot.destroy()
              callback?.(true, '')
            })
            .catch((error: Error) => {
              shot.destroy()
              callback?.(false, `raster failed: ${error.message}`)
            })
        }
      })
      ipcMain.removeHandler('printer:getPrinters')
      ipcMain.handle('printer:getPrinters', () => ({
        success: true,
        data: [{ name: printerName, displayName: printerName, description: '', isDefault: true }]
      }))
    },
    { printerName: FAKE_PRINTER, dpi: DPI }
  )
})
test.afterAll(async () => {
  await shutdownApp(l)
})
test.afterEach(() => {
  expect(l.problems, 'renderer errors').toEqual([])
})

async function rasters(): Promise<Raster[]> {
  return l.app.evaluate(() => (globalThis as unknown as { __rasters: Raster[] }).__rasters)
}

/** Decodes the label and checks its bar geometry; returns the PNG for the report. */
async function checkLabel(raster: Raster, expected: string): Promise<Buffer> {
  expect([raster.width, raster.height]).toEqual([406, 203])
  const png = Buffer.from(raster.png, 'base64')
  expect(await readCode128(new Uint8Array(png))).toEqual([expected])

  // Bars are vertical: the barcode is the bar/space pattern repeated on the most consecutive lines (text is not)
  const bgra = new Uint8Array(Buffer.from(raster.bgra, 'base64'))
  const lines = Array.from({ length: raster.height }, (_, y) => measureBars(bgra, raster.width, y, 0, LABEL_DOTS))
  const key = (m: (typeof lines)[number]): string => `${m.quietLeft}|${m.runs.join(',')}`
  let best = lines[0]
  let bestRepeat = 0
  for (let y = 0, repeat = 0; y < lines.length; y++) {
    repeat = y > 0 && key(lines[y]) === key(lines[y - 1]) ? repeat + 1 : 1
    if (lines[y].runs.length >= 20 && repeat > bestRepeat) {
      best = lines[y]
      bestRepeat = repeat
    }
  }
  expect(bestRepeat, 'bars run straight down for at least 5mm').toBeGreaterThanOrEqual(40)
  const offModule = best.runs.filter((w) => w % MODULE_DOTS !== 0)
  expect(offModule, `bar/space widths not a whole number of ${MODULE_DOTS}-dot modules: ${best.runs}`).toEqual([])
  expect(Math.max(...best.runs)).toBeLessThanOrEqual(4 * MODULE_DOTS) // Code128 elements are 1-4 modules wide
  expect(best.quietLeft).toBeGreaterThanOrEqual(QUIET_MODULES * MODULE_DOTS)
  expect(best.quietRight).toBeGreaterThanOrEqual(QUIET_MODULES * MODULE_DOTS)
  return png
}

/**
 * Every text box and run stays >= SIDE_MARGIN_MM inside the 40mm paper on both sides, and so does the ink: no dark
 * dot in the outer 1mm strips (the bars' quiet zones are white, so only text could put ink there).
 */
function checkSideMargins(raster: Raster, expectedTexts: string[]): void {
  expect(raster.pageWidthMm, 'the page is not wider than the 40mm label').toBeLessThanOrEqual(40.01)
  const texts = raster.text.filter((r) => r.what.startsWith('text ')).map((r) => r.what.slice(5))
  for (const t of expectedTexts) expect(texts).toContain(t)
  for (const r of raster.text) {
    expect(r.left, `${r.what}: left margin`).toBeGreaterThanOrEqual(SIDE_MARGIN_MM)
    expect(40 - r.right, `${r.what}: right margin`).toBeGreaterThanOrEqual(SIDE_MARGIN_MM)
  }
  const bgra = new Uint8Array(Buffer.from(raster.bgra, 'base64'))
  const strip = Math.floor(SIDE_MARGIN_MM * MM_DOTS)
  const labelHeight = Math.floor((20 / 25.4) * DPI)
  const inked: string[] = []
  for (let y = 0; y < labelHeight; y++) {
    for (const x0 of [0, LABEL_DOTS - strip]) {
      const m = measureBars(bgra, raster.width, y, x0, x0 + strip)
      if (m.runs.length > 0) inked.push(`y=${y} x=${x0 + m.quietLeft}`)
    }
  }
  expect(inked, 'ink in the outer 1mm of the label').toEqual([])
}

test('a label printed from the app scans back to its ticket code (203 DPI)', async () => {
  const barcode = await createTicket(l.page, {
    name: LONG_NAME,
    phone: '0555123456',
    price: 2500,
    paid: 0,
    type: 'credit'
  })
  expect(isTicketCode(barcode)).toBe(true)
  await openDetailsByBarcode(l.page, barcode)
  await l.page.getByTestId('details-reprint').click()
  await l.page.getByTestId('print-submit').waitFor()
  await expect(l.page.getByTestId('print-printer')).toContainText(FAKE_PRINTER)
  await l.page.getByTestId('print-submit').click()
  await expect(l.page.getByTestId('print-status')).toHaveAttribute('role', 'status')
  await expect.poll(async () => (await rasters()).length).toBe(1)

  const [raster] = await rasters()
  expect(raster.barcode).toBe(barcode)
  const png = await checkLabel(raster, barcode)
  checkSideMargins(raster, ['ورشتي', '0555123456', 'SA A54'])
  writeFileSync(test.info().outputPath('label-203dpi.png'), png)

  await l.page.getByTestId('print-close').click()
  await l.page.getByTestId('print-submit').waitFor({ state: 'hidden' })
  await closeDetails(l.page)
})

test('three random ticket codes scan back exactly', async () => {
  const codes = [generateTicketCode(), generateTicketCode(), generateTicketCode()]
  for (const code of codes) {
    const result = await l.page.evaluate(
      (c) =>
        window.api.printLabel({ barcode: c, customerName: 'زبون', shortLabel: 'SA A54', customerPhone: '0661234567' }),
      code
    )
    expect(result).toEqual({ success: true })
  }
  const all = await rasters()
  expect(all).toHaveLength(4)
  for (const [i, code] of codes.entries()) {
    expect(all[i + 1].barcode).toBe(code)
    await checkLabel(all[i + 1], code)
  }
})

test('text keeps its side margins with the longest name, with and without the phone', async () => {
  for (const customerPhone of ['0555123456', undefined]) {
    const result = await l.page.evaluate(
      (phone) =>
        window.api.printLabel({
          barcode: '29876543',
          customerName: 'عبد الرحمان بن محمد الأمين بوعلام الشريف القسنطيني',
          shortLabel: 'IP 15PM',
          customerPhone: phone
        }),
      customerPhone
    )
    expect(result).toEqual({ success: true })
    const all = await rasters()
    const raster = all[all.length - 1]
    await checkLabel(raster, '29876543')
    checkSideMargins(raster, customerPhone ? ['ورشتي', customerPhone, 'IP 15PM'] : ['ورشتي', 'IP 15PM'])
    if (!customerPhone) expect(raster.text.some((r) => r.what.includes('footer-phone'))).toBe(false)
  }
})

test('a code that cannot fit the label with readable bars is refused, not printed', async () => {
  const result = await l.page.evaluate(() =>
    window.api.printLabel({ barcode: 'WSH2610056T5197', customerName: 'زبون', shortLabel: 'X' })
  )
  expect(result.success).toBe(false)
  expect(await rasters()).toHaveLength(6)
})
