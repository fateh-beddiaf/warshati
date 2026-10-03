import { useEffect, useRef, useCallback } from 'react'

export interface BarcodeScannerOptions {
  onScan: (barcode: string) => void
  maxIntervalMs?: number // Max time between keystrokes typical of HID scanners (default: 60ms)
  minLength?: number // Minimum barcode length (default: 6)
  prefix?: string // Optional required prefix (e.g. 'WSH')
}

/**
 * Dual-Approach Global Keyboard Listener for Henex / HID Barcode Scanners.
 *
 * Layer 1: Active Element Inspection.
 * - If focus is inside a standard user input (input, textarea, select, contenteditable)
 *   that is NOT explicitly marked as a dedicated barcode field (data-barcode-input="true"),
 *   we ignore the keystrokes completely so user typing is NEVER hijacked or misinterpreted.
 *
 * Layer 2: Rapid Burst Timing & Structural Pattern Verification.
 * - Hardware scanners emit keystrokes in ultra-fast bursts (< 50ms per key) followed by 'Enter'.
 * - When global conditions are met, the buffer is validated for timing, length, and optional prefix,
 *   and dispatched to `onScan`.
 */
export function useBarcodeScanner({
  onScan,
  maxIntervalMs = 60,
  minLength = 6,
  prefix = ''
}: BarcodeScannerOptions): void {
  const bufferRef = useRef<string>('')
  const lastKeyTimeRef = useRef<number>(0)
  const intervalsRef = useRef<number[]>([])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null

      // --- Layer 1: Active Element Check ---
      if (activeEl) {
        const tagName = activeEl.tagName.toUpperCase()
        const isInput = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || activeEl.isContentEditable
        const isDedicatedBarcodeInput = activeEl.getAttribute('data-barcode-input') === 'true'

        // If user is typing inside a regular text field, completely bypass global scanner logic
        if (isInput && !isDedicatedBarcodeInput) {
          bufferRef.current = ''
          intervalsRef.current = []
          return
        }
      }

      // --- Layer 2: Timing & Burst Collection ---
      const now = Date.now()

      if (e.key === 'Enter') {
        const scannedText = bufferRef.current.trim()
        const intervals = intervalsRef.current

        if (scannedText.length >= minLength) {
          // Verify timing: average interval between characters must be very fast (< maxIntervalMs)
          const avgInterval = intervals.length > 0
            ? intervals.reduce((a, b) => a + b, 0) / intervals.length
            : 0

          const matchesPrefix = prefix ? scannedText.startsWith(prefix) : true

          // Accept if burst was fast OR if user submitted inside a dedicated barcode input
          const isDedicatedBarcodeInput = activeEl?.getAttribute('data-barcode-input') === 'true'
          const isScannerSpeed = avgInterval > 0 && avgInterval <= maxIntervalMs

          if (matchesPrefix && (isScannerSpeed || isDedicatedBarcodeInput)) {
            e.preventDefault()
            e.stopPropagation()
            onScan(scannedText)
          }
        }

        // Reset buffer after Enter
        bufferRef.current = ''
        intervalsRef.current = []
        return
      }

      // Collect single printable characters
      if (e.key.length === 1) {
        const timeSinceLastKey = now - lastKeyTimeRef.current

        // If more than 120ms elapsed since last keystroke, reset buffer for a new scan burst
        if (timeSinceLastKey > 120 && bufferRef.current.length > 0) {
          bufferRef.current = ''
          intervalsRef.current = []
        }

        if (bufferRef.current.length > 0) {
          intervalsRef.current.push(timeSinceLastKey)
        }

        bufferRef.current += e.key
        lastKeyTimeRef.current = now
      }
    },
    [onScan, maxIntervalMs, minLength, prefix]
  )

  useEffect(() => {
    // Listen in capture phase to catch events cleanly
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [handleKeyDown])
}
