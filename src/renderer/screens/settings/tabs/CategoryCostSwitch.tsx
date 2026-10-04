import * as React from 'react'
import { useI18n } from '../../../lib/i18n'
import { Label } from '../../../components/ui/Label'
import { Switch } from '../../../components/ui/Switch'

interface CategoryCostSwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** Short row (category card) or the full row with the explanation (add/edit dialog) */
  compact?: boolean
  disabled?: boolean
  testId?: string
}

/** "Requires a parts cost" switch of a repair category (off by default; the user decides per category). */
export function CategoryCostSwitch({
  checked,
  onCheckedChange,
  compact,
  disabled,
  testId = 'settings-category-requires-cost'
}: CategoryCostSwitchProps): React.JSX.Element {
  const { t } = useI18n()
  const text = t.ui.partsCost.settings
  const id = React.useId()

  return (
    <div className={compact ? 'flex items-center justify-between gap-3' : 'space-y-2 rounded-lg border border-border bg-muted/40 p-3'}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className={compact ? 'text-xs font-semibold' : 'text-sm font-bold'}>
          {text.switchLabel}
        </Label>
        <Switch
          id={id}
          data-testid={testId}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
          aria-label={text.switchLabel}
        />
      </div>
      {!compact && <p className="text-xs leading-relaxed text-muted-foreground">{text.switchHint}</p>}
    </div>
  )
}
