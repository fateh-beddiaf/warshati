import { toLocalDateString, startOfMonthLocalString } from '../src/shared/date-utils'

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`)
    throw new Error(`Assertion failed: ${message}`)
  }
  console.log(`✅ Passed: ${message}`)
}

console.log('--- Local date helpers ---')

// 00:30 local time: in any timezone ahead of UTC the UTC date is still "yesterday", which is
// what toISOString().split('T')[0] used to return for the reports default dates.
const justAfterMidnight = new Date(2026, 9, 3, 0, 30, 0, 0)
assert(toLocalDateString(justAfterMidnight) === '2026-10-03', 'toLocalDateString uses local parts at 00:30 local time')

const justBeforeMidnight = new Date(2026, 9, 3, 23, 45, 0, 0)
assert(toLocalDateString(justBeforeMidnight) === '2026-10-03', 'toLocalDateString uses local parts at 23:45 local time')

assert(toLocalDateString(new Date(2026, 0, 5)) === '2026-01-05', 'month and day are zero padded')
assert(toLocalDateString(new Date(2026, 11, 31, 23, 59)) === '2026-12-31', 'year end is not rolled over')

assert(
  startOfMonthLocalString(new Date(2026, 9, 3, 0, 30)) === '2026-10-01',
  'startOfMonthLocalString returns the 1st of the local month at 00:30'
)
assert(
  startOfMonthLocalString(new Date(2026, 0, 1, 0, 5)) === '2026-01-01',
  'startOfMonthLocalString on the 1st at 00:05 stays on the 1st (not the previous month)'
)

console.log('\n✅ All date helper tests passed')
process.exit(0)
