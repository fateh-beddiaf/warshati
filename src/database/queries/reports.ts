import type Database from 'better-sqlite3'
import type {
  ReportFilterDTO,
  FinancialReportResult,
  TechnicianReportSummary,
  CategoryReportSummary,
  TicketListItem
} from '../types'
import { calculateProfitSplit } from '../../shared/profit'

function getDateRange(
  period: ReportFilterDTO['period'],
  customStart?: string,
  customEnd?: string
): { startDate: string; endDate: string } {
  const now = new Date()

  if (period === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    return { startDate: start.toISOString(), endDate: end.toISOString() }
  }

  if (period === 'this_week') {
    // Current week: Start 6 days ago (or current week starting Saturday)
    const day = now.getDay() // 0 = Sunday, 6 = Saturday
    const diffToSaturday = (day + 1) % 7
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToSaturday, 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    return { startDate: start.toISOString(), endDate: end.toISOString() }
  }

  if (period === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    return { startDate: start.toISOString(), endDate: end.toISOString() }
  }

  if (period === 'custom' && customStart) {
    const sDate = new Date(customStart)
    sDate.setHours(0, 0, 0, 0)
    const eDate = customEnd ? new Date(customEnd) : new Date(customStart)
    eDate.setHours(23, 59, 59, 999)
    return { startDate: sDate.toISOString(), endDate: eDate.toISOString() }
  }

  // all_time default: from year 2020 to far future
  return {
    startDate: new Date('2020-01-01T00:00:00.000Z').toISOString(),
    endDate: new Date('2099-12-31T23:59:59.999Z').toISOString()
  }
}

export function getFinancialReport(
  db: Database.Database,
  filter: ReportFilterDTO = { period: 'all_time' }
): FinancialReportResult {
  const { startDate, endDate } = getDateRange(filter.period, filter.startDate, filter.endDate)

  // 1. Fetch tickets within date range (based on delivered timestamp in StatusLog, or created_at)
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
      (
        SELECT timestamp 
        FROM StatusLog 
        WHERE ticket_id = t.id AND new_status = 'delivered' 
        ORDER BY id DESC 
        LIMIT 1
      ) AS delivered_at
    FROM Ticket t
    JOIN Customer c ON t.customer_id = c.id
    JOIN Technician tech ON tech.id = t.technician_id
    LEFT JOIN TicketDevice td ON td.ticket_id = t.id
    LEFT JOIN RepairCategory rc ON rc.id = t.repair_category_id
    WHERE 1=1
  `

  const params: unknown[] = []

  if (filter.period !== 'all_time') {
    query += `
      AND (
        (t.status = 'delivered' AND (
          SELECT timestamp FROM StatusLog WHERE ticket_id = t.id AND new_status = 'delivered' ORDER BY id DESC LIMIT 1
        ) BETWEEN ? AND ?)
        OR
        (t.status != 'delivered' AND t.created_at BETWEEN ? AND ?)
      )
    `
    params.push(startDate, endDate, startDate, endDate)
  }

  if (filter.technicianFilter && filter.technicianFilter !== 'all') {
    query += ` AND t.technician_id = ?`
    params.push(Number(filter.technicianFilter))
  }

  if (filter.categoryFilter && filter.categoryFilter !== 'all') {
    query += ` AND t.repair_category_id = ?`
    params.push(Number(filter.categoryFilter))
  }

  query += ` ORDER BY t.id DESC`

  const rows = db.prepare(query).all(...params) as (TicketListItem & {
    category_split_percentage?: number
    delivered_at?: string | null
  })[]

  // Aggregation variables
  let totalRevenue = 0
  let totalMyShare = 0
  let totalPartnerShare = 0
  let totalPaid = 0
  let totalOutstandingDebt = 0
  let completedTicketsCount = 0
  let inProgressTicketsCount = 0
  let readyTicketsCount = 0

  const techMap = new Map<string, TechnicianReportSummary>()
  const catMap = new Map<number, CategoryReportSummary>()

  const enrichedTickets: TicketListItem[] = []

  for (const row of rows) {
    if (row.status === 'in_progress') inProgressTicketsCount++
    if (row.status === 'ready') readyTicketsCount++

    let ticketMyShare = row.my_share
    let ticketPartnerShare = row.partner_share

    // If delivered but shares were not frozen (e.g. legacy data), compute them
    if (row.status === 'delivered') {
      completedTicketsCount++
      const price = Number(row.price) || 0
      totalRevenue += price
      totalPaid += Number(row.amount_paid) || 0
      totalOutstandingDebt += Number(row.amount_remaining) || 0

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
    }

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
