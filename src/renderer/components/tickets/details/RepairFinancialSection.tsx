import * as React from 'react'
import { CheckCircle, Coins } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { cn, formatCurrency, formatDate } from '../../../lib/utils'
import { SectionCard } from './SectionCard'
import { DebtPaymentSection } from './DebtPaymentSection'
import type { TicketFullDetails } from '../../../../shared/types'
import type { TicketDetailsState } from './useTicketDetailsState'

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="space-y-1">
      <span className="block text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="inline-block rounded-md border border-border bg-card px-2 py-1 text-xs font-bold text-foreground">
      {children}
    </span>
  )
}

/** Category, technician, money summary, compact profit row and the debt payment form. */
export function RepairFinancialSection({
  ticketDetails,
  state
}: {
  ticketDetails: TicketFullDetails
  state: TicketDetailsState
}): React.JSX.Element {
  const { t } = useI18n()
  const { ticket, category } = ticketDetails
  const { profitSplit } = state
  const owes = ticket.amount_remaining > 0

  return (
    <SectionCard
      icon={<Coins className="text-success" />}
      title={t.ticketDetails.repairInfo}
      action={
        ticket.status === 'delivered' ? (
          <span className="flex items-center gap-1 rounded-full border border-success/25 bg-success-soft px-2 py-0.5 text-[11px] font-bold text-success-soft-foreground">
            <CheckCircle className="h-3 w-3" />
            {t.ui.details.profitsDocumented}
          </span>
        ) : undefined
      }
    >
      <div className="grid grid-cols-2 gap-4 text-start sm:grid-cols-4">
        <Field label={t.ticketDetails.category}>
          <Chip>{category?.name || t.ui.details.generalCategory}</Chip>
        </Field>
        <Field label={t.ticketDetails.technician}>
          <Chip>{ticket.technician}</Chip>
        </Field>
        <Field label={t.ticketDetails.price}>
          <span className="tabular block text-base font-extrabold text-foreground">{formatCurrency(ticket.price)}</span>
        </Field>
        <Field label={t.ticketDetails.amountRemaining}>
          <span className={cn('tabular block text-base font-extrabold', owes ? 'text-warning' : 'text-success')}>
            {owes ? formatCurrency(ticket.amount_remaining) : t.ui.details.settled}
          </span>
        </Field>
      </div>

      {/* Compact profit split (the delivery dialog shows it large before confirming) */}
      <div className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-card p-3 sm:grid-cols-2 sm:gap-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-muted-foreground">{t.profit.ownerShareLabel}</span>
          <strong className="tabular text-sm font-bold text-primary">
            {formatCurrency(profitSplit.myShare)} <span dir="ltr">({profitSplit.myPercentage}%)</span>
          </strong>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-muted-foreground">{t.profit.partnerShareLabel}</span>
          <strong className="tabular text-sm font-bold text-primary-to">
            {formatCurrency(profitSplit.partnerShare)} <span dir="ltr">({profitSplit.partnerPercentage}%)</span>
          </strong>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
        <span>
          {t.ticketDetails.paymentType}{' '}
          <strong className="text-foreground">
            {ticket.payment_type === 'cash' ? t.ui.details.paymentCash : t.ui.details.paymentCredit}
          </strong>
        </span>
        <span>
          {t.ticketDetails.amountPaid} <strong className="tabular text-foreground">{formatCurrency(ticket.amount_paid)}</strong>
        </span>
        <span>
          {t.ticketDetails.createdAt} <strong className="tabular text-foreground">{formatDate(ticket.created_at)}</strong>
        </span>
      </div>

      <DebtPaymentSection ticketDetails={ticketDetails} state={state} />
    </SectionCard>
  )
}
