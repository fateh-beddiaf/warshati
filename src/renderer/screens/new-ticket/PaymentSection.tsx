import * as React from 'react'
import { Banknote, Coins, Wallet } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { cn, formatAmount, formatCurrency } from '../../lib/utils'
import { Input } from '../../components/ui/Input'
import { AnimatedNumber } from '../../components/AnimatedNumber'
import { Field } from './Field'
import { SectionCard } from './SectionCard'
import type { NewTicketForm } from './useNewTicketForm'

export type PaymentSectionForm = Pick<
  NewTicketForm,
  | 'price'
  | 'setPrice'
  | 'amountPaid'
  | 'setAmountPaid'
  | 'effectivePaymentType'
  | 'numPrice'
  | 'numPaid'
  | 'calculatedRemaining'
>

/**
 * The payment type as the form computes it (shared/payment.ts): nothing left to pay = cash, a remaining balance =
 * credit. It is shown, never chosen, so it can never contradict the amounts.
 */
function PaymentTypeDisplay({ type, remaining }: { type: 'cash' | 'credit'; remaining: number }): React.JSX.Element {
  const { t } = useI18n()
  const text = t.ui.newTicket.payment
  const isCash = type === 'cash'
  return (
    <div
      role="status"
      data-testid="payment-type"
      data-value={type}
      className={cn(
        'flex items-center gap-3 rounded-xl border-2 p-3 transition-colors',
        isCash ? 'border-success/30 bg-success-soft' : 'border-warning/30 bg-warning-soft'
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&_svg]:h-4 [&_svg]:w-4',
          isCash ? 'bg-success text-success-foreground' : 'bg-warning text-warning-foreground'
        )}
      >
        {isCash ? <Banknote /> : <Coins />}
      </div>
      <div className="min-w-0">
        <p
          className={cn('text-sm font-bold', isCash ? 'text-success-soft-foreground' : 'text-warning-soft-foreground')}
        >
          {isCash ? t.newTicket.paymentCash : t.newTicket.paymentCredit}
        </p>
        <p className="text-xs text-muted-foreground">
          {isCash ? text.cashHint : text.creditHint.replace('{amount}', formatCurrency(remaining))}
        </p>
      </div>
    </div>
  )
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular font-bold text-foreground">{children}</span>
    </div>
  )
}

/** Price / paid inputs, payment type, and the total / paid / remaining summary. */
export function PaymentSection({ form }: { form: PaymentSectionForm }): React.JSX.Element {
  const { t } = useI18n()
  const text = t.ui.newTicket
  const hasDebt = form.calculatedRemaining > 0

  return (
    <SectionCard
      icon={<Wallet />}
      tone="success"
      title={text.payment.section}
      description={text.payment.hint}
      contentClassName="grid grid-cols-1 gap-5 space-y-0 lg:grid-cols-5"
    >
      <div className="space-y-4 lg:col-span-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t.newTicket.price}>
            <Input
              type="number"
              min="0"
              step="100"
              value={form.price}
              onChange={(e) => form.setPrice(e.target.value)}
              data-testid="payment-price"
              placeholder="0"
              className="tabular text-lg font-bold"
            />
          </Field>
          <Field label={t.newTicket.amountPaid}>
            <Input
              type="number"
              min="0"
              step="100"
              value={form.amountPaid}
              onChange={(e) => form.setAmountPaid(e.target.value)}
              data-testid="payment-paid"
              placeholder="0"
              className="tabular text-lg font-semibold"
            />
          </Field>
        </div>

        <Field label={t.newTicket.paymentType}>
          <PaymentTypeDisplay type={form.effectivePaymentType} remaining={form.calculatedRemaining} />
          <p className="text-xs text-muted-foreground">{text.payment.automatic}</p>
        </Field>
      </div>

      <div
        className={cn(
          'flex flex-col justify-center gap-3 rounded-xl border p-4 transition-colors lg:col-span-2',
          hasDebt ? 'border-warning/25 bg-warning-soft' : 'border-success/25 bg-success-soft'
        )}
        data-testid="payment-summary"
      >
        <SummaryRow label={text.payment.total}>
          {formatAmount(Math.round(form.numPrice))} {text.currency}
        </SummaryRow>
        <SummaryRow label={text.payment.paid}>
          {formatAmount(Math.round(form.numPaid))} {text.currency}
        </SummaryRow>
        <div className="border-t border-border/60 pt-3">
          <p className="text-xs font-semibold text-muted-foreground">{t.newTicket.amountRemaining}</p>
          <p
            className={cn(
              'tabular mt-1 text-2xl font-extrabold',
              hasDebt ? 'text-warning-soft-foreground' : 'text-success-soft-foreground'
            )}
          >
            <AnimatedNumber
              value={form.calculatedRemaining}
              format={(n) => formatAmount(Math.round(n))}
              data-testid="payment-remaining"
            />{' '}
            <span className="text-sm font-bold">{text.currency}</span>
          </p>
        </div>
      </div>
    </SectionCard>
  )
}
