import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { cn } from '../../lib/utils'
import { Input } from '../ui/Input'

/** A revealed value goes back to dots by itself after this long. */
export const REVEAL_MS = 5000

/**
 * Keeps a revealed/hidden flag that resets itself: after REVEAL_MS, or as soon as focus leaves the
 * whole control (`containerProps.onBlur`) or `reset()` is called (dialog closed, ticket changed...).
 */
export function useAutoHide(): {
  revealed: boolean
  toggle: () => void
  hide: () => void
} {
  const [revealed, setRevealed] = React.useState(false)
  React.useEffect(() => {
    if (!revealed) return
    const timer = setTimeout(() => setRevealed(false), REVEAL_MS)
    return () => clearTimeout(timer)
  }, [revealed])
  return {
    revealed,
    toggle: () => setRevealed((v) => !v),
    hide: () => setRevealed(false)
  }
}

interface MaskedAmountInputProps {
  value: string
  onChange: (value: string) => void
  /** Ids/labels for accessibility; the visible label is rendered by the caller */
  id?: string
  ariaLabel?: string
  placeholder?: string
  autoFocus?: boolean
  error?: boolean
  testId?: string
  className?: string
}

/**
 * Amount box that shows dots instead of digits (a customer may be looking at the screen). The eye
 * button reveals the value temporarily; it hides again after a few seconds or when focus leaves the
 * control. Typing works normally (decimal keypad), nothing is ever echoed in the clear by default.
 */
export function MaskedAmountInput({
  value,
  onChange,
  id,
  ariaLabel,
  placeholder,
  autoFocus,
  error,
  testId,
  className
}: MaskedAmountInputProps): React.JSX.Element {
  const { t } = useI18n()
  const { revealed, toggle, hide } = useAutoHide()
  const text = t.ui.partsCost.field

  return (
    <div
      className={cn('relative', className)}
      onBlur={(e) => {
        // focus moved to somewhere outside this control (not just input -> eye button)
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hide()
      }}
    >
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        data-testid={testId}
        data-masked={revealed ? 'false' : 'true'}
        error={error}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn('tabular pe-10', !revealed && '[-webkit-text-security:disc]')}
      />
      <button
        type="button"
        tabIndex={0}
        data-testid={testId ? `${testId}-toggle` : undefined}
        aria-pressed={revealed}
        aria-label={revealed ? text.hide : text.show}
        title={revealed ? text.hide : text.show}
        onClick={toggle}
        className="absolute end-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}
