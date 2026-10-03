import * as React from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '../lib/utils'
import { useI18n } from '../lib/i18n'
import { useTheme } from '../lib/theme'
import { transitions } from '../lib/motion'
import type { ThemePreference } from '@shared/theme'

const OPTIONS: Array<{ value: ThemePreference; icon: typeof Sun }> = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor }
]

/** Segmented light / dark / system control (used in Settings). */
export function ThemeSelector({ className }: { className?: string }): React.JSX.Element {
  const { t } = useI18n()
  const { preference, setPreference } = useTheme()

  return (
    <div
      role="radiogroup"
      aria-label={t.theme.label}
      data-testid="theme-selector"
      className={cn('inline-flex rounded-lg bg-muted p-1', className)}
    >
      {OPTIONS.map(({ value, icon: Icon }) => {
        const active = preference === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            data-testid={`theme-option-${value}`}
            onClick={() => setPreference(value)}
            className={cn(
              'relative inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {active && (
              <motion.span
                layoutId="theme-selector-pill"
                transition={transitions.spring}
                className="absolute inset-0 rounded-md bg-card shadow-soft"
              />
            )}
            <Icon className="relative h-4 w-4" />
            <span className="relative">{t.theme[value]}</span>
          </button>
        )
      })}
    </div>
  )
}
