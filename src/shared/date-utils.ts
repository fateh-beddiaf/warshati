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
