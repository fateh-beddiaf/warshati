import * as React from 'react'
import { useState } from 'react'
import { AlertTriangle, RefreshCw, TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'
import { useI18n } from '../lib/i18n'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/PageHeader'
import { toLocalDateString, startOfMonthLocalString } from '../../shared/date-utils'
import type { ReportPeriod } from '../../shared/types'
import { fadeIn } from '../lib/motion'
import { useReportData } from './reports/useReportData'
import { ReportFilters } from './reports/ReportFilters'
import { ReportStatCards } from './reports/ReportStatCards'
import { ShareSplitBar } from './reports/ShareSplitBar'
import { ReportBreakdowns } from './reports/ReportBreakdowns'
import { ReportLedger } from './reports/ReportLedger'

interface ReportsScreenProps {
  onOpenTicketDetails?: (ticketId: number) => void
}

export function ReportsScreen({ onOpenTicketDetails }: ReportsScreenProps): React.JSX.Element {
  const { t } = useI18n()
  const [period, setPeriod] = useState<ReportPeriod>('this_month')

  // Local calendar dates (toISOString would shift the day around local midnight)
  const [startDate, setStartDate] = useState<string>(() => startOfMonthLocalString(new Date()))
  const [endDate, setEndDate] = useState<string>(() => toLocalDateString(new Date()))
  const [technicianFilter, setTechnicianFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const filters = { period, startDate, endDate, technicianFilter, categoryFilter }
  const { report, metadata, loading, loadError, deliveredTickets, reload } = useReportData(filters)

  // First load: skeletons instead of zeros. After an error the empty states are shown, not skeletons.
  const initialLoading = loading && !report && !loadError

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.reports.title}
        subtitle={t.reports.subtitle}
        icon={<TrendingUp />}
        actions={
          <Button type="button" variant="outline" onClick={() => reload()} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t.ui.reports.refresh}</span>
          </Button>
        }
      />

      <ReportFilters
        filters={filters}
        metadata={metadata}
        onPeriodChange={setPeriod}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onTechnicianChange={setTechnicianFilter}
        onCategoryChange={setCategoryFilter}
      />

      {/* Report load error (replaces silently showing stale data) */}
      {loadError && (
        <motion.div
          {...fadeIn}
          data-testid="report-error"
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-danger/25 bg-danger-soft p-3 text-xs font-semibold text-danger-soft-foreground"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{loadError}</span>
        </motion.div>
      )}

      <ReportStatCards report={report} initialLoading={initialLoading} />
      <ShareSplitBar report={report} />
      <ReportBreakdowns report={report} initialLoading={initialLoading} />
      <ReportLedger
        tickets={deliveredTickets}
        initialLoading={initialLoading}
        onOpenTicketDetails={onOpenTicketDetails}
      />
    </div>
  )
}
