// New UI strings for the "newTicket" area (T003). Add keys here, never inline text in JSX.
// `en` is typed against `ar`, so both languages must define every key.
export const newTicketAr = {
  currency: 'د.ج',
  loading: 'جاري تحميل البيانات...',
  autocomplete: {
    placeholder: 'اختر أو اكتب...',
    useTyped: 'استخدام القيمة المكتوبة:',
    noResults: 'لا توجد نتائج مطابقة',
    narrow: 'اكتب لتضييق النتائج',
    toggle: 'إظهار الخيارات'
  },
  customer: {
    hint: 'ابحث عن زبون مسجل أو أدخل بيانات زبون جديد'
  },
  device: {
    hint: 'اختر الماركة والموديل من القائمة أو اكتبهما'
  },
  repair: {
    hint: 'نوع العطل والفني المسؤول',
    categoryShare: 'نسبة الحصة'
  },
  payment: {
    section: 'الدفع',
    hint: 'السعر والمبلغ المدفوع وطريقة الدفع',
    total: 'الإجمالي',
    paid: 'المدفوع',
    remaining: 'المتبقي',
    cashHint: 'يُدفع كامل المبلغ الآن',
    creditHint: 'يبقى جزء من المبلغ دَيناً على الزبون',
    creditForced: 'الدفع الجزئي يُسجَّل تلقائياً كدَين'
  },
  accessories: {
    hint: 'اختر ما استلمته مع الجهاز',
    empty: 'لا توجد ملحقات معرّفة بعد'
  },
  actions: {
    printLabel: 'طباعة الملصق',
    anotherTicket: 'تذكرة أخرى',
    viewInList: 'عرض في القائمة',
    regenerateLabel: 'إعادة توليد المسمى التلقائي'
  },
  requiredMark: 'حقل إلزامي'
}

export const newTicketEn: typeof newTicketAr = {
  currency: 'DZD',
  loading: 'Loading data...',
  autocomplete: {
    placeholder: 'Select or type...',
    useTyped: 'Use the typed value:',
    noResults: 'No matching results',
    narrow: 'Type to narrow results',
    toggle: 'Show options'
  },
  customer: {
    hint: 'Look up a registered customer or enter a new one'
  },
  device: {
    hint: 'Pick the brand and model from the list or type them'
  },
  repair: {
    hint: 'Repair category and responsible technician',
    categoryShare: 'Share'
  },
  payment: {
    section: 'Payment',
    hint: 'Price, amount paid and payment method',
    total: 'Total',
    paid: 'Paid',
    remaining: 'Remaining',
    cashHint: 'The full amount is paid now',
    creditHint: 'Part of the amount stays as a debt on the customer',
    creditForced: 'A partial payment is recorded as a debt automatically'
  },
  accessories: {
    hint: 'Select what you received with the device',
    empty: 'No accessories defined yet'
  },
  actions: {
    printLabel: 'Print label',
    anotherTicket: 'Another ticket',
    viewInList: 'View in list',
    regenerateLabel: 'Regenerate the automatic label'
  },
  requiredMark: 'Required field'
}
