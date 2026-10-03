/**
 * Small pure date helpers shared by the renderer and the main process.
 * All of them work on LOCAL calendar parts: `toISOString()` converts to UTC, which shifts the
 * calendar day for dates close to local midnight (e.g. 00:30 in UTC+1 is still "yesterday" in UTC).
 */

/** Formats a Date as YYYY-MM-DD using its local year/month/day (what <input type="date"> uses). */
export function toLocalDateString(d: Date): string {
  const y = String(d.getFullYear()).padStart(4, '0')
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** First day of the month containing `d`, as a local YYYY-MM-DD string. */
export function startOfMonthLocalString(d: Date): string {
  return toLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1))
}

/**
 * Parses a strict YYYY-MM-DD string as a LOCAL date, at 00:00:00.000 or (endOfDay) 23:59:59.999.
 * Returns null for anything else, including impossible dates such as 2026-02-31.
 * (`new Date('2026-10-03')` would be UTC midnight, i.e. the previous local day west of UTC.)
 */
export function parseLocalDateString(
  value: string | undefined | null,
  endOfDay = false
): Date | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const d = endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0)
  // Reject overflowed dates (month 13, Feb 31, ...): Date silently rolls them over.
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null
  return d
}
