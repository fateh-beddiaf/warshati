import { BrowserWindow } from 'electron'
import type { PrintLabelData } from '../shared/types'
import { withTimeout } from '../shared/with-timeout'

export interface PrintOptions extends PrintLabelData {
  svgContent?: string
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export const PRINT_TIMEOUT_MS = 30_000
export const PRINT_TIMEOUT_ERROR = 'انتهت مهلة الطباعة: لم تستجب الطابعة خلال 30 ثانية. تحقق من الطابعة وأعد المحاولة.'

type PrintResult = { success: boolean; error?: string }

/**
 * Executes high-precision 40x20mm thermal printing via a dedicated hidden window.
 * Configured specifically for Xprinter (203 DPI) with zero margins and crisp contrast.
 * A job that never reports back (driver hang, dialog never answered) is aborted after
 * `timeoutMs`: the hidden window is destroyed and { success:false, error } is returned.
 */
export function printTicketLabel(data: PrintOptions, timeoutMs: number = PRINT_TIMEOUT_MS): Promise<PrintResult> {
  const ctx: { win: BrowserWindow | null } = { win: null }
  return withTimeout(runPrintJob(data, ctx), timeoutMs, () => {
    try {
      if (ctx.win && !ctx.win.isDestroyed()) ctx.win.destroy()
    } catch {
      // window already gone
    }
    return { success: false, error: PRINT_TIMEOUT_ERROR }
  })
}

/**
 * The 40x20mm label as HTML. It is built ONLY from the customer name, short label, phone and barcode:
 * the ticket's money (price, parts cost, profit) never reaches this function, so it can never be printed.
 */
export function buildLabelHtml(data: PrintOptions): string {
  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="utf-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
      <style>
        @page {
          size: 40mm 20mm;
          margin: 0;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        html, body {
          width: 40mm;
          height: 20mm;
          margin: 0;
          padding: 1mm 1.2mm;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          color: #000000;
          background-color: #ffffff;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 7.5pt;
          font-weight: 900;
          line-height: 1.1;
          border-bottom: 0.5pt solid #000000;
          padding-bottom: 0.4mm;
        }
        .customer-name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 25mm;
          font-weight: 800;
        }
        .short-label {
          font-family: monospace, ui-monospace;
          font-weight: 900;
          font-size: 8pt;
          background-color: #000000;
          color: #ffffff;
          padding: 0.5px 3px;
          border-radius: 2px;
          letter-spacing: 0.5px;
        }
        .barcode-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin: 0.4mm 0;
          flex: 1;
        }
        .barcode-container svg {
          width: 100%;
          max-height: 8.5mm;
        }
        .barcode-text {
          font-family: monospace, ui-monospace;
          font-size: 6.5pt;
          font-weight: 900;
          letter-spacing: 0.5px;
          line-height: 1;
          margin-top: 0.3mm;
        }
        .footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 5.5pt;
          font-weight: 700;
          line-height: 1;
          border-top: 0.4pt dashed #666;
          padding-top: 0.3mm;
        }
        .footer-phone {
          font-family: monospace, ui-monospace;
          font-size: 6pt;
          direction: ltr;
          unicode-bidi: embed;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <span class="customer-name">${escapeHtml(data.customerName)}</span>
        <span class="short-label">${escapeHtml(data.shortLabel)}</span>
      </div>
      <div class="barcode-container">
        ${data.svgContent || `<div class="barcode-text">${escapeHtml(data.barcode)}</div>`}
        <div class="barcode-text">${escapeHtml(data.barcode)}</div>
      </div>
      <div class="footer">
        <span>ورشتي</span>
        ${data.customerPhone ? `<span class="footer-phone">${escapeHtml(data.customerPhone)}</span>` : ''}
      </div>
    </body>
    </html>
`
}

function runPrintJob(data: PrintOptions, ctx: { win: BrowserWindow | null }): Promise<PrintResult> {
  return new Promise((resolve) => {
    let printWin: BrowserWindow | null = null
    try {
      printWin = new BrowserWindow({
        show: false,
        width: 380,
        height: 200,
        // Same isolation as the main window; no preload: the label page needs no API at all
        webPreferences: {
          sandbox: true,
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      ctx.win = printWin

      const htmlContent = buildLabelHtml(data)

      const win = printWin

      win.webContents.on('did-finish-load', () => {
        win.webContents.print(
          {
            silent: !!data.printerName,
            deviceName: data.printerName || undefined,
            printBackground: true,
            margins: {
              marginType: 'none'
            },
            pageSize: {
              width: 40000,
              height: 20000
            }
          },
          (success, failureReason) => {
            try {
              win.close()
            } catch {
              // ignore if already closed
            }
            if (!success) {
              resolve({ success: false, error: failureReason || 'Printing cancelled or unavailable' })
            } else {
              resolve({ success: true })
            }
          }
        )
      })

      win.webContents.on('did-fail-load', (_event, _errorCode, errorDescription) => {
        try {
          win.close()
        } catch {
          // ignore
        }
        resolve({ success: false, error: errorDescription })
      })

      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`)
    } catch (err) {
      if (printWin) {
        try {
          printWin.close()
        } catch {
          // ignore
        }
      }
      resolve({ success: false, error: err instanceof Error ? err.message : 'Unknown printing error' })
    }
  })
}
