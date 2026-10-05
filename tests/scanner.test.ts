import {
  classifyKey,
  diagnoseScan,
  ScanBuffer,
  BURST_RESET_MS,
  SCAN_MAX_INTERVAL_MS,
  SCAN_MIN_LENGTH,
  type RawKey
} from '../src/shared/scanner'

console.log('--- Running Scanner Logic Tests ---')

let passed = true
function check(name: string, cond: boolean): void {
  if (!cond) {
    console.error(`[FAIL] ${name}`)
    passed = false
  }
}

// 1. key -> char mapping uses `code`, not `key`
const ar = (code: string, key = 'ش'): ReturnType<typeof classifyKey> => classifyKey({ code, key })
check('KeyA under Arabic layout -> A', JSON.stringify(ar('KeyA')) === JSON.stringify({ kind: 'char', char: 'A' }))
check('KeyZ -> Z', JSON.stringify(ar('KeyZ', 'w')) === JSON.stringify({ kind: 'char', char: 'Z' }))
check(
  'Digit5 under AZERTY (key "(") -> 5',
  JSON.stringify(ar('Digit5', '(')) === JSON.stringify({ kind: 'char', char: '5' })
)
check('Numpad7 -> 7', JSON.stringify(ar('Numpad7', '7')) === JSON.stringify({ kind: 'char', char: '7' }))
check('Minus -> -', JSON.stringify(ar('Minus', '_')) === JSON.stringify({ kind: 'char', char: '-' }))
check(
  'lowercase key still gives uppercase letter',
  JSON.stringify(ar('KeyW', 'w')) === JSON.stringify({ kind: 'char', char: 'W' })
)
const suffix = (ev: Parameters<typeof classifyKey>[0]): string => JSON.stringify(classifyKey(ev))
check('Enter is a suffix', suffix({ code: 'Enter', key: 'Enter' }) === '{"kind":"suffix","key":"Enter"}')
check(
  'NumpadEnter is a suffix',
  suffix({ code: 'NumpadEnter', key: 'Enter' }) === '{"kind":"suffix","key":"NumpadEnter"}'
)
check(
  'Tab is a suffix (readers configured with a Tab suffix)',
  suffix({ code: 'Tab', key: 'Tab' }) === '{"kind":"suffix","key":"Tab"}'
)
check('Shift is a modifier', classifyKey({ code: 'ShiftLeft', key: 'Shift' }).kind === 'modifier')
check('Backspace is other', classifyKey({ code: 'Backspace', key: 'Backspace' }).kind === 'other')
check('Space is other', classifyKey({ code: 'Space', key: ' ' }).kind === 'other')
check('Ctrl+KeyA is other (shortcut)', classifyKey({ code: 'KeyA', key: 'a', ctrlKey: true }).kind === 'other')
check('Alt+Digit1 is other', classifyKey({ code: 'Digit1', key: '1', altKey: true }).kind === 'other')
// Missing key/code (synthetic or autofill events) must not throw nor count as input
check('empty event is other', classifyKey({}).kind === 'other')
check('key only (no code), letter -> other', classifyKey({ key: 'a' }).kind === 'other')
check('key-only Enter still a suffix', classifyKey({ key: 'Enter' }).kind === 'suffix')
check('undefined fields', classifyKey({ key: undefined, code: undefined }).kind === 'other')

// 2. burst buffer
const opts = { maxIntervalMs: SCAN_MAX_INTERVAL_MS, minLength: SCAN_MIN_LENGTH }
check('defaults: 80ms average, 6 characters', SCAN_MAX_INTERVAL_MS === 80 && SCAN_MIN_LENGTH === 6)
function feed(buf: ScanBuffer, text: string, start: number, step: number): number {
  let t = start
  for (const ch of text) {
    buf.push(ch, t)
    t += step
  }
  return t
}

{
  const b = new ScanBuffer()
  feed(b, '27304918', 1000, 5)
  check('fast ticket-code burst accepted', b.complete(opts) === '27304918')
  check('buffer cleared after complete', b.value === '')
}
{
  const b = new ScanBuffer()
  feed(b, '27304918', 1000, 100) // human speed (under the reset gap, over scanner speed)
  check('slow burst rejected', b.complete(opts) === null)
}
{
  const b = new ScanBuffer()
  feed(b, '6130000000017', 1000, 70) // a slow reader (or a USB hub): still a scan with the 80ms default
  check('70ms-per-key burst accepted', b.complete(opts) === '6130000000017')
}
{
  const b = new ScanBuffer()
  feed(b, 'WSH2410ABC1234', 1000, 100)
  check('slow burst accepted when allowSlow (dedicated field)', b.complete(opts, true) === 'WSH2410ABC1234')
}
{
  const b = new ScanBuffer()
  feed(b, '6130000000017', 1000, 5)
  check(
    'any content is a scan (EAN-13 product barcode): the hook decides what to do with it',
    b.complete(opts) === '6130000000017'
  )
}
{
  const b = new ScanBuffer()
  feed(b, '27304', 1000, 5)
  check('too short rejected', b.complete(opts) === null)
}
{
  const b = new ScanBuffer()
  b.push('W', 1000)
  check('single char (no intervals) rejected', b.complete({ ...opts, minLength: 1 }) === null)
}
{
  // All keys inside the same millisecond (interval 0) is still scanner speed
  const b = new ScanBuffer()
  feed(b, '27304918', 1000, 0)
  check('zero-interval burst accepted', b.complete(opts) === '27304918')
}
{
  // A pause longer than the reset gap starts a new burst; leftovers are discarded
  const b = new ScanBuffer()
  const t = feed(b, 'xyz', 1000, 5)
  const started = b.push('2', t + BURST_RESET_MS + 1)
  check('push after long gap reports a new burst', started === true)
  feed(b, '7304918', t + BURST_RESET_MS + 6, 5)
  check('burst after pause accepted without leftovers', b.complete(opts) === '27304918')
}
{
  const b = new ScanBuffer()
  check('first push starts a burst', b.push('W', 500) === true)
  check('second push continues burst', b.push('S', 505) === false)
}
{
  // Reset (e.g. Backspace in the middle) discards the burst
  const b = new ScanBuffer()
  feed(b, '273', 1000, 5)
  b.reset()
  feed(b, '04918', 1100, 5)
  check('reset discards earlier chars (5 left: too short)', b.complete(opts) === null)
}

// 3. "Test the reader" diagnosis (same rules as the global listener)
const keysOf = (text: string, step: number, key = (ch: string) => ch): RawKey[] =>
  [...text].map((ch, i) => ({ key: key(ch), code: /\d/.test(ch) ? `Digit${ch}` : `Key${ch}`, time: 1000 + i * step }))
{
  const d = diagnoseScan(keysOf('27304918', 4), 'Enter')
  check(
    'diagnosis: a ticket code at scanner speed is ok',
    d.verdict === 'ok' && d.isTicketCode && d.readAs === '27304918'
  )
  check('diagnosis: average interval', d.avgIntervalMs === 4 && d.keyCount === 8)
}
{
  // AZERTY without Shift: the layout gives symbols, the physical keys still give the digits
  const azerty: Record<string, string> = {
    '2': 'é',
    '7': 'è',
    '3': '"',
    '0': 'à',
    '4': "'",
    '9': 'ç',
    '1': '&',
    '8': '_'
  }
  const d = diagnoseScan(
    keysOf('27304918', 4, (ch) => azerty[ch]),
    'Enter'
  )
  check(
    'diagnosis: AZERTY symbols shown as received, read as digits',
    d.chars === `éè"à'ç&_` && d.readAs === '27304918'
  )
}
check(
  'diagnosis: product barcode is ok but not a ticket code',
  !diagnoseScan(keysOf('6130000000017', 4), 'Tab').isTicketCode
)
check('diagnosis: no suffix', diagnoseScan(keysOf('27304918', 4), null).verdict === 'no-suffix')
check('diagnosis: too slow', diagnoseScan(keysOf('27304918', 120), 'Enter').verdict === 'slow')
check('diagnosis: too short', diagnoseScan(keysOf('2730', 4), 'Enter').verdict === 'short')
check(
  'diagnosis: Shift keys ignored',
  diagnoseScan([{ key: 'Shift', code: 'ShiftLeft', time: 990 }, ...keysOf('27304918', 4)], 'Enter').keyCount === 8
)

if (passed) {
  console.log('[PASS] Scanner key mapping, burst buffer and diagnosis logic verified.')
  process.exit(0)
} else {
  console.error('\nSCANNER TESTS FAILED!')
  process.exit(1)
}
