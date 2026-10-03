// New UI strings for the "layout" area (T003). Add keys here, never inline text in JSX.
// `en` is typed against `ar`, so both languages must define every key.
export const layoutAr = {
  navAria: 'التنقل الرئيسي',
  scanInputAria: 'إدخال الباركود يدوياً',
  scannerStatusAria: 'حالة قارئ الباركود',
  dismissAlert: 'إغلاق التنبيه'
}

export const layoutEn: typeof layoutAr = {
  navAria: 'Main navigation',
  scanInputAria: 'Enter a barcode manually',
  scannerStatusAria: 'Barcode scanner status',
  dismissAlert: 'Dismiss alert'
}
