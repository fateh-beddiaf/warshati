import * as React from 'react'
import { useRef } from 'react'
import { ScanLine } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { Button } from './ui/Button'
import { Mono } from './ui/Mono'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/Dialog'

/**
 * A label was scanned while a form (New Ticket, edit ticket) holds unsaved changes: ask before throwing them away.
 * Focus starts on Cancel, so a stray Enter (or the next scan's suffix) never discards anything. Give it a new `key`
 * for every question: a question asked while the previous one is still animating out then starts fresh (focus on
 * Cancel again).
 */
export function UnsavedScanDialog({
  open,
  code,
  onCancel,
  onDiscard
}: {
  open: boolean
  /** The scanned ticket's code */
  code: string
  onCancel: () => void
  onDiscard: () => void
}): React.JSX.Element {
  const { t } = useI18n()
  const text = t.ui.layout
  const cancelRef = useRef<HTMLButtonElement>(null)
  // Cancel gives focus back to where it was (typically the field the scan landed in), so typing just goes on.
  // Radix would send it to a trigger button, and this dialog has none.
  const returnFocusTo = useRef<HTMLElement | null>(null)
  const cancelled = useRef(false)
  const cancel = (): void => {
    cancelled.current = true
    onCancel()
  }
  const [before, after = ''] = text.unsavedScanBody.split('{code}')

  return (
    <Dialog open={open} onOpenChange={(next) => !next && cancel()}>
      <DialogContent
        className="max-w-md"
        data-testid="unsaved-scan-dialog"
        closeLabel={t.common.close}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          returnFocusTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
          cancelRef.current?.focus()
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          if (cancelled.current && returnFocusTo.current?.isConnected) returnFocusTo.current.focus()
          cancelled.current = false
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning-soft-foreground">
              <ScanLine className="h-5 w-5" />
            </div>
            <div className="space-y-1 pe-6">
              <DialogTitle>{text.unsavedScanTitle}</DialogTitle>
              <DialogDescription>
                {before}
                <Mono as="strong" data-testid="unsaved-scan-code" className="text-foreground">
                  {code}
                </Mono>
                {after}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="gap-2 border-t border-border pt-4">
          <Button ref={cancelRef} type="button" variant="outline" data-testid="unsaved-scan-cancel" onClick={cancel}>
            {text.unsavedScanKeep}
          </Button>
          <Button type="button" variant="destructive" data-testid="unsaved-scan-discard" onClick={onDiscard}>
            {text.unsavedScanDiscard}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
