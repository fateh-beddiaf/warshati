// UI strings for the "settings" area. Add keys here, never inline text in JSX.
// `en` is typed against `ar`, so both languages must define every key.
export const settingsAr = {
  loadFailed: 'فشل في تحميل بيانات الإعدادات',
  unexpectedError: 'خطأ غير متوقع',
  tabsLabel: 'أقسام الإعدادات',
  deleteDialog: {
    title: 'تأكيد الحذف',
    description: 'هل أنت متأكد من حذف "{name}"؟ لا يمكن التراجع عن هذا الإجراء.'
  },
  msg: {
    categoryAdded: 'تمت إضافة تصنيف العطل بنجاح',
    categoryUpdated: 'تم تعديل تصنيف العطل ونسبة الأرباح بنجاح',
    categoryAddFailed: 'فشل الإضافة',
    categoryUpdateFailed: 'فشل التعديل',
    categoryDeleted: 'تم حذف التصنيف بنجاح',
    brandAdded: 'تمت إضافة الماركة بنجاح',
    brandUpdated: 'تم تعديل اسم الماركة بنجاح',
    brandAddFailed: 'فشل إضافة الماركة',
    brandUpdateFailed: 'فشل تعديل الماركة',
    brandDeleted: 'تم حذف الماركة بنجاح',
    modelAdded: 'تمت إضافة الموديل بنجاح',
    modelUpdated: 'تم تعديل الموديل بنجاح',
    modelAddFailed: 'فشل إضافة الموديل',
    modelUpdateFailed: 'فشل تعديل الموديل',
    modelDeleted: 'تم حذف الموديل بنجاح',
    accessoryAdded: 'تمت إضافة الملحق بنجاح',
    accessoryUpdated: 'تم تعديل الملحق بنجاح',
    accessoryAddFailed: 'فشل إضافة الملحق',
    accessoryUpdateFailed: 'فشل تعديل الملحق',
    accessoryDeleted: 'تم حذف الملحق بنجاح',
    technicianAdded: 'تمت إضافة الفني بنجاح',
    technicianUpdated: 'تم تعديل اسم الفني بنجاح',
    technicianAddFailed: 'فشل إضافة الفني',
    technicianUpdateFailed: 'فشل تعديل الفني',
    technicianDeleted: 'تم حذف الفني بنجاح',
    exportFailed: 'فشل تصدير النسخة الاحتياطية',
    exportError: 'فشل التصدير',
    importFailed: 'فشل استيراد قاعدة البيانات',
    importError: 'فشل الاستيراد',
    preferencesFailed: 'فشل حفظ التفضيلات'
  },
  categories: {
    splitSummary: '{owner}% لي / {partner}% للشريك',
    previewOwner: 'حصتي: {amount} {currency}',
    previewPartner: 'حصة الشريك: {amount} {currency}',
    emptyTitle: 'لا توجد تصنيفات بعد',
    emptyDescription: 'أضف أول تصنيف عطل وحدد نسبة الأرباح الافتراضية له.'
  },
  brands: {
    emptyTitle: 'لا توجد ماركات بعد',
    emptyDescription: 'أضف أول ماركة لتتمكن من إدارة موديلاتها.'
  },
  models: {
    noMatch: 'لا توجد موديلات مطابقة',
    emptyTitle: 'لا توجد موديلات لهذه الماركة بعد',
    emptyDescription: 'أضف موديلاً ليظهر في قائمة الاقتراحات عند إنشاء التذاكر.'
  },
  accessories: {
    emptyTitle: 'لا توجد ملحقات بعد',
    emptyDescription: 'أضف الملحقات التي يتركها الزبائن مع أجهزتهم عادة.'
  },
  technicians: {
    certified: 'فني معتمد',
    emptyTitle: 'لا يوجد فنيون بعد',
    emptyDescription: 'أضف فنياً لإسناد تذاكر الصيانة إليه.'
  },
  backup: {
    exporting: 'جاري التصدير...',
    importing: 'جاري الاستيراد...'
  },
  preferences: {
    languageCardTitle: 'اللغة',
    languageCardDescription: 'اختر لغة واجهة التطبيق واتجاه العرض',
    overdueCardTitle: 'تنبيه التذاكر المتأخرة',
    overdueCardDescription: 'حدد بعد كم يوم تُعتبر التذكرة الجاهزة متأخرة'
  },
  labelPrinter: {
    title: 'طابعة الملصقات',
    description:
      'تُختار تلقائياً في نافذة الطباعة. يحفظها البرنامج عند كل طباعة ملصق ناجحة، ويمكنك اختيارها أو مسحها هنا.',
    selectLabel: 'الطابعة',
    none: 'لا شيء: استخدم الطابعة الافتراضية للنظام',
    notInstalled: '{name} (غير موجودة الآن)',
    notInstalledHelp: 'هذه الطابعة غير مثبتة حالياً: ستُختار الطابعة الافتراضية للنظام إلى أن تعود.',
    clear: 'مسح',
    saved: 'تم حفظ طابعة الملصقات',
    cleared: 'تم مسح طابعة الملصقات: ستُستخدم الطابعة الافتراضية',
    saveFailed: 'فشل حفظ طابعة الملصقات'
  },
  scannerTest: {
    title: 'اختبار القارئ',
    description: 'امسح أي باركود هنا لترى ما يرسله القارئ بالضبط، وهل يتعرّف عليه البرنامج كمسح.',
    inputLabel: 'حقل الاختبار',
    inputPlaceholder: 'ضع المؤشر هنا ثم امسح باركوداً...',
    waiting: 'لم يُمسح شيء بعد.',
    chars: 'الأحرف كما وصلت',
    readAs: 'كما يقرؤها البرنامج',
    keyCodes: 'رموز المفاتيح (e.code)',
    interval: 'متوسط الفاصل الزمني',
    intervalValue: '{ms} ms بين المفاتيح ({count} مفتاح)',
    suffix: 'اللاحقة',
    noSuffix: 'لا شيء',
    verdict: 'النتيجة',
    verdictOk: 'يُعرف كمسح',
    verdictSlow: 'أبطأ من القارئ (الحد {max} ms): سيُعامل ككتابة يدوية',
    verdictShort: 'أقصر من {min} أحرف: لا يُعامل كمسح',
    verdictNoSuffix: 'لم يرسل القارئ Enter أو Tab في النهاية: اضبطه ليضيف Enter بعد كل مسح',
    ticketCode: 'رمز تذكرة: يفتح التذكرة من أي مكان',
    otherCode: 'ليس رمز تذكرة (باركود منتج مثلاً): يظهر في صندوق المسح خارج الحقول، ويبقى في الحقل إن كان المؤشر داخله'
  }
}

export const settingsEn: typeof settingsAr = {
  loadFailed: 'Failed to load settings data',
  unexpectedError: 'Unexpected error',
  tabsLabel: 'Settings sections',
  deleteDialog: {
    title: 'Confirm deletion',
    description: 'Are you sure you want to delete "{name}"? This action cannot be undone.'
  },
  msg: {
    categoryAdded: 'Repair category added successfully',
    categoryUpdated: 'Repair category and profit split updated successfully',
    categoryAddFailed: 'Failed to add',
    categoryUpdateFailed: 'Failed to update',
    categoryDeleted: 'Category deleted successfully',
    brandAdded: 'Brand added successfully',
    brandUpdated: 'Brand name updated successfully',
    brandAddFailed: 'Failed to add brand',
    brandUpdateFailed: 'Failed to update brand',
    brandDeleted: 'Brand deleted successfully',
    modelAdded: 'Model added successfully',
    modelUpdated: 'Model updated successfully',
    modelAddFailed: 'Failed to add model',
    modelUpdateFailed: 'Failed to update model',
    modelDeleted: 'Model deleted successfully',
    accessoryAdded: 'Accessory added successfully',
    accessoryUpdated: 'Accessory updated successfully',
    accessoryAddFailed: 'Failed to add accessory',
    accessoryUpdateFailed: 'Failed to update accessory',
    accessoryDeleted: 'Accessory deleted successfully',
    technicianAdded: 'Technician added successfully',
    technicianUpdated: 'Technician name updated successfully',
    technicianAddFailed: 'Failed to add technician',
    technicianUpdateFailed: 'Failed to update technician',
    technicianDeleted: 'Technician deleted successfully',
    exportFailed: 'Failed to export the backup',
    exportError: 'Export failed',
    importFailed: 'Failed to import the database',
    importError: 'Import failed',
    preferencesFailed: 'Failed to save preferences'
  },
  categories: {
    splitSummary: '{owner}% me / {partner}% partner',
    previewOwner: 'My share: {amount} {currency}',
    previewPartner: 'Partner share: {amount} {currency}',
    emptyTitle: 'No categories yet',
    emptyDescription: 'Add your first repair category and set its default profit split.'
  },
  brands: {
    emptyTitle: 'No brands yet',
    emptyDescription: 'Add your first brand to start managing its models.'
  },
  models: {
    noMatch: 'No matching models',
    emptyTitle: 'No models for this brand yet',
    emptyDescription: 'Add a model so it shows up in suggestions when creating tickets.'
  },
  accessories: {
    emptyTitle: 'No accessories yet',
    emptyDescription: 'Add the accessories customers usually leave with their devices.'
  },
  technicians: {
    certified: 'Certified technician',
    emptyTitle: 'No technicians yet',
    emptyDescription: 'Add a technician to assign repair tickets to.'
  },
  backup: {
    exporting: 'Exporting...',
    importing: 'Importing...'
  },
  preferences: {
    languageCardTitle: 'Language',
    languageCardDescription: 'Choose the app language and text direction',
    overdueCardTitle: 'Overdue ticket alert',
    overdueCardDescription: 'Set after how many days a ready ticket counts as overdue'
  },
  labelPrinter: {
    title: 'Label printer',
    description:
      'Preselected in the print dialog. The app remembers it after every successful label print; choose or clear it here.',
    selectLabel: 'Printer',
    none: 'None: use the system default printer',
    notInstalled: '{name} (not installed now)',
    notInstalledHelp: 'This printer is not installed right now: the system default printer is used until it is back.',
    clear: 'Clear',
    saved: 'Label printer saved',
    cleared: 'Label printer cleared: the default printer will be used',
    saveFailed: 'Failed to save the label printer'
  },
  scannerTest: {
    title: 'Test the reader',
    description: 'Scan any barcode here to see exactly what the reader sends and whether the app takes it as a scan.',
    inputLabel: 'Test field',
    inputPlaceholder: 'Click here, then scan a barcode...',
    waiting: 'Nothing scanned yet.',
    chars: 'Characters received',
    readAs: 'As the app reads them',
    keyCodes: 'Key codes (e.code)',
    interval: 'Average key interval',
    intervalValue: '{ms} ms between keys ({count} keys)',
    suffix: 'Suffix',
    noSuffix: 'none',
    verdict: 'Result',
    verdictOk: 'Recognised as a scan',
    verdictSlow: 'Slower than a reader (limit {max} ms): treated as typing',
    verdictShort: 'Shorter than {min} characters: not a scan',
    verdictNoSuffix: 'The reader sent no Enter or Tab at the end: configure it to add Enter after each scan',
    ticketCode: 'A ticket code: opens the ticket from anywhere',
    otherCode:
      'Not a ticket code (e.g. a product barcode): shown in the scan box outside fields, left in the field when typing in one'
  }
}
