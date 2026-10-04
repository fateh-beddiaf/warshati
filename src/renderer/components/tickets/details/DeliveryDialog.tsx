import * as React from 'react'
import { AlertTriangle, CheckCircle, CreditCard, Eye, EyeOff, TrendingDown } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { cn, formatCurrency } from '../../../lib/utils'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/Dialog'
import { ProfitShares } from './ProfitShares'
import { FeedbackBanners } from './FeedbackBanners'
import type { TicketFullDetails } from '../../../../shared/types'
import type { SettlementType, TicketDetailsState } from './useTicketDetailsState'

interface OptionProps {
  value: SettlementType
  testId: string
  checked: boolean
  onSelect: () => void
  title: string
  hint?: string
  children?: React.ReactNode
}

function SettlementOption({ value, testId, checked, onSelect, title, hint, children }: OptionProps): React.JSX.Element {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
        checked ? 'border-primary/50 bg-accent' : 'border-border bg-card hover:bg-muted/60'
      )}
    >
      <input
        type="radio"
        name="settlement"
        value={value}
        data-testid={testId}
        checked={checked}
        onChange={onSelect}
        className="mt-1 h-4 w-4 accent-primary"
      />
      <div className="flex-1 space-y-1 text-xs">
        <span className="block text-sm font-bold text-foreground">{title}</span>
        {hint && <span className="tabular block text-muted-foreground">{hint}</span>}
        {children}
      </div>
    </label>
  )
}

/**
 * "Close the ticket" step: shows the technician / partner shares LARGE, lets the user settle the
 * remaining balance, and only then confirms the delivery. A real nested Radix dialog (focus trap,
 * Esc closes only this one).
 */
export function DeliveryDialog({
  ticketDetails,
  state
}: {
  ticketDetails: TicketFullDetails
  state: TicketDetailsState
}): React.JSX.Element {
  const { t } = useI18n()
  const { ticket } = ticketDetails
  const d = t.ui.details
  // The customer is usually at the counter: the profit split stays hidden until asked for, and is hidden
  // again whenever the dialog closes (or another ticket is shown).
  const [showProfit, setShowProfit] = React.useState(false)
  React.useEffect(() => {
    setShowProfit(false)
  }, [state.isDeliveryDialogOpen, ticket.id])

  return (
    <Dialog open={state.isDeliveryDialogOpen} onOpenChange={(open) => !open && state.closeDeliveryDialog()}>
      <DialogContent
        className="max-w-xl"
        closeLabel={d.closeDialog}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          ;(e.currentTarget as HTMLElement).focus()
        }}
      >
        <DialogHeader className="pe-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-card">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle>{t.lifecycle.confirmDeliveryTitle}</DialogTitle>
              <DialogDescription>{d.deliveryDescription}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="delivery-profit-toggle"
            aria-pressed={showProfit}
            onClick={() => setShowProfit((v) => !v)}
            className="gap-1.5 text-xs font-bold"
          >
            {showProfit ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showProfit ? t.ui.partsCost.details.hideProfit : t.ui.partsCost.details.showProfit}
          </Button>
          {showProfit ? (
            <ProfitShares split={state.profitSplit} />
          ) : (
            <p data-testid="delivery-profit-hidden" className="text-xs text-muted-foreground">
              {t.ui.partsCost.details.profitHiddenHint}
            </p>
          )}
        </div>

        {state.profitSplit.isProvisional && (
          <div
            role="status"
            data-testid="delivery-provisional-warning"
            className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning-soft p-3 text-warning-soft-foreground"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-0.5 text-xs">
              <p className="font-bold">{t.ui.partsCost.details.deliveryProvisionalTitle}</p>
              <p>{t.ui.partsCost.details.deliveryProvisionalBody}</p>
            </div>
          </div>
        )}
        {state.profitSplit.isLoss && (
          <div
            role="status"
            data-testid="delivery-loss-note"
            className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-soft p-3 text-xs font-semibold text-danger-soft-foreground"
          >
            <TrendingDown className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t.ui.partsCost.details.deliveryLossNote}</span>
          </div>
        )}

        {ticket.amount_remaining > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-warning/30 bg-warning-soft px-3.5 py-2.5 text-xs text-warning-soft-foreground">
              <span className="font-semibold">{t.lifecycle.deliveryRemainingNotice}</span>
              <strong className="tabular text-base font-extrabold">{formatCurrency(ticket.amount_remaining)}</strong>
            </div>

            <div className="space-y-2" role="radiogroup" aria-label={d.settlementTitle}>
              <SettlementOption
                value="full"
                testId="settle-full"
                checked={state.settlementType === 'full'}
                onSelect={() => state.setSettlementType('full')}
                title={t.lifecycle.settleFullChoice}
                hint={d.settleFullHint
                  .replace('{amount}', formatCurrency(ticket.amount_remaining))
                  .replace('{zero}', formatCurrency(0))}
              />
              <SettlementOption
                value="credit"
                testId="settle-credit"
                checked={state.settlementType === 'credit'}
                onSelect={() => state.setSettlementType('credit')}
                title={t.lifecycle.creditChoice}
                hint={d.creditHint.replace('{amount}', formatCurrency(ticket.amount_remaining))}
              />
              <SettlementOption
                value="partial"
                testId="settle-partial"
                checked={state.settlementType === 'partial'}
                onSelect={() => state.setSettlementType('partial')}
                title={t.lifecycle.settlePartialChoice}
              >
                {state.settlementType === 'partial' && (
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max={ticket.amount_remaining}
                      step="100"
                      data-testid="settle-partial-amount"
                      value={state.customAdditionalPaid}
                      onChange={(e) => state.setCustomAdditionalPaid(e.target.value)}
                      placeholder={d.partialPlaceholder}
                      className="tabular h-9 text-sm font-bold"
                    />
                    <span className="whitespace-nowrap text-xs text-muted-foreground">{d.currencyUnit}</span>
                  </div>
                )}
              </SettlementOption>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-success/25 bg-success-soft p-3 text-xs font-semibold text-success-soft-foreground">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>{d.fullyPaidNotice}</span>
          </div>
        )}

        <FeedbackBanners errorMessage={state.errorMessage} successMessage={null} />

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={state.closeDeliveryDialog}>
            {d.cancel}
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={state.loading}
            data-testid="confirm-delivery"
            onClick={state.handleConfirmDelivery}
          >
            {state.loading ? t.lifecycle.updatingStatus : t.lifecycle.confirmDeliveryButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
