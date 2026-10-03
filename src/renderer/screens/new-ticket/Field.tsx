import * as React from 'react'
import { Label } from '../../components/ui/Label'
import { cn } from '../../lib/utils'

interface FieldProps {
  label: string
  required?: boolean
  /** Small text on the label row's end side */
  hint?: string
  className?: string
  children: React.ReactNode
}

/** Label + control wrapper shared by the New Ticket sections. */
export function Field({ label, required = false, hint, className, children }: FieldProps): React.JSX.Element {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-bold">
          {label}
          {required && (
            <span className="ms-1 text-danger" aria-hidden>
              *
            </span>
          )}
        </Label>
        {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
