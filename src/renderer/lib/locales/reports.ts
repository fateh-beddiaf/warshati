// UI strings for the "reports" area. Add keys here, never inline text in JSX.
// `en` is typed against `ar`, so both languages must define every key.
export const reportsAr = {
  refresh: 'تحديث التقرير',
  periodAria: 'الفترة الزمنية',
  fullIncome: '100% الدخل الإجمالي',
  paidLabel: 'مدفوع:',
  deliveredCount: '{count} تذكرة مسلّمة',
  devicesDone: '{count} أجهزة منجزة',
  devicesRepaired: '{count} أجهزة صيانة',
  partnerException: 'استثناء 100% للشريك',
  proportionalSplit: 'تقسيم نسبي حسب التصنيف',
  totalIncome: 'إجمالي الدخل',
  myShareShort: 'حصتي',
  partnerShareShort: 'حصة الشريك',
  partnerWord: 'الشريك',
  totalWord: 'الإجمالي',
  percentMine: '{pct}% لي',
  noTechniciansData: 'لا توجد تذاكر منجزة للفنيين في هذا النطاق الزمني',
  noCategoriesData: 'لا توجد إيرادات مسجلة حسب التصنيفات في هذا النطاق الزمني',
  debtWithAmount: 'دين ({amount})',
  paidInFull: 'خالص نقداً',
  splitTitle: 'توزيع الحصص بين الورشة والشريك'
}

export const reportsEn: typeof reportsAr = {
  refresh: 'Refresh report',
  periodAria: 'Time period',
  fullIncome: '100% of total income',
  paidLabel: 'Paid:',
  deliveredCount: '{count} delivered tickets',
  devicesDone: '{count} devices completed',
  devicesRepaired: '{count} devices repaired',
  partnerException: '100% partner exception',
  proportionalSplit: 'Split by category percentage',
  totalIncome: 'Total income',
  myShareShort: 'My share',
  partnerShareShort: 'Partner share',
  partnerWord: 'Partner',
  totalWord: 'Total',
  percentMine: '{pct}% mine',
  noTechniciansData: 'No completed tickets for technicians in this date range',
  noCategoriesData: 'No revenue recorded by category in this date range',
  debtWithAmount: 'Debt ({amount})',
  paidInFull: 'Paid in full',
  splitTitle: 'Profit split between shop and partner'
}
