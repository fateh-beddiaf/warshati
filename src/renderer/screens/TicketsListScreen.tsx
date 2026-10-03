import * as React from 'react'
import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../lib/i18n'
import { Card, CardContent } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { formatCurrency, formatDate } from '../lib/utils'
import type { TicketListItem, TicketStatus } from '../../database/types'
import {
  Search,
  PlusCircle,
  Clock,
  CheckCircle,
  PackageCheck,
  RefreshCw,
  Phone,
  User,
  Smartphone,
  Printer,
  AlertTriangle,
  SlidersHorizontal
} from 'lucide-react'

interface TicketsListScreenProps {
  onNewTicketClick: () => void
  onOpenTicketDetails?: (ticketId: number) => void
  onPrintTicket?: (ticket: TicketListItem) => void
  /** Bump to refetch the list in place (without remounting the screen) */
  refreshKey?: number
}

export function TicketsListScreen({
  onNewTicketClick,
  onOpenTicketDetails,
  onPrintTicket,
  refreshKey = 0
}: TicketsListScreenProps): React.JSX.Element {
  const { t } = useI18n()
  const [tickets, setTickets] = useState<TicketListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')


  // Threshold settings state
  const [overdueThreshold, setOverdueThreshold] = useState<number>(3)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [customThresholdInput, setCustomThresholdInput] = useState('3')

  const latestRequestRef = useRef(0)

  const fetchTicketsAndSettings = async (): Promise<void> => {
    const requestId = ++latestRequestRef.current
    setLoading(true)
    try {
      const [ticketsRes, thresholdRes] = await Promise.all([
        window.api.getTicketsList(searchQuery, statusFilter === 'overdue' ? 'ready' : statusFilter),
        window.api.getOverdueDays()
      ])

      // Ignore out-of-order responses (fast typing / quick filter switches)
      if (requestId !== latestRequestRef.current) return

      if (ticketsRes.success && ticketsRes.data) {
        if (statusFilter === 'overdue') {
          setTickets(ticketsRes.data.filter((t) => t.is_overdue))
        } else {
          setTickets(ticketsRes.data)
        }
      }

      if (thresholdRes.success && thresholdRes.data !== undefined) {
        setOverdueThreshold(thresholdRes.data)
        setCustomThresholdInput(String(thresholdRes.data))
      }
    } catch (err) {
      console.error('Error fetching tickets:', err)
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false)
    }
  }

  // Load tickets on search / filter changes and when the parent requests a refresh
  useEffect(() => {
    fetchTicketsAndSettings()
  }, [searchQuery, statusFilter, refreshKey])

  const handleSaveThreshold = async (): Promise<void> => {
    const parsed = parseInt(customThresholdInput, 10)
    if (!isNaN(parsed) && parsed > 0) {
      await window.api.setSetting('overdue_ready_days', String(parsed))
      setOverdueThreshold(parsed)
      setIsSettingsOpen(false)
      fetchTicketsAndSettings()
    }
  }

  const overdueCount = tickets.filter((t) => t.is_overdue).length

  const getStatusBadge = (ticket: TicketListItem): React.JSX.Element => {
    switch (ticket.status) {
      case 'in_progress':
        return (
          <Badge variant="warning" className="gap-1 font-bold">
            <Clock className="h-3 w-3" />
            {t.status.in_progress}
          </Badge>
        )
      case 'ready':
        return (
          <div className="flex flex-col gap-1 items-start">
            <Badge variant="success" className="gap-1 font-bold">
              <CheckCircle className="h-3 w-3" />
              {t.status.ready}
            </Badge>
            {ticket.is_overdue && (
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-amber-500 text-white px-2 py-0.5 rounded-md shadow-xs animate-pulse">
                <AlertTriangle className="h-2.5 w-2.5" />
                {t.lifecycle.overdueBadge.replace('{days}', String(ticket.overdue_days || 0))}
              </span>
            )}
          </div>
        )
      case 'delivered':
        return (
          <Badge variant="secondary" className="gap-1">
            <PackageCheck className="h-3 w-3" />
            {t.status.delivered}
          </Badge>
        )
      default:
        return <Badge variant="outline">{ticket.status}</Badge>
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {t.ticketsList.title}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">{t.ticketsList.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Threshold Adjuster Toggle */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="text-xs text-slate-700 font-semibold gap-1.5"
            title="تعديل عتبة أيام التنبيه"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
            <span>تنبيه التأخر: {overdueThreshold} أيام</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={fetchTicketsAndSettings}
            title="تحديث القائمة"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            type="button"
            onClick={onNewTicketClick}
            className="shadow-md shadow-blue-500/20"
          >
            <PlusCircle className="h-4 w-4 me-1.5" />
            {t.nav.newTicket}
          </Button>
        </div>
      </div>

      {/* Threshold Setting Popup */}
      {isSettingsOpen && (
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <SlidersHorizontal className="h-4 w-4 text-blue-600" />
            <span>{t.lifecycle.thresholdSettingsLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="1"
              max="30"
              value={customThresholdInput}
              onChange={(e) => setCustomThresholdInput(e.target.value)}
              className="w-20 h-8 text-xs font-bold text-center"
            />
            <span className="text-xs text-slate-500">أيام</span>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveThreshold}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
            >
              حفظ
            </Button>
          </div>
        </div>
      )}

      {/* Overdue Alert Banner if present */}
      {overdueCount > 0 && statusFilter !== 'overdue' && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <p className="text-xs font-bold">
              {t.ticketsList.overdueAlertCard
                .replace('{count}', String(overdueCount))
                .replace('{threshold}', String(overdueThreshold))}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="overdue-banner"
            onClick={() => setStatusFilter('overdue')}
            className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100 text-xs font-bold"
          >
            عرض المتأخرة فقط
          </Button>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[280px]">
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.ticketsList.searchPlaceholder}
            className="ps-9"
          />
          <Search className="absolute start-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            data-testid="filter-all"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.ticketsList.filterAll}
          </button>
          <button
            type="button"
            data-testid="filter-in_progress"
            onClick={() => setStatusFilter('in_progress')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              statusFilter === 'in_progress'
                ? 'bg-white text-amber-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.ticketsList.filterInProgress}
          </button>
          <button
            type="button"
            data-testid="filter-ready"
            onClick={() => setStatusFilter('ready')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              statusFilter === 'ready'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.ticketsList.filterReady}
          </button>
          <button
            type="button"
            data-testid="filter-overdue"
            onClick={() => setStatusFilter('overdue')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
              statusFilter === 'overdue'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-amber-700 hover:text-amber-900'
            }`}
          >
            <AlertTriangle className="h-3 w-3" />
            <span>{t.ticketsList.filterOverdue}</span>
          </button>
          <button
            type="button"
            data-testid="filter-delivered"
            onClick={() => setStatusFilter('delivered')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              statusFilter === 'delivered'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.ticketsList.filterDelivered}
          </button>
        </div>
      </div>

      {/* Tickets Table / List */}
      {tickets.length > 0 ? (
        <Card className="overflow-hidden border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3.5 text-start">{t.ticketsList.table.ticketNumber}</th>
                  <th className="px-4 py-3.5 text-start">{t.ticketsList.table.customer}</th>
                  <th className="px-4 py-3.5 text-start">{t.ticketsList.table.device}</th>
                  <th className="px-4 py-3.5 text-start">{t.ticketsList.table.category}</th>
                  <th className="px-4 py-3.5 text-start">{t.ticketsList.table.price}</th>
                  <th className="px-4 py-3.5 text-start">{t.ticketsList.table.remaining}</th>
                  <th className="px-4 py-3.5 text-start">{t.ticketsList.table.technician}</th>
                  <th className="px-4 py-3.5 text-start">{t.ticketsList.table.status}</th>
                  <th className="px-4 py-3.5 text-start">{t.ticketsList.table.createdAt}</th>
                  <th className="px-4 py-3.5 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {tickets.map((ticket) => {
                  const isOverdue = ticket.status === 'ready' && ticket.is_overdue
                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => onOpenTicketDetails && onOpenTicketDetails(ticket.id)}
                      className={`transition-colors group cursor-pointer ${
                        isOverdue
                          ? 'bg-amber-50/70 hover:bg-amber-100/70 border-s-4 border-s-amber-500'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Barcode & ID */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-2 py-1 rounded w-fit border border-slate-200">
                            {ticket.barcode_code}
                          </span>
                          <span className="text-xs text-slate-400 mt-1">#{ticket.id}</span>
                        </div>
                      </td>

                      {/* Customer Info */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 font-bold text-slate-900">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            <span>{ticket.customer_name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono mt-0.5" dir="ltr">
                            <span>{ticket.customer_phone}</span>
                            <Phone className="h-3 w-3 text-slate-400" />
                          </div>
                        </div>
                      </td>

                      {/* Device */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                            <Smartphone className="h-3.5 w-3.5 text-indigo-500" />
                            <span>{ticket.brand} {ticket.model}</span>
                          </div>
                          {ticket.short_label && (
                            <span className="text-xs font-mono font-bold text-indigo-600 mt-0.5">
                              {ticket.short_label}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Repair Category */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
                          {ticket.category_name || 'عام'}
                        </span>
                      </td>

                      {/* Total Price */}
                      <td className="px-4 py-4 whitespace-nowrap font-bold text-slate-900">
                        {formatCurrency(ticket.price)}
                      </td>

                      {/* Remaining Amount */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        {ticket.amount_remaining > 0 ? (
                          <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-xs">
                            {formatCurrency(ticket.amount_remaining)}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            خالص
                          </span>
                        )}
                      </td>

                      {/* Technician */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-800">
                          {ticket.technician}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        {getStatusBadge(ticket)}
                      </td>

                      {/* Created Date */}
                      <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-500">
                        {formatDate(ticket.created_at)}
                      </td>

                      {/* Action: Reprint Barcode Button */}
                      <td className="px-4 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          data-testid="row-print"
                          onClick={() => onPrintTicket && onPrintTicket(ticket)}
                          className="text-xs text-slate-700 hover:text-blue-600 hover:border-blue-300 gap-1.5"
                          title={t.print.reprintButton}
                        >
                          <Printer className="h-3.5 w-3.5 text-blue-600" />
                          <span>طباعة</span>
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="p-12 text-center border-dashed border-2 border-slate-300">
          <CardContent className="flex flex-col items-center justify-center p-0 space-y-3">
            <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <Search className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">{t.ticketsList.emptyTitle}</h3>
            <p className="text-sm text-slate-500 max-w-sm">{t.ticketsList.emptySubtitle}</p>
            <Button
              type="button"
              onClick={onNewTicketClick}
              className="mt-2 shadow-sm"
            >
              <PlusCircle className="h-4 w-4 me-1.5" />
              {t.nav.newTicket}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
