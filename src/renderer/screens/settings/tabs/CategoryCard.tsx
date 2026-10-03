import * as React from 'react'
import { motion } from 'framer-motion'
import { useI18n } from '../../../lib/i18n'
import { Card, CardContent } from '../../../components/ui/Card'
import { Badge } from '../../../components/ui/Badge'
import { listItemProps } from '../../../lib/motion'
import type { RepairCategory } from '../../../../shared/types'
import { RowActions } from '../shared/RowActions'

/** Keeps the shown split inside 0..100 even if a stored value is malformed. */
export function clampSplit(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0
}

interface CategoryCardProps {
  category: RepairCategory
  index: number
  onEdit: (category: RepairCategory) => void
  onDelete: (category: RepairCategory) => void
}

export function CategoryCard({ category, index, onEdit, onDelete }: CategoryCardProps): React.JSX.Element {
  const { t } = useI18n()
  const mine = clampSplit(category.default_split_percentage)
  const partner = 100 - mine

  return (
    <motion.div {...listItemProps(index)} data-testid="settings-category-card">
      <Card className="h-full transition-shadow hover:shadow-pop">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="truncate text-base font-bold text-foreground">{category.name}</h4>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="default" className="tabular-nums">
                  {t.settings.categories.ownerShare.replace('{percent}', String(mine))}
                </Badge>
                <Badge variant="success" className="tabular-nums">
                  {t.settings.categories.partnerShare.replace('{percent}', String(partner))}
                </Badge>
              </div>
            </div>
            <RowActions onEdit={() => onEdit(category)} onDelete={() => onDelete(category)} testIdPrefix="settings-category" />
          </div>

          <div className="mt-4 space-y-1.5">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full border border-border bg-muted">
              <div style={{ width: `${mine}%` }} className="bg-primary transition-all duration-300" />
              <div style={{ width: `${partner}%` }} className="bg-success transition-all duration-300" />
            </div>
            <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
              <span>
                {t.profit.ownerShareLabel}: <span className="tabular-nums">{mine}%</span>
              </span>
              <span>
                {t.profit.partnerShareLabel}: <span className="tabular-nums">{partner}%</span>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
