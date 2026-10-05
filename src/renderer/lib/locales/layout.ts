// UI strings for the "layout" area. Add keys here, never inline text in JSX.
// `en` is typed against `ar`, so both languages must define every key.
export const layoutAr = {
  navAria: 'التنقل الرئيسي',
  scanInputAria: 'إدخال الباركود يدوياً',
  scannerStatusAria: 'حالة قارئ الباركود',
  dismissAlert: 'إغلاق التنبيه',
  backupStale: 'لم تُحفظ نسخة احتياطية منذ أكثر من 3 أيام. بياناتك غير محمية إن تلف الجهاز.',
  backupUnavailable: 'مجلد النسخ الاحتياطي غير متاح ({dir}): لا تُحفظ نسخ حالياً. صِل الفلاشة أو اختر مجلداً آخر.',
  backupOpenSettings: 'إعدادات النسخ'
}

export const layoutEn: typeof layoutAr = {
  navAria: 'Main navigation',
  scanInputAria: 'Enter a barcode manually',
  scannerStatusAria: 'Barcode scanner status',
  dismissAlert: 'Dismiss alert',
  backupStale: 'No backup was saved for more than 3 days. Your data is not protected if this computer fails.',
  backupUnavailable:
    'The backup folder is not available ({dir}): no backups are being saved. Connect the USB drive or choose another folder.',
  backupOpenSettings: 'Backup settings'
}
