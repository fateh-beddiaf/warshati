import * as React from 'react'
import { Banknote, Coins, Wallet } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { cn, formatAmount } from '../../lib/utils'
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
  | 'setPaymentType'
  | 'numPrice'
  | 'numPaid'
  | 'calculatedRemaining'
>

interface PaymentOptionProps {
  value: 'cash' | 'credit'
  checked: boolean
  onSelect: () => void
  icon: React.ReactNode
  label: string
  hint: string
}

/** Payment type as a radio card: a real (visually hidden) radio input drives it. */
function PaymentOption({ value, checked, onSelect, icon, label, hint }: PaymentOptionProps): React.JSX.Element {
  return (
    <label className="relative block cursor-pointer">
      <input
        type="radio"
        name="paymentType"
        value={value}
        checked={checked}
        onChange={onSelect}
        className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0"
      />
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border-2 border-border bg-card p-3 transition-colors hover:bg-accent/60',
          'peer-checked:border-primary peer-checked:bg-primary/5',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background'
        )}
      >
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&_svg]:h-4 [&_svg]:w-4',
            checked ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
    </label>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <PaymentOption
              value="cash"
              checked={form.effectivePaymentType === 'cash'}
              onSelect={() => form.setPaymentType('cash')}
              icon={<Banknote />}
              label={t.newTicket.paymentCash}
              hint={text.payment.cashHint}
            />
            <PaymentOption
              value="credit"
              checked={form.effectivePaymentType === 'credit'}
              onSelect={() => form.setPaymentType('credit')}
              icon={<Coins />}
              label={t.newTicket.paymentCredit}
              hint={text.payment.creditHint}
            />
          </div>
          {hasDebt && <p className="text-xs font-medium text-warning-soft-foreground">{text.payment.creditForced}</p>}
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
