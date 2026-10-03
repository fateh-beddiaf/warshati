import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'
import { scaleIn } from '../../lib/motion'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description?: string
  /** Optional call to action (usually a <Button>) */
  action?: React.ReactNode
  className?: string
  'data-testid'?: string
}

/** Friendly placeholder for empty lists, no-search-results and no-data reports. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  'data-testid': testId
}: EmptyStateProps): React.JSX.Element {
  return (
    <motion.div
      {...scaleIn}
      data-testid={testId}
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card/60 px-6 py-14 text-center',
        className
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-foreground [&_svg]:h-8 [&_svg]:w-8">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-foreground">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  )
}
