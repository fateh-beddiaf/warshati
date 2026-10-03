import * as React from 'react'
import { cn } from '../../lib/utils'

/** Loading placeholder. The pulse is a slow opacity fade (disabled by prefers-reduced-motion in index.css). */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div aria-hidden className={cn('animate-skeleton-pulse rounded-md bg-muted', className)} {...props} />
}
