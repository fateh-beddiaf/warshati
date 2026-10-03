import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-primary/20 bg-accent text-accent-foreground',
        secondary: 'border-border bg-secondary text-secondary-foreground',
        success: 'border-success/25 bg-success-soft text-success-soft-foreground',
        warning: 'border-warning/25 bg-warning-soft text-warning-soft-foreground',
        destructive: 'border-danger/25 bg-danger-soft text-danger-soft-foreground',
        outline: 'border-input text-foreground',
        // Ticket lifecycle
        inProgress: 'border-status-in-progress/25 bg-status-in-progress-soft text-status-in-progress-soft-foreground',
        ready: 'border-status-ready/25 bg-status-ready-soft text-status-ready-soft-foreground',
        delivered: 'border-status-delivered/25 bg-status-delivered-soft text-status-delivered-soft-foreground',
        overdue: 'border-status-overdue/30 bg-status-overdue-soft text-status-overdue-soft-foreground'
      }
    },
    defaultVariants: { variant: 'default' }
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps): React.JSX.Element {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
