import * as React from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { cn } from '../../../lib/utils'

interface RowActionsProps {
  onEdit: () => void
  onDelete: () => void
  /** Used to build the data-testids: `${testIdPrefix}-edit` / `${testIdPrefix}-delete` */
  testIdPrefix?: string
  className?: string
}

/** Edit + delete icon buttons shown at the end of a settings row/card. */
export function RowActions({ onEdit, onDelete, testIdPrefix, className }: RowActionsProps): React.JSX.Element {
  const { t } = useI18n()
  return (
    <div className={cn('flex shrink-0 items-center gap-0.5', className)}>
      <button
        type="button"
        onClick={onEdit}
        data-testid={testIdPrefix ? `${testIdPrefix}-edit` : undefined}
        aria-label={t.common.edit}
        title={t.common.edit}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        data-testid={testIdPrefix ? `${testIdPrefix}-delete` : undefined}
        aria-label={t.common.delete}
        title={t.common.delete}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger-soft-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
