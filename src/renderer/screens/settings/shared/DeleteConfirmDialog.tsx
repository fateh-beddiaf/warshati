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

interface DeleteConfirmDialogProps {
  /** Name of the item to delete; the dialog is open while this is set */
  itemName: string | null
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmation shown after the usage check passed (the item is not referenced by any ticket). */
export function DeleteConfirmDialog({ itemName, busy, onConfirm, onCancel }: DeleteConfirmDialogProps): React.JSX.Element {
  const { t } = useI18n()
  // Keep the last name so the text doesn't blank out during the close animation
  const lastName = React.useRef('')
  if (itemName !== null) lastName.current = itemName
  return (
    <Dialog open={itemName !== null} onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent className="max-w-sm" closeLabel={t.common.close} data-testid="settings-delete-dialog">
        <DialogHeader className="items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-danger-soft text-danger-soft-foreground">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <DialogTitle>{t.ui.settings.deleteDialog.title}</DialogTitle>
          <DialogDescription>{t.ui.settings.deleteDialog.description.replace('{name}', lastName.current)}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={busy} data-testid="settings-delete-confirm">
            {busy ? t.common.deleting : t.common.delete}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
