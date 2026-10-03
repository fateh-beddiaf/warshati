// New UI strings for the "details" area (T003): ticket details modal + print preview.
// Add keys here, never inline text in JSX.
// `en` is typed against `ar`, so both languages must define every key.
export const detailsAr = {
  // Ticket details modal
  statusLine: 'الحالة: {status}',
  deliveredNotice: 'تم تسليم الجهاز وتوثيق توزيع الأرباح بنجاح.',
  updateStatusFailed: 'فشل في تحديث الحالة',
  updateStatusError: 'حدث خطأ أثناء تحديث الحالة',
  cancel: 'إلغاء',
  back: 'رجوع',
  settleFullHint: 'دفع {amount} نقداً ليصبح المتبقي {zero}',
  creditHint: 'تسجيل باقي المبلغ ({amount}) كدين على الزبون',
  partialPlaceholder: 'أدخل المبلغ الإضافي المدفوع...',
  currencyUnit: 'د.ج',
  fullyPaidNotice: 'الحساب مسدد بالكامل (خالص). هل تود تأكيد تسليم الجهاز وحفظ توزيع الأرباح؟',
  profitsDocumented: 'الأرباح موثقة تاريخياً',
  generalCategory: 'عام',
  settled: 'خالص',
  paymentCash: 'نقداً',
  paymentCredit: 'دين / آجل',
  deliveryDescription: 'راجع حصتي الفني والشريك وسوِّ الحساب قبل تأكيد التسليم النهائي.',
  shareCaption: 'من إجمالي {total}',
  settlementTitle: 'تسوية الحساب عند التسليم',
  closeDialog: 'إغلاق النافذة',
  deleteDescription: 'عملية الحذف النهائي تتم على 3 خطوات للتأكد من عدم حدوثها بالخطأ.',

  // Print preview modal
  labelSize: '40 × 20 mm',
  defaultMark: '(الافتراضية)',
  shortLabelPlaceholder: 'SA A54...',
  previewNote: 'يظهر الملصق دائماً بخلفية بيضاء كما سيُطبع، بغض النظر عن وضع الواجهة.',
  scaleAria: 'حجم المعاينة'
}

export const detailsEn: typeof detailsAr = {
  statusLine: 'Status: {status}',
  deliveredNotice: 'The device was delivered and the profit split has been recorded.',
  updateStatusFailed: 'Failed to update the status',
  updateStatusError: 'An error occurred while updating the status',
  cancel: 'Cancel',
  back: 'Back',
  settleFullHint: 'Pay {amount} in cash so the remaining balance becomes {zero}',
  creditHint: 'Record the remaining amount ({amount}) as customer debt',
  partialPlaceholder: 'Enter the additional amount paid...',
  currencyUnit: 'DZD',
  fullyPaidNotice: 'The account is fully paid. Do you want to confirm the delivery and save the profit split?',
  profitsDocumented: 'Profits recorded historically',
  generalCategory: 'General',
  settled: 'Settled',
  paymentCash: 'Cash',
  paymentCredit: 'Credit / Debt',
  deliveryDescription: 'Review the technician and partner shares and settle the account before the final delivery confirmation.',
  shareCaption: 'of {total}',
  settlementTitle: 'Settle the account at delivery',
  closeDialog: 'Close dialog',
  deleteDescription: 'Permanent deletion takes 3 steps so it can never happen by accident.',

  labelSize: '40 × 20 mm',
  defaultMark: '(default)',
  shortLabelPlaceholder: 'SA A54...',
  previewNote: 'The label is always shown black on white, exactly as it will be printed, whatever the app theme.',
  scaleAria: 'Preview size'
}
