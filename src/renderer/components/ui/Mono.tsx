import * as React from 'react'
import { cn } from '../../lib/utils'

/**
 * The ONLY place `font-mono` / letter-spacing may be used (enforced by scripts/check-ui.cjs).
 * Use it for pure Latin/digit codes: barcodes, short device labels, phone numbers.
 * Never wrap Arabic text or currency in it: monospace fonts have no Arabic glyphs, so the
 * letters fall back to another font and stop joining ("م ح ا ك ا ة"). Currency and aligned
 * numbers use the `tabular` class (tabular-nums) instead.
 */
export const Mono = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { spaced?: boolean }
>(({ className, spaced = false, ...props }, ref) => (
  <span ref={ref} dir="ltr" className={cn('font-mono tabular', spaced && 'tracking-wider', className)} {...props} />
))
Mono.displayName = 'Mono'
