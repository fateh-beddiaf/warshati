// Pure (DOM-free) logic for the HID keyboard-wedge barcode scanner.
// Kept separate from the React hook so it can be unit-tested with plain Node.
import { looksLikeTicketCode } from './ticket-code'

/** Minimal shape of a KeyboardEvent that we need. Fields may be missing on synthetic events. */
export interface KeyLike {
  key?: string
  code?: string
  ctrlKey?: boolean
  altKey?: boolean
  metaKey?: boolean
}

/** 'suffix' ends a scan: scanners send Enter (or NumpadEnter, or Tab, depending on their configuration). */
export type KeyClass =
  { kind: 'char'; char: string } | { kind: 'suffix'; key: ScanSuffix } | { kind: 'modifier' } | { kind: 'other' }

export type ScanSuffix = 'Enter' | 'NumpadEnter' | 'Tab'

/** A gap longer than this (ms) between two keystrokes starts a new burst. */
export const BURST_RESET_MS = 120
/**
 * Default maximum AVERAGE gap (ms) between the keys of a scan. HID scanners send a key every few ms, some cheap
 * ones (or USB hubs) every 30-60ms; people type 100-250ms apart. 80ms accepts the slow scanners and still rejects
 * human typing.
 */
export const SCAN_MAX_INTERVAL_MS = 80
/** Shortest scan accepted: shorter bursts are keyboard shortcuts or typing, not barcodes. */
export const SCAN_MIN_LENGTH = 6

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
 * AZERTY layout a scanner typing "27304918" yields "é'(&)..." or Arabic letters. Ticket codes are digits
 * (old ones: A-Z, 0-9 and '-'), and the wedge sends US scan codes, so `code` is layout-independent and
 * always gives the right Latin character.
 *
 * Shift is deliberately ignored: letters are always returned UPPERCASE (old ticket codes were
 * uppercase; scanners that send Shift for capitals or toggle CapsLock then give the same
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

  if (code === 'Enter' || code === 'NumpadEnter' || code === 'Tab') return { kind: 'suffix', key: code }
  if (!code && (key === 'Enter' || key === 'Tab')) return { kind: 'suffix', key }

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
}

/** What the last completed burst looked like (shown by the "test the reader" tool in Settings). */
export interface BurstSummary {
  text: string
  /** average gap between keys in ms (null for a single key) */
  avgIntervalMs: number | null
  /** true when it qualified as a scan (length and speed) */
  accepted: boolean
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
   * Called on a suffix key. Returns the scanned code when the buffered burst qualifies (long enough and at
   * scanner speed), else null. Always clears the buffer afterwards. Speed is required everywhere, barcode fields
   * included: a slow burst is someone typing, and taking it as a scan would replace what they typed with its tail.
   */
  complete(opts: BurstOptions): string | null {
    const summary = this.completeWithSummary(opts)
    return summary.accepted ? summary.text : null
  }

  /** Same as complete(), but describes the burst too. */
  completeWithSummary(opts: BurstOptions): BurstSummary {
    const text = this.text
    const intervals = this.intervals
    this.reset()
    const avgIntervalMs = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : null
    const fastEnough = avgIntervalMs !== null && avgIntervalMs <= opts.maxIntervalMs
    return { text, avgIntervalMs, accepted: text.length >= opts.minLength && fastEnough }
  }
}

/** One raw keydown as the reader sent it (for the "test the reader" tool). */
export interface RawKey {
  key: string
  code: string
  /** ms, monotonic */
  time: number
}

export interface ScanDiagnosis {
  /** characters as the keyboard layout produced them (`key`) */
  chars: string
  /** characters as the app reads them (physical keys, layout-independent) */
  readAs: string
  codes: string[]
  keyCount: number
  avgIntervalMs: number | null
  suffix: ScanSuffix | null
  verdict: 'ok' | 'no-suffix' | 'short' | 'slow'
  isTicketCode: boolean
}

/**
 * What the global scanner listener makes of a burst of keys (same rules and thresholds as useBarcodeScanner),
 * spelled out so a shop owner can check a reader's configuration without a developer.
 */
export function diagnoseScan(
  keys: RawKey[],
  suffix: ScanSuffix | null,
  opts: BurstOptions = { maxIntervalMs: SCAN_MAX_INTERVAL_MS, minLength: SCAN_MIN_LENGTH }
): ScanDiagnosis {
  const typed = keys.filter((k) => classifyKey(k).kind !== 'modifier')
  const readAs = typed
    .map((k) => classifyKey(k))
    .map((c) => (c.kind === 'char' ? c.char : ''))
    .join('')
  const gaps = typed.slice(1).map((k, i) => k.time - typed[i].time)
  const avgIntervalMs = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null
  const verdict =
    suffix === null
      ? 'no-suffix'
      : readAs.length < opts.minLength
        ? 'short'
        : avgIntervalMs === null || avgIntervalMs > opts.maxIntervalMs
          ? 'slow'
          : 'ok'
  return {
    chars: typed.map((k) => (k.key.length === 1 ? k.key : `[${k.key}]`)).join(''),
    readAs,
    codes: typed.map((k) => k.code),
    keyCount: typed.length,
    avgIntervalMs,
    suffix,
    verdict,
    isTicketCode: looksLikeTicketCode(readAs)
  }
}
