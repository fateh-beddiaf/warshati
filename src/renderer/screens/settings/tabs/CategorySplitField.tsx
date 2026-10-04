import * as React from 'react'
import { useI18n } from '../../../lib/i18n'
import { formatAmount } from '../../../lib/utils'
import { Label } from '../../../components/ui/Label'
import { clampSplit } from './CategoryCard'

/** Reference ticket price used for the live split preview. */
const PREVIEW_PRICE = 10000
/** Reference parts cost used by the preview while the category requires a parts cost. */
const PREVIEW_COST = 6000

const fmt = (n: number): string => formatAmount(n)

interface CategorySplitFieldProps {
  value: number
  onChange: (value: number) => void
  /** The category requires a parts cost: the preview splits the NET profit of an example with a cost */
  requiresPartsCost?: boolean
}

/** Owner/partner split slider with a live preview for a 10,000 ticket. */
export function CategorySplitField({
  value,
  onChange,
  requiresPartsCost = false
}: CategorySplitFieldProps): React.JSX.Element {
  const { t } = useI18n()
  const id = React.useId()
  const owner = clampSplit(value)
  const partner = 100 - owner
  const cost = requiresPartsCost ? PREVIEW_COST : 0
  const net = PREVIEW_PRICE - cost
  const costText = t.ui.partsCost.settings

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{t.settings.categories.splitPercentage}</Label>
        <span className="text-sm font-bold tabular-nums text-primary">
          {t.ui.settings.categories.splitSummary
            .replace('{owner}', String(owner))
            .replace('{partner}', String(partner))}
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
        <span className="block font-bold text-muted-foreground">
          {requiresPartsCost ? costText.previewTitle : t.settings.categories.preview}
        </span>
        {requiresPartsCost && (
          <span data-testid="settings-category-preview-line" className="block tabular-nums text-foreground">
            {costText.previewLine
              .replace('{price}', `${fmt(PREVIEW_PRICE)} ${t.common.currency}`)
              .replace('{cost}', `${fmt(cost)} ${t.common.currency}`)
              .replace('{net}', `${fmt(net)} ${t.common.currency}`)}
          </span>
        )}
        <div className="flex flex-wrap justify-between gap-2 font-bold tabular-nums">
          <span className="text-primary" data-testid="settings-category-preview-owner">
            {t.ui.settings.categories.previewOwner
              .replace('{amount}', fmt(net * (owner / 100)))
              .replace('{currency}', t.common.currency)}
          </span>
          <span className="text-success-soft-foreground" data-testid="settings-category-preview-partner">
            {t.ui.settings.categories.previewPartner
              .replace('{amount}', fmt(net * (partner / 100)))
              .replace('{currency}', t.common.currency)}
          </span>
        </div>
      </div>
    </div>
  )
}
