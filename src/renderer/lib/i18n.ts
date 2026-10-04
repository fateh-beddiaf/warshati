import * as React from 'react'
import { createContext, useContext, useState, useEffect } from 'react'
import { setUiLanguage } from './utils'
import { layoutAr, layoutEn } from './locales/layout'
import { ticketsAr, ticketsEn } from './locales/tickets'
import { newTicketAr, newTicketEn } from './locales/newTicket'
import { detailsAr, detailsEn } from './locales/details'
import { reportsAr, reportsEn } from './locales/reports'
import { settingsAr, settingsEn } from './locales/settings'
import { partsCostAr, partsCostEn } from './locales/partsCost'

export type Language = 'ar' | 'en'

export const ar = {
  // New T003 strings, one namespace per area: t.ui.layout.x, t.ui.tickets.x, ...
  ui: {
    layout: layoutAr,
    tickets: ticketsAr,
    newTicket: newTicketAr,
    details: detailsAr,
    reports: reportsAr,
    settings: settingsAr,
    partsCost: partsCostAr
  },
  common: {
    save: 'حفظ',
    saving: 'جاري الحفظ...',
    cancel: 'إلغاء',
    delete: 'حذف',
    deleting: 'جاري الحذف...',
    edit: 'تعديل',
    add: 'إضافة',
    close: 'إغلاق',
    confirm: 'تأكيد',
    warning: 'تنبيه',
    error: 'خطأ',
    success: 'نجاح',
    actions: 'الإجراءات',
    search: 'بحث...',
    all: 'الكل',
    yes: 'نعم',
    no: 'لا',
    currency: 'د.ج',
    days: 'أيام',
    status: 'الحالة',
    details: 'التفاصيل',
    loading: 'جاري التحميل...'
  },
  app: {
    title: 'ورشتي',
    subtitle: 'إدارة محل تصليح الهواتف',
    statusOnline: 'متصل محلياً'
  },
  nav: {
    ticketsList: 'قائمة التذاكر',
    newTicket: 'تذكرة جديدة',
    reports: 'التقارير المالية',
    settings: 'الإعدادات'
  },
  theme: {
    label: 'المظهر',
    light: 'فاتح',
    dark: 'مظلم',
    system: 'حسب النظام',
    toggle: 'تبديل المظهر',
    description: 'اختر مظهر التطبيق: فاتح أو مظلم أو حسب إعدادات النظام'
  },
  newTicket: {
    title: 'إنشاء تذكرة صيانة جديدة',
    subtitle: 'أدخل بيانات الزبون والجهاز وتفاصيل العطل لحفظ التذكرة فوراً',
    customerSection: 'بيانات الزبون',
    searchCustomerPlaceholder: 'ابحث بالاسم أو رقم الهاتف أو أضف جديداً...',
    customerName: 'اسم الزبون',
    customerPhone: 'رقم الهاتف',
    customerNotes: 'ملاحظات الزبون (اختياري)',
    namePlaceholder: 'مثال: كريم بن يوسف',
    phonePlaceholder: '05 / 06 / 07...',
    notesPlaceholder: 'أي ملاحظات خاصة بالزبون...',
    newCustomerBadge: 'زبون جديد',
    existingCustomerBadge: 'زبون مسجل',
    phoneMatches: 'زبائن مسجلون بنفس الرقم:',

    deviceSection: 'بيانات الجهاز',
    brand: 'الماركة',
    selectBrand: 'اختر الماركة...',
    model: 'الموديل',
    selectModel: 'اختر الموديل أو اكتب...',
    shortLabel: 'المسمى المختصر (للملصق)',
    shortLabelPlaceholder: 'مثال: SA A54',
    shortLabelHint: 'يتم توليده تلقائياً من الماركة والموديل ويمكن تعديله',

    repairSection: 'تفاصيل العطل والمالية',
    repairCategory: 'نوع العطل',
    selectCategory: 'اختر نوع العطل...',
    price: 'سعر الإصلاح الإجمالي (د.ج)',
    amountPaid: 'المبلغ المدفوع / العربون (د.ج)',
    amountRemaining: 'المبلغ المتبقي (د.ج)',
    paymentType: 'طريقة الدفع',
    paymentCash: 'نقداً',
    paymentCredit: 'آجل / دين',
    technician: 'الفني المسؤول',
    technicianMe: 'أنا',
    technicianPartner: 'الشريك',

    accessoriesSection: 'الملحقات المستلمة مع الجهاز',

    submitButton: 'حفظ التذكرة',
    submittingButton: 'جاري الحفظ...',
    successTitle: 'تم حفظ التذكرة بنجاح',
    successBarcode: 'رقم الباركود:',
    errorTitle: 'خطأ في حفظ التذكرة',
    requiredFieldsError: 'يرجى ملء جميع الحقول الإلزامية (اسم الزبون، الهاتف، الماركة، الموديل، والتصنيف)'
  },
  status: {
    in_progress: 'قيد الإصلاح',
    ready: 'جاهز للتسليم',
    delivered: 'تم التسليم'
  },
  lifecycle: {
    statusActionTitle: 'تحديث حالة التذكرة',
    markReady: 'نقل إلى: جاهز للتسليم',
    markDelivered: 'تسليم الجهاز للزبون',
    revertToInProgress: 'تراجع إلى: قيد الإصلاح',
    revertToReady: 'تراجع إلى: جاهز للتسليم',
    confirmStatusChange: 'تأكيد تغيير الحالة',
    confirmDeliveryTitle: 'تسليم الجهاز وتسوية الحساب',
    deliveryRemainingNotice: 'يوجد مبلغ متبقي على التذكرة:',
    settleFullChoice: 'سداد كامل المبلغ المتبقي نقداً الآن (خالص)',
    settlePartialChoice: 'سداد دفعة جزئية إضافية',
    creditChoice: 'تسليم كـ دين / آجل (يسدد لاحقاً)',
    additionalPaidLabel: 'المبلغ الإضافي المدفوع الآن:',
    finalRemainingLabel: 'المتبقي النهائي بعد التسليم:',
    confirmDeliveryButton: 'تأكيد التسليم وحفظ السجل',
    updatingStatus: 'جاري تحديث الحالة...',
    statusUpdateSuccess: 'تم تحديث حالة التذكرة وحفظ السجل بنجاح',
    invalidAdditionalAmount: 'المبلغ الإضافي المدفوع غير صالح: أدخل رقماً أكبر من أو يساوي صفر.',
    recordPaymentTitle: 'تسجيل دفعة على الدين',
    recordPaymentLabel: 'مبلغ الدفعة (د.ج):',
    recordPaymentPlaceholder: 'أدخل مبلغ الدفعة...',
    recordPaymentButton: 'تسجيل الدفعة',
    recordPaymentSaving: 'جاري تسجيل الدفعة...',
    recordPaymentSuccess: 'تم تسجيل الدفعة بنجاح',
    recordPaymentInvalid: 'مبلغ الدفعة يجب أن يكون رقماً أكبر من صفر.',
    recordPaymentTooMuch: 'مبلغ الدفعة لا يمكن أن يتجاوز المبلغ المتبقي ({remaining}).',
    recordPaymentFailed: 'فشل تسجيل الدفعة',
    overdueWarningTitle: 'تنبيه: جهاز متأخر عن الاستلام',
    overdueWarningDesc: 'هذا الجهاز جاهز منذ {days} أيام ولم يستلمه الزبون بعد.',
    overdueBadge: 'متأخر {days} أيام',
    thresholdSettingsLabel: 'عتبة تنبيه التأخر (بالأيام):',
    daysCount: '{count} يوم'
  },
  profit: {
    splitBreakdownTitle: 'توزيع الأرباح الصافية لهذه التذكرة',
    splitBreakdownDesc: 'يتم احتساب نصيب كل طرف تلقائياً وفق القاعدة المعتمدة:',
    partnerExclusiveBadge: 'قاعدة الشريك (100% للشريك)',
    ownerShareLabel: 'حصتي (صاحب الورشة)',
    partnerShareLabel: 'حصة الشريك',
    totalTicketPrice: 'المبلغ الإجمالي:',
    categorySplitNote: 'نسبة التصنيف ({mySplit}% لي / {partnerSplit}% للشريك)'
  },
  reports: {
    title: 'التقارير المالية وحساب الأرباح',
    subtitle: 'متابعة الدخل وتوزيع الأرباح وحسابات الشركاء والديون بدقة',
    periodFilter: 'الفترة الزمنية:',
    today: 'اليوم',
    thisWeek: 'هذا الأسبوع',
    thisMonth: 'هذا الشهر',
    custom: 'فترة مخصصة',
    allTime: 'جميع الأوقات',
    from: 'من تاريخ:',
    to: 'إلى تاريخ:',
    applyFilter: 'تطبيق الفلتر',
    filterByTechnician: 'الفني:',
    filterByCategory: 'نوع العطل:',
    allTechnicians: 'جميع الفنيين',
    allCategories: 'جميع التصنيفات',
    
    kpi: {
      totalRevenue: 'إجمالي الدخل المحقق',
      totalRevenueDesc: 'مجموع أسعار التذاكر المسلّمة',
      myTotalShare: 'صافي أرباحي (حصتي)',
      myTotalShareDesc: 'مستحقات صاحب الورشة',
      partnerTotalShare: 'صافي أرباح الشريك',
      partnerTotalShareDesc: 'مستحقات الشريك الفني',
      outstandingDebt: 'الديون المتبقية (الآجل)',
      outstandingDebtDesc: 'مبالغ غير محصلة على أجهزة مستلمة',
      completedCount: 'أجهزة مسلّمة',
      inProgressCount: 'قيد الصيانة',
      readyCount: 'جاهزة للتسليم'
    },
    techniciansSection: 'توزيع الدخل والأرباح حسب الفني',
    categoriesSection: 'توزيع الإيرادات حسب نوع العطل',
    ticketsLedgerSection: 'سجل التذاكر المسلّمة وتفصيل الحصص',
    table: {
      ticketNumber: 'رقم / باركود',
      customer: 'الزبون',
      device: 'الجهاز',
      category: 'نوع العطل',
      technician: 'الفني المسؤول',
      price: 'السعر الإجمالي',
      myShare: 'حصتي',
      partnerShare: 'حصة الشريك',
      paymentStatus: 'حالة الدفع',
      date: 'تاريخ التسليم / الإنشاء'
    },
    emptyReports: 'لا توجد بيانات مالية مسجلة لهذه الفترة',
    emptyReportsSubtitle: 'قم بتغيير نطاق التاريخ أو تسليم تذاكر لعرض تقاريرها المالية',
    loadError: 'تعذّر تحميل التقرير المالي. حاول مرة أخرى أو غيّر نطاق التاريخ.'
  },
  ticketsList: {
    title: 'قائمة تذاكر الصيانة',
    subtitle: 'متابعة وإدارة جميع أجهزة المحل وحالاتها',
    searchPlaceholder: 'بحث باسم الزبون، رقم الهاتف، الباركود، أو الموديل...',
    filterAll: 'جميع الحالات',
    filterInProgress: 'قيد الإصلاح',
    filterReady: 'جاهز للتسليم',
    filterDelivered: 'تم التسليم',
    filterOverdue: 'متأخرة عن الاستلام',
    totalTickets: 'إجمالي التذاكر:',
    overdueAlertCard: 'توجد {count} أجهزة جاهزة تجاوزت مدة الاستلام المحددة ({threshold} أيام)',
    emptyTitle: 'لا توجد تذاكر حالياً',
    emptySubtitle: 'قم بإنشاء أول تذكرة بالضغط على "تذكرة جديدة"',
    table: {
      ticketNumber: 'رقم / باركود',
      customer: 'الزبون',
      device: 'الجهاز',
      category: 'نوع العطل',
      price: 'السعر',
      remaining: 'المتبقي',
      technician: 'الفني',
      status: 'الحالة',
      createdAt: 'التاريخ'
    }
  },
  print: {
    modalTitle: 'معاينة وطباعة الملصق (…40×20mm⁩)',
    modalSubtitle: 'معاينة الملصق بدقة قبل إرساله إلى طابعة الملصقات الحرارية',
    actualSizeToggle: 'الحجم الفعلي (1:1)',
    zoomedToggle: 'معاينة مكبّرة',
    shortLabelLabel: 'المسمى المختصر على الملصق:',
    showPhoneLabel: 'إظهار رقم الهاتف على الملصق',
    selectPrinter: 'طابعة الملصقات (Xprinter):',
    defaultPrinter: 'الطابعة الافتراضية للنظام',
    printButton: 'طباعة الملصق الآن',
    printingButton: 'جاري الإرسال للطابعة...',
    printSuccess: 'تم إرسال الملصق للطباعة بنجاح',
    printError: 'فشل في إرسال أمر الطباعة',
    barcodeError: 'تعذّر إنشاء رمز الباركود لهذه التذكرة، تم تعطيل الطباعة.',
    reprintButton: 'إعادة طباعة الملصق',
    previewBadge: 'أبعاد الملصق 40×20 ملم'
  },
  scanner: {
    readyBadge: 'قارئ الباركود (Henex) نشط',
    scanningPrompt: 'وجّه قارئ الباركود على أي ملصق لفتح التذكرة فوراً',
    ticketNotFound: 'لم يتم العثور على تذكرة مطابقة لهذا الباركود',
    simulateInputPlaceholder: 'محاكاة مسح باركود (WSH...)...',
    simulateButton: 'مسح'
  },
  ticketDetails: {
    title: 'تفاصيل تذكرة الصيانة',
    customerInfo: 'بيانات الزبون',
    deviceInfo: 'بيانات الجهاز والملحقات',
    repairInfo: 'العطل والبيانات المالية',
    statusHistory: 'سجل تغيير الحالة الزمني',
    closeButton: 'إغلاق',
    printLabelButton: 'طباعة / إعادة طباعة الملصق',
    ticketCode: 'كود التذكرة (الباركود):',
    brandAndModel: 'الماركة والموديل:',
    shortLabel: 'المسمى المختصر:',
    accessories: 'الملحقات المستلمة:',
    noAccessories: 'بدون ملحقات',
    price: 'السعر الإجمالي:',
    amountPaid: 'المدفوع (العربون):',
    amountRemaining: 'المتبقي:',
    paymentType: 'طريقة الدفع:',
    technician: 'الفني المسؤول:',
    category: 'نوع العطل:',
    createdAt: 'تاريخ الإنشاء:',
    status: 'الحالة الحالية:'
  },
  settings: {
    title: 'إعدادات النظام والبيانات',
    subtitle: 'إدارة الماركات، الموديلات، التصنيفات ونسب الأرباح، النسخ الاحتياطي، واللغة',
    tabs: {
      categories: 'تصنيفات الأعطال والنسب',
      brandsModels: 'الماركات والموديلات',
      accessories: 'الملحقات المستلمة',
      technicians: 'فريق العمل / الفنيين',
      backup: 'النسخ الاحتياطي والبيانات',
      preferences: 'التفضيلات واللغة'
    },
    categories: {
      title: 'تصنيفات الأعطال ونسب الأرباح الافتراضية',
      description: 'حدد النسبة المئوية المخصصة لصاحب الورشة من كل تصنيف (تحسب تلقائياً عند تسليم التذكرة)',
      addCategory: 'إضافة تصنيف جديد',
      categoryName: 'اسم التصنيف',
      categoryNamePlaceholder: 'مثال: تبديل شاشة أصلية',
      splitPercentage: 'نسبة صاحب الورشة (%)',
      ownerShare: 'حصتي: {percent}%',
      partnerShare: 'حصة الشريك: {percent}%',
      preview: 'معاينة تقسيم الربح لتذكرة بـ 10,000 د.ج:',
      deleteGuardWarning: 'لا يمكن حذف هذا التصنيف لأنه مرتبط بتذاكر سابقة. يمكنك تعديل اسمه أو نسبته بدلاً من ذلك.'
    },
    brands: {
      title: 'إدارة الماركات المصنعة',
      description: 'إضافة وتعديل الماركات المتاحة في القائمة المنسدلة للتذاكر',
      addBrand: 'إضافة ماركة جديدة',
      brandName: 'اسم الماركة',
      brandNamePlaceholder: 'مثال: Google Pixel',
      modelsCount: '{count} موديل',
      deleteGuardWarning: 'لا يمكن حذف هذه الماركة لأنها مرتبطة بتذاكر مسجلة أو تحوي موديلات.'
    },
    models: {
      title: 'موديلات ماركة: {brand}',
      description: 'إدارة الموديلات التابعة لهذه الماركة',
      addModel: 'إضافة موديل لـ {brand}',
      modelName: 'اسم الموديل',
      modelNamePlaceholder: 'مثال: Pixel 8 Pro',
      selectBrandPrompt: 'اختر ماركة من القائمة لعرض وإدارة موديلاتها',
      deleteGuardWarning: 'لا يمكن حذف هذا الموديل لأنه مسجل في تذاكر صيانة سابقة.'
    },
    accessories: {
      title: 'أزرار الملحقات السريعة (Chips)',
      description: 'الملحقات التي تظهر في شاشة إنشاء التذكرة لتوثيق استلامها بنقرة واحدة',
      addAccessory: 'إضافة ملحق جديد',
      accessoryName: 'اسم الملحق',
      accessoryNamePlaceholder: 'مثال: قلم رقمي S-Pen',
      deleteGuardWarning: 'لا يمكن حذف هذا الملحق لأنه مرتبط بتذاكر سابقة.'
    },
    technicians: {
      title: 'الفنيون ومستخدمو الورشة',
      description: 'قائمة الفنيين المعتمدين لتسجيل وإسناد تذاكر الصيانة',
      addTechnician: 'إضافة فني جديد',
      technicianName: 'اسم الفني',
      technicianNamePlaceholder: 'مثال: وليد (فني ثان)',
      deleteGuardWarning: 'لا يمكن حذف هذا الفني لأنه مسند إليه تذاكر سابقة.'
    },
    preferences: {
      title: 'التفضيلات العامة والتنبيهات',
      description: 'تخصيص لغة الواجهة وفترات التنبيه للتذاكر المتأخرة',
      languageLabel: 'لغة الواجهة (App Language):',
      languageArabic: 'العربية (Arabic - RTL)',
      languageEnglish: 'English (الإنجليزية - LTR)',
      overdueThresholdLabel: 'عتبة تنبيه التذاكر الجاهزة المتأخرة (بالأيام):',
      overdueThresholdHelp: 'التذاكر التي تبقى بحالة "جاهز للتسليم" أكثر من هذا العدد من الأيام ستظهر بعلامة تنبيه بارزة في القائمة.',
      savePreferences: 'حفظ التفضيلات',
      preferencesSaved: 'تم حفظ التفضيلات بنجاح'
    },
    backup: {
      title: 'النسخ الاحتياطي واستعادة البيانات',
      description: 'حماية وتصدير كامل قاعدة بيانات المحل محلياً لضمان عدم فقدان أي تذكرة أو تقرير مالي',
      databaseInfoTitle: 'معلومات قاعدة البيانات الحالية',
      databasePath: 'مسار الملف:',
      databaseSize: 'حجم البيانات:',
      lastModified: 'آخر تعديل:',
      exportButton: 'تصدير نسخة احتياطية (.db)',
      exportHelp: 'حفظ نسخة كاملة من قاعدة البيانات في مسار أو فلاشة USB من اختيارك.',
      importButton: 'استيراد واستعادة قاعدة البيانات (.db)',
      importHelp: 'استرجاع البيانات من ملف نسخة احتياطية تم تصديره مسبقاً.',
      exportSuccess: 'تم تصدير النسخة الاحتياطية بنجاح إلى: {path}',
      importConfirmTitle: 'تأكيد استيراد واستعادة قاعدة البيانات',
      importConfirmDesc: 'تنبيه هام: استيراد ملف جديد سيقوم باستبدال قاعدة البيانات الحالية بالكامل بالبيانات المستوردة. سيتم أخذ نسخة احتياطية صامتة تلقائياً قبل الاستبدال.',
      importSuccess: 'تمت استعادة قاعدة البيانات بنجاح وتحديث كافة السجلات.',
      safetyBackupNotice: 'تم حفظ نسخة احتياطية تلقائية من بياناتك السابقة في: {path}'
    }
  },
  deleteTicket: {
    buttonLabel: 'حذف التذكرة',
    modalTitle: 'حذف تذكرة الصيانة نهائياً',
    step1Title: 'الخطوة 1 من 3: مراجعة بيانات التذكرة',
    step1Warning: 'أنت على وشك بدء إجراء حذف نهائي لهذه التذكرة من النظام.',
    step1DetailsTitle: 'تفاصيل التذكرة المراد حذفها:',
    step1Device: 'الجهاز:',
    step1Customer: 'الزبون:',
    step1Barcode: 'رقم الباركود:',
    step1Status: 'الحالة:',
    step1Price: 'السعر الإجمالي:',
    step1Notice: 'سيتم حذف التذكرة وكافة سجلاتها وفحوصاتها وملحقاتها. هل ترغب بالمتابعة؟',
    nextToStep2: 'متابعة إلى الخطوة التالية',
    step2Title: 'الخطوة 2 من 3: الأثر المالي والتقارير',
    step2WarningBadge: 'تنبيه مالي وإداري حرج',
    step2FinancialNotice: 'حذف هذه التذكرة سيؤدي إلى شطب كافة أرقامها ومستحقاتها المالية (المبالغ المدفوعة، حصص الأرباح، والديون) من التقارير المالية ومؤشرات الأداء التاريخية واللاحقة نهائياً.',
    step2CustomerCleanupNotice: 'ملاحظة: إذا كانت هذه هي التذكرة الوحيدة للزبون، فسيتم تنظيف وحذف سجل الزبون تلقائياً وبصمت لعدم وجود سجلات أخرى له.',
    step2IrreversibleNotice: 'هذا الإجراء نهائي ولا يمكن التراجع عنه بأي شكل من الأشكال.',
    nextToStep3: 'أقر بالآثار المالية وأريد المتابعة',
    step3Title: 'الخطوة 3 من 3: التأكيد النهائي بالكتابة',
    step3Instruction: 'لتأكيد الحذف النهائي، يرجى كتابة كود الباركود للتذكرة أدناه تماماً:',
    step3Placeholder: 'اكتب كود الباركود هنا للتأكيد...',
    step3BarcodeMismatch: 'الكود المدخل لا يطابق كود الباركود للتذكرة',
    confirmDeleteButton: 'تأكيد الحذف النهائي والشامل',
    deletingButton: 'جاري الحذف...',
    deleteSuccess: 'تم حذف التذكرة وسجلاتها بنجاح',
    deleteError: 'فشل حذف التذكرة',
    cancel: 'إلغاء'
  }
}



export const en: typeof ar = {
  ui: {
    layout: layoutEn,
    tickets: ticketsEn,
    newTicket: newTicketEn,
    details: detailsEn,
    reports: reportsEn,
    settings: settingsEn,
    partsCost: partsCostEn
  },
  common: {
    save: 'Save',
    saving: 'Saving...',
    cancel: 'Cancel',
    delete: 'Delete',
    deleting: 'Deleting...',
    edit: 'Edit',
    add: 'Add',
    close: 'Close',
    confirm: 'Confirm',
    warning: 'Warning',
    error: 'Error',
    success: 'Success',
    actions: 'Actions',
    search: 'Search...',
    all: 'All',
    yes: 'Yes',
    no: 'No',
    currency: 'DZD',
    days: 'days',
    status: 'Status',
    details: 'Details',
    loading: 'Loading...'
  },
  app: {
    title: 'Warshati',
    subtitle: 'Phone Repair Shop Management',
    statusOnline: 'Local Database Online'
  },
  nav: {
    ticketsList: 'Tickets List',
    newTicket: 'New Ticket',
    reports: 'Financial Reports',
    settings: 'Settings'
  },
  theme: {
    label: 'Appearance',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    toggle: 'Toggle theme',
    description: 'Choose the app appearance: light, dark, or follow the system setting'
  },
  newTicket: {
    title: 'Create New Repair Ticket',
    subtitle: 'Enter customer, device, and repair details to immediately save the ticket',
    customerSection: 'Customer Information',
    searchCustomerPlaceholder: 'Search by name, phone number, or add new...',
    customerName: 'Customer Name',
    customerPhone: 'Phone Number',
    customerNotes: 'Customer Notes (Optional)',
    namePlaceholder: 'e.g. Karim Benyoussef',
    phonePlaceholder: '05 / 06 / 07...',
    notesPlaceholder: 'Any specific notes about the customer...',
    newCustomerBadge: 'New Customer',
    existingCustomerBadge: 'Registered Customer',
    phoneMatches: 'Registered customers with this number:',

    deviceSection: 'Device Information',
    brand: 'Brand',
    selectBrand: 'Select Brand...',
    model: 'Model',
    selectModel: 'Select Model or Type...',
    shortLabel: 'Short Label (for sticker)',
    shortLabelPlaceholder: 'e.g. SA A54',
    shortLabelHint: 'Auto-generated from Brand & Model, editable before printing',

    repairSection: 'Repair & Financial Details',
    repairCategory: 'Repair Category',
    selectCategory: 'Select Category...',
    price: 'Total Repair Price (DZD)',
    amountPaid: 'Amount Paid / Deposit (DZD)',
    amountRemaining: 'Amount Remaining (DZD)',
    paymentType: 'Payment Method',
    paymentCash: 'Cash',
    paymentCredit: 'Credit / Due',
    technician: 'Assigned Technician',
    technicianMe: 'Me (Owner)',
    technicianPartner: 'Partner',

    accessoriesSection: 'Accessories Received with Device',

    submitButton: 'Save Ticket',
    submittingButton: 'Saving Ticket...',
    successTitle: 'Ticket Saved Successfully',
    successBarcode: 'Barcode Code:',
    errorTitle: 'Error Saving Ticket',
    requiredFieldsError: 'Please fill all required fields (Customer Name, Phone, Brand, Model, and Category)'
  },
  status: {
    in_progress: 'In Progress',
    ready: 'Ready for Pickup',
    delivered: 'Delivered'
  },
  lifecycle: {
    statusActionTitle: 'Update Ticket Status',
    markReady: 'Mark as: Ready for Pickup',
    markDelivered: 'Deliver Device to Customer',
    revertToInProgress: 'Revert to: In Progress',
    revertToReady: 'Revert to: Ready for Pickup',
    confirmStatusChange: 'Confirm Status Change',
    confirmDeliveryTitle: 'Deliver Device & Settle Payment',
    deliveryRemainingNotice: 'There is a remaining unpaid balance on this ticket:',
    settleFullChoice: 'Pay full remaining balance in cash now (Settled)',
    settlePartialChoice: 'Pay an additional partial payment',
    creditChoice: 'Deliver as Credit / Debt (to be paid later)',
    additionalPaidLabel: 'Additional Amount Paid Now:',
    finalRemainingLabel: 'Final Remaining Balance After Delivery:',
    confirmDeliveryButton: 'Confirm Delivery & Save Audit Log',
    updatingStatus: 'Updating Status...',
    statusUpdateSuccess: 'Ticket status updated and audit log saved successfully',
    invalidAdditionalAmount: 'The additional amount paid is invalid: enter a number greater than or equal to zero.',
    recordPaymentTitle: 'Record a debt payment',
    recordPaymentLabel: 'Payment amount (DZD):',
    recordPaymentPlaceholder: 'Enter payment amount...',
    recordPaymentButton: 'Record payment',
    recordPaymentSaving: 'Recording payment...',
    recordPaymentSuccess: 'Payment recorded successfully',
    recordPaymentInvalid: 'The payment amount must be a number greater than zero.',
    recordPaymentTooMuch: 'The payment cannot exceed the remaining balance ({remaining}).',
    recordPaymentFailed: 'Failed to record the payment',
    overdueWarningTitle: 'Alert: Overdue Ready Device',
    overdueWarningDesc: 'This device has been ready for {days} days and has not been picked up yet.',
    overdueBadge: 'Overdue {days} days',
    thresholdSettingsLabel: 'Overdue Alert Threshold (in days):',
    daysCount: '{count} day(s)'
  },
  profit: {
    splitBreakdownTitle: 'Net Profit Distribution for this Ticket',
    splitBreakdownDesc: 'Each party share is automatically computed according to the agreed formula:',
    partnerExclusiveBadge: 'Partner Rule (100% to Partner)',
    ownerShareLabel: 'My Share (Shop Owner)',
    partnerShareLabel: 'Partner Share',
    totalTicketPrice: 'Total Amount:',
    categorySplitNote: 'Category Split ({mySplit}% Owner / {partnerSplit}% Partner)'
  },
  reports: {
    title: 'Financial Reports & Profit Analytics',
    subtitle: 'Track shop revenue, profit shares, partner balances, and outstanding debt accurately',
    periodFilter: 'Time Period:',
    today: 'Today',
    thisWeek: 'This Week',
    thisMonth: 'This Month',
    custom: 'Custom Period',
    allTime: 'All Time',
    from: 'From Date:',
    to: 'To Date:',
    applyFilter: 'Apply Filter',
    filterByTechnician: 'Technician:',
    filterByCategory: 'Repair Category:',
    allTechnicians: 'All Technicians',
    allCategories: 'All Categories',

    kpi: {
      totalRevenue: 'Total Revenue',
      totalRevenueDesc: 'Sum of all delivered ticket prices',
      myTotalShare: 'My Net Profit (Owner Share)',
      myTotalShareDesc: 'Net earnings of shop owner',
      partnerTotalShare: 'Partner Net Profit',
      partnerTotalShareDesc: 'Net earnings of repair partner',
      outstandingDebt: 'Outstanding Debt (Credit)',
      outstandingDebtDesc: 'Uncollected balance on delivered devices',
      completedCount: 'Delivered Devices',
      inProgressCount: 'In Repair',
      readyCount: 'Ready for Pickup'
    },
    techniciansSection: 'Revenue & Profit Distribution by Technician',
    categoriesSection: 'Revenue Distribution by Repair Category',
    ticketsLedgerSection: 'Delivered Tickets Ledger & Split Breakdown',
    table: {
      ticketNumber: 'Ticket / Barcode',
      customer: 'Customer',
      device: 'Device',
      category: 'Category',
      technician: 'Technician',
      price: 'Total Price',
      myShare: 'My Share',
      partnerShare: 'Partner Share',
      paymentStatus: 'Payment Status',
      date: 'Delivered / Created Date'
    },
    emptyReports: 'No financial records found for this period',
    emptyReportsSubtitle: 'Change date range filter or deliver tickets to view financial reports',
    loadError: 'Could not load the financial report. Try again or change the date range.'
  },
  ticketsList: {
    title: 'Repair Tickets List',
    subtitle: 'Track and manage all shop devices and their statuses',
    searchPlaceholder: 'Search by customer name, phone, barcode, or device model...',
    filterAll: 'All Statuses',
    filterInProgress: 'In Progress',
    filterReady: 'Ready for Pickup',
    filterDelivered: 'Delivered',
    filterOverdue: 'Overdue for Pickup',
    totalTickets: 'Total Tickets:',
    overdueAlertCard: 'There are {count} ready devices exceeding the pickup threshold ({threshold} days)',
    emptyTitle: 'No tickets found',
    emptySubtitle: 'Create your first ticket by clicking "New Ticket"',
    table: {
      ticketNumber: 'Ticket / Barcode',
      customer: 'Customer',
      device: 'Device',
      category: 'Category',
      price: 'Price',
      remaining: 'Remaining',
      technician: 'Technician',
      status: 'Status',
      createdAt: 'Date'
    }
  },
  print: {
    modalTitle: 'Label Preview & Print (40×20mm)',
    modalSubtitle: 'Preview thermal sticker precisely before sending to label printer',
    actualSizeToggle: 'Actual Size (1:1)',
    zoomedToggle: 'Zoomed Preview',
    shortLabelLabel: 'Short Device Label on Sticker:',
    showPhoneLabel: 'Include Customer Phone Number',
    selectPrinter: 'Label Printer (Xprinter):',
    defaultPrinter: 'System Default Printer',
    printButton: 'Print Label Now',
    printingButton: 'Sending to Printer...',
    printSuccess: 'Label successfully sent to printer',
    printError: 'Failed to send print command',
    barcodeError: 'Could not generate the barcode for this ticket, printing is disabled.',
    reprintButton: 'Reprint Label',
    previewBadge: 'Sticker Dimensions 40×20 mm'
  },
  scanner: {
    readyBadge: 'Barcode Scanner (Henex) Active',
    scanningPrompt: 'Scan any ticket barcode sticker to open details immediately',
    ticketNotFound: 'No ticket found matching barcode',
    simulateInputPlaceholder: 'Simulate barcode scan (WSH...)...',
    simulateButton: 'Scan'
  },
  ticketDetails: {
    title: 'Repair Ticket Details',
    customerInfo: 'Customer Information',
    deviceInfo: 'Device & Accessories Information',
    repairInfo: 'Repair & Financial Information',
    statusHistory: 'Status Timeline & History',
    closeButton: 'Close',
    printLabelButton: 'Print / Reprint Label',
    ticketCode: 'Ticket Code (Barcode):',
    brandAndModel: 'Brand & Model:',
    shortLabel: 'Short Label:',
    accessories: 'Received Accessories:',
    noAccessories: 'No accessories',
    price: 'Total Price:',
    amountPaid: 'Paid (Deposit):',
    amountRemaining: 'Remaining Balance:',
    paymentType: 'Payment Method:',
    technician: 'Assigned Technician:',
    category: 'Repair Category:',
    createdAt: 'Created At:',
    status: 'Current Status:'
  },
  settings: {
    title: 'System Settings & Data Management',
    subtitle: 'Manage Brands, Models, Repair Categories & Profit Splits, Database Backup, and Language',
    tabs: {
      categories: 'Categories & Profit Splits',
      brandsModels: 'Brands & Models',
      accessories: 'Device Accessories',
      technicians: 'Technicians / Staff',
      backup: 'Backup & Data Management',
      preferences: 'Preferences & Language'
    },
    categories: {
      title: 'Repair Categories & Default Profit Splits',
      description: 'Set default owner percentage for each repair type (automatically computed upon delivery)',
      addCategory: 'Add New Category',
      categoryName: 'Category Name',
      categoryNamePlaceholder: 'e.g. Original Screen Replacement',
      splitPercentage: 'Owner Split Percentage (%)',
      ownerShare: 'My Share: {percent}%',
      partnerShare: 'Partner Share: {percent}%',
      preview: 'Profit split preview for 10,000 DZD ticket:',
      deleteGuardWarning: 'Cannot delete this category because it is used in existing tickets. You can edit its name or percentage instead.'
    },
    brands: {
      title: 'Device Brands Management',
      description: 'Add and edit brands available in ticket dropdown menus',
      addBrand: 'Add New Brand',
      brandName: 'Brand Name',
      brandNamePlaceholder: 'e.g. Google Pixel',
      modelsCount: '{count} models',
      deleteGuardWarning: 'Cannot delete this brand because it has associated tickets or models.'
    },
    models: {
      title: '{brand} Models',
      description: 'Manage models belonging to this brand',
      addModel: 'Add Model for {brand}',
      modelName: 'Model Name',
      modelNamePlaceholder: 'e.g. Pixel 8 Pro',
      selectBrandPrompt: 'Select a brand from the list to view and manage its models',
      deleteGuardWarning: 'Cannot delete this model because it is used in existing repair tickets.'
    },
    accessories: {
      title: 'Quick Accessory Chips',
      description: 'Accessories appearing in the new ticket screen for 1-click documentation',
      addAccessory: 'Add New Accessory',
      accessoryName: 'Accessory Name',
      accessoryNamePlaceholder: 'e.g. S-Pen Stylus',
      deleteGuardWarning: 'Cannot delete this accessory because it is referenced in existing tickets.'
    },
    technicians: {
      title: 'Technicians & Workshop Staff',
      description: 'Registered technicians for ticket assignments and revenue splitting',
      addTechnician: 'Add New Technician',
      technicianName: 'Technician Name',
      technicianNamePlaceholder: 'e.g. Walid (Technician)',
      deleteGuardWarning: 'Cannot delete this technician because they have assigned tickets in the system.'
    },
    preferences: {
      title: 'General Preferences & Alerts',
      description: 'Customize application language and overdue ticket pickup threshold',
      languageLabel: 'Application Language:',
      languageArabic: 'العربية (Arabic - RTL)',
      languageEnglish: 'English (LTR)',
      overdueThresholdLabel: 'Overdue Pickup Alert Threshold (Days):',
      overdueThresholdHelp: 'Ready tickets remaining uncollected longer than this threshold will be highlighted in the tickets list.',
      savePreferences: 'Save Preferences',
      preferencesSaved: 'Preferences saved successfully'
    },
    backup: {
      title: 'Database Backup & Restore',
      description: 'Safeguard and export the entire workshop database locally to prevent any data loss',
      databaseInfoTitle: 'Current Database Information',
      databasePath: 'File Path:',
      databaseSize: 'Data Size:',
      lastModified: 'Last Modified:',
      exportButton: 'Export Backup (.db)',
      exportHelp: 'Save a complete SQLite snapshot to any folder or USB flash drive of your choice.',
      importButton: 'Import & Restore Database (.db)',
      importHelp: 'Restore all data from a previously exported backup file.',
      exportSuccess: 'Backup exported successfully to: {path}',
      importConfirmTitle: 'Confirm Database Restore',
      importConfirmDesc: 'Important: Importing a backup will completely replace the current database with the imported data. A silent safety auto-backup will be taken before replacement.',
      importSuccess: 'Database restored successfully and all records refreshed.',
      safetyBackupNotice: 'A silent safety backup of your previous database was saved to: {path}'
    }
  },
  deleteTicket: {
    buttonLabel: 'Delete Ticket',
    modalTitle: 'Permanently Delete Repair Ticket',
    step1Title: 'Step 1 of 3: Review Ticket Details',
    step1Warning: 'You are about to start a permanent deletion of this ticket from the system.',
    step1DetailsTitle: 'Ticket details to be deleted:',
    step1Device: 'Device:',
    step1Customer: 'Customer:',
    step1Barcode: 'Barcode:',
    step1Status: 'Status:',
    step1Price: 'Total Price:',
    step1Notice: 'The ticket along with all its devices, accessories, and status logs will be permanently deleted. Do you wish to continue?',
    nextToStep2: 'Proceed to Next Step',
    step2Title: 'Step 2 of 3: Financial Impact & Reports',
    step2WarningBadge: 'Critical Financial Warning',
    step2FinancialNotice: 'Deleting this ticket will permanently remove all its financial figures (amounts paid, profit shares, and outstanding debt) from historical and future financial reports and KPI metrics.',
    step2CustomerCleanupNotice: 'Note: If this is the customer\'s only ticket, the customer record will be automatically and silently cleaned up.',
    step2IrreversibleNotice: 'This action is irreversible and cannot be undone.',
    nextToStep3: 'I Acknowledge Financial Impact & Proceed',
    step3Title: 'Step 3 of 3: Final Type Confirmation',
    step3Instruction: 'To confirm permanent deletion, please type the exact ticket barcode below:',
    step3Placeholder: 'Type ticket barcode here...',
    step3BarcodeMismatch: 'Entered code does not match ticket barcode',
    confirmDeleteButton: 'Confirm Permanent Deletion',
    deletingButton: 'Deleting...',
    deleteSuccess: 'Ticket and associated records deleted successfully',
    deleteError: 'Failed to delete ticket',
    cancel: 'Cancel'
  }
}



// Fallback constant
export let t = ar

interface I18nContextType {
  language: Language
  t: typeof ar
  dir: 'rtl' | 'ltr'
  isRtl: boolean
  setLanguage: (lang: Language) => void
}

const I18nContext = createContext<I18nContextType>({
  language: 'ar',
  t: ar,
  dir: 'rtl',
  isRtl: true,
  setLanguage: () => {}
})

export function I18nProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('warshati_language') as Language
    return saved === 'en' ? 'en' : 'ar'
  })
  // Formatters (currency, dates) follow the UI language; set during render so they are never one render stale
  setUiLanguage(language)

  // Sync document dir and lang attributes
  useEffect(() => {
    const dir = language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.dir = dir
    document.documentElement.lang = language
    t = language === 'ar' ? ar : en
  }, [language])

  // Load language setting from database on boot
  useEffect(() => {
    async function loadSetting(): Promise<void> {
      try {
        if (window.api && window.api.getSetting) {
          const res = await window.api.getSetting('app_language', language)
          if (res.success && res.data && (res.data === 'ar' || res.data === 'en')) {
            setLanguageState(res.data as Language)
          }
        }
      } catch (err) {
        console.warn('Failed to load language setting from database:', err)
      }
    }
    loadSetting()
  }, [])

  const setLanguage = (lang: Language): void => {
    setLanguageState(lang)
    localStorage.setItem('warshati_language', lang)
    t = lang === 'ar' ? ar : en
    try {
      if (window.api && window.api.setSetting) {
        window.api.setSetting('app_language', lang)
      }
    } catch {
      // ignore
    }
  }

  const currentT = language === 'ar' ? ar : en
  const dir = language === 'ar' ? 'rtl' : 'ltr'
  const isRtl = language === 'ar'

  return React.createElement(
    I18nContext.Provider,
    { value: { language, t: currentT, dir, isRtl, setLanguage } },
    children
  )
}

export function useI18n(): I18nContextType {
  return useContext(I18nContext)
}



