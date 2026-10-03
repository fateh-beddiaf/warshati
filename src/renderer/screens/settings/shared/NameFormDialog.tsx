import * as React from 'react'
import { useI18n } from '../../../lib/i18n'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Label } from '../../../components/ui/Label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/Dialog'

interface NameFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  fieldLabel: string
  placeholder: string
  name: string
  onNameChange: (name: string) => void
  onSubmit: () => void
  saving?: boolean
  /** Extra fields rendered under the name input (e.g. the split slider) */
  children?: React.ReactNode
  /** Wider dialog for forms with extra content */
  wide?: boolean
  testId?: string
}

/** Add/edit dialog with a single required name field (+ optional extra fields). */
export function NameFormDialog({
  open,
  onOpenChange,
  title,
  fieldLabel,
  placeholder,
  name,
  onNameChange,
  onSubmit,
  saving,
  children,
  wide,
  testId
}: NameFormDialogProps): React.JSX.Element {
  const { t } = useI18n()
  const inputId = React.useId()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        closeLabel={t.common.close}
        data-testid={testId}
        className={wide ? 'max-w-md' : 'max-w-sm'}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor={inputId}>{fieldLabel}</Label>
            <Input
              id={inputId}
              required
              autoFocus
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={placeholder}
            />
          </div>
          {children}
          <DialogFooter className="border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
