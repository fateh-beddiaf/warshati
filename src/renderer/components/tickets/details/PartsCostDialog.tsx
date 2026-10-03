import * as React from 'react'
import { Wrench } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { Button } from '../../ui/Button'
import { Label } from '../../ui/Label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../ui/Dialog'
import { MaskedAmountInput } from '../../parts-cost/MaskedAmountInput'
import { LossConfirmDialog } from '../../parts-cost/LossConfirmDialog'
import type { TicketFullDetails } from '../../../../shared/types'
import type { TicketDetailsState } from './useTicketDetailsState'

/**
 * Add / edit / clear the parts cost. The box is masked like the one on the New Ticket screen (the
 * details are sometimes open while the customer is at the counter). A cost above the price needs an
 * explicit second confirmation. For a delivered ticket the shares are recomputed on save.
 */
export function PartsCostDialog({
  ticketDetails,
  state
}: {
  ticketDetails: TicketFullDetails
  state: Pick<TicketDetailsState, 'partsCost'>
}): React.JSX.Element {
  const { t } = useI18n()
  const text = t.ui.partsCost.details
  const editor = state.partsCost
  const inputId = React.useId()
  const delivered = ticketDetails.ticket.status === 'delivered'
  const hasCost = ticketDetails.ticket.parts_cost !== null && ticketDetails.ticket.parts_cost !== undefined

  return (
    <>
      <Dialog open={editor.open && !editor.lossPending} onOpenChange={(open) => !open && editor.closeEditor()}>
        <DialogContent
          className="max-w-sm"
          data-testid="parts-cost-dialog"
          closeLabel={t.common.close}
          onOpenAutoFocus={(e) => {
            // Focus the (masked) input, not an action button
            e.preventDefault()
            document.getElementById(inputId)?.focus()
          }}
        >
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning-soft-foreground">
                <Wrench className="h-5 w-5" />
              </div>
              <div className="space-y-1 pe-6">
                <DialogTitle>{text.dialogTitle}</DialogTitle>
                <DialogDescription>{delivered ? text.dialogDescriptionDelivered : text.dialogDescription}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              void editor.save()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor={inputId} className="text-xs font-bold">
                {text.inputLabel}
              </Label>
              <MaskedAmountInput
                id={inputId}
                testId="parts-cost-dialog-input"
                value={editor.value}
                onChange={editor.setValue}
                error={Boolean(editor.error)}
                placeholder={t.ui.partsCost.newTicket.placeholder}
              />
              {editor.error && (
                <p role="alert" data-testid="parts-cost-error" className="text-xs font-semibold text-danger-soft-foreground">
                  {editor.error}
                </p>
              )}
            </div>
            <DialogFooter className="gap-2 border-t border-border pt-4 sm:justify-between">
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={editor.closeEditor}>
                  {t.common.cancel}
                </Button>
                {hasCost && (
                  <Button
                    type="button"
                    variant="ghost"
                    data-testid="parts-cost-clear"
                    disabled={editor.saving}
                    onClick={() => void editor.clear()}
                  >
                    {text.clearCost}
                  </Button>
                )}
              </div>
              <Button type="submit" data-testid="parts-cost-save" disabled={editor.saving}>
                {editor.saving ? t.common.saving : text.saveCost}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <LossConfirmDialog
        open={editor.open && editor.lossPending}
        title={text.lossConfirmTitle}
        body={text.lossConfirmBody}
        confirmLabel={text.lossConfirmButton}
        cancelLabel={t.ui.partsCost.newTicket.lossReview}
        busy={editor.saving}
        onCancel={editor.cancelLoss}
        onConfirm={() => void editor.confirmLoss()}
      />
    </>
  )
}
