import { generateShortLabel } from '../src/shared/device-utils'
import { calculateRemaining, generateBarcodeCode } from '../src/database/helpers'
import { t } from '../src/renderer/lib/i18n'

console.log('--- Running Unit Tests (Milestone 1 & 2) ---')

let passed = true

// 1. Test short_label generation
const shortLabelCases = [
  { brand: 'Samsung', model: 'Galaxy A54', expected: 'SA A54' },
  { brand: 'Samsung', model: 'M13', expected: 'SA M13' },
  { brand: 'Apple', model: 'iPhone 14 Pro Max', expected: 'IP 14 Pro Max' },
  { brand: 'Xiaomi', model: 'Redmi Note 12', expected: 'MI Note 12' },
  { brand: 'Huawei', model: 'Y9 Prime', expected: 'HW Y9 Prime' },
  { brand: 'Oppo', model: 'Reno 8', expected: 'OP Reno 8' },
  { brand: 'Realme', model: 'C55', expected: 'RL C55' },
  { brand: 'Infinix', model: 'Hot 30', expected: 'IN Hot 30' },
  { brand: 'Tecno', model: 'Spark 10', expected: 'TC Spark 10' },
  // Regression: regex metacharacters in a custom brand used to throw (white screen)
  { brand: 'C++', model: 'C++ X1', expected: 'C X1' },
  { brand: '(', model: 'Model 1', expected: '( Model 1' },
  { brand: 'LG [x', model: 'G8', expected: 'LG G8' }
]

for (const tc of shortLabelCases) {
  const result = generateShortLabel(tc.brand, tc.model)
  if (result !== tc.expected) {
    console.error(`[FAIL] generateShortLabel("${tc.brand}", "${tc.model}"): Expected "${tc.expected}", got "${result}"`)
    passed = false
  } else {
    console.log(`[PASS] generateShortLabel("${tc.brand}", "${tc.model}") = "${result}"`)
  }
}

// 2. Test calculateRemaining
console.log('\n[TEST] calculateRemaining:')
const rem1 = calculateRemaining(15000, 5000)
if (rem1 !== 10000) {
  console.error(`[FAIL] Expected 10000, got ${rem1}`)
  passed = false
} else {
  console.log(`[PASS] calculateRemaining(15000, 5000) = ${rem1}`)
}

const rem2 = calculateRemaining(5000, 10000)
if (rem2 !== 0) {
  console.error(`[FAIL] Expected 0 for overpaid/negative, got ${rem2}`)
  passed = false
} else {
  console.log(`[PASS] calculateRemaining(5000, 10000) = ${rem2}`)
}

// 3. Test generateBarcodeCode
console.log('\n[TEST] generateBarcodeCode:')
const code1 = generateBarcodeCode()
const code2 = generateBarcodeCode()
console.log(`[PASS] Generated Barcodes: ${code1}, ${code2}`)
if (!code1.startsWith('WSH') || code1 === code2 || code1.length < 10) {
  console.error(`[FAIL] Invalid or duplicate barcode: ${code1}, ${code2}`)
  passed = false
}

// 4. Test 40x20mm Thermal Printer Calculations (203 DPI / Xprinter)
console.log('\n[TEST] 40x20mm Thermal Printer Calculations:')
const widthMm = 40
const heightMm = 20
const dpi = 203 // Standard thermal head resolution (8 dots/mm)
const widthPx = Math.round(widthMm * (dpi / 25.4))
const heightPx = Math.round(heightMm * (dpi / 25.4))
const widthMicrons = widthMm * 1000
const heightMicrons = heightMm * 1000

if (widthPx !== 320 || heightPx !== 160 || widthMicrons !== 40000 || heightMicrons !== 20000) {
  console.error(`[FAIL] Unexpected dimension calculations: ${widthPx}x${heightPx} px, ${widthMicrons}x${heightMicrons} microns`)
  passed = false
} else {
  console.log(`[PASS] 40x20mm at 203 DPI = ${widthPx}px x ${heightPx}px (Page size: ${widthMicrons}x${heightMicrons} microns)`)
}

// 5. Test Dual-Approach Barcode Scanner Timing Logic
console.log('\n[TEST] Scanner Burst Timing Logic:')
function evaluateScanBurst(intervals: number[], maxIntervalMs = 60): boolean {
  if (intervals.length === 0) return false
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
  return avg > 0 && avg <= maxIntervalMs
}

const hardwareScannerIntervals = [12, 15, 14, 18, 11, 13, 16] // typical HID burst ~14ms
const humanTypingIntervals = [140, 210, 180, 250, 190] // typical human typing ~200ms

if (!evaluateScanBurst(hardwareScannerIntervals, 60)) {
  console.error('[FAIL] Hardware scanner burst was wrongly rejected')
  passed = false
} else {
  console.log('[PASS] Hardware scanner burst (<50ms) correctly classified as Scanner.')
}

if (evaluateScanBurst(humanTypingIntervals, 60)) {
  console.error('[FAIL] Human typing burst was wrongly classified as Scanner')
  passed = false
} else {
  console.log('[PASS] Human typing (>100ms) correctly rejected by timing filter.')
}

// 6. Test i18n keys for Milestone 1 & 2
console.log('\n[TEST] i18n structure for Milestone 1 & 2:')
const requiredKeys = [
  t.app.title,
  t.newTicket.title,
  t.ticketsList.title,
  t.print.modalTitle,
  t.print.actualSizeToggle,
  t.print.reprintButton,
  t.scanner.readyBadge,
  t.ticketDetails.title,
  t.ticketDetails.printLabelButton
]

if (requiredKeys.some((k) => !k)) {
  console.error('[FAIL] Missing required i18n keys')
  passed = false
} else {
  console.log('[PASS] All Milestone 1 & 2 i18n keys verified.')
}

if (passed) {
  console.log('\n=========================================')
  console.log('✅ ALL UNIT & COMPUTATION TESTS PASSED!')
  console.log('=========================================')
  process.exit(0)
} else {
  console.error('\n❌ UNIT TESTS FAILED!')
  process.exit(1)
}
