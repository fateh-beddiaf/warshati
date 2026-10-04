import * as React from 'react'
import { CreditCard } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { formatCurrency } from '../../../lib/utils'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import type { TicketFullDetails } from '../../../../shared/types'
import type { TicketDetailsState } from './useTicketDetailsState'

type Props = {
  ticketDetails: TicketFullDetails
  state: Pick<
    TicketDetailsState,
    'recordAmount' | 'setRecordAmount' | 'recordingPayment' | 'loading' | 'handleRecordPayment'
  >
}

/** Debt payment (T002 recordPayment): delivered tickets that still carry a remaining balance. */
export function DebtPaymentSection({ ticketDetails, state }: Props): React.JSX.Element | null {
  const { t } = useI18n()
  const { ticket } = ticketDetails
  if (ticket.status !== 'delivered' || ticket.amount_remaining <= 0) return null

  return (
    <div
      data-testid="record-payment-section"
      className="space-y-3 rounded-lg border border-warning/30 bg-warning-soft/60 p-3.5"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-warning-soft-foreground">
        <CreditCard className="h-4 w-4" />
        <span>{t.lifecycle.recordPaymentTitle}</span>
        <span className="tabular font-semibold opacity-80">
          ({t.ticketDetails.amountRemaining} {formatCurrency(ticket.amount_remaining)})
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min="1"
          max={ticket.amount_remaining}
          step="1"
          data-testid="record-payment-input"
          value={state.recordAmount}
          onChange={(e) => state.setRecordAmount(e.target.value)}
          placeholder={t.lifecycle.recordPaymentPlaceholder}
          aria-label={t.lifecycle.recordPaymentLabel}
          className="tabular h-9 text-sm font-bold"
        />
        <Button
          type="button"
          size="sm"
          disabled={state.recordingPayment || state.loading}
          data-testid="record-payment-submit"
          onClick={state.handleRecordPayment}
          className="h-9 shrink-0"
        >
          {state.recordingPayment ? t.lifecycle.recordPaymentSaving : t.lifecycle.recordPaymentButton}
        </Button>
      </div>
    </div>
  )
}
