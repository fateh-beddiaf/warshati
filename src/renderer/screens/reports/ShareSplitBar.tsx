import * as React from 'react'
import { Card, CardContent } from '../../components/ui/Card'
import { formatCurrency } from '../../lib/utils'
import { useI18n } from '../../lib/i18n'
import type { FinancialReportResult } from '../../../shared/types'

/** Token-coloured bar: my share vs the partner's share of the period's revenue. */
export function ShareSplitBar({ report }: { report: FinancialReportResult | null }): React.JSX.Element | null {
  const { t } = useI18n()
  if (!report) return null
  const total = report.totalMyShare + report.totalPartnerShare
  if (total <= 0) return null

  // A negative share (a loss) cannot be drawn as a proportion: the bar is then clamped, the numbers stay exact
  const minePct = Math.min(100, Math.max(0, (report.totalMyShare / total) * 100))
  const partnerPct = 100 - minePct

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-muted-foreground">
          <span>{t.ui.reports.splitTitle}</span>
        </div>
        <div
          className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`${t.reports.table.myShare} ${Math.round(minePct)}% / ${t.reports.table.partnerShare} ${Math.round(partnerPct)}%`}
        >
          <div
            className="h-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${minePct}%` }}
          />
          <div
            className="h-full bg-primary-to transition-[width] duration-300 ease-out"
            style={{ width: `${partnerPct}%` }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-foreground">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-primary" />
            {t.ui.reports.myShareShort}
            <span className="flex items-center gap-2 tabular text-muted-foreground">
              <span className={report.totalMyShare < 0 ? 'text-danger' : undefined}>
                {formatCurrency(report.totalMyShare)}
              </span>
              <span dir="ltr">{Math.round(minePct)}%</span>
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-foreground">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-primary-to" />
            {t.ui.reports.partnerShareShort}
            <span className="flex items-center gap-2 tabular text-muted-foreground">
              <span className={report.totalPartnerShare < 0 ? 'text-danger' : undefined}>
                {formatCurrency(report.totalPartnerShare)}
              </span>
              <span dir="ltr">{Math.round(partnerPct)}%</span>
            </span>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
