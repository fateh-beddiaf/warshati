import { classifyKey, ScanBuffer, BURST_RESET_MS } from '../src/shared/scanner'

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
check('Digit5 under AZERTY (key "(") -> 5', JSON.stringify(ar('Digit5', '(')) === JSON.stringify({ kind: 'char', char: '5' }))
check('Numpad7 -> 7', JSON.stringify(ar('Numpad7', '7')) === JSON.stringify({ kind: 'char', char: '7' }))
check('Minus -> -', JSON.stringify(ar('Minus', '_')) === JSON.stringify({ kind: 'char', char: '-' }))
check('lowercase key still gives uppercase letter', JSON.stringify(ar('KeyW', 'w')) === JSON.stringify({ kind: 'char', char: 'W' }))
check('Enter', classifyKey({ code: 'Enter', key: 'Enter' }).kind === 'enter')
check('NumpadEnter', classifyKey({ code: 'NumpadEnter', key: 'Enter' }).kind === 'enter')
check('Shift is a modifier', classifyKey({ code: 'ShiftLeft', key: 'Shift' }).kind === 'modifier')
check('Backspace is other', classifyKey({ code: 'Backspace', key: 'Backspace' }).kind === 'other')
check('Space is other', classifyKey({ code: 'Space', key: ' ' }).kind === 'other')
check('Ctrl+KeyA is other (shortcut)', classifyKey({ code: 'KeyA', key: 'a', ctrlKey: true }).kind === 'other')
check('Alt+Digit1 is other', classifyKey({ code: 'Digit1', key: '1', altKey: true }).kind === 'other')
// Missing key/code (synthetic or autofill events) must not throw nor count as input
check('empty event is other', classifyKey({}).kind === 'other')
check('key only (no code), letter -> other', classifyKey({ key: 'a' }).kind === 'other')
check('key-only Enter still enter', classifyKey({ key: 'Enter' }).kind === 'enter')
check('undefined fields', classifyKey({ key: undefined, code: undefined }).kind === 'other')

// 2. burst buffer
const opts = { maxIntervalMs: 60, minLength: 6, prefix: 'WSH' }
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
  feed(b, 'WSH2410ABC1234', 1000, 5)
  check('fast WSH burst accepted', b.complete(opts) === 'WSH2410ABC1234')
  check('buffer cleared after complete', b.value === '')
}
{
  const b = new ScanBuffer()
  feed(b, 'WSH2410ABC1234', 1000, 90) // human-ish speed (under reset gap, over scanner speed)
  check('slow burst rejected', b.complete(opts) === null)
}
{
  const b = new ScanBuffer()
  feed(b, 'WSH2410ABC1234', 1000, 90)
  check('slow burst accepted when allowSlow (dedicated field)', b.complete(opts, true) === 'WSH2410ABC1234')
}
{
  const b = new ScanBuffer()
  feed(b, 'ABC12345', 1000, 5)
  check('fast burst without WSH prefix rejected', b.complete(opts) === null)
}
{
  const b = new ScanBuffer()
  feed(b, 'WSH12', 1000, 5)
  check('too short rejected', b.complete(opts) === null)
}
{
  const b = new ScanBuffer()
  b.push('W', 1000)
  check('single char (no intervals) rejected', b.complete({ ...opts, minLength: 1, prefix: '' }) === null)
}
{
  // All keys inside the same millisecond (interval 0) is still scanner speed
  const b = new ScanBuffer()
  feed(b, 'WSH123456', 1000, 0)
  check('zero-interval burst accepted', b.complete(opts) === 'WSH123456')
}
{
  // A pause longer than the reset gap starts a new burst; leftovers are discarded
  const b = new ScanBuffer()
  const t = feed(b, 'xyz', 1000, 5)
  const started = b.push('W', t + BURST_RESET_MS + 1)
  check('push after long gap reports a new burst', started === true)
  feed(b, 'SH123456', t + BURST_RESET_MS + 6, 5)
  check('burst after pause accepted without leftovers', b.complete(opts) === 'WSH123456')
}
{
  const b = new ScanBuffer()
  check('first push starts a burst', b.push('W', 500) === true)
  check('second push continues burst', b.push('S', 505) === false)
}
{
  // Reset (e.g. Backspace in the middle) discards the burst
  const b = new ScanBuffer()
  feed(b, 'WSH123', 1000, 5)
  b.reset()
  feed(b, '456789', 1100, 5)
  check('reset discards earlier chars', b.complete(opts) === null)
}

if (passed) {
  console.log('[PASS] Scanner key mapping and burst buffer logic verified.')
  process.exit(0)
} else {
  console.error('\nSCANNER TESTS FAILED!')
  process.exit(1)
}
