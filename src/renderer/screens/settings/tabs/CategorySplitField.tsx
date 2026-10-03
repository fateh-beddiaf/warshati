import * as React from 'react'
import { useI18n } from '../../../lib/i18n'
import { Label } from '../../../components/ui/Label'
import { clampSplit } from './CategoryCard'

/** Reference ticket price used for the live split preview. */
const PREVIEW_PRICE = 10000

const fmt = (n: number): string => n.toLocaleString('en-US')

interface CategorySplitFieldProps {
  value: number
  onChange: (value: number) => void
}

/** Owner/partner split slider with a live preview for a 10,000 ticket. */
export function CategorySplitField({ value, onChange }: CategorySplitFieldProps): React.JSX.Element {
  const { t } = useI18n()
  const id = React.useId()
  const owner = clampSplit(value)
  const partner = 100 - owner

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{t.settings.categories.splitPercentage}</Label>
        <span className="text-sm font-bold tabular-nums text-primary">
          {t.ui.settings.categories.splitSummary.replace('{owner}', String(owner)).replace('{partner}', String(partner))}
        </span>
      </div>
      <input
        id={id}
        data-testid="settings-category-split"
        type="range"
        min="0"
        max="100"
        step="5"
        value={owner}
        onChange={(e) => {
          const next = parseInt(e.target.value, 10)
          if (Number.isFinite(next)) onChange(next)
        }}
        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
      />
      <div className="space-y-1 rounded-lg border border-border bg-muted/50 p-3 text-xs">
        <span className="block font-bold text-muted-foreground">{t.settings.categories.preview}</span>
        <div className="flex flex-wrap justify-between gap-2 font-bold tabular-nums">
          <span className="text-primary">
            {t.ui.settings.categories.previewOwner
              .replace('{amount}', fmt(PREVIEW_PRICE * (owner / 100)))
              .replace('{currency}', t.common.currency)}
          </span>
          <span className="text-success-soft-foreground">
            {t.ui.settings.categories.previewPartner
              .replace('{amount}', fmt(PREVIEW_PRICE * (partner / 100)))
              .replace('{currency}', t.common.currency)}
          </span>
        </div>
      </div>
    </div>
  )
}
