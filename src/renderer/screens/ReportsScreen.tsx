import * as React from 'react'
import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '../lib/i18n'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { formatCurrency, formatDate } from '../lib/utils'
import type {
  FinancialReportResult,
  ReportPeriod,
  ReportFilterDTO,
  AppMetadata,
  TicketListItem
} from '../../database/types'
import {
  TrendingUp,
  Coins,
  User,
  Users,
  CreditCard,
  Calendar,
  Filter,
  CheckCircle,
  Clock,
  Sparkles,
  PieChart,
  Layers,
  ArrowUpDown,
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react'

interface ReportsScreenProps {
  onOpenTicketDetails?: (ticketId: number) => void
}

export function ReportsScreen({ onOpenTicketDetails }: ReportsScreenProps): React.JSX.Element {
  const { t } = useI18n()
  const [period, setPeriod] = useState<ReportPeriod>('this_month')

  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [technicianFilter, setTechnicianFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const [report, setReport] = useState<FinancialReportResult | null>(null)
  const [metadata, setMetadata] = useState<AppMetadata | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch Metadata for filters
  useEffect(() => {
    async function loadMeta(): Promise<void> {
      try {
        const res = await window.api.getMetadata()
        if (res.success && res.data) {
          setMetadata(res.data)
        }
      } catch (err) {
        console.error('Failed to load metadata:', err)
      }
    }
    loadMeta()
  }, [])

  // Fetch Report Data
  const loadReport = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const filterDTO: ReportFilterDTO = {
        period,
        startDate: period === 'custom' ? startDate : undefined,
        endDate: period === 'custom' ? endDate : undefined,
        technicianFilter: technicianFilter !== 'all' ? technicianFilter : undefined,
        categoryFilter: categoryFilter !== 'all' ? Number(categoryFilter) : undefined
      }

      const res = await window.api.getFinancialReport(filterDTO)
      if (res.success && res.data) {
        setReport(res.data)
      }
    } catch (err) {
      console.error('Failed to load financial report:', err)
    } finally {
      setLoading(false)
    }
  }, [period, startDate, endDate, technicianFilter, categoryFilter])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5">
            <TrendingUp className="h-7 w-7 text-blue-600" />
            <span>{t.reports.title}</span>
          </h2>
          <p className="text-sm text-slate-500 mt-1">{t.reports.subtitle}</p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => loadReport()}
          disabled={loading}
          className="self-start sm:self-auto text-xs gap-1.5 border-slate-300"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث التقرير</span>
        </Button>
      </div>

      {/* Filter Controls Bar */}
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-4 space-y-4">
          {/* Period Selection Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-xs font-bold text-slate-600 me-1.5 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-blue-600" />
                {t.reports.periodFilter}
              </span>
              
              <button
                type="button"
                data-testid="period-today"
                onClick={() => setPeriod('today')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  period === 'today'
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.reports.today}
              </button>

              <button
                type="button"
                data-testid="period-this_week"
                onClick={() => setPeriod('this_week')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  period === 'this_week'
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.reports.thisWeek}
              </button>

              <button
                type="button"
                data-testid="period-this_month"
                onClick={() => setPeriod('this_month')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  period === 'this_month'
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.reports.thisMonth}
              </button>

              <button
                type="button"
                data-testid="period-all_time"
                onClick={() => setPeriod('all_time')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  period === 'all_time'
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.reports.allTime}
              </button>

              <button
                type="button"
                data-testid="period-custom"
                onClick={() => setPeriod('custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  period === 'custom'
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.reports.custom}
              </button>
            </div>

            {/* Sub-Filters: Technician & Category */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                <span className="text-slate-500 font-semibold">{t.reports.filterByTechnician}</span>
                <select
                  value={technicianFilter}
                  onChange={(e) => setTechnicianFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="all">{t.reports.allTechnicians}</option>
                  {metadata?.technicians.map((technician) => (
                      <option key={technician.id} value={String(technician.id)}>
                        {technician.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                <span className="text-slate-500 font-semibold">{t.reports.filterByCategory}</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="all">{t.reports.allCategories}</option>
                  {metadata?.repairCategories?.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.default_split_percentage}%)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Custom Date Inputs Row */}
          {period === 'custom' && (
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600">{t.reports.from}</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs font-mono font-bold bg-white text-slate-800"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600">{t.reports.to}</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs font-mono font-bold bg-white text-slate-800"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4 Main KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <Card className="bg-white border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 start-0 w-1.5 h-full bg-emerald-500" />
          <CardContent className="p-4 ps-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">{t.reports.kpi.totalRevenue}</span>
              <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Coins className="h-4 w-4" />
              </div>
            </div>
            <p className="text-xl font-extrabold text-slate-900 font-mono mt-2">
              {formatCurrency(report?.totalRevenue || 0)}
            </p>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100 font-medium">
              <span>{report?.completedTicketsCount || 0} {t.reports.kpi.completedCount}</span>
              <span className="text-emerald-700 font-bold">100% الدخل الإجمالي</span>
            </div>
          </CardContent>
        </Card>

        {/* My Total Share */}
        <Card className="bg-white border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 start-0 w-1.5 h-full bg-blue-600" />
          <CardContent className="p-4 ps-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">{t.reports.kpi.myTotalShare}</span>
              <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <User className="h-4 w-4" />
              </div>
            </div>
            <p className="text-xl font-extrabold text-blue-700 font-mono mt-2">
              {formatCurrency(report?.totalMyShare || 0)}
            </p>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100 font-medium">
              <span>{t.reports.kpi.myTotalShareDesc}</span>
              <span className="font-bold text-blue-800 font-mono">
                {report && report.totalRevenue > 0
                  ? `${Math.round((report.totalMyShare / report.totalRevenue) * 100)}%`
                  : '0%'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Partner Total Share */}
        <Card className="bg-white border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 start-0 w-1.5 h-full bg-purple-600" />
          <CardContent className="p-4 ps-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">{t.reports.kpi.partnerTotalShare}</span>
              <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <p className="text-xl font-extrabold text-purple-700 font-mono mt-2">
              {formatCurrency(report?.totalPartnerShare || 0)}
            </p>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100 font-medium">
              <span>{t.reports.kpi.partnerTotalShareDesc}</span>
              <span className="font-bold text-purple-800 font-mono">
                {report && report.totalRevenue > 0
                  ? `${Math.round((report.totalPartnerShare / report.totalRevenue) * 100)}%`
                  : '0%'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Outstanding Debt */}
        <Card className="bg-white border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 start-0 w-1.5 h-full bg-amber-500" />
          <CardContent className="p-4 ps-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">{t.reports.kpi.outstandingDebt}</span>
              <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
            <p className={`text-xl font-extrabold font-mono mt-2 ${Number(report?.totalOutstandingDebt) > 0 ? 'text-amber-700' : 'text-slate-800'}`}>
              {formatCurrency(report?.totalOutstandingDebt || 0)}
            </p>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100 font-medium">
              <span>{t.reports.kpi.outstandingDebtDesc}</span>
              <span className="text-slate-400 font-mono">
                مدفوع: {formatCurrency(report?.totalPaid || 0)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Technicians Comparison & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Technicians Cards */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span>{t.reports.techniciansSection}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {report?.technicianBreakdown && report.technicianBreakdown.length > 0 ? (
              report.technicianBreakdown.map((tech) => {
                const isPartner = tech.isPartner
                return (
                  <div
                    key={tech.technicianId}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                        <span>{tech.technician}</span>
                        {isPartner ? (
                          <Badge variant="secondary" className="text-[10px] bg-purple-100 text-purple-800 border-purple-200">
                            استثناء 100% للشريك
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-800 border-blue-200">
                            تقسيم نسبي حسب التصنيف
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 font-semibold">
                        {tech.ticketsCount} أجهزة منجزة
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-start pt-1">
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-[11px] text-slate-500 block">إجمالي الدخل</span>
                        <span className="text-xs font-bold text-slate-800 font-mono block mt-0.5">
                          {formatCurrency(tech.totalRevenue)}
                        </span>
                      </div>

                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-[11px] text-blue-700 font-semibold block">حصتي</span>
                        <span className="text-xs font-extrabold text-blue-700 font-mono block mt-0.5">
                          {formatCurrency(tech.myShare)}
                        </span>
                      </div>

                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-[11px] text-purple-700 font-semibold block">حصة الشريك</span>
                        <span className="text-xs font-extrabold text-purple-700 font-mono block mt-0.5">
                          {formatCurrency(tech.partnerShare)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                لا توجد تذاكر منجزة للفنيين في هذا النطاق الزمني
              </div>
            )}
          </CardContent>
        </Card>

        {/* Categories Breakdown */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600" />
              <span>{t.reports.categoriesSection}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5">
            {report?.categoryBreakdown && report.categoryBreakdown.length > 0 ? (
              report.categoryBreakdown.map((cat) => (
                <div
                  key={cat.categoryId}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 transition-colors flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{cat.categoryName}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">
                        {cat.splitPercentage}% لي
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {cat.ticketsCount} أجهزة صيانة
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-start font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 block">الإجمالي</span>
                      <span className="font-bold text-slate-800">{formatCurrency(cat.totalRevenue)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-blue-600 block">حصتي</span>
                      <span className="font-bold text-blue-700">{formatCurrency(cat.myShare)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-purple-600 block">الشريك</span>
                      <span className="font-bold text-purple-700">{formatCurrency(cat.partnerShare)}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                لا توجد إيرادات مسجلة حسب التصنيفات في هذا النطاق الزمني
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delivered Tickets Financial Ledger Table */}
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-200 bg-slate-50/60">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>{t.reports.ticketsLedgerSection}</span>
            </CardTitle>
            <span className="text-xs text-slate-500 font-semibold font-mono">
              {report?.tickets?.filter((t) => t.status === 'delivered').length || 0} تذكرة مسلّمة
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          {report?.tickets && report.tickets.filter((t) => t.status === 'delivered').length > 0 ? (
            <table className="w-full text-xs text-start border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-bold">
                  <th className="py-3 px-4 text-start">{t.reports.table.ticketNumber}</th>
                  <th className="py-3 px-4 text-start">{t.reports.table.customer}</th>
                  <th className="py-3 px-4 text-start">{t.reports.table.device}</th>
                  <th className="py-3 px-4 text-start">{t.reports.table.category}</th>
                  <th className="py-3 px-4 text-start">{t.reports.table.technician}</th>
                  <th className="py-3 px-4 text-start">{t.reports.table.price}</th>
                  <th className="py-3 px-4 text-start text-blue-700">{t.reports.table.myShare}</th>
                  <th className="py-3 px-4 text-start text-purple-700">{t.reports.table.partnerShare}</th>
                  <th className="py-3 px-4 text-start">{t.reports.table.paymentStatus}</th>
                  <th className="py-3 px-4 text-start">{t.reports.table.date}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.tickets
                  .filter((t) => t.status === 'delivered')
                  .map((tItem) => (
                    <tr
                      key={tItem.id}
                      onClick={() => onOpenTicketDetails && onOpenTicketDetails(tItem.id)}
                      className="hover:bg-slate-50/90 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {tItem.barcode_code}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800 block">{tItem.customer_name}</span>
                        <span className="text-[11px] text-slate-400 font-mono" dir="ltr">
                          {tItem.customer_phone}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-800 font-semibold block">{tItem.brand} {tItem.model}</span>
                        <span className="text-[10px] font-mono font-bold bg-slate-200 px-1.5 py-0.2 rounded text-slate-700 inline-block">
                          {tItem.short_label}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {tItem.category_name}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={tItem.technician_is_partner ? 'secondary' : 'outline'}
                          className="text-[11px] font-bold"
                        >
                          {tItem.technician}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-extrabold text-slate-900 font-mono">
                        {formatCurrency(tItem.price)}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-blue-700 font-mono">
                        {formatCurrency(tItem.my_share ?? 0)}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-purple-700 font-mono">
                        {formatCurrency(tItem.partner_share ?? 0)}
                      </td>
                      <td className="py-3 px-4">
                        {tItem.amount_remaining > 0 ? (
                          <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                            دين ({formatCurrency(tItem.amount_remaining)})
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            خالص نقداً
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-500 font-mono" dir="ltr">
                        {formatDate(tItem.created_at)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <div className="py-12 text-center text-slate-400 space-y-1">
              <p className="font-bold text-sm text-slate-600">{t.reports.emptyReports}</p>
              <p className="text-xs">{t.reports.emptyReportsSubtitle}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
