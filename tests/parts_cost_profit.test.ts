import { calculateProfitSplit, roundMoney } from '../src/shared/profit'

// T004: the profit rule with a parts cost. Pure-function tests only (no DB, no UI).
//   net profit = price - (parts_cost ?? 0); shares are taken from the net; my + partner = net exactly.

let failures = 0
function eq<T>(actual: T, expected: T, message: string): void {
  const ok = Object.is(actual, expected) || JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    console.log(`✅ ${message}`)
  } else {
    failures++
    console.error(`❌ ${message}\n   expected: ${JSON.stringify(expected)}\n   actual:   ${JSON.stringify(actual)}`)
  }
}
const cents = (n: number): number => Math.round(n * 100)

console.log("--- T004 Section 1: the user's own examples ---")
{
  // Realme C51 screen: price 4000, screen cost 2600, 50% => net 1400 => 700 / 700
  const r = calculateProfitSplit({
    price: 4000,
    partsCost: 2600,
    isPartner: false,
    categorySplitPercentage: 50,
    requiresPartsCost: true
  })
  eq(r.netProfit, 1400, '4000 - 2600 => net profit 1400')
  eq([r.myShare, r.partnerShare], [700, 700], '4000/2600 at 50% => 700 / 700')
  eq([r.myPercentage, r.partnerPercentage], [50, 50], 'percentages 50 / 50')
  eq(r.partsCost, 2600, 'the cost used is reported')
  eq(
    [r.isProvisional, r.isLoss, r.isPartnerExclusive],
    [false, false, false],
    'not provisional, not a loss, not partner exclusive'
  )
}
{
  // Same ticket, partner technician: the partner takes 100% of the NET profit
  const r = calculateProfitSplit({
    price: 4000,
    partsCost: 2600,
    isPartner: true,
    categorySplitPercentage: 50,
    requiresPartsCost: true
  })
  eq([r.myShare, r.partnerShare], [0, 1400], 'partner technician with cost => 0 / 1400 (not 4000)')
  eq([r.myPercentage, r.partnerPercentage, r.isPartnerExclusive], [0, 100, true], 'partner exclusive 0% / 100%')
  eq(r.netProfit, 1400, 'partner: net profit 1400')
}

console.log('\n--- T004 Section 2: missing vs explicit-zero cost ---')
{
  const missing = calculateProfitSplit({
    price: 4000,
    partsCost: null,
    isPartner: false,
    categorySplitPercentage: 50,
    requiresPartsCost: true
  })
  eq(missing.isProvisional, true, 'NULL cost on a category that requires it => provisional')
  eq([missing.netProfit, missing.partsCost], [4000, 0], 'NULL cost is treated as 0 (net = price)')
  eq([missing.myShare, missing.partnerShare], [2000, 2000], 'provisional shares are computed as if the cost were 0')

  const undef = calculateProfitSplit({
    price: 4000,
    isPartner: false,
    categorySplitPercentage: 50,
    requiresPartsCost: true
  })
  eq(undef.isProvisional, true, 'omitted cost on a required category is also provisional')

  const explicitZero = calculateProfitSplit({
    price: 4000,
    partsCost: 0,
    isPartner: false,
    categorySplitPercentage: 50,
    requiresPartsCost: true
  })
  eq(explicitZero.isProvisional, false, 'explicit 0 cost is NOT provisional (the user said "no cost")')
  eq([explicitZero.myShare, explicitZero.partnerShare], [2000, 2000], 'explicit 0 cost => same shares as the price')

  const notRequired = calculateProfitSplit({
    price: 4000,
    partsCost: null,
    isPartner: false,
    categorySplitPercentage: 50,
    requiresPartsCost: false
  })
  eq(notRequired.isProvisional, false, 'NULL cost on a category that does NOT require it => never provisional')
  const defaultNotRequired = calculateProfitSplit({ price: 4000, isPartner: false, categorySplitPercentage: 50 })
  eq(defaultNotRequired.isProvisional, false, 'requiresPartsCost defaults to false (backwards compatible callers)')
  eq(
    [defaultNotRequired.myShare, defaultNotRequired.partnerShare, defaultNotRequired.netProfit],
    [2000, 2000, 4000],
    'no-cost callers keep the old result'
  )

  const partnerMissing = calculateProfitSplit({
    price: 4000,
    partsCost: null,
    isPartner: true,
    requiresPartsCost: true
  })
  eq(
    [partnerMissing.isProvisional, partnerMissing.myShare, partnerMissing.partnerShare],
    [true, 0, 4000],
    'partner + missing cost => provisional 0 / full price'
  )

  // a cost entered on a category that does not require one still counts
  const optional = calculateProfitSplit({
    price: 4000,
    partsCost: 500,
    isPartner: false,
    categorySplitPercentage: 50,
    requiresPartsCost: false
  })
  eq(
    [optional.netProfit, optional.myShare, optional.partnerShare],
    [3500, 1750, 1750],
    'an entered cost is used even when the category does not require one'
  )
}

console.log('\n--- T004 Section 3: losses (cost > price) ---')
{
  const r = calculateProfitSplit({
    price: 3000,
    partsCost: 3500,
    isPartner: false,
    categorySplitPercentage: 50,
    requiresPartsCost: true
  })
  eq(r.netProfit, -500, 'loss: net profit -500')
  eq([r.myShare, r.partnerShare], [-250, -250], 'loss 3000/3500 at 50% => -250 / -250 (split like a profit)')
  eq(r.isLoss, true, 'isLoss is true')

  const p = calculateProfitSplit({ price: 3000, partsCost: 3500, isPartner: true, requiresPartsCost: true })
  eq([p.myShare, p.partnerShare], [0, -500], 'loss with the partner technician => 0 / -500')
  eq(p.isLoss, true, 'partner loss: isLoss')

  const uneven = calculateProfitSplit({
    price: 1000,
    partsCost: 1600,
    isPartner: false,
    categorySplitPercentage: 70,
    requiresPartsCost: true
  })
  eq([uneven.netProfit, uneven.myShare, uneven.partnerShare], [-600, -420, -180], 'loss at 70%: -600 => -420 / -180')

  const breakEven = calculateProfitSplit({
    price: 2600,
    partsCost: 2600,
    isPartner: false,
    categorySplitPercentage: 50,
    requiresPartsCost: true
  })
  eq(
    [breakEven.netProfit, breakEven.myShare, breakEven.partnerShare, breakEven.isLoss],
    [0, 0, 0, false],
    'cost == price => zero profit, not a loss'
  )
  eq(
    Object.is(breakEven.myShare, -0) || Object.is(breakEven.partnerShare, -0) || Object.is(breakEven.netProfit, -0),
    false,
    'no negative zero leaks out'
  )

  const zeroPrice = calculateProfitSplit({
    price: 0,
    partsCost: 800,
    isPartner: false,
    categorySplitPercentage: 50,
    requiresPartsCost: true
  })
  eq(
    [zeroPrice.netProfit, zeroPrice.myShare, zeroPrice.partnerShare, zeroPrice.isLoss],
    [-800, -400, -400, true],
    'free repair with a cost => loss of the cost'
  )
}

console.log('\n--- T004 Section 4: fractions, rounding, exact totals ---')
{
  // 70%: 1255.50 - 100.25 = 1155.25 => 808.675 -> 808.68 (half away from zero) ; partner takes the exact rest
  const r = calculateProfitSplit({
    price: 1255.5,
    partsCost: 100.25,
    isPartner: false,
    categorySplitPercentage: 70,
    requiresPartsCost: true
  })
  eq(r.netProfit, 1155.25, 'net 1255.50 - 100.25 = 1155.25')
  eq(r.myShare, 808.68, '70% of 1155.25 = 808.675 rounds to 808.68')
  eq(r.partnerShare, 346.57, 'partner gets the exact remainder 346.57')
  eq(cents(r.myShare) + cents(r.partnerShare), cents(r.netProfit), 'cents: my + partner = net exactly')

  // 33.33%: awkward percentage on an awkward net
  const odd = calculateProfitSplit({
    price: 1000.01,
    partsCost: 333.34,
    isPartner: false,
    categorySplitPercentage: 33.33,
    requiresPartsCost: true
  })
  eq(cents(odd.myShare) + cents(odd.partnerShare), cents(odd.netProfit), '33.33%: my + partner = net exactly')
  eq(odd.netProfit, 666.67, '33.33%: net 666.67')

  // a loss with fractions rounds symmetrically (half away from zero) and still sums exactly
  const lossFrac = calculateProfitSplit({
    price: 100,
    partsCost: 255.5,
    isPartner: false,
    categorySplitPercentage: 70,
    requiresPartsCost: true
  })
  eq(lossFrac.netProfit, -155.5, 'fractional loss net -155.50')
  eq([lossFrac.myShare, lossFrac.partnerShare], [-108.85, -46.65], 'fractional loss: 70% of -155.50 = -108.85 / -46.65')
  eq(cents(lossFrac.myShare) + cents(lossFrac.partnerShare), cents(lossFrac.netProfit), 'fractional loss sums exactly')

  // half-cent ties go away from zero, symmetric for profit and loss
  const tiePos = calculateProfitSplit({ price: 0.01, isPartner: false, categorySplitPercentage: 50 })
  const tieNeg = calculateProfitSplit({ price: 0, partsCost: 0.01, isPartner: false, categorySplitPercentage: 50 })
  eq(
    [tiePos.myShare, tiePos.partnerShare],
    [0.01, 0],
    '1 cent at 50%: tie rounds away from zero for me, remainder to the partner'
  )
  eq([tieNeg.myShare, tieNeg.partnerShare], [-0.01, 0], '-1 cent at 50%: symmetric')

  eq(roundMoney(2.675), 2.68, 'roundMoney(2.675) = 2.68 (binary float noise tolerated)')
  eq(roundMoney(-2.675), -2.68, 'roundMoney(-2.675) = -2.68')
  eq(roundMoney(1400), 1400, 'roundMoney leaves exact values alone')
}

console.log('\n--- T004 Section 5: frozen percentage beats the current category percentage ---')
{
  // Delivered at 50%. The category is later changed to 90%. Editing the cost must keep 50%.
  const afterCategoryChange = calculateProfitSplit({
    price: 4000,
    partsCost: 2600,
    isPartner: false,
    categorySplitPercentage: 90,
    appliedSplitPercentage: 50,
    requiresPartsCost: true
  })
  eq(
    [afterCategoryChange.myShare, afterCategoryChange.partnerShare],
    [700, 700],
    "frozen 50% wins over the category's current 90%"
  )
  eq(afterCategoryChange.myPercentage, 50, 'the applied percentage is the frozen one')

  const withoutFrozen = calculateProfitSplit({
    price: 4000,
    partsCost: 2600,
    isPartner: false,
    categorySplitPercentage: 90,
    requiresPartsCost: true
  })
  eq(
    [withoutFrozen.myShare, withoutFrozen.partnerShare],
    [1260, 140],
    "without a frozen percentage the category's is used (fallback)"
  )

  const frozenZero = calculateProfitSplit({
    price: 4000,
    partsCost: 2600,
    isPartner: false,
    categorySplitPercentage: 90,
    appliedSplitPercentage: 0
  })
  eq([frozenZero.myShare, frozenZero.partnerShare], [0, 1400], 'a frozen 0% is honoured (not treated as "missing")')

  const frozenNull = calculateProfitSplit({
    price: 4000,
    partsCost: 2600,
    isPartner: false,
    categorySplitPercentage: 60,
    appliedSplitPercentage: null
  })
  eq([frozenNull.myShare, frozenNull.partnerShare], [840, 560], 'frozen null falls back to the category percentage')

  // The partner is always 100% whatever percentages are around
  const partner = calculateProfitSplit({
    price: 4000,
    partsCost: 2600,
    isPartner: true,
    categorySplitPercentage: 90,
    appliedSplitPercentage: 50
  })
  eq([partner.myShare, partner.partnerShare], [0, 1400], 'partner ignores any percentage')

  // Loss recomputed with a frozen 70%
  const lossFrozen = calculateProfitSplit({
    price: 3000,
    partsCost: 3500,
    isPartner: false,
    categorySplitPercentage: 10,
    appliedSplitPercentage: 70
  })
  eq([lossFrozen.myShare, lossFrozen.partnerShare], [-350, -150], 'loss with a frozen 70% => -350 / -150')
}

console.log('\n--- T004 Section 6: defensive input handling ---')
{
  eq(
    calculateProfitSplit({
      price: 4000,
      partsCost: -50,
      isPartner: false,
      categorySplitPercentage: 50,
      requiresPartsCost: true
    }).partsCost,
    0,
    'a negative cost is never used (treated as not entered)'
  )
  eq(
    calculateProfitSplit({
      price: 4000,
      partsCost: -50,
      isPartner: false,
      categorySplitPercentage: 50,
      requiresPartsCost: true
    }).isProvisional,
    true,
    'a negative cost counts as not entered => provisional'
  )
  eq(
    calculateProfitSplit({
      price: 4000,
      partsCost: NaN,
      isPartner: false,
      categorySplitPercentage: 50,
      requiresPartsCost: true
    }).isProvisional,
    true,
    'NaN cost counts as not entered'
  )
  eq(
    calculateProfitSplit({ price: 4000, partsCost: Infinity, isPartner: false, categorySplitPercentage: 50 }).netProfit,
    4000,
    'Infinity cost is ignored'
  )
  eq(
    calculateProfitSplit({ price: -100, partsCost: 0, isPartner: false, categorySplitPercentage: 70 }).netProfit,
    0,
    'a negative price is clamped to 0 (as before)'
  )
  eq(
    calculateProfitSplit({ price: NaN, isPartner: false, categorySplitPercentage: 70 }).myShare,
    0,
    'NaN price => 0 shares'
  )
  eq(
    calculateProfitSplit({ price: 1000, isPartner: false, categorySplitPercentage: 250 }).myPercentage,
    100,
    'percentage clamped to 100'
  )
  eq(
    calculateProfitSplit({ price: 1000, isPartner: false, categorySplitPercentage: -5 }).myPercentage,
    0,
    'percentage clamped to 0'
  )
  eq(
    calculateProfitSplit({ price: 1000, isPartner: false, categorySplitPercentage: undefined }).myShare,
    500,
    'missing percentage defaults to 50%'
  )
  eq(
    calculateProfitSplit({ price: 1000, isPartner: false, categorySplitPercentage: NaN }).myShare,
    500,
    'NaN percentage defaults to 50%'
  )
  eq(
    calculateProfitSplit({
      price: 4000,
      partsCost: '2600' as unknown as number,
      isPartner: false,
      categorySplitPercentage: 50
    }).netProfit,
    1400,
    'a numeric string cost is coerced like the price'
  )
}

console.log('\n--- T004 Section 7: invariants over many combinations ---')
{
  // Deterministic pseudo-random sweep: the identity my + partner = net must hold to the cent in every case,
  // and a partner ticket must never give the owner anything.
  let seed = 123456789
  const rand = (): number => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  let identityHolds = true
  let partnerHolds = true
  let netHolds = true
  let provisionalHolds = true
  let firstBad = ''
  for (let i = 0; i < 20000; i++) {
    const price = Math.round(rand() * 2000000) / 100 // up to 20,000.00
    const hasCost = rand() > 0.25
    const partsCost = hasCost ? Math.round(rand() * 2500000) / 100 : null // sometimes more than the price
    const pct = [0, 10, 25, 33.33, 40, 50, 66.67, 70, 90, 100, 12.5][Math.floor(rand() * 11)]
    const isPartner = rand() > 0.7
    const requires = rand() > 0.5
    const r = calculateProfitSplit({
      price,
      partsCost,
      isPartner,
      categorySplitPercentage: pct,
      requiresPartsCost: requires
    })
    if (cents(r.myShare) + cents(r.partnerShare) !== cents(r.netProfit)) {
      identityHolds = false
      firstBad ||= `identity price=${price} cost=${partsCost} pct=${pct} partner=${isPartner}`
    }
    if (cents(r.netProfit) !== cents(price) - cents(partsCost ?? 0)) {
      netHolds = false
      firstBad ||= `net price=${price} cost=${partsCost}`
    }
    if (isPartner && r.myShare !== 0) partnerHolds = false
    if (r.isProvisional !== (requires && partsCost === null)) provisionalHolds = false
  }
  eq(identityHolds, true, `my + partner = net exactly (to the cent) in 20,000 random cases ${firstBad}`)
  eq(netHolds, true, 'net profit = price - cost in cents in every random case')
  eq(partnerHolds, true, 'the owner never gets a share on a partner ticket')
  eq(provisionalHolds, true, 'isProvisional <=> category requires a cost AND none entered')
}

if (failures > 0) {
  console.error(`\n💥 ${failures} assertion(s) failed`)
  process.exit(1)
}
console.log('\n🎉 ALL PARTS-COST PROFIT TESTS PASSED! 🎉')
process.exit(0)
