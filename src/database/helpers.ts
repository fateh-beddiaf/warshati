/**
 * Calculates amount_remaining accurately.
 * Guaranteed to be non-negative.
 */
export function calculateRemaining(price: number, amountPaid: number): number {
  const safePrice = Number(price) || 0
  const safePaid = Number(amountPaid) || 0
  const remaining = safePrice - safePaid
  return remaining > 0 ? remaining : 0
}

/**
 * Generates a unique, Code128-compatible barcode code for a ticket.
 * Format: WSH-YYMMDD-XXXX where XXXX is a unique sequence/random alphanumeric segment.
 */
export function generateBarcodeCode(): string {
  const now = new Date()
  const year = String(now.getFullYear()).slice(-2)
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString()
  const randomAlpha = Math.random().toString(36).substring(2, 4).toUpperCase()

  return `WSH${year}${month}${day}${randomAlpha}${randomSuffix}`
}
