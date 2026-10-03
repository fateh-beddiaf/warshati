import * as React from 'react'
import { Card } from '../../components/ui/Card'
import { Skeleton } from '../../components/ui/Skeleton'

const ROWS = 6

/** First-load placeholder for the tickets table (divs, not <tr>, so it never counts as a data row). */
export function TicketsSkeleton(): React.JSX.Element {
  return (
    <Card className="overflow-hidden" data-testid="tickets-skeleton" aria-busy="true">
      <div className="border-b border-border bg-muted/60 px-4 py-4">
        <Skeleton className="h-3 w-1/3" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: ROWS }, (_, i) => (
          <div key={i} className="flex items-center gap-6 px-4 py-4">
            <div className="space-y-2">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-3 w-10" />
            </div>
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="hidden h-4 w-32 md:block" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    </Card>
  )
}
