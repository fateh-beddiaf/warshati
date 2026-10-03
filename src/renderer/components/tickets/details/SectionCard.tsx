import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../../lib/utils'
import { listItem } from '../../../lib/motion'

interface SectionCardProps {
  icon: React.ReactNode
  title: string
  /** Optional element shown at the end of the title row (e.g. a badge) */
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}

/**
 * Titled surface used by every block of the details modal. It is a stagger item: inside a
 * `listContainer` parent it fades/slides in; outside one it simply renders.
 */
export function SectionCard({ icon, title, action, className, children }: SectionCardProps): React.JSX.Element {
  return (
    <motion.section
      variants={listItem}
      className={cn('space-y-3 rounded-xl border border-border bg-muted/40 p-4', className)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">
          {icon}
          <h4>{title}</h4>
        </div>
        {action}
      </div>
      {children}
    </motion.section>
  )
}
