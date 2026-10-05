/**
 * Ticket codes: what the label's barcode encodes and what the scanner types.
 *
 * Format: 8 digits, "2" followed by 7 random digits (e.g. 27304918).
 *  - All digits, even length: Code128 set C packs two digits per symbol, so the whole code is 4 symbols and the
 *    barcode fits the 40mm label with a 3-dot (0.375mm) module and full quiet zones (see label-barcode.ts).
 *  - Never confused with an Algerian phone number (10 digits starting with 0): different length, starts with 2.
 *  - 10 million possible codes; uniqueness is checked against the database when a ticket is created.
 *
 * Older databases used "WSH" + date + letters + digits (e.g. WSH2610056T5197). Those labels could not be scanned
 * (too long for the label, no quiet zone); migrated tickets keep that code in Ticket.legacy_barcode_code so it can
 * still be searched and scanned.
 */
export const TICKET_CODE_PREFIX = '2'
export const TICKET_CODE_LENGTH = 8

const TICKET_CODE_RE = /^2\d{7}$/
const LEGACY_TICKET_CODE_RE = /^WSH[A-Z0-9]{6,}$/

export function isTicketCode(value: string): boolean {
  return TICKET_CODE_RE.test(value)
}

export function isLegacyTicketCode(value: string): boolean {
  return LEGACY_TICKET_CODE_RE.test(value)
}

/** A code a ticket can carry or a scan can be looking for: the current format or the legacy WSH one. */
export function looksLikeTicketCode(value: string): boolean {
  return isTicketCode(value) || isLegacyTicketCode(value)
}

/** A random code in the current format. `random` returns [0, 1) (injectable for tests). */
export function generateTicketCode(random: () => number = Math.random): string {
  let digits = TICKET_CODE_PREFIX
  while (digits.length < TICKET_CODE_LENGTH) digits += String(Math.min(9, Math.floor(random() * 10)))
  return digits
}
