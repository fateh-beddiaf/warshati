import * as React from 'react'
import { motion } from 'framer-motion'
import { Coins, CreditCard, TrendingDown, TrendingUp, User, Users, Wrench } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { Card, CardContent } from '../../components/ui/Card'
import { Skeleton } from '../../components/ui/Skeleton'
import { AnimatedNumber } from '../../components/AnimatedNumber'
import { cn, formatCurrency } from '../../lib/utils'
import { listContainer, listItem } from '../../lib/motion'
import type { FinancialReportResult } from '../../../shared/types'

type Tone = 'success' | 'primary' | 'partner' | 'warning' | 'neutral' | 'danger'

// Static class strings so Tailwind can see them
const TONES: Record<Tone, { glow: string; bar: string; icon: string }> = {
  success: {
    glow: 'from-success/10',
    bar: 'bg-success',
    icon: 'bg-success-soft text-success-soft-foreground'
  },
  primary: {
    glow: 'from-primary/10',
    bar: 'bg-primary',
    icon: 'bg-accent text-accent-foreground'
  },
  partner: {
    glow: 'from-primary-to/10',
    bar: 'bg-primary-to',
    icon: 'bg-primary-to/15 text-primary-to'
  },
  warning: {
    glow: 'from-warning/10',
    bar: 'bg-warning',
    icon: 'bg-warning-soft text-warning-soft-foreground'
  },
  neutral: {
    glow: 'from-muted-foreground/10',
    bar: 'bg-muted-foreground',
    icon: 'bg-muted text-muted-foreground'
  },
  danger: {
    glow: 'from-danger/10',
    bar: 'bg-danger',
    icon: 'bg-danger-soft text-danger-soft-foreground'
  }
}

interface StatCardProps {
  testId: string
  tone: Tone
  icon: React.ReactNode
  label: string
  value: number
  valueClassName?: string
  footerStart: React.ReactNode
  footerEnd: React.ReactNode
  skeleton: boolean
}

function StatCard({
  testId,
  tone,
  icon,
  label,
  value,
  valueClassName,
  footerStart,
  footerEnd,
  skeleton
}: StatCardProps): React.JSX.Element {
  const styles = TONES[tone]
  return (
    <motion.div variants={listItem}>
      <Card className="relative h-full overflow-hidden">
        <div aria-hidden className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent', styles.glow)} />
        <div aria-hidden className={cn('absolute inset-x-0 top-0 h-1', styles.bar)} />
        <CardContent className="relative p-5">
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs font-bold text-muted-foreground">{label}</span>
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', styles.icon)}>
              {icon}
            </div>
          </div>
          {skeleton ? (
            <>
              <Skeleton className="mt-3 h-8 w-32" />
              <Skeleton className="mt-4 h-4 w-full" />
            </>
          ) : (
            <>
              <p className={cn('mt-3 text-2xl font-extrabold tabular text-foreground', valueClassName)}>
                <AnimatedNumber value={value} format={formatCurrency} data-testid={testId} />
              </p>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3 text-[11px] font-medium text-muted-foreground">
                {footerStart}
                {footerEnd}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

interface ReportStatCardsProps {
  report: FinancialReportResult | null
  /** First load (no data yet and no error): show skeletons instead of zeros */
  initialLoading: boolean
}

export function ReportStatCards({ report, initialLoading }: ReportStatCardsProps): React.JSX.Element {
  const { t } = useI18n()
  const revenue = report?.totalRevenue || 0
  const partsCost = report?.totalPartsCost || 0
  const netProfit = report?.totalNetProfit || 0
  const isLoss = netProfit < 0
  const lossCount = report?.lossTicketsCount || 0
  // Shares are taken from the NET profit, so their percentages are relative to it
  const pct = (part: number): string => (report && netProfit > 0 ? `${Math.round((part / netProfit) * 100)}%` : '-')
  const shareClass = (value: number, base: string): string => (value < 0 ? 'text-danger' : base)
  const text = t.ui.partsCost.reports

  return (
    <motion.div
      variants={listContainer}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <StatCard
        testId="stat-revenue"
        tone="success"
        icon={<Coins className="h-4 w-4" />}
        label={t.reports.kpi.totalRevenue}
        value={revenue}
        skeleton={initialLoading}
        footerStart={
          <span>
            <span className="tabular">{report?.completedTicketsCount || 0}</span> {t.reports.kpi.completedCount}
          </span>
        }
        footerEnd={<span className="font-bold text-success-soft-foreground">{t.ui.reports.fullIncome}</span>}
      />
      <StatCard
        testId="stat-parts-cost"
        tone="neutral"
        icon={<Wrench className="h-4 w-4" />}
        label={text.partsCost}
        value={partsCost}
        skeleton={initialLoading}
        footerStart={<span>{text.partsCostDesc}</span>}
        footerEnd={null}
      />
      <StatCard
        testId="stat-net-profit"
        tone={isLoss ? 'danger' : 'success'}
        icon={isLoss ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
        label={text.netProfit}
        value={netProfit}
        valueClassName={isLoss ? 'text-danger' : undefined}
        skeleton={initialLoading}
        footerStart={<span>{text.netProfitDesc}</span>}
        footerEnd={
          lossCount > 0 ? (
            <span data-testid="stat-loss-count" className="font-bold tabular text-danger">
              {text.lossesCount.replace('{count}', String(lossCount))}
            </span>
          ) : null
        }
      />
      <StatCard
        testId="stat-my-share"
        tone="primary"
        icon={<User className="h-4 w-4" />}
        label={t.reports.kpi.myTotalShare}
        value={report?.totalMyShare || 0}
        valueClassName={shareClass(report?.totalMyShare || 0, 'text-primary')}
        skeleton={initialLoading}
        footerStart={<span>{t.reports.kpi.myTotalShareDesc}</span>}
        footerEnd={<span className="font-bold tabular text-primary">{pct(report?.totalMyShare || 0)}</span>}
      />
      <StatCard
        testId="stat-partner-share"
        tone="partner"
        icon={<Users className="h-4 w-4" />}
        label={t.reports.kpi.partnerTotalShare}
        value={report?.totalPartnerShare || 0}
        valueClassName={shareClass(report?.totalPartnerShare || 0, 'text-primary-to')}
        skeleton={initialLoading}
        footerStart={<span>{t.reports.kpi.partnerTotalShareDesc}</span>}
        footerEnd={
          <span className="font-bold tabular text-primary-to">{pct(report?.totalPartnerShare || 0)}</span>
        }
      />
      <StatCard
        testId="stat-debt"
        tone="warning"
        icon={<CreditCard className="h-4 w-4" />}
        label={t.reports.kpi.outstandingDebt}
        value={report?.totalOutstandingDebt || 0}
        valueClassName={Number(report?.totalOutstandingDebt) > 0 ? 'text-warning' : undefined}
        skeleton={initialLoading}
        footerStart={<span>{t.reports.kpi.outstandingDebtDesc}</span>}
        footerEnd={
          <span className="tabular">
            {t.ui.reports.paidLabel} {formatCurrency(report?.totalPaid || 0)}
          </span>
        }
      />
    </motion.div>
  )
}
