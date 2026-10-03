import * as React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card'
import { cn } from '../../lib/utils'

export type SectionTone = 'primary' | 'progress' | 'warning' | 'success'

const TONE: Record<SectionTone, string> = {
  primary: 'bg-primary/10 text-primary',
  progress: 'bg-status-in-progress-soft text-status-in-progress-soft-foreground',
  warning: 'bg-warning-soft text-warning-soft-foreground',
  success: 'bg-success-soft text-success-soft-foreground'
}

interface SectionCardProps {
  icon: React.ReactNode
  title: string
  description?: string
  tone?: SectionTone
  /** Shown at the end of the header (e.g. a badge) */
  aside?: React.ReactNode
  className?: string
  contentClassName?: string
  children: React.ReactNode
}

/** A titled card with a tinted icon tile: one per form section. */
export function SectionCard({
  icon,
  title,
  description,
  tone = 'primary',
  aside,
  className,
  contentClassName,
  children
}: SectionCardProps): React.JSX.Element {
  return (
    <Card className={className}>
      <CardHeader className="p-5 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl [&_svg]:h-5 [&_svg]:w-5',
                TONE[tone]
              )}
            >
              {icon}
            </div>
            <div className="space-y-1">
              <CardTitle>{title}</CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
          </div>
          {aside}
        </div>
      </CardHeader>
      <CardContent className={cn('space-y-4 p-5 pt-0', contentClassName)}>{children}</CardContent>
    </Card>
  )
}
