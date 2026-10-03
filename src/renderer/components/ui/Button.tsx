import * as React from 'react'
import { cn } from '../../lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50'

    const variants = {
      default: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm active:bg-blue-800',
      secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300',
      outline: 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-800',
      destructive: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
      ghost: 'hover:bg-slate-100 text-slate-700'
    }

    const sizes = {
      default: 'h-10 px-4 py-2',
      sm: 'h-8 rounded-md px-3 text-xs',
      lg: 'h-12 rounded-lg px-6 text-base font-bold',
      icon: 'h-10 w-10'
    }

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
