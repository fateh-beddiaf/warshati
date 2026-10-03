import type Database from 'better-sqlite3'
import type {
  ReportFilterDTO,
  FinancialReportResult,
  TechnicianReportSummary,
  CategoryReportSummary,
  TicketListItem
} from '../../shared/types'
import { calculateProfitSplit } from '../../shared/profit'
import { parseLocalDateString } from '../../shared/date-utils'

interface DateRange {
  startDate: string
  endDate: string
  /** true when the range is the whole history, so no date predicate is applied */
  unbounded: boolean
  /** true when from > to: nothing can match */
  empty: boolean
}

/**
 * Resolves the filter's period into an ISO [startDate, endDate] window (local-day boundaries).
 *
 * Custom range rules:
 *  - startDate empty/missing  -> treated as "all time" (nothing to bound on)
 *  - endDate empty/missing    -> the range is the single day startDate
 *  - from > to                -> empty report (no error): there is simply nothing in that window
 *  - a malformed date (not a real YYYY-MM-DD calendar day) -> throws an Arabic Error; the IPC
 *    layer turns it into { success: false, error } and the Reports screen shows it.
 */
function getDateRange(
  period: ReportFilterDTO['period'],
  customStart?: string,
  customEnd?: string
): DateRange {
  const now = new Date()
  const bounded = (start: Date, end: Date): DateRange => ({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    unbounded: false,
    empty: start.getTime() > end.getTime()
  })

  if (period === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    return bounded(start, end)
  }

  if (period === 'this_week') {
    // Current week: Start 6 days ago (or current week starting Saturday)
    const day = now.getDay() // 0 = Sunday, 6 = Saturday
    const diffToSaturday = (day + 1) % 7
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToSaturday, 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    return bounded(start, end)
  }

  if (period === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    return bounded(start, end)
  }

  if (period === 'custom' && customStart) {
    const start = parseLocalDateString(customStart)
    if (!start) throw new Error('تاريخ البداية غير صالح. استخدم الصيغة السنة-الشهر-اليوم (YYYY-MM-DD).')
    const end = parseLocalDateString(customEnd || customStart, true)
    if (!end) throw new Error('تاريخ النهاية غير صالح. استخدم الصيغة السنة-الشهر-اليوم (YYYY-MM-DD).')
    return bounded(start, end)
  }

  // all_time (also a custom period without a start date): from year 2020 to far future
  return {
    startDate: new Date('2020-01-01T00:00:00.000Z').toISOString(),
    endDate: new Date('2099-12-31T23:59:59.999Z').toISOString(),
    unbounded: true,
    empty: false
  }
}

export function getFinancialReport(
  db: Database.Database,
  filter: ReportFilterDTO = { period: 'all_time' }
): FinancialReportResult {
  const { startDate, endDate, unbounded, empty } = getDateRange(
    filter.period,
    filter.startDate,
    filter.endDate
  )

  // Optional technician / category predicates, shared by the ticket query and the counters
  let extraWhere = ''
  const extraParams: unknown[] = []
  if (filter.technicianFilter && filter.technicianFilter !== 'all') {
    extraWhere += ` AND t.technician_id = ?`
    extraParams.push(Number(filter.technicianFilter))
  }
  if (filter.categoryFilter && filter.categoryFilter !== 'all') {
    extraWhere += ` AND t.repair_category_id = ?`
    extraParams.push(Number(filter.categoryFilter))
  }

  // 1. Delivered tickets only: that is all the screen lists and all the totals are built from.
  //    A ticket belongs to the period in which it was (last) delivered. The latest 'delivered'
  //    StatusLog row is found with one grouped subquery instead of a correlated subquery per row
  //    (and per predicate). Legacy delivered tickets without any such row still show up in
  //    all-time reports (LEFT JOIN) but can't be placed in a date window.
  let query = `
    SELECT
      t.id,
      t.barcode_code,
      t.customer_id,
      c.name AS customer_name,
      c.phone AS customer_phone,
      td.brand,
      td.model,
      td.short_label,
      rc.id AS repair_category_id,
      rc.name AS category_name,
      rc.default_split_percentage AS category_split_percentage,
      t.price,
      t.payment_type,
      t.amount_paid,
      t.amount_remaining,
      t.status,
      t.technician,
      t.technician_id,
      tech.is_partner AS technician_is_partner,
      t.created_at,
      t.my_share,
      t.partner_share,
      dl.timestamp AS delivered_at
    FROM Ticket t
    JOIN Customer c ON t.customer_id = c.id
    JOIN Technician tech ON tech.id = t.technician_id
    LEFT JOIN TicketDevice td ON td.ticket_id = t.id
    LEFT JOIN RepairCategory rc ON rc.id = t.repair_category_id
    LEFT JOIN (
      SELECT ticket_id, MAX(id) AS last_id
      FROM StatusLog
      WHERE new_status = 'delivered'
      GROUP BY ticket_id
    ) ld ON ld.ticket_id = t.id
    LEFT JOIN StatusLog dl ON dl.id = ld.last_id
    WHERE t.status = 'delivered'
  `
  const params: unknown[] = []
  if (!unbounded) {
    query += ` AND dl.timestamp BETWEEN ? AND ?`
    params.push(startDate, endDate)
  }
  query += extraWhere + ` ORDER BY t.id DESC`
  params.push(...extraParams)

  const rows = (empty ? [] : db.prepare(query).all(...params)) as (TicketListItem & {
    category_split_percentage?: number
    delivered_at?: string | null
  })[]

  // 2. Informational counters for tickets still in the workshop (created within the period)
  let inProgressTicketsCount = 0
  let readyTicketsCount = 0
  if (!empty) {
    let counterQuery = `
      SELECT t.status AS status, COUNT(*) AS n
      FROM Ticket t
      WHERE t.status IN ('in_progress', 'ready')
    `
    const counterParams: unknown[] = []
    if (!unbounded) {
      counterQuery += ` AND t.created_at BETWEEN ? AND ?`
      counterParams.push(startDate, endDate)
    }
    counterQuery += extraWhere + ` GROUP BY t.status`
    counterParams.push(...extraParams)
    const counters = db.prepare(counterQuery).all(...counterParams) as { status: string; n: number }[]
    for (const row of counters) {
      if (row.status === 'in_progress') inProgressTicketsCount = row.n
      if (row.status === 'ready') readyTicketsCount = row.n
    }
  }

  // Aggregation variables
  let totalRevenue = 0
  let totalMyShare = 0
  let totalPartnerShare = 0
  let totalPaid = 0
  let totalOutstandingDebt = 0
  let completedTicketsCount = 0

  const techMap = new Map<string, TechnicianReportSummary>()
  const catMap = new Map<number, CategoryReportSummary>()

  const enrichedTickets: TicketListItem[] = []

  for (const row of rows) {
    let ticketMyShare = row.my_share
    let ticketPartnerShare = row.partner_share

    completedTicketsCount++
    const price = Number(row.price) || 0
    totalRevenue += price
    totalPaid += Number(row.amount_paid) || 0
    totalOutstandingDebt += Number(row.amount_remaining) || 0

    // If delivered but shares were not frozen (e.g. legacy data), compute them
    if (ticketMyShare === null || ticketMyShare === undefined || ticketPartnerShare === null || ticketPartnerShare === undefined) {
      const split = calculateProfitSplit({
        price,
        isPartner: Boolean(row.technician_is_partner),
        categorySplitPercentage: row.category_split_percentage ?? 50.0
      })
      ticketMyShare = split.myShare
      ticketPartnerShare = split.partnerShare
    }

    totalMyShare += ticketMyShare
    totalPartnerShare += ticketPartnerShare

    // Technician Summary
    const techKey = String(row.technician_id)
    const existingTech = techMap.get(techKey) || {
      technicianId: row.technician_id,
      technician: row.technician || 'غير محدد',
      isPartner: Boolean(row.technician_is_partner),
      ticketsCount: 0,
      totalRevenue: 0,
      myShare: 0,
      partnerShare: 0
    }
    existingTech.ticketsCount += 1
    existingTech.totalRevenue += price
    existingTech.myShare += ticketMyShare
    existingTech.partnerShare += ticketPartnerShare
    techMap.set(techKey, existingTech)

    // Category Summary
    const catId = row.repair_category_id || 0
    const existingCat = catMap.get(catId) || {
      categoryId: catId,
      categoryName: row.category_name || 'عام',
      splitPercentage: row.category_split_percentage ?? 50.0,
      ticketsCount: 0,
      totalRevenue: 0,
      myShare: 0,
      partnerShare: 0
    }
    existingCat.ticketsCount += 1
    existingCat.totalRevenue += price
    existingCat.myShare += ticketMyShare
    existingCat.partnerShare += ticketPartnerShare
    catMap.set(catId, existingCat)

    enrichedTickets.push({
      ...row,
      my_share: ticketMyShare,
      partner_share: ticketPartnerShare
    })
  }

  // Round all aggregate numbers cleanly
  totalRevenue = Math.round(totalRevenue * 100) / 100
  totalMyShare = Math.round(totalMyShare * 100) / 100
  totalPartnerShare = Math.round(totalPartnerShare * 100) / 100
  totalPaid = Math.round(totalPaid * 100) / 100
  totalOutstandingDebt = Math.round(totalOutstandingDebt * 100) / 100

  const technicianBreakdown = Array.from(techMap.values()).map((t) => ({
    ...t,
    totalRevenue: Math.round(t.totalRevenue * 100) / 100,
    myShare: Math.round(t.myShare * 100) / 100,
    partnerShare: Math.round(t.partnerShare * 100) / 100
  }))

  const categoryBreakdown = Array.from(catMap.values()).map((c) => ({
    ...c,
    totalRevenue: Math.round(c.totalRevenue * 100) / 100,
    myShare: Math.round(c.myShare * 100) / 100,
    partnerShare: Math.round(c.partnerShare * 100) / 100
  }))

  return {
    period: filter.period,
    startDate,
    endDate,
    totalRevenue,
    totalMyShare,
    totalPartnerShare,
    totalPaid,
    totalOutstandingDebt,
    completedTicketsCount,
    inProgressTicketsCount,
    readyTicketsCount,
    technicianBreakdown,
    categoryBreakdown,
    tickets: enrichedTickets
  }
}
