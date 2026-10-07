/**
 * محرك حساب الأرباح النقي لمشروع "ورشتي"
 * يطبق قاعدة توزيع الأرباح الأساسية للمشروع (دالة نقية قابلة للاختبار بمعزل عن الواجهة):
 *
 *   الربح الصافي = price − parts_cost   (parts_cost الفارغة تُعامل 0 مؤقتاً)
 *     — تكلفة القطعة تُدفع أولاً من مال الزبون، لا يتحملها شريك بعينه.
 *
 * عند status → delivered:
 *   إذا technician == "الشريك": حصة الشريك = 100% من الربح الصافي، حصتي = 0
 *   وإلا: نسبتي = default_split_percentage الخاصة بـ repair_category هذه التذكرة (تُجمَّد عند التسليم)
 *         حصتي = الربح الصافي × نسبتي ; حصة الشريك = الربح الصافي − حصتي
 *
 * خسارة (تكلفة > سعر): الربح الصافي سالب والحصص سالبة بنفس القاعدة.
 * عند تعديل التكلفة بعد التسليم تُمرَّر النسبة المجمَّدة في `appliedSplitPercentage`
 * فتتقدم على نسبة التصنيف الحالية.
 *
 * تعديل تذكرة مسلَّمة (src/database/queries/ticket-edit.ts) يعيد الحساب بهذه الدالة نفسها:
 *   السعر/التكلفة ← بالنسبة المجمَّدة؛ الفني ← قاعدة الشريك (100% له وتُمسح النسبة المجمَّدة)، وغير الشريك
 *   يأخذ المجمَّدة أو نسبة التصنيف الحالية إن لم توجد؛ التصنيف ← تُجمَّد من جديد نسبةُ التصنيف الجديد الحالية.
 *   التذكرة غير المسلَّمة تُحفظ فقط (الحصص تُحسب عند التسليم).
 *
 * كل الحسابات بالسنتيم (أعداد صحيحة) لضمان myShare + partnerShare = netProfit بالضبط.
 */

export interface ProfitSplitParams {
  price: number
  isPartner: boolean
  /** نسبة التصنيف الحالية (تُستخدم عند أول حساب/تسليم) */
  categorySplitPercentage?: number | null
  /** تكلفة القطع؛ null/undefined = لم تُدخل بعد (تُعامل 0) */
  partsCost?: number | null
  /** هل يتطلب تصنيف التذكرة تكلفة قطع؟ (لحساب isProvisional فقط، لا يغيّر الأرقام) */
  requiresPartsCost?: boolean
  /** النسبة المجمَّدة عند التسليم؛ إن وُجدت تتقدم على categorySplitPercentage */
  appliedSplitPercentage?: number | null
}

export interface ProfitSplitResult {
  /** الربح الصافي = price − (partsCost ?? 0) ، مقرَّب لسنتيمين، قد يكون سالباً */
  netProfit: number
  /** التكلفة المستخدمة في الحساب (0 إن كانت فارغة) */
  partsCost: number
  myShare: number
  partnerShare: number
  /** نسبتي المطبَّقة (0 للشريك) */
  myPercentage: number
  partnerPercentage: number
  isPartnerExclusive: boolean
  /** التصنيف يتطلب تكلفة والتكلفة لم تُدخل: الأرقام مؤقتة */
  isProvisional: boolean
  /** التكلفة تتجاوز السعر */
  isLoss: boolean
}

const DEFAULT_SPLIT_PERCENTAGE = 50

/** Integer cents of an amount (half away from zero, tolerant to binary float noise). */
function toCents(amount: number): number {
  const abs = Math.abs(amount)
  const cents = Math.round(abs * 100 + 1e-7)
  return amount < 0 ? -cents : cents
}

/** Cents -> amount, never -0. */
function fromCents(cents: number): number {
  const value = cents / 100
  return value === 0 ? 0 : value
}

/** Round a monetary amount to 2 decimals (half away from zero). */
export function roundMoney(amount: number): number {
  return fromCents(toCents(amount))
}

/** A usable percentage (finite number) clamped to 0..100, otherwise null. */
function normalizePercentage(value: number | null | undefined): number | null {
  if (value === undefined || value === null) return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(100, n))
}

/**
 * دالة نقية لحساب توزيع الأرباح بين صاحب المحل والشريك
 */
export function calculateProfitSplit(params: ProfitSplitParams): ProfitSplitResult {
  const rawPrice = Number(params.price)
  const priceCents = !Number.isFinite(rawPrice) || rawPrice < 0 ? 0 : toCents(rawPrice)

  // Missing / malformed cost counts as "not entered" (0); a negative cost is never valid
  const rawCost = params.partsCost === null || params.partsCost === undefined ? null : Number(params.partsCost)
  const hasCost = rawCost !== null && Number.isFinite(rawCost) && rawCost >= 0
  const costCents = hasCost ? toCents(rawCost as number) : 0

  const netCents = priceCents - costCents
  const isProvisional = Boolean(params.requiresPartsCost) && !hasCost
  const isLoss = netCents < 0

  const base = {
    netProfit: fromCents(netCents),
    partsCost: fromCents(costCents),
    isProvisional,
    isLoss
  }

  // الحالة الاستثنائية للشريك: يحصل على 100% من الربح الصافي
  if (params.isPartner) {
    return {
      ...base,
      myShare: 0,
      partnerShare: fromCents(netCents),
      myPercentage: 0,
      partnerPercentage: 100,
      isPartnerExclusive: true
    }
  }

  // الفني "أنا": النسبة المجمَّدة (إن وُجدت) ثم نسبة التصنيف ثم 50%
  const splitPercentage =
    normalizePercentage(params.appliedSplitPercentage) ??
    normalizePercentage(params.categorySplitPercentage) ??
    DEFAULT_SPLIT_PERCENTAGE

  const myPercentage = splitPercentage
  const partnerPercentage = Math.round((100 - splitPercentage) * 100) / 100

  // myShare rounded (half away from zero) on the cents; the partner takes the exact remainder
  const myCents = Math.sign(netCents) * Math.round(Math.abs(netCents) * (myPercentage / 100) + 1e-7)
  const partnerCents = netCents - myCents

  return {
    ...base,
    myShare: fromCents(myCents),
    partnerShare: fromCents(partnerCents),
    myPercentage,
    partnerPercentage,
    isPartnerExclusive: false
  }
}
