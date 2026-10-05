import { parseCostInput, isCostLoss } from '../src/shared/parts-cost'

// Parsing of the (masked) parts-cost text box and the "cost above price" check.

let failures = 0
function eq<T>(actual: T, expected: T, message: string): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) console.log(`✅ ${message}`)
  else {
    failures++
    console.error(`❌ ${message}\n   expected: ${JSON.stringify(expected)}\n   actual:   ${JSON.stringify(actual)}`)
  }
}

eq(parseCostInput(''), { kind: 'empty' }, 'empty string => not entered')
eq(parseCostInput('   '), { kind: 'empty' }, 'blanks => not entered')
eq(parseCostInput('0'), { kind: 'ok', value: 0 }, '0 is a real answer ("no cost"), not empty')
eq(parseCostInput('2600'), { kind: 'ok', value: 2600 }, '2600')
eq(parseCostInput(' 2600 '), { kind: 'ok', value: 2600 }, 'surrounding spaces are ignored')
eq(parseCostInput('2 600'), { kind: 'ok', value: 2600 }, 'inner spaces (thousands) are ignored')
eq(parseCostInput('1234.5'), { kind: 'ok', value: 1234.5 }, 'one decimal')
eq(parseCostInput('1234,56'), { kind: 'ok', value: 1234.56 }, 'comma decimal separator')
eq(parseCostInput('٢٦٠٠'), { kind: 'ok', value: 2600 }, 'Arabic-Indic digits')
eq(parseCostInput('۲۶۰۰'), { kind: 'ok', value: 2600 }, 'Extended Arabic-Indic digits')
eq(parseCostInput('١٢٣٫٥'), { kind: 'ok', value: 123.5 }, 'Arabic decimal separator')
for (const bad of [
  'abc',
  '-5',
  '+5',
  '1e3',
  '1.234',
  '12.',
  '.5',
  '1..2',
  '١٢٣abc',
  '2600 د.ج',
  'NaN',
  'Infinity',
  '--1'
]) {
  eq(parseCostInput(bad), { kind: 'invalid' }, `invalid: "${bad}"`)
}

eq(isCostLoss(3500, 3000), true, 'cost above the price is a loss')
eq(isCostLoss(3000, 3000), false, 'cost equal to the price is not a loss')
eq(isCostLoss(2600, 4000), false, 'cost below the price is not a loss')
eq(isCostLoss(0.01, 0), true, 'any cost on a free repair is a loss')
eq(isCostLoss(0, 0), false, 'zero cost on a free repair is not a loss')
eq(isCostLoss(100.005, 100), true, 'sub-cent noise is rounded to cents before comparing (100.005 -> 100.01 > 100.00)')
eq(isCostLoss(5, -10), true, 'a negative price counts as 0')

if (failures > 0) {
  console.error(`\n💥 ${failures} assertion(s) failed`)
  process.exit(1)
}
console.log('\n🎉 ALL PARTS-COST INPUT TESTS PASSED! 🎉')
process.exit(0)
