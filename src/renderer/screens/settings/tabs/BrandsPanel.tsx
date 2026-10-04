import * as React from 'react'
import { motion } from 'framer-motion'
import { Smartphone } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { cn } from '../../../lib/utils'
import { Badge } from '../../../components/ui/Badge'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { listContainer, listItemProps } from '../../../lib/motion'
import type { Brand } from '../../../../shared/types'
import { SectionHeader } from '../shared/SectionHeader'
import { RowActions } from '../shared/RowActions'

interface BrandsPanelProps {
  brands: Brand[]
  modelCounts: Map<number, number>
  selectedId: number | null
  loading: boolean
  onSelect: (id: number) => void
  onAdd: () => void
  onEdit: (brand: Brand) => void
  onDelete: (brand: Brand) => void
}

/** Left column: the list of brands; selecting one shows its models. */
export function BrandsPanel({
  brands,
  modelCounts,
  selectedId,
  loading,
  onSelect,
  onAdd,
  onEdit,
  onDelete
}: BrandsPanelProps): React.JSX.Element {
  const { t } = useI18n()

  return (
    <div className="space-y-4">
      <SectionHeader
        compact
        title={t.settings.brands.title}
        addLabel={t.common.add}
        onAdd={onAdd}
        addTestId="settings-brand-add"
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : brands.length === 0 ? (
        <EmptyState
          className="py-10"
          icon={<Smartphone />}
          title={t.ui.settings.brands.emptyTitle}
          description={t.ui.settings.brands.emptyDescription}
        />
      ) : (
        <motion.div
          variants={listContainer}
          initial="hidden"
          animate="show"
          className="max-h-[520px] divide-y divide-border overflow-y-auto rounded-xl border border-border/80 bg-card shadow-card"
        >
          {brands.map((b, i) => {
            const selected = selectedId === b.id
            return (
              <motion.div
                key={b.id}
                {...listItemProps(i)}
                data-testid="settings-brand-row"
                className={cn(
                  'flex items-center justify-between gap-1 border-s-2 pe-2 transition-colors',
                  selected ? 'border-primary bg-accent' : 'border-transparent hover:bg-accent/50'
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(b.id)}
                  aria-pressed={selected}
                  className="flex min-w-0 flex-1 items-center gap-2 px-3 py-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span
                    className={cn(
                      'truncate text-sm',
                      selected ? 'font-bold text-accent-foreground' : 'font-medium text-foreground'
                    )}
                  >
                    {b.name}
                  </span>
                  <Badge variant="secondary" className="tabular-nums">
                    {modelCounts.get(b.id) ?? 0}
                  </Badge>
                </button>
                <RowActions onEdit={() => onEdit(b)} onDelete={() => onDelete(b)} testIdPrefix="settings-brand" />
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}
