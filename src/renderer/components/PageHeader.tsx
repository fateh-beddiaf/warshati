import * as React from 'react'
import { cn } from '../lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  /** Buttons / controls shown at the end of the header */
  actions?: React.ReactNode
  className?: string
}

/**
 * Shared screen header: soft primary gradient card with icon, title, subtitle and actions.
 * Use at the top of every main screen so they look like one app.
 */
export function PageHeader({ title, subtitle, icon, actions, className }: PageHeaderProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-col justify-between gap-4 rounded-xl border border-border/70 bg-gradient-header bg-card p-5 shadow-soft sm:flex-row sm:items-center',
        className
      )}
    >
      <div className="flex items-center gap-4">
        {icon && (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-card [&_svg]:h-6 [&_svg]:w-6">
            {icon}
          </div>
        )}
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
