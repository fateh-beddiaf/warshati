import * as React from 'react'
import { AlertTriangle } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { Button } from '../../../components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../../components/ui/Dialog'

interface ImportConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  /** Default: the import texts. A restore from the backup list names the backup instead. */
  title?: string
  description?: string
  testId?: string
}

/** Warns that importing replaces the whole database (a safety backup is taken first by the main process). */
export function ImportConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  testId = 'settings-import-dialog'
}: ImportConfirmDialogProps): React.JSX.Element {
  const { t } = useI18n()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t.common.close} data-testid={testId}>
        <DialogHeader className="flex-row items-start gap-4 space-y-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning-soft-foreground">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-2 pe-6">
            <DialogTitle>{title ?? t.settings.backup.importConfirmTitle}</DialogTitle>
            <DialogDescription className="leading-relaxed">
              {description ?? t.settings.backup.importConfirmDesc}
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter className="border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className="bg-warning text-warning-foreground hover:bg-warning/90"
            data-testid="settings-import-confirm"
          >
            {t.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
