import * as React from 'react'
import { Printer } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { Button } from '../../ui/Button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/Dialog'

/**
 * After an edit changed something printed on the label (customer name / phone, short label): offer a new label.
 * The barcode is the same, so the old label keeps scanning; reprinting is only about the printed text.
 */
export function ReprintPromptDialog({
  open,
  onPrint,
  onDismiss
}: {
  open: boolean
  onPrint: () => void
  onDismiss: () => void
}): React.JSX.Element {
  const { t } = useI18n()
  const text = t.ui.editTicket

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onDismiss()}>
      <DialogContent
        className="max-w-md"
        data-testid="reprint-prompt"
        closeLabel={t.common.close}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          ;(e.currentTarget as HTMLElement).focus()
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Printer className="h-5 w-5" />
            </div>
            <div className="space-y-1 pe-6">
              <DialogTitle>{text.reprintTitle}</DialogTitle>
              <DialogDescription>{text.reprintBody}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" data-testid="reprint-later" onClick={onDismiss}>
            {text.reprintLater}
          </Button>
          <Button type="button" data-testid="reprint-now" onClick={onPrint}>
            <Printer className="h-4 w-4" />
            {text.reprintNow}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
