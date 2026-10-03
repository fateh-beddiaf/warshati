import { useEffect, useRef, useCallback } from 'react'
import { classifyKey, ScanBuffer } from '../../shared/scanner'

export interface BarcodeScannerOptions {
  onScan: (barcode: string) => void
  maxIntervalMs?: number // Max average time between keystrokes typical of HID scanners (default: 60ms)
  minLength?: number // Minimum barcode length (default: 6)
  prefix?: string // Required prefix of a scan (default: 'WSH', the prefix of every ticket barcode)
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
 * The scanner "types" the code very fast (a few ms per key) and ends with Enter. This hook works
 * app-wide, REGARDLESS of where focus is:
 *
 * - The buffer is built from `event.code` (physical key), so it is independent of the keyboard
 *   layout (Arabic / AZERTY). See classifyKey in src/shared/scanner.ts.
 * - When a burst arrives at scanner speed, starts with the prefix (WSH), and ends with Enter, it is
 *   intercepted (preventDefault + stopPropagation: no form submit, no Enter side effects) and
 *   passed to `onScan`.
 * - If focus was inside an input / textarea / select, the characters of the burst were already
 *   typed into it (keydown fires before the character is inserted and we can only know it was a
 *   scan at the final Enter). So the value the field had BEFORE the burst began is snapshotted at
 *   the first character of every burst and restored on a confirmed scan. The dedicated manual
 *   barcode field (data-barcode-input="true") is cleared instead, since its content is consumed.
 * - Normal human typing is never touched: keys are never prevented, and nothing is restored unless
 *   a complete scanner-speed, WSH-prefixed burst ended with Enter.
 */
export function useBarcodeScanner({
  onScan,
  maxIntervalMs = 60,
  minLength = 6,
  prefix = 'WSH'
}: BarcodeScannerOptions): void {
  const bufferRef = useRef<ScanBuffer>(new ScanBuffer())
  const snapshotRef = useRef<FieldSnapshot | null>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const k = classifyKey(e)
      if (k.kind === 'modifier') return

      const activeEl = document.activeElement
      const field = isFieldEl(activeEl) ? activeEl : null
      const isDedicatedBarcodeInput = field?.getAttribute('data-barcode-input') === 'true'

      if (k.kind === 'char') {
        const startedBurst = bufferRef.current.push(k.char, performance.now())
        if (startedBurst) {
          // keydown runs before the character is inserted, so this is the pre-burst value
          snapshotRef.current = field ? snapshotField(field) : null
        }
        return
      }

      if (k.kind === 'enter') {
        const scanned = bufferRef.current.complete({ maxIntervalMs, minLength, prefix }, isDedicatedBarcodeInput)
        const snap = snapshotRef.current
        snapshotRef.current = null
        if (scanned === null) return

        e.preventDefault()
        e.stopPropagation()
        if (snap) restoreField(snap, isDedicatedBarcodeInput ? '' : snap.value)
        onScan(scanned)
        return
      }

      // Any other key (Backspace, arrows, Tab, shortcuts, events without key/code) breaks a burst
      bufferRef.current.reset()
      snapshotRef.current = null
    },
    [onScan, maxIntervalMs, minLength, prefix]
  )

  useEffect(() => {
    // Capture phase on window: runs before any component handler can see the event
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [handleKeyDown])
}
