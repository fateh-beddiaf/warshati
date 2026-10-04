import * as React from 'react'
import { CheckCircle, Coins } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { cn, formatCurrency, formatDate } from '../../../lib/utils'
import { SectionCard } from './SectionCard'
import { DebtPaymentSection } from './DebtPaymentSection'
import { PartsCostSection } from './PartsCostSection'
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

      {/* Price / cost (hidden) / net profit / both shares (the delivery dialog shows them large before confirming) */}
      <PartsCostSection ticketDetails={ticketDetails} state={state} />

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
