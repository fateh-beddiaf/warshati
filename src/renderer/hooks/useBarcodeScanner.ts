import { useEffect, useRef, useCallback } from 'react'
import { classifyKey, ScanBuffer, SCAN_MAX_INTERVAL_MS, SCAN_MIN_LENGTH } from '../../shared/scanner'
import { looksLikeTicketCode } from '../../shared/ticket-code'

export interface BarcodeScannerOptions {
  onScan: (barcode: string) => void
  maxIntervalMs?: number // Max average time between keystrokes of a scan (default SCAN_MAX_INTERVAL_MS)
  minLength?: number // Minimum barcode length (default SCAN_MIN_LENGTH)
  /** Inside an ordinary text field, only scans this accepts are taken from the field (default: ticket codes) */
  interceptInField?: (barcode: string) => boolean
}

type FieldEl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

interface FieldSnapshot {
  el: FieldEl
  value: string
  selStart: number | null
  selEnd: number | null
}

function isFieldEl(el: Element | null): el is FieldEl {
  if (!el) return false
  const tag = el.tagName.toUpperCase()
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

function snapshotField(el: FieldEl): FieldSnapshot {
  let selStart: number | null = null
  let selEnd: number | null = null
  try {
    if (!(el instanceof HTMLSelectElement)) {
      selStart = el.selectionStart
      selEnd = el.selectionEnd
    }
  } catch {
    // some input types (number, email, ...) throw on selection access
  }
  return { el, value: el.value, selStart, selEnd }
}

/**
 * Puts a field back to `value` in a way React controlled inputs notice: the native prototype
 * setter bypasses React's value tracker, and the dispatched event makes React run onChange so
 * its state syncs with the DOM.
 */
function restoreField(snap: FieldSnapshot, value: string): void {
  const { el } = snap
  if (!el.isConnected) return
  if (el.value !== value) {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : el instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter) setter.call(el, value)
    else el.value = value
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
  }
  if (!(el instanceof HTMLSelectElement) && snap.selStart !== null && snap.selEnd !== null && value === snap.value) {
    try {
      el.setSelectionRange(snap.selStart, snap.selEnd)
    } catch {
      // unsupported for this input type
    }
  }
}

/**
 * Global keyboard listener for Henex / HID keyboard-wedge barcode scanners.
 *
 * The scanner "types" the code very fast (a few ms per key) and ends with a suffix key (Enter, NumpadEnter or
 * Tab, depending on how it is configured). This hook works app-wide, REGARDLESS of where focus is:
 *
 * - The buffer is built from `event.code` (physical key), so it is independent of the keyboard
 *   layout (Arabic / AZERTY). See classifyKey in src/shared/scanner.ts.
 * - Focus outside any text field: EVERY burst at scanner speed ended by a suffix is a scan, whatever it contains
 *   (a ticket code or a product barcode). It is intercepted (preventDefault + stopPropagation: no form submit,
 *   no focus move) and passed to `onScan`, which shows it and looks it up.
 * - Focus inside an input / textarea / select: only a burst that looks like a ticket code (`interceptInField`) is
 *   taken. Its characters were already typed into the field (keydown fires before the character is inserted and
 *   we can only know it was a scan at the suffix), so the value the field had BEFORE the burst began is
 *   snapshotted at the first character of every burst and restored. Anything else (a product barcode scanned
 *   into a name field, a paste, typing) is left to the field untouched.
 * - Exception: a field marked data-barcode-input="true" is waiting for a barcode (header search,
 *   delete-confirmation, reader test). A scan is NOT intercepted there: the field receives the code (rewritten
 *   from the physical keys so an Arabic/AZERTY layout cannot garble it), the suffix keeps its normal
 *   behaviour (e.g. Enter submits the header form) and `onScan` is not called.
 * - Normal human typing is never touched: keys are never prevented, and nothing is restored unless a complete
 *   scanner-speed burst ended with a suffix.
 */
export function useBarcodeScanner({
  onScan,
  maxIntervalMs = SCAN_MAX_INTERVAL_MS,
  minLength = SCAN_MIN_LENGTH,
  interceptInField = looksLikeTicketCode
}: BarcodeScannerOptions): void {
  const bufferRef = useRef<ScanBuffer>(new ScanBuffer())
  const snapshotRef = useRef<FieldSnapshot | null>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const k = classifyKey(e)
      if (k.kind === 'modifier') return

      const activeEl = document.activeElement
      const field = isFieldEl(activeEl) ? activeEl : null
      const isBarcodeInput = field?.getAttribute('data-barcode-input') === 'true'

      if (k.kind === 'char') {
        const startedBurst = bufferRef.current.push(k.char, performance.now())
        if (startedBurst) {
          // keydown runs before the character is inserted, so this is the pre-burst value
          snapshotRef.current = field ? snapshotField(field) : null
        }
        return
      }

      if (k.kind === 'suffix') {
        const scanned = bufferRef.current.complete({ maxIntervalMs, minLength }, isBarcodeInput)
        const snap = snapshotRef.current
        snapshotRef.current = null
        if (scanned === null) return

        if (isBarcodeInput && field) {
          // The field consumes the code itself: hand it the layout-independent text, let the suffix through
          restoreField(snapshotField(field), scanned)
          return
        }
        // In an ordinary field, only ticket codes are taken; anything else stays the field's input
        if (field && !interceptInField(scanned)) return

        e.preventDefault()
        e.stopPropagation()
        if (snap) restoreField(snap, snap.value)
        onScan(scanned)
        return
      }

      // Any other key (Backspace, arrows, shortcuts, events without key/code) breaks a burst
      bufferRef.current.reset()
      snapshotRef.current = null
    },
    [onScan, maxIntervalMs, minLength, interceptInField]
  )

  useEffect(() => {
    // Capture phase on window: runs before any component handler can see the event
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [handleKeyDown])
}
