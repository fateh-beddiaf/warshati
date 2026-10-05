import { getDefaultPrinterName, parseDefaultPrinterDevice, toPrinterList } from '../src/main/printers'

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`)
    throw new Error(`Assertion failed: ${message}`)
  }
  console.log(`✅ Passed: ${message}`)
}

const regOutput = (value: string): string =>
  `\r\nHKEY_CURRENT_USER\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Windows\r\n    Device    REG_SZ    ${value}\r\n\r\n`

console.log('--- Default printer from the Windows "Device" setting ---')
assert(parseDefaultPrinterDevice(regOutput('Xprinter XP-80,winspool,Ne00:')) === 'Xprinter XP-80', 'local printer')
assert(
  parseDefaultPrinterDevice(regOutput('\\\\shop-pc\\Xprinter XP-350B,winspool,Ne03:')) ===
    '\\\\shop-pc\\Xprinter XP-350B',
  'shared network printer keeps its \\\\server\\ prefix'
)
assert(
  parseDefaultPrinterDevice(regOutput('Label  Printer (copy 1),winspool,USB001')) === 'Label  Printer (copy 1)',
  'spaces and parentheses inside the name are kept'
)
assert(parseDefaultPrinterDevice(regOutput('طابعة الملصقات,winspool,Ne01:')) === 'طابعة الملصقات', 'Arabic name')
assert(
  parseDefaultPrinterDevice('ERROR: The system was unable to find the specified registry key or value.') === null,
  'no default printer'
)
assert(parseDefaultPrinterDevice(regOutput(',winspool,Ne00:')) === null, 'empty name is not a printer')

console.log('--- Printer list sent to the print dialog ---')
const printers = [
  { name: 'Xprinter XP-80', displayName: 'Xprinter XP-80', description: '', options: { 'printer-location': '' } },
  { name: 'Xprinter XP-350B', displayName: 'Xprinter XP-350B', description: 'label' }
]
const list = toPrinterList(printers, 'Xprinter XP-350B')
assert(list.length === 2, 'every printer is listed')
assert(
  list
    .filter((p) => p.isDefault)
    .map((p) => p.name)
    .join() === 'Xprinter XP-350B',
  'only the OS default is marked'
)
assert(
  JSON.stringify(Object.keys(list[0]).sort()) ===
    JSON.stringify(['description', 'displayName', 'isDefault', 'isLabelPrinter', 'name']),
  'driver details (options) are not sent to the renderer'
)
assert(
  toPrinterList(printers, null).every((p) => !p.isDefault),
  'unknown default: nothing preselected'
)
assert(
  toPrinterList(printers, 'Printer that was removed').every((p) => !p.isDefault),
  'a default that is no longer installed is not marked'
)

console.log('--- Remembered label printer ---')
const withLabel = toPrinterList(printers, 'Xprinter XP-80', 'Xprinter XP-350B')
assert(
  withLabel
    .filter((p) => p.isLabelPrinter)
    .map((p) => p.name)
    .join() === 'Xprinter XP-350B',
  'the remembered label printer is marked (only it)'
)
assert(
  withLabel.find((p) => p.isDefault)?.name === 'Xprinter XP-80',
  'the OS default is still marked separately (receipt printer)'
)
assert(
  toPrinterList(printers, null).every((p) => !p.isLabelPrinter),
  'nothing remembered: no label printer marked'
)
assert(
  toPrinterList(printers, null, 'Unplugged label printer').every((p) => !p.isLabelPrinter),
  'a remembered printer that is no longer installed is not marked (the dialog falls back to the default)'
)

console.log('--- Reading the real setting never throws ---')
getDefaultPrinterName().then((name) => {
  assert(
    name === null || (typeof name === 'string' && name.length > 0),
    `default printer read: ${JSON.stringify(name)}`
  )
})
