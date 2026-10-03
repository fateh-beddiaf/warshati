import * as React from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { cn, formatCurrency } from '../../../lib/utils'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../ui/Dialog'
import { FeedbackBanners } from './FeedbackBanners'
import { fadeIn, transitions } from '../../../lib/motion'
import type { TicketFullDetails } from '../../../../shared/types'
import type { DeleteStep, TicketDetailsState } from './useTicketDetailsState'

function StepDots({ step }: { step: DeleteStep }): React.JSX.Element {
  return (
    <div className="flex items-center justify-center gap-2" aria-hidden="true">
      {([1, 2, 3] as const).map((n) => (
        <motion.div
          key={n}
          initial={false}
          animate={{ width: step === n ? 32 : 10 }}
          transition={transitions.spring}
          className={cn('h-2.5 rounded-full', step === n ? 'bg-danger' : 'bg-muted-foreground/25')}
        />
      ))}
    </div>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div>
      <span className="block text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

/**
 * 3-step permanent delete. Step 3's field is marked data-barcode-input so the global scanner hands
 * the scanned code to it instead of opening the ticket (hooks/useBarcodeScanner.ts).
 */
export function DeleteTicketDialog({
  ticketDetails,
  state
}: {
  ticketDetails: TicketFullDetails
  state: TicketDetailsState
}): React.JSX.Element {
  const { t } = useI18n()
  const { ticket, customer, device } = ticketDetails
  const { deleteStep, setDeleteStep, deleting, confirmBarcode } = state
  const stepTitle = deleteStep === 1 ? t.deleteTicket.step1Title : deleteStep === 2 ? t.deleteTicket.step2Title : t.deleteTicket.step3Title

  return (
    <Dialog
      open={state.isDeleteDialogOpen}
      onOpenChange={(open) => {
        if (!open && !deleting) state.closeDeleteDialog()
      }}
    >
      <DialogContent
        className="max-w-lg"
        showClose={!deleting}
        closeLabel={t.ui.details.closeDialog}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          ;(e.currentTarget as HTMLElement).focus()
        }}
      >
        <DialogHeader className="pe-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger text-danger-foreground shadow-card">
              <Trash2 className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle>{t.deleteTicket.modalTitle}</DialogTitle>
              <DialogDescription className="font-semibold text-danger">{stepTitle}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <StepDots step={deleteStep} />

        <motion.div key={deleteStep} {...fadeIn} className="space-y-3.5 text-start">
          {deleteStep === 1 && (
            <>
              <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning-soft p-3 text-xs text-warning-soft-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{t.deleteTicket.step1Warning}</span>
              </div>
              <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3.5 text-xs">
                <div className="border-b border-border pb-1.5 font-bold text-foreground">{t.deleteTicket.step1DetailsTitle}</div>
                <div className="grid grid-cols-2 gap-3">
                  <Detail label={t.deleteTicket.step1Barcode}>
                    <span className="font-mono font-bold text-foreground" dir="ltr">{ticket.barcode_code}</span>
                  </Detail>
                  <Detail label={t.deleteTicket.step1Customer}>
                    <span className="font-bold text-foreground">{customer.name}</span>
                  </Detail>
                  <Detail label={t.deleteTicket.step1Device}>
                    <span className="font-bold text-foreground">{device.brand} {device.model}</span>
                  </Detail>
                  <Detail label={t.deleteTicket.step1Price}>
                    <span className="tabular font-extrabold text-foreground">{formatCurrency(ticket.price)}</span>
                  </Detail>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{t.deleteTicket.step1Notice}</p>
            </>
          )}

          {deleteStep === 2 && (
            <>
              <div className="space-y-2 rounded-xl border-2 border-danger/30 bg-danger-soft p-3.5 text-xs text-danger-soft-foreground">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{t.deleteTicket.step2WarningBadge}</span>
                </div>
                <p className="leading-relaxed">{t.deleteTicket.step2FinancialNotice}</p>
              </div>
              <div className="rounded-xl border border-primary/20 bg-accent p-3 text-xs leading-relaxed text-accent-foreground">
                {t.deleteTicket.step2CustomerCleanupNotice}
              </div>
              <p className="text-xs font-bold text-danger">{t.deleteTicket.step2IrreversibleNotice}</p>
            </>
          )}

          {deleteStep === 3 && (
            <>
              <p className="text-xs font-medium text-foreground">{t.deleteTicket.step3Instruction}</p>
              <div className="rounded-lg border border-border bg-muted p-2.5 text-center font-mono text-sm font-bold text-foreground" dir="ltr">
                {ticket.barcode_code}
              </div>
              <div className="space-y-1.5">
                <Input
                  type="text"
                  dir="ltr"
                  data-testid="delete-confirm-input"
                  data-barcode-input="true"
                  value={confirmBarcode}
                  onChange={(e) => state.setConfirmBarcode(e.target.value)}
                  placeholder={t.deleteTicket.step3Placeholder}
                  className="text-center font-mono font-bold tracking-wider"
                  autoFocus
                />
                {confirmBarcode && confirmBarcode.trim() !== ticket.barcode_code.trim() && (
                  <span className="block text-center text-[11px] font-semibold text-danger">
                    {t.deleteTicket.step3BarcodeMismatch}
                  </span>
                )}
              </div>
            </>
          )}
        </motion.div>

        <FeedbackBanners errorMessage={state.errorMessage} successMessage={null} />

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={deleting}
            data-testid="delete-back"
            onClick={() => {
              if (deleteStep > 1) {
                setDeleteStep((prev) => (prev - 1) as DeleteStep)
              } else {
                state.closeDeleteDialog()
              }
            }}
          >
            {deleteStep === 1 ? t.deleteTicket.cancel : t.ui.details.back}
          </Button>

          {deleteStep < 3 ? (
            <Button
              type="button"
              variant="destructive"
              data-testid="delete-next"
              onClick={() => setDeleteStep((prev) => (prev + 1) as DeleteStep)}
            >
              {deleteStep === 1 ? t.deleteTicket.nextToStep2 : t.deleteTicket.nextToStep3}
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              data-testid="delete-confirm"
              disabled={deleting || confirmBarcode.trim() !== ticket.barcode_code.trim()}
              onClick={state.handleDeleteTicket}
            >
              {deleting ? t.deleteTicket.deletingButton : t.deleteTicket.confirmDeleteButton}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
