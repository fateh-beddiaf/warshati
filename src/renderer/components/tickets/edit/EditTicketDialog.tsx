import * as React from 'react'
import { AlertCircle, AlertTriangle, Loader2, PencilLine, Save } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { Button } from '../../ui/Button'
import { Skeleton } from '../../ui/Skeleton'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../ui/Dialog'
import { DeviceSection } from '../../../screens/new-ticket/DeviceSection'
import { RepairSection } from '../../../screens/new-ticket/RepairSection'
import { PaymentSection } from '../../../screens/new-ticket/PaymentSection'
import { CustomerEditSection } from './CustomerEditSection'
import { EditReviewDialog } from './EditReviewDialog'
import { useTicketEditForm } from './useTicketEditForm'
import { useUnsavedChanges } from '../../../lib/unsaved-changes'
import type { AppMetadata, TicketFullDetails, UpdateTicketResult } from '../../../../shared/types'

/** The form itself: mounted fresh on every opening, so it always starts from the saved ticket. */
function EditTicketForm({
  open,
  details,
  metadata,
  onCancel,
  onSaved
}: {
  open: boolean
  details: TicketFullDetails
  metadata: AppMetadata
  onCancel: () => void
  onSaved: (result: UpdateTicketResult) => void
}): React.JSX.Element {
  const { t } = useI18n()
  const text = t.ui.editTicket
  const form = useTicketEditForm(details, metadata, onSaved)
  // A scanned label asks before opening another ticket while this form holds unsaved changes (App.tsx). `open`:
  // the form stays mounted while the dialog animates out, and a closed form has nothing left to protect.
  useUnsavedChanges(open && form.isDirty, onCancel)

  return (
    <>
      <form data-testid="edit-ticket-form" onSubmit={form.handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-5 overflow-y-auto bg-background/40 px-6 py-5">
          {details.ticket.status === 'delivered' && (
            <p
              data-testid="edit-delivered-banner"
              className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft p-3 text-xs font-semibold text-warning-soft-foreground"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{text.deliveredBanner}</span>
            </p>
          )}
          <CustomerEditSection form={form} details={details} />
          <DeviceSection form={form} />
          <RepairSection form={form} layoutGroup="edit-ticket-technician" costTestId="edit-parts-cost" />
          <PaymentSection form={form} />
        </div>

        <div className="space-y-3 border-t border-border bg-muted/40 px-6 py-4">
          {form.errorMessage && (
            <p
              role="alert"
              data-testid="edit-error"
              className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft p-2.5 text-xs font-semibold text-danger-soft-foreground"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{form.errorMessage}</span>
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={form.saving}>
              {t.common.cancel}
            </Button>
            <Button type="submit" data-testid="edit-save" disabled={form.saving}>
              {form.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {form.saving ? t.common.saving : text.save}
            </Button>
          </div>
        </div>
      </form>

      <EditReviewDialog
        plan={form.review}
        details={details}
        remaining={form.calculatedRemaining}
        saving={form.saving}
        onBack={form.closeReview}
        onConfirm={() => void form.confirmReview()}
      />
    </>
  )
}

/**
 * "Edit ticket" from the details modal (a nested dialog). Loads the lists (brands, categories, technicians,
 * accessories) on opening, then shows the form built from the New Ticket sections.
 */
export function EditTicketDialog({
  open,
  details,
  onClose,
  onSaved
}: {
  open: boolean
  details: TicketFullDetails
  onClose: () => void
  onSaved: (result: UpdateTicketResult) => void
}): React.JSX.Element {
  const { t } = useI18n()
  const text = t.ui.editTicket
  const [metadata, setMetadata] = React.useState<AppMetadata | null>(null)

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    window.api
      .getMetadata()
      .then((res) => {
        if (!cancelled && res.success && res.data) setMetadata(res.data)
      })
      .catch((err) => console.error('Failed to load the lists for the edit form:', err))
    return () => {
      cancelled = true
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="flex max-w-3xl flex-col gap-0 overflow-hidden p-0"
        data-testid="edit-ticket-dialog"
        closeLabel={t.common.close}
        onOpenAutoFocus={(e) => {
          // Never land on an action button: a stray Enter/scan must not save
          e.preventDefault()
          ;(e.currentTarget as HTMLElement).focus()
        }}
      >
        <div className="border-b border-border bg-gradient-header px-6 py-5 pe-14">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-card">
              <PencilLine className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle>
                {text.title} <span className="tabular">#{details.ticket.id}</span>
              </DialogTitle>
              <DialogDescription className="text-xs">{text.description}</DialogDescription>
            </div>
          </div>
        </div>

        {metadata ? (
          <EditTicketForm
            key={details.ticket.id}
            open={open}
            details={details}
            metadata={metadata}
            onCancel={onClose}
            onSaved={onSaved}
          />
        ) : (
          <div className="space-y-4 px-6 py-5" aria-busy="true" aria-label={text.loading}>
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-56 rounded-xl" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
