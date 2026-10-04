/**
 * Parsing of the parts-cost text boxes (UI side, pure so it can be unit tested).
 *   ''            -> empty   (cost not entered)
 *   '2600'        -> ok 2600
 *   '2600.5' / '2600,5' / '٢٦٠٠' (Arabic-Indic digits) -> ok
 *   'abc', '-5', '1e3', '1.234' (more than 2 decimals) -> invalid
 */
export type ParsedCost = { kind: 'empty' } | { kind: 'invalid' } | { kind: 'ok'; value: number }

const ARABIC_INDIC_ZERO = 0x0660
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0

function normalizeDigits(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - ARABIC_INDIC_ZERO))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - EXTENDED_ARABIC_INDIC_ZERO))
    .replace(/[٫,]/g, '.')
    .replace(/\s+/g, '')
}

export function parseCostInput(raw: string): ParsedCost {
  const text = normalizeDigits(raw ?? '')
  if (text === '') return { kind: 'empty' }
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return { kind: 'invalid' }
  const value = Number(text)
  return Number.isFinite(value) ? { kind: 'ok', value } : { kind: 'invalid' }
}

/** True when an entered cost is higher than the price (the ticket is a loss). */
export function isCostLoss(cost: number, price: number): boolean {
  return Math.round(cost * 100) > Math.round(Math.max(0, price) * 100)
}
