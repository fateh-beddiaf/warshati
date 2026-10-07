import * as React from 'react'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { formatCurrency } from '../../../lib/utils'
import { Button } from '../../ui/Button'
import { useAutoHide } from '../../parts-cost/MaskedAmountInput'
import type { TicketEditField } from '../../../../shared/types'

export interface ChangeRow {
  field: TicketEditField
  from: string | null
  to: string | null
}

type Translations = ReturnType<typeof useI18n>['t']

const MONEY_FIELDS: readonly TicketEditField[] = ['price', 'amount_paid', 'parts_cost']

/** A logged value as text: money formatted, payment type translated, NULL as a dash. */
export function formatEditValue(field: TicketEditField, value: string | null, t: Translations): string {
  if (value === null || value === '') return t.ui.editTicket.emptyValue
  if (MONEY_FIELDS.includes(field)) {
    const n = Number(value)
    return Number.isFinite(n) ? formatCurrency(n) : value
  }
  if (field === 'payment_type') return value === 'cash' ? t.ui.details.paymentCash : t.ui.details.paymentCredit
  return value
}

/**
 * "field: old → new" lines of one edit. Parts cost values are owner-only: they show as dots until the eye is
 * clicked (and hide again by themselves), like every other cost in the app.
 */
export function EditChangeList({ rows, testId }: { rows: readonly ChangeRow[]; testId?: string }): React.JSX.Element {
  const { t } = useI18n()
  const text = t.ui.editTicket
  const { revealed, toggle, hide } = useAutoHide()
  const hasCost = rows.some((r) => r.field === 'parts_cost')
  const show = (row: ChangeRow, value: string | null): string =>
    row.field === 'parts_cost' && !revealed ? t.ui.partsCost.details.hiddenValue : formatEditValue(row.field, value, t)

  return (
    <div className="space-y-1.5" data-testid={testId}>
      {hasCost && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            data-testid="edit-cost-reveal"
            aria-pressed={revealed}
            aria-label={revealed ? text.hideCost : text.showCost}
            title={revealed ? text.hideCost : text.showCost}
            onClick={toggle}
            onBlur={hide}
            className="h-7 gap-1 px-2 text-[11px] text-muted-foreground"
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {revealed ? text.hideCost : text.showCost}
          </Button>
        </div>
      )}
      <ul className="space-y-1">
        {rows.map((row) => (
          <li
            key={row.field}
            data-testid={`edit-change-${row.field}`}
            data-masked={row.field === 'parts_cost' && !revealed ? 'true' : 'false'}
            className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs"
          >
            <span className="font-bold text-foreground">{text.fields[row.field]}:</span>
            <span className="tabular text-muted-foreground line-through decoration-muted-foreground/50">
              {show(row, row.from)}
            </span>
            <ArrowLeft className="h-3 w-3 shrink-0 self-center text-muted-foreground ltr:rotate-180" />
            <span className="tabular font-semibold text-foreground">{show(row, row.to)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
