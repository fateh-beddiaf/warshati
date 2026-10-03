import * as React from 'react'
import { motion } from 'framer-motion'
import { Calendar } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { Card, CardContent } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { fadeIn } from '../../lib/motion'
import type { AppMetadata, ReportPeriod } from '../../../shared/types'
import type { ReportFilters as ReportFiltersState } from './useReportData'

interface ReportFiltersProps {
  filters: ReportFiltersState
  metadata: AppMetadata | null
  onPeriodChange: (period: ReportPeriod) => void
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onTechnicianChange: (value: string) => void
  onCategoryChange: (value: string) => void
}

interface FilterSelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}

/** Native select (the e2e smoke test drives it with selectOption) styled with the design tokens. */
function FilterSelect({ label, value, onChange, children }: FilterSelectProps): React.JSX.Element {
  return (
    <label className="flex h-9 items-center gap-2 rounded-lg border border-input bg-card ps-3 pe-1 text-xs transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40">
      <span className="font-semibold text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full cursor-pointer bg-transparent pe-2 text-xs font-bold text-foreground focus:outline-none [&>option]:bg-popover [&>option]:text-popover-foreground"
      >
        {children}
      </select>
    </label>
  )
}

export function ReportFilters({
  filters,
  metadata,
  onPeriodChange,
  onStartDateChange,
  onEndDateChange,
  onTechnicianChange,
  onCategoryChange
}: ReportFiltersProps): React.JSX.Element {
  const { t } = useI18n()

  const periodItems: Array<{ value: ReportPeriod; label: string; testId: string }> = [
    { value: 'today', label: t.reports.today, testId: 'period-today' },
    { value: 'this_week', label: t.reports.thisWeek, testId: 'period-this_week' },
    { value: 'this_month', label: t.reports.thisMonth, testId: 'period-this_month' },
    { value: 'all_time', label: t.reports.allTime, testId: 'period-all_time' },
    { value: 'custom', label: t.reports.custom, testId: 'period-custom' }
  ]

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              {t.reports.periodFilter}
            </span>
            <SegmentedControl
              items={periodItems}
              value={filters.period}
              onChange={onPeriodChange}
              layoutGroup="reports-period"
              ariaLabel={t.ui.reports.periodAria}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              label={t.reports.filterByTechnician}
              value={filters.technicianFilter}
              onChange={onTechnicianChange}
            >
              <option value="all">{t.reports.allTechnicians}</option>
              {metadata?.technicians?.map((technician) => (
                <option key={technician.id} value={String(technician.id)}>
                  {technician.name}
                </option>
              ))}
            </FilterSelect>

            <FilterSelect
              label={t.reports.filterByCategory}
              value={filters.categoryFilter}
              onChange={onCategoryChange}
            >
              <option value="all">{t.reports.allCategories}</option>
              {metadata?.repairCategories?.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.default_split_percentage}%)
                </option>
              ))}
            </FilterSelect>
          </div>
        </div>

        {filters.period === 'custom' && (
          <motion.div
            {...fadeIn}
            className="flex flex-wrap items-center gap-4 border-t border-border pt-4 text-xs"
          >
            <label className="flex items-center gap-2">
              <span className="font-semibold text-muted-foreground">{t.reports.from}</span>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="h-9 w-40 text-xs font-bold tabular"
              />
            </label>

            <label className="flex items-center gap-2">
              <span className="font-semibold text-muted-foreground">{t.reports.to}</span>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="h-9 w-40 text-xs font-bold tabular"
              />
            </label>
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}
