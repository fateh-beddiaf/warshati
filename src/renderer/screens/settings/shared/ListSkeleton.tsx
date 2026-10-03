import * as React from 'react'
import { Skeleton } from '../../../components/ui/Skeleton'
import { cn } from '../../../lib/utils'

interface ListSkeletonProps {
  count?: number
  /** Height utility of each placeholder card */
  itemClassName?: string
  /** Grid classes of the wrapper */
  className?: string
}

/** Placeholder cards shown while the reference data of a settings tab is loading. */
export function ListSkeleton({ count = 4, itemClassName = 'h-20', className }: ListSkeletonProps): React.JSX.Element {
  return (
    <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-2', className)} data-testid="settings-skeleton">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={cn('rounded-xl', itemClassName)} />
      ))}
    </div>
  )
}
