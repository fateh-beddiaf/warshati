import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'
import { transitions } from '../../lib/motion'

export interface SegmentedItem<T extends string> {
  value: T
  label: React.ReactNode
  icon?: React.ReactNode
  testId?: string
  /** Colour the label/pill when active: neutral (default), or a ticket-status tone */
  tone?: 'default' | 'in-progress' | 'ready' | 'delivered' | 'overdue'
}

interface SegmentedControlProps<T extends string> {
  items: Array<SegmentedItem<T>>
  value: T
  onChange: (value: T) => void
  /** Unique per control instance: the active pill glides between items via Framer `layoutId` */
  layoutGroup: string
  ariaLabel?: string
  className?: string
}

const ACTIVE_TONE: Record<NonNullable<SegmentedItem<string>['tone']>, string> = {
  default: 'text-foreground',
  'in-progress': 'text-status-in-progress-soft-foreground',
  ready: 'text-status-ready-soft-foreground',
  delivered: 'text-status-delivered-soft-foreground',
  overdue: 'text-status-overdue-soft-foreground'
}

const PILL_TONE: Record<NonNullable<SegmentedItem<string>['tone']>, string> = {
  default: 'bg-card shadow-soft',
  'in-progress': 'bg-status-in-progress-soft shadow-soft',
  ready: 'bg-status-ready-soft shadow-soft',
  delivered: 'bg-status-delivered-soft shadow-soft',
  overdue: 'bg-status-overdue-soft shadow-soft'
}

/** Pill-style filter / switcher with a sliding active indicator (used for status filters, report periods, ...). */
export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  layoutGroup,
  ariaLabel,
  className
}: SegmentedControlProps<T>): React.JSX.Element {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1', className)}
    >
      {items.map((item) => {
        const active = item.value === value
        const tone = item.tone ?? 'default'
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={item.testId}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? ACTIVE_TONE[tone] : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {active && (
              <motion.span
                layoutId={`segmented-${layoutGroup}`}
                transition={transitions.spring}
                className={cn('absolute inset-0 rounded-md', PILL_TONE[tone])}
              />
            )}
            {item.icon && <span className="relative [&_svg]:h-3.5 [&_svg]:w-3.5">{item.icon}</span>}
            <span className="relative">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
