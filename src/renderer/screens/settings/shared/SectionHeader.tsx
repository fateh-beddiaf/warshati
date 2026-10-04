import * as React from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { cn } from '../../../lib/utils'

interface SectionHeaderProps {
  title: string
  description?: string
  addLabel?: string
  onAdd?: () => void
  addTestId?: string
  /** Compact variant for the side panels of the brands/models tab */
  compact?: boolean
  className?: string
}

/** Title + description + "add" button row at the top of each settings section. */
export function SectionHeader({
  title,
  description,
  addLabel,
  onAdd,
  addTestId,
  compact,
  className
}: SectionHeaderProps): React.JSX.Element {
  return (
    <div className={cn('flex flex-col justify-between gap-3 sm:flex-row sm:items-center', className)}>
      <div className="min-w-0">
        <h3 className={cn('font-bold text-foreground', compact ? 'text-base' : 'text-lg')}>{title}</h3>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {onAdd && addLabel && (
        <Button
          size={compact ? 'sm' : 'default'}
          onClick={onAdd}
          data-testid={addTestId}
          className="shrink-0 self-start"
        >
          <Plus className="h-4 w-4" />
          <span>{addLabel}</span>
        </Button>
      )}
    </div>
  )
}
