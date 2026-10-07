import * as React from 'react'
import { AlertTriangle, ClipboardCheck, Info, TrendingDown } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { formatCurrency } from '../../../lib/utils'
import { Button } from '../../ui/Button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/Dialog'
import { EditChangeList } from './EditChangeList'
import type { EditPlan } from './editPatch'
import type { TicketFullDetails } from '../../../../shared/types'

function Note({
  tone,
  icon,
  children
}: {
  tone: 'warning' | 'danger' | 'info'
  icon: React.ReactNode
  children: string
}): React.JSX.Element {
  const toneClass = {
    warning: 'border-warning/30 bg-warning-soft text-warning-soft-foreground',
    danger: 'border-danger/30 bg-danger-soft text-danger-soft-foreground',
    info: 'border-border bg-muted/40 text-muted-foreground'
  }[tone]
  return (
    <p className={`flex items-start gap-2 rounded-lg border p-2.5 text-xs font-semibold ${toneClass}`}>
      <span className="mt-0.5 shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
      <span>{children}</span>
    </p>
  )
}

/**
 * The changes, field by field, before they are saved: always for a delivered ticket (its profit split may be
 * recalculated), and when the amount paid goes down (a debt) or the cost goes above the price (a loss).
 * It never opens on the confirm button: a stray Enter must not save.
 */
export function EditReviewDialog({
  plan,
  details,
  remaining,
  saving,
  onBack,
  onConfirm
}: {
  plan: EditPlan | null
  details: TicketFullDetails
  remaining: number
  saving: boolean
  onBack: () => void
  onConfirm: () => void
}): React.JSX.Element {
  const { t } = useI18n()
  const text = t.ui.editTicket
  const delivered = details.ticket.status === 'delivered'

  return (
    <Dialog open={plan !== null} onOpenChange={(open) => !open && onBack()}>
      <DialogContent
        className="max-w-lg"
        data-testid="edit-review-dialog"
        closeLabel={t.common.close}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          ;(e.currentTarget as HTMLElement).focus()
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div className="space-y-1 pe-6">
              <DialogTitle>{text.reviewTitle}</DialogTitle>
              <DialogDescription>{text.reviewDescription}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {plan && (
          <div className="space-y-3">
            {delivered && (
              <div data-testid="edit-review-delivered">
                <Note tone={plan.profitChanged ? 'warning' : 'info'} icon={<AlertTriangle />}>
                  {plan.profitChanged ? text.deliveredRecalc : text.deliveredNoRecalc}
                </Note>
              </div>
            )}
            {plan.paidLowered && (
              <Note tone="warning" icon={<AlertTriangle />}>
                {text.paidLowered.replace('{remaining}', formatCurrency(remaining))}
              </Note>
            )}
            {plan.loss && (
              <Note tone="danger" icon={<TrendingDown />}>
                {text.lossWarning}
              </Note>
            )}
            {plan.customerEdited && details.customerTicketCount > 1 && (
              <Note tone="info" icon={<Info />}>
                {text.customerAllTickets.replace('{count}', String(details.customerTicketCount))}
              </Note>
            )}
            <div className="rounded-lg border border-border bg-card p-3">
              <EditChangeList rows={plan.changes} testId="edit-review-changes" />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onBack} disabled={saving}>
            {text.backToEditing}
          </Button>
          <Button type="button" data-testid="edit-review-confirm" onClick={onConfirm} disabled={saving}>
            {saving ? t.common.saving : text.confirmSave}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
