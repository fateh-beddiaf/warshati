// UI strings for the parts cost feature (T004), one namespace per area. Add keys here, never inline text in JSX.
// `en` is typed against `ar`, so both languages must define every key.
export const partsCostAr = {
  // Shared by the masked input
  field: {
    show: 'إظهار القيمة',
    hide: 'إخفاء القيمة',
    invalid: 'قيمة التكلفة غير صالحة. أدخل رقماً أكبر من أو يساوي صفر.'
  },
  // Settings > categories
  settings: {
    switchLabel: 'يتطلب تكلفة قطع',
    switchHint:
      'فعّله للتصنيفات التي فيها ثمن قطعة (مثل الشاشات والفيشور). تُخصم التكلفة من السعر قبل توزيع الأرباح. اتركه مطفأً للفلاش والسوفتوير.',
    badge: 'يتطلب تكلفة',
    enabledToast: 'تم تفعيل «يتطلب تكلفة قطع» للتصنيف',
    disabledToast: 'تم إيقاف «يتطلب تكلفة قطع» للتصنيف',
    toggleFailed: 'فشل تعديل الإعداد',
    previewTitle: 'مثال بتكلفة قطعة',
    previewLine: 'السعر {price} − التكلفة {cost} = ربح صافٍ {net}',
    previewOwner: 'حصتي: {amount}',
    previewPartner: 'حصة الشريك: {amount}',
    tabNote:
      'التصنيفات التي تتطلب تكلفة قطع تُنبّهك عند إنشاء التذكرة، وتُحسب أرباحها على الربح الصافي (السعر − التكلفة).'
  },
  // New ticket
  newTicket: {
    label: 'تكلفة داخلية',
    optional: 'اختياري',
    placeholder: '—',
    noCostTitle: 'هذه التذكرة بلا تكلفة',
    noCostBody: 'أضفها لاحقاً من تفاصيل التذكرة؛ الأرباح مؤقتة حتى ذلك الحين.',
    lossTitle: 'التكلفة أعلى من السعر',
    lossBody: 'تكلفة القطع تتجاوز سعر الإصلاح، وستُسجَّل هذه التذكرة بخسارة. هل تريد المتابعة؟',
    lossConfirm: 'نعم، سجّلها بخسارة',
    lossReview: 'مراجعة القيم'
  },
  // Ticket details
  details: {
    costTitle: 'تكلفة القطع',
    costLabel: 'التكلفة',
    hiddenValue: '••••••',
    notEntered: 'لم تُدخل بعد',
    priceLabel: 'السعر',
    netProfit: 'الربح الصافي',
    addCost: 'إضافة التكلفة',
    editCost: 'تعديل التكلفة',
    provisionalBadge: 'مؤقتة',
    provisionalHint: 'الأرباح مؤقتة: لم تُدخل تكلفة القطع بعد. ستُعاد حسبة الحصص تلقائياً عند إضافتها.',
    lossBadge: 'خسارة',
    lossHint: 'تكلفة القطع أعلى من السعر: التذكرة بخسارة، وتُقسَّم الخسارة بنفس النسبة.',
    dialogTitle: 'تكلفة القطع',
    dialogDescription: 'تُدفع تكلفة القطعة أولاً من مال الزبون، ثم يُوزَّع الربح الصافي. لا تظهر التكلفة على الملصق.',
    dialogDescriptionDelivered: 'التذكرة مسلَّمة: ستُعاد حسبة الحصص تلقائياً بنفس النسبة المجمَّدة عند التسليم.',
    inputLabel: 'تكلفة القطع',
    clearCost: 'مسح التكلفة',
    saveCost: 'حفظ التكلفة',
    savedToast: 'تم حفظ التكلفة وتحديث الحصص',
    clearedToast: 'تم مسح التكلفة',
    lossConfirmTitle: 'التكلفة أعلى من السعر',
    lossConfirmBody: 'ستُسجَّل هذه التذكرة بخسارة. هل تريد حفظ هذه التكلفة؟',
    lossConfirmButton: 'نعم، احفظها بخسارة',
    sharesCaption: 'من الربح الصافي {net}',
    deliveryProvisionalTitle: 'الأرباح مؤقتة',
    deliveryProvisionalBody:
      'لم تُدخل تكلفة القطع بعد. التسليم مسموح، وتُعاد حسبة الحصص تلقائياً عند إضافة التكلفة لاحقاً.',
    deliveryLossNote: 'تنبيه: التكلفة أعلى من السعر، فالحصص سالبة (خسارة).',
    showProfit: 'إظهار توزيع الأرباح',
    hideProfit: 'إخفاء توزيع الأرباح',
    profitHiddenHint: 'توزيع الأرباح مخفي لأن الزبون قد يرى الشاشة. اضغط للإظهار.',
    showCostProfit: 'إظهار التكلفة والأرباح',
    hideCostProfit: 'إخفاء التكلفة والأرباح',
    hiddenShare: '••••'
  },
  // Tickets list
  tickets: {
    missingTooltip: 'التكلفة غير مُدخلة',
    missingAria: 'تذكرة ناقصة التكلفة',
    filterMissing: 'ناقصة التكلفة',
    bannerText: 'تذاكر تحتاج إضافة التكلفة: {count}',
    showMissingOnly: 'عرض الناقصة فقط'
  },
  // Reports
  reports: {
    partsCost: 'إجمالي تكلفة القطع',
    partsCostDesc: 'تُدفع من مال الزبون قبل التوزيع',
    netProfit: 'الربح الصافي الموزَّع',
    netProfitDesc: 'السعر − التكلفة',
    lossesCount: 'تذاكر بخسارة: {count}',
    provisionalAlert: 'تذاكر مسلَّمة بلا تكلفة — الأرباح غير نهائية: {count}',
    showProvisional: 'عرض هذه التذاكر فقط',
    showAllDelivered: 'عرض كل التذاكر',
    netColumn: 'الربح الصافي',
    provisionalBadge: 'مؤقتة',
    lossBadge: 'خسارة',
    ofNet: '{pct} من الصافي',
    netWord: 'الصافي',
    filteredCount: '{count} تذكرة بلا تكلفة'
  }
}

export const partsCostEn: typeof partsCostAr = {
  field: {
    show: 'Show value',
    hide: 'Hide value',
    invalid: 'Invalid cost. Enter a number greater than or equal to zero.'
  },
  settings: {
    switchLabel: 'Requires a parts cost',
    switchHint:
      'Turn it on for categories with a part to buy (screens, charging ports...). The cost is deducted from the price before the profit is split. Leave it off for flashing and software.',
    badge: 'Requires cost',
    enabledToast: '"Requires a parts cost" turned on for the category',
    disabledToast: '"Requires a parts cost" turned off for the category',
    toggleFailed: 'Failed to change the setting',
    previewTitle: 'Example with a part cost',
    previewLine: 'Price {price} − cost {cost} = net profit {net}',
    previewOwner: 'My share: {amount}',
    previewPartner: 'Partner share: {amount}',
    tabNote:
      'Categories that require a parts cost remind you when creating the ticket, and their profit is split on the net profit (price − cost).'
  },
  newTicket: {
    label: 'Internal cost',
    optional: 'optional',
    placeholder: '—',
    noCostTitle: 'This ticket has no cost',
    noCostBody: 'Add it later from the ticket details; the profit stays provisional until then.',
    lossTitle: 'The cost is higher than the price',
    lossBody:
      'The parts cost exceeds the repair price, so this ticket will be recorded as a loss. Do you want to continue?',
    lossConfirm: 'Yes, record it as a loss',
    lossReview: 'Review the values'
  },
  details: {
    costTitle: 'Parts cost',
    costLabel: 'Cost',
    hiddenValue: '••••••',
    notEntered: 'Not entered yet',
    priceLabel: 'Price',
    netProfit: 'Net profit',
    addCost: 'Add the cost',
    editCost: 'Edit the cost',
    provisionalBadge: 'Provisional',
    provisionalHint:
      'Provisional profit: the parts cost has not been entered yet. The shares are recomputed automatically once you add it.',
    lossBadge: 'Loss',
    lossHint: 'The parts cost is higher than the price: this ticket is a loss, split with the same percentage.',
    dialogTitle: 'Parts cost',
    dialogDescription:
      "The part is paid first from the customer's money, then the net profit is split. The cost never appears on the label.",
    dialogDescriptionDelivered:
      'The ticket is delivered: the shares are recomputed automatically with the percentage frozen at delivery.',
    inputLabel: 'Parts cost',
    clearCost: 'Clear the cost',
    saveCost: 'Save the cost',
    savedToast: 'Cost saved and shares updated',
    clearedToast: 'Cost cleared',
    lossConfirmTitle: 'The cost is higher than the price',
    lossConfirmBody: 'This ticket will be recorded as a loss. Do you want to save this cost?',
    lossConfirmButton: 'Yes, save it as a loss',
    sharesCaption: 'of the net profit {net}',
    deliveryProvisionalTitle: 'Provisional profit',
    deliveryProvisionalBody:
      'The parts cost has not been entered yet. Delivery is allowed, and the shares are recomputed automatically when you add the cost later.',
    deliveryLossNote: 'Heads up: the cost is higher than the price, so the shares are negative (a loss).',
    showProfit: 'Show profit split',
    hideProfit: 'Hide profit split',
    profitHiddenHint: 'The profit split is hidden because the customer may be looking. Click to show it.',
    showCostProfit: 'Show cost and profit',
    hideCostProfit: 'Hide cost and profit',
    hiddenShare: '••••'
  },
  tickets: {
    missingTooltip: 'Cost not entered',
    missingAria: 'Ticket missing its cost',
    filterMissing: 'Missing cost',
    bannerText: 'Tickets that need their cost added: {count}',
    showMissingOnly: 'Show those only'
  },
  reports: {
    partsCost: 'Total parts cost',
    partsCostDesc: "Paid from the customer's money before the split",
    netProfit: 'Net profit distributed',
    netProfitDesc: 'Price − cost',
    lossesCount: 'Tickets at a loss: {count}',
    provisionalAlert: 'Delivered tickets without a cost — profit is not final: {count}',
    showProvisional: 'Show these tickets only',
    showAllDelivered: 'Show all tickets',
    netColumn: 'Net profit',
    provisionalBadge: 'Provisional',
    lossBadge: 'Loss',
    ofNet: '{pct} of net',
    netWord: 'Net',
    filteredCount: '{count} tickets without a cost'
  }
}
