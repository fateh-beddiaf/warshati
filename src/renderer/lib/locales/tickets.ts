// UI strings for the "tickets" area. Add keys here, never inline text in JSX.
// `en` is typed against `ar`, so both languages must define every key.
export const ticketsAr = {
  thresholdButton: 'تنبيه التأخر: {days} أيام',
  thresholdTitle: 'تعديل عتبة أيام التنبيه',
  refreshTitle: 'تحديث القائمة',
  showOverdueOnly: 'عرض المتأخرة فقط',
  printRow: 'طباعة',
  settled: 'خالص',
  categoryFallback: 'عام',
  emptyFilteredTitle: 'لا توجد نتائج مطابقة',
  emptyFilteredSubtitle: 'جرّب كلمات بحث أخرى أو أزل عوامل التصفية لعرض كل التذاكر.',
  clearFilters: 'مسح البحث والتصفية',
  statusFiltersAria: 'تصفية حسب الحالة',
  resultCount: '{count} تذكرة'
}

export const ticketsEn: typeof ticketsAr = {
  thresholdButton: 'Overdue alert: {days} days',
  thresholdTitle: 'Edit the overdue alert threshold',
  refreshTitle: 'Refresh the list',
  showOverdueOnly: 'Show overdue only',
  printRow: 'Print',
  settled: 'Paid in full',
  categoryFallback: 'General',
  emptyFilteredTitle: 'No matching tickets',
  emptyFilteredSubtitle: 'Try different search words or clear the filters to see every ticket.',
  clearFilters: 'Clear search and filters',
  statusFiltersAria: 'Filter by status',
  resultCount: '{count} tickets'
}
