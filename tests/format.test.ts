import { formatCurrency, formatAmount, formatDate, setUiLanguage } from '../src/renderer/lib/utils'

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`)
    throw new Error(`Assertion failed: ${message}`)
  }
  console.log(`✅ Passed: ${message}`)
}

console.log('--- Currency / date formatting follows the UI language ---')

setUiLanguage('ar')
assert(formatCurrency(1500).endsWith(' د.ج'), 'Arabic UI: currency suffix is د.ج')
assert(/^1.500 /.test(formatCurrency(1500)), `Arabic UI: grouping keeps the existing style (${formatCurrency(1500)})`)
assert(formatCurrency(0) === '0 د.ج', 'Arabic UI: zero')

// Negative amounts (a loss): the minus stays on the left of the digits, isolated from the Arabic text around it
assert(formatCurrency(-250) === '\u2066-250\u2069 د.ج', `Arabic UI: a loss keeps "-250" as one left-to-right run (${JSON.stringify(formatCurrency(-250))})`)
assert(formatAmount(-1500).replace(/[\u2066\u2069]/g, '') === '-1.500', 'Arabic UI: negative grouping')
assert(formatAmount(0) === '0' && formatAmount(-0.2) === '0', 'a negative that rounds to zero shows no sign')

setUiLanguage('en')
assert(formatCurrency(-250).replace(/[\u2066\u2069]/g, '') === '-250 DZD', 'English UI: -250 DZD')
assert(formatCurrency(1500) === '1,500 DZD', 'English UI: 1,500 DZD')
assert(formatCurrency(1234567) === '1,234,567 DZD', 'English UI: millions are grouped')
assert(formatAmount(2500) === '2,500', 'English UI: plain amount has no currency')
assert(!/[\u0600-\u06FF]/.test(formatCurrency(99999)), 'English UI: no Arabic characters in money')
assert(!/[\u0600-\u06FF]/.test(formatDate('2026-10-03T10:10:00.000Z')), 'English UI: dates have no Arabic month names')

setUiLanguage('ar')
assert(/[\u0600-\u06FF]/.test(formatDate('2026-10-03T10:10:00.000Z')), 'Arabic UI: dates use Arabic month names')

process.exit(0)
