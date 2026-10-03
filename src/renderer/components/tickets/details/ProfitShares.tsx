import * as React from 'react'
import { PieChart, Sparkles } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { formatCurrency } from '../../../lib/utils'
import { AnimatedNumber } from '../../AnimatedNumber'
import type { DisplayedProfitSplit } from './profitSplit'

interface ShareCardProps {
  label: string
  percentage: number
  amount: number
  caption: string
  tone: 'owner' | 'partner'
  testId: string
}

function ShareCard({ label, percentage, amount, caption, tone, testId }: ShareCardProps): React.JSX.Element {
  const owner = tone === 'owner'
  return (
    <div
      data-testid={testId}
      className={
        owner
          ? 'space-y-2 rounded-xl border-2 border-primary/30 bg-primary/10 p-4'
          : 'space-y-2 rounded-xl border-2 border-primary-to/30 bg-primary-to/10 p-4'
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-foreground">{label}</span>
        <span
          className={
            owner
              ? 'tabular rounded-md bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground'
              : 'tabular rounded-md bg-primary-to px-2 py-0.5 text-xs font-bold text-primary-foreground'
          }
        >
          {percentage}%
        </span>
      </div>
      <p className={owner ? 'tabular text-3xl font-extrabold leading-tight text-primary' : 'tabular text-3xl font-extrabold leading-tight text-primary-to'}>
        <AnimatedNumber value={amount} format={formatCurrency} />
      </p>
      <p className="tabular text-xs text-muted-foreground">{caption}</p>
    </div>
  )
}

/**
 * The financially sensitive moment of closing a ticket: both shares shown LARGE before the
 * final confirmation (frontend-design rule for the delivery screen).
 */
export function ProfitShares({ split, price }: { split: DisplayedProfitSplit; price: number }): React.JSX.Element {
  const { t } = useI18n()
  const caption = t.ui.details.shareCaption.replace('{total}', formatCurrency(price))

  return (
    <section data-testid="profit-shares" className="space-y-3 rounded-xl border border-border bg-muted/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <PieChart className="h-4 w-4 text-primary" />
          <span>{t.profit.splitBreakdownTitle}</span>
        </div>
        {split.isPartnerExclusive ? (
          <span className="flex items-center gap-1 rounded-full border border-warning/30 bg-warning-soft px-2.5 py-0.5 text-[11px] font-bold text-warning-soft-foreground">
            <Sparkles className="h-3 w-3" />
            {t.profit.partnerExclusiveBadge}
          </span>
        ) : (
          <span className="tabular text-[11px] font-semibold text-muted-foreground">
            {t.profit.categorySplitNote
              .replace('{mySplit}', String(split.myPercentage))
              .replace('{partnerSplit}', String(split.partnerPercentage))}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ShareCard
          testId="share-owner"
          tone="owner"
          label={t.profit.ownerShareLabel}
          percentage={split.myPercentage}
          amount={split.myShare}
          caption={caption}
        />
        <ShareCard
          testId="share-partner"
          tone="partner"
          label={t.profit.partnerShareLabel}
          percentage={split.partnerPercentage}
          amount={split.partnerShare}
          caption={caption}
        />
      </div>
    </section>
  )
}
