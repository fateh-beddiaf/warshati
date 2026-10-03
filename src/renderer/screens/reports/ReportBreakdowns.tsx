import * as React from 'react'
import { motion } from 'framer-motion'
import { Layers, Users } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Skeleton } from '../../components/ui/Skeleton'
import { formatCurrency } from '../../lib/utils'
import { listContainer, listItemProps } from '../../lib/motion'
import type { FinancialReportResult } from '../../../shared/types'

interface ReportBreakdownsProps {
  report: FinancialReportResult | null
  initialLoading: boolean
}

function BreakdownSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-3" aria-hidden>
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  )
}

function EmptyNote({ text }: { text: string }): React.JSX.Element {
  return <div className="py-8 text-center text-xs text-muted-foreground">{text}</div>
}

function ShareCell({
  label,
  value,
  tone
}: {
  label: string
  value: number
  tone: 'neutral' | 'primary' | 'partner'
}): React.JSX.Element {
  const toneClass =
    tone === 'primary' ? 'text-primary' : tone === 'partner' ? 'text-primary-to' : 'text-foreground'
  return (
    <div className="rounded-lg border border-border bg-card p-2">
      <span className={`block text-[11px] font-semibold ${tone === 'neutral' ? 'text-muted-foreground' : toneClass}`}>
        {label}
      </span>
      <span className={`mt-0.5 block text-xs font-extrabold tabular ${toneClass}`}>
        {formatCurrency(value)}
      </span>
    </div>
  )
}

export function ReportBreakdowns({ report, initialLoading }: ReportBreakdownsProps): React.JSX.Element {
  const { t } = useI18n()
  const technicians = report?.technicianBreakdown ?? []
  const categories = report?.categoryBreakdown ?? []

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Technicians */}
      <Card>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-primary" />
            <span>{t.reports.techniciansSection}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          {initialLoading ? (
            <BreakdownSkeleton />
          ) : technicians.length > 0 ? (
            <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-3">
              {technicians.map((tech, index) => (
                <motion.div
                  key={tech.technicianId}
                  {...listItemProps(index)}
                  className="space-y-2.5 rounded-xl border border-border bg-muted/40 p-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-foreground">
                      <span>{tech.technician}</span>
                      {tech.isPartner ? (
                        <Badge variant="default" className="text-[10px]">
                          {t.ui.reports.partnerException}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          {t.ui.reports.proportionalSplit}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {t.ui.reports.devicesDone.replace('{count}', String(tech.ticketsCount))}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-start">
                    <ShareCell label={t.ui.reports.totalIncome} value={tech.totalRevenue} tone="neutral" />
                    <ShareCell label={t.ui.reports.myShareShort} value={tech.myShare} tone="primary" />
                    <ShareCell label={t.ui.reports.partnerShareShort} value={tech.partnerShare} tone="partner" />
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <EmptyNote text={t.ui.reports.noTechniciansData} />
          )}
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Layers className="h-4 w-4 text-primary-to" />
            <span>{t.reports.categoriesSection}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 p-4">
          {initialLoading ? (
            <BreakdownSkeleton />
          ) : categories.length > 0 ? (
            <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-2.5">
              {categories.map((cat, index) => (
                <motion.div
                  key={cat.categoryId}
                  {...listItemProps(index)}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-xs transition-colors hover:bg-accent/40"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{cat.categoryName}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular text-muted-foreground">
                        {t.ui.reports.percentMine.replace('{pct}', String(cat.splitPercentage))}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {t.ui.reports.devicesRepaired.replace('{count}', String(cat.ticketsCount))}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-start tabular">
                    <div>
                      <span className="block text-[10px] text-muted-foreground">{t.ui.reports.totalWord}</span>
                      <span className="font-bold text-foreground">{formatCurrency(cat.totalRevenue)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-primary">{t.ui.reports.myShareShort}</span>
                      <span className="font-bold text-primary">{formatCurrency(cat.myShare)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-primary-to">{t.ui.reports.partnerWord}</span>
                      <span className="font-bold text-primary-to">{formatCurrency(cat.partnerShare)}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <EmptyNote text={t.ui.reports.noCategoriesData} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
