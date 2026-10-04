import * as React from 'react'
import { AlertTriangle, Eye, EyeOff, Hourglass, Pencil, Plus, TrendingDown } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { cn, formatCurrency } from '../../../lib/utils'
import { Button } from '../../ui/Button'
import { useAutoHide } from '../../parts-cost/MaskedAmountInput'
import type { TicketFullDetails } from '../../../../shared/types'
import type { TicketDetailsState } from './useTicketDetailsState'

function Cell({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="min-w-0 space-y-1">
      <span className="block text-[11px] font-semibold text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

/**
 * Profit block of the details modal: price, parts cost (hidden by default: dots + eye), net profit,
 * both shares, and the "provisional" / "loss" badges. The cost can be added or edited in any status.
 */
export function PartsCostSection({
  ticketDetails,
  state
}: {
  ticketDetails: TicketFullDetails
  state: Pick<TicketDetailsState, 'profitSplit' | 'partsCost'>
}): React.JSX.Element {
  const { t } = useI18n()
  const text = t.ui.partsCost.details
  const { ticket } = ticketDetails
  const { profitSplit, partsCost: editor } = state
  const { revealed, toggle, hide } = useAutoHide()
  // A different ticket, or a cost that just changed, always starts hidden again
  React.useEffect(hide, [hide, ticket.id, ticket.parts_cost])

  const entered = ticket.parts_cost !== null && ticket.parts_cost !== undefined
  const loss = profitSplit.isLoss
  const moneyTone = loss ? 'text-danger' : undefined
  const hidden = text.hiddenValue
  const eyeLabel = revealed ? text.hideCostProfit : text.showCostProfit

  return (
    <div data-testid="parts-cost-section" className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-muted-foreground">
          <span>{text.costTitle}</span>
          {profitSplit.isProvisional && (
            <span
              data-testid="profit-provisional-badge"
              className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning-soft px-2 py-0.5 text-[11px] font-bold text-warning-soft-foreground"
            >
              <Hourglass className="h-3 w-3" />
              {text.provisionalBadge}
            </span>
          )}
          {loss && (
            <span
              data-testid="profit-loss-badge"
              className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger-soft px-2 py-0.5 text-[11px] font-bold text-danger-soft-foreground"
            >
              <TrendingDown className="h-3 w-3" />
              {text.lossBadge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            data-testid="parts-cost-reveal"
            aria-pressed={revealed}
            aria-label={eyeLabel}
            title={eyeLabel}
            onClick={toggle}
            onBlur={hide}
            className="h-8 w-8 p-0 text-muted-foreground"
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="parts-cost-edit"
            onClick={editor.openEditor}
            className="gap-1.5 text-xs"
          >
            {entered ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {entered ? text.editCost : text.addCost}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Cell label={text.priceLabel}>
          <span className="tabular block text-sm font-extrabold text-foreground">{formatCurrency(ticket.price)}</span>
        </Cell>
        <Cell label={text.costLabel}>
          <div className="flex items-center gap-1.5">
            <span
              data-testid="parts-cost-value"
              data-masked={entered && !revealed ? 'true' : 'false'}
              className={cn(
                'tabular block text-sm font-extrabold',
                entered ? 'text-foreground' : 'font-medium text-muted-foreground'
              )}
            >
              {!entered ? text.notEntered : revealed ? formatCurrency(ticket.parts_cost as number) : hidden}
            </span>
          </div>
        </Cell>
        <Cell label={text.netProfit}>
          <span
            data-testid="net-profit-value"
            className={cn('tabular block text-sm font-extrabold text-foreground', moneyTone)}
          >
            {revealed ? formatCurrency(profitSplit.netProfit) : hidden}
          </span>
        </Cell>
      </div>

      <div className="grid grid-cols-1 gap-2 border-t border-border pt-3 sm:grid-cols-2 sm:gap-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-muted-foreground">{t.profit.ownerShareLabel}</span>
          <strong data-testid="compact-my-share" className={cn('tabular text-sm font-bold text-primary', moneyTone)}>
            {revealed ? (
              <>
                {formatCurrency(profitSplit.myShare)} <span dir="ltr">({profitSplit.myPercentage}%)</span>
              </>
            ) : (
              text.hiddenShare
            )}
          </strong>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-muted-foreground">{t.profit.partnerShareLabel}</span>
          <strong
            data-testid="compact-partner-share"
            className={cn('tabular text-sm font-bold text-primary-to', moneyTone)}
          >
            {revealed ? (
              <>
                {formatCurrency(profitSplit.partnerShare)} <span dir="ltr">({profitSplit.partnerPercentage}%)</span>
              </>
            ) : (
              text.hiddenShare
            )}
          </strong>
        </div>
      </div>

      {profitSplit.isProvisional && (
        <p className="flex items-start gap-2 text-[11px] font-medium text-warning-soft-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{text.provisionalHint}</span>
        </p>
      )}
      {loss && (
        <p className="flex items-start gap-2 text-[11px] font-medium text-danger-soft-foreground">
          <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{text.lossHint}</span>
        </p>
      )}
    </div>
  )
}
