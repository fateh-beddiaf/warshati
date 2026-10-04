// Pure (DOM-free) logic for the HID keyboard-wedge barcode scanner.
// Kept separate from the React hook so it can be unit-tested with plain Node.

/** Minimal shape of a KeyboardEvent that we need. Fields may be missing on synthetic events. */
export interface KeyLike {
  key?: string
  code?: string
  ctrlKey?: boolean
  altKey?: boolean
  metaKey?: boolean
}

export type KeyClass = { kind: 'char'; char: string } | { kind: 'enter' } | { kind: 'modifier' } | { kind: 'other' }

/** A gap longer than this (ms) between two keystrokes starts a new burst. */
export const BURST_RESET_MS = 120

const MODIFIER_CODES = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'CapsLock',
  'NumLock',
  'ScrollLock'
])
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock', 'NumLock'])

/**
 * Maps the PHYSICAL key (`event.code`) to the Latin character the barcode contains.
 *
 * Why `code` and not `key`: `key` follows the active keyboard layout, so under an Arabic or
 * AZERTY layout a scanner typing "WSH2410AB1234" yields different characters. Barcodes are
 * Code128 text made only of A-Z, 0-9 and '-', and the wedge sends US scan codes, so `code`
 * is layout-independent and always gives the right Latin character.
 *
 * Shift is deliberately ignored: letters are always returned UPPERCASE (generateBarcodeCode only
 * emits uppercase; scanners that send Shift for capitals or toggle CapsLock then give the same
 * result), and digits / '-' are returned as such even when Shift would turn them into symbols.
 * Ctrl/Alt/Meta combos are never part of a scan (shortcuts) and are classified as 'other'.
 */
export function classifyKey(ev: KeyLike): KeyClass {
  const code = typeof ev.code === 'string' ? ev.code : ''
  const key = typeof ev.key === 'string' ? ev.key : ''

  // Synthetic / autofill events can carry neither; never treat them as scanner input.
  if (!code && !key) return { kind: 'other' }

  if (MODIFIER_CODES.has(code) || MODIFIER_KEYS.has(key)) return { kind: 'modifier' }
  if (ev.ctrlKey || ev.altKey || ev.metaKey) return { kind: 'other' }

  if (code === 'Enter' || code === 'NumpadEnter' || (!code && key === 'Enter')) {
    return { kind: 'enter' }
  }

  let m = /^Key([A-Z])$/.exec(code)
  if (m) return { kind: 'char', char: m[1] }
  m = /^Digit([0-9])$/.exec(code)
  if (m) return { kind: 'char', char: m[1] }
  m = /^Numpad([0-9])$/.exec(code)
  if (m) return { kind: 'char', char: m[1] }
  if (code === 'Minus' || code === 'NumpadSubtract') return { kind: 'char', char: '-' }

  return { kind: 'other' }
}

export interface BurstOptions {
  maxIntervalMs: number
  minLength: number
  prefix: string
}

/**
 * Accumulates a burst of scanner characters with their inter-key timing.
 */
export class ScanBuffer {
  private text = ''
  private intervals: number[] = []
  private lastTime = 0

  /** Current buffered text. */
  get value(): string {
    return this.text
  }

  reset(): void {
    this.text = ''
    this.intervals = []
  }

  /**
   * Appends a character typed at `now` (ms, monotonic). Returns true when this character
   * started a NEW burst (buffer was empty or the gap exceeded BURST_RESET_MS).
   */
  push(char: string, now: number): boolean {
    const gap = now - this.lastTime
    let started = false
    if (this.text.length === 0 || gap > BURST_RESET_MS) {
      this.reset()
      started = true
    }
    if (this.text.length > 0) this.intervals.push(gap)
    this.text += char
    this.lastTime = now
    return started
  }

  /**
   * Called on Enter. Returns the scanned code when the buffered burst qualifies, else null.
   * Always clears the buffer afterwards.
   * `allowSlow` accepts a burst of any speed (used for the dedicated manual barcode field).
   */
  complete(opts: BurstOptions, allowSlow = false): string | null {
    const text = this.text
    const intervals = this.intervals
    this.reset()
    if (text.length < opts.minLength) return null
    if (opts.prefix && !text.startsWith(opts.prefix)) return null
    if (allowSlow) return text
    if (intervals.length === 0) return null
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
    return avg <= opts.maxIntervalMs ? text : null
  }
}
