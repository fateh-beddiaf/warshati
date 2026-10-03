/**
 * محرك حساب الأرباح النقي لمشروع "ورشتي"
 * يطبق قاعدة توزيع الأرباح الأساسية للمشروع (دالة نقية قابلة للاختبار بمعزل عن الواجهة):
 *
 * عند status → delivered:
 *   إذا technician == "الشريك": حصة الشريك = 100%، حصتي = 0
 *   وإلا: نسبة = default_split_percentage الخاصة بـ repair_category هذه التذكرة
 *         حصتي = price × نسبتي ; حصة الشريك = price × نسبة الشريك
 */

export interface ProfitSplitParams {
  price: number
  isPartner: boolean
  categorySplitPercentage?: number | null
}

export interface ProfitSplitResult {
  myShare: number
  partnerShare: number
  myPercentage: number
  partnerPercentage: number
  isPartnerExclusive: boolean
}

/**
 * دالة نقية لحساب توزيع الأرباح بين صاحب المحل والشريك
 */
export function calculateProfitSplit(params: ProfitSplitParams): ProfitSplitResult {
  const rawPrice = Number(params.price)
  const price = isNaN(rawPrice) || rawPrice < 0 ? 0 : Math.round(rawPrice * 100) / 100
  // حالة الشريك الاستثنائية: يحصل على 100% من المبلغ
  if (params.isPartner) {
    return {
      myShare: 0,
      partnerShare: price,
      myPercentage: 0,
      partnerPercentage: 100,
      isPartnerExclusive: true
    }
  }

  // حالة الفني "أنا" (أو أي فني عادي): يعتمد على نسبة التصنيف
  let splitPercentage = 50.0
  if (
    params.categorySplitPercentage !== undefined &&
    params.categorySplitPercentage !== null &&
    !isNaN(Number(params.categorySplitPercentage))
  ) {
    splitPercentage = Math.max(0, Math.min(100, Number(params.categorySplitPercentage)))
  }

  const myPercentage = splitPercentage
  const partnerPercentage = Math.round((100 - splitPercentage) * 100) / 100

  // حساب الحصص مع ضمان عدم ضياع الكسور وأن myShare + partnerShare = price دائماً
  const myShare = Math.round((price * (myPercentage / 100)) * 100) / 100
  const partnerShare = Math.round((price - myShare) * 100) / 100

  return {
    myShare,
    partnerShare,
    myPercentage,
    partnerPercentage,
    isPartnerExclusive: false
  }
}
