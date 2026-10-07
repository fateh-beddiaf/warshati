// UI strings for editing a ticket (edit form, review dialog, reprint prompt) and the edit history in the details.
// Add keys here, never inline text in JSX.
// `en` is typed against `ar`, so both languages must define every key.
export const editTicketAr = {
  editButton: 'تعديل التذكرة',
  title: 'تعديل التذكرة',
  description: 'صحّح أي معلومة أُدخلت خطأً. رمز التذكرة وتاريخ إنشائها وحالتها لا تتغيّر.',
  deliveredBanner: 'هذه التذكرة مُسلَّمة: تغيير السعر أو تكلفة القطع أو الفني أو التصنيف يعيد حساب توزيع أرباحها.',
  loading: 'جارٍ تحميل البيانات…',
  save: 'حفظ التعديلات',
  noChanges: 'لم يتغيّر شيء بعد.',
  savedToast: 'تم حفظ تعديلات التذكرة.',
  saveFailed: 'تعذّر حفظ التعديلات.',
  invalidAmount: 'أدخل مبلغاً صحيحاً (رقم أكبر من أو يساوي صفر).',
  priceBelowPaid: 'السعر ({price}) لا يمكن أن يقل عن المبلغ المدفوع ({paid}). خفّض المبلغ المدفوع أولاً إن كان خاطئاً.',
  paidAbovePrice: 'المبلغ المدفوع لا يمكن أن يتجاوز السعر.',

  // Customer: the record itself, or another customer
  customerEditHint: 'تعديل بيانات هذا الزبون نفسه.',
  ticketCountMany: 'عدد تذاكر هذا الزبون: {count} — التعديل يسري عليها كلها.',
  ticketCountOne: 'هذه التذكرة الوحيدة لهذا الزبون.',
  wrongCustomer: 'زبون خاطئ؟ اربط التذكرة بزبون آخر أو جديد',
  reassignTitle: 'ربط التذكرة بزبون آخر',
  reassignHint: 'اختر زبوناً مسجَّلاً أو اكتب زبوناً جديداً. الزبون الحالي ({name}) لا يتغيّر.',
  backToEdit: 'إلغاء الربط وتعديل الزبون الحالي',

  // Review before saving
  reviewTitle: 'مراجعة التعديلات',
  reviewDescription: 'ستُحفظ هذه التغييرات وتُسجَّل في سجل التذكرة.',
  deliveredRecalc: 'هذه التذكرة مُسلَّمة؛ سيُعاد حساب توزيع أرباحها.',
  deliveredNoRecalc: 'هذه التذكرة مُسلَّمة؛ هذه التعديلات لا تغيّر توزيع أرباحها.',
  paidLowered: 'خفض المبلغ المدفوع يُنشئ ديناً أو يزيده: سيبقى على الزبون {remaining}.',
  lossWarning: 'تكلفة القطع أعلى من السعر: التذكرة ستكون بخسارة.',
  customerAllTickets: 'تعديل بيانات الزبون يظهر على تذاكره كلها ({count}).',
  confirmSave: 'تأكيد وحفظ',
  backToEditing: 'رجوع للتعديل',
  showCost: 'إظهار التكلفة',
  hideCost: 'إخفاء التكلفة',

  // Reprint prompt after a printed field changed
  reprintTitle: 'إعادة طباعة الملصق؟',
  reprintBody:
    'تغيّرت معلومة مطبوعة على الملصق (اسم الزبون أو هاتفه أو الوصف المختصر). رمز التذكرة لم يتغيّر، فالملصق القديم ما زال يُقرأ بالماسح.',
  reprintNow: 'طباعة الملصق',
  reprintLater: 'لاحقاً',

  // History (details timeline)
  historyTitle: 'سجل التذكرة',
  editedEntry: 'تعديل',
  emptyValue: '—',
  fields: {
    customer: 'الزبون',
    customer_name: 'اسم الزبون',
    customer_phone: 'هاتف الزبون',
    customer_notes: 'ملاحظات الزبون',
    brand: 'الماركة',
    model: 'الموديل',
    short_label: 'الوصف المختصر',
    accessories: 'الملحقات',
    repair_category: 'التصنيف',
    technician: 'الفني',
    price: 'السعر',
    amount_paid: 'المدفوع',
    payment_type: 'نوع الدفع',
    parts_cost: 'تكلفة القطع'
  }
}

export const editTicketEn: typeof editTicketAr = {
  editButton: 'Edit ticket',
  title: 'Edit ticket',
  description: 'Fix any information entered by mistake. The ticket code, creation date and status do not change.',
  deliveredBanner:
    'This ticket is delivered: changing the price, parts cost, technician or category recalculates its profit split.',
  loading: 'Loading…',
  save: 'Save changes',
  noChanges: 'Nothing has changed yet.',
  savedToast: 'Ticket changes saved.',
  saveFailed: 'The changes could not be saved.',
  invalidAmount: 'Enter a valid amount (a number of 0 or more).',
  priceBelowPaid:
    'The price ({price}) cannot be below the amount paid ({paid}). Lower the amount paid first if it is wrong.',
  paidAbovePrice: 'The amount paid cannot be more than the price.',

  customerEditHint: 'Edits this customer’s own record.',
  ticketCountMany: 'This customer has {count} tickets; the change applies to all of them.',
  ticketCountOne: 'This is this customer’s only ticket.',
  wrongCustomer: 'Wrong customer? Attach this ticket to another / a new customer',
  reassignTitle: 'Attach to another customer',
  reassignHint: 'Pick a registered customer or type a new one. The current customer ({name}) is not changed.',
  backToEdit: 'Cancel and edit the current customer instead',

  reviewTitle: 'Review the changes',
  reviewDescription: 'These changes will be saved and recorded in the ticket history.',
  deliveredRecalc: 'This ticket is delivered; its profit split will be recalculated.',
  deliveredNoRecalc: 'This ticket is delivered; these changes do not affect its profit split.',
  paidLowered: 'Lowering the amount paid creates or increases a debt: the customer will owe {remaining}.',
  lossWarning: 'The parts cost is above the price: this ticket will be at a loss.',
  customerAllTickets: 'The customer change shows on all of their tickets ({count}).',
  confirmSave: 'Confirm and save',
  backToEditing: 'Back to editing',
  showCost: 'Show the cost',
  hideCost: 'Hide the cost',

  reprintTitle: 'Reprint the label?',
  reprintBody:
    'Information printed on the label changed (customer name, phone or short label). The ticket code is the same, so the old label still scans.',
  reprintNow: 'Print the label',
  reprintLater: 'Not now',

  historyTitle: 'Ticket history',
  editedEntry: 'Edited',
  emptyValue: '—',
  fields: {
    customer: 'Customer',
    customer_name: 'Customer name',
    customer_phone: 'Customer phone',
    customer_notes: 'Customer notes',
    brand: 'Brand',
    model: 'Model',
    short_label: 'Short label',
    accessories: 'Accessories',
    repair_category: 'Category',
    technician: 'Technician',
    price: 'Price',
    amount_paid: 'Amount paid',
    payment_type: 'Payment type',
    parts_cost: 'Parts cost'
  }
}
