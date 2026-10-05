import { execFile } from 'child_process'
import { join } from 'path'
import type { WebContents } from 'electron'
import type { PrinterInfo } from '../shared/types'

const DEFAULT_PRINTER_KEY = 'HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Windows'

/**
 * The printer name in `reg query <key> /v Device` output. Windows stores the default printer there as
 * "<printer name>,winspool,<port>", e.g. "Xprinter XP-80,winspool,Ne00:".
 */
export function parseDefaultPrinterDevice(regOutput: string): string | null {
  const match = /^\s*Device\s+REG_SZ\s+(.+?)\s*$/m.exec(regOutput)
  if (!match) return null
  const parts = match[1].split(',')
  const name = (parts.length >= 3 ? parts.slice(0, -2).join(',') : parts[0]).trim()
  return name || null
}

/**
 * The OS default printer, or null when unknown. Electron 36 removed `PrinterInfo.isDefault` (Chromium no longer
 * reports it), so it is read from the per-user setting Windows itself uses for "default printer".
 */
export function getDefaultPrinterName(): Promise<string | null> {
  if (process.platform !== 'win32') return Promise.resolve(null)
  const regExe = join(process.env['SystemRoot'] || 'C:\\Windows', 'System32', 'reg.exe')
  return new Promise((resolve) => {
    execFile(
      regExe,
      ['query', DEFAULT_PRINTER_KEY, '/v', 'Device'],
      { timeout: 3000, windowsHide: true },
      (error, stdout) => resolve(error ? null : parseDefaultPrinterDevice(stdout))
    )
  })
}

/**
 * Only what the print dialog shows. `isDefault` marks the OS default printer, `isLabelPrinter` the label printer
 * remembered in settings (LABEL_PRINTER_SETTING_KEY); each matches at most one printer, and a remembered printer
 * that is no longer installed matches none (the dialog then falls back to the OS default).
 */
export function toPrinterList(
  printers: Array<Pick<Electron.PrinterInfo, 'name' | 'displayName' | 'description'>>,
  defaultName: string | null,
  labelPrinterName = ''
): PrinterInfo[] {
  return printers.map((p) => ({
    name: p.name,
    displayName: p.displayName,
    description: p.description,
    isDefault: defaultName !== null && p.name === defaultName,
    isLabelPrinter: labelPrinterName !== '' && p.name === labelPrinterName
  }))
}

export async function listPrinters(contents: WebContents, labelPrinterName = ''): Promise<PrinterInfo[]> {
  const [printers, defaultName] = await Promise.all([contents.getPrintersAsync(), getDefaultPrinterName()])
  return toPrinterList(printers, defaultName, labelPrinterName)
}
