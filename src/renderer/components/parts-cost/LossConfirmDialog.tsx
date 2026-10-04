import * as React from 'react'
import { TrendingDown } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { Button } from '../ui/Button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/Dialog'

interface LossConfirmDialogProps {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}

/**
 * "The cost is higher than the price" warning. A loss is allowed, but never silently: the user has to
 * confirm explicitly. The text never repeats the amounts (the customer may be looking at the screen).
 */
export function LossConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy
}: LossConfirmDialogProps): React.JSX.Element {
  const { t } = useI18n()
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent
        className="max-w-sm"
        closeLabel={t.common.close}
        data-testid="loss-confirm-dialog"
        onOpenAutoFocus={(e) => {
          // Don't land on the destructive action: a stray Enter/scan must not confirm a loss.
          e.preventDefault()
          ;(e.currentTarget as HTMLElement).focus()
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger-soft-foreground">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div className="space-y-1 pe-6">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{body}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" data-testid="loss-confirm-cancel" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            data-testid="loss-confirm-accept"
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
