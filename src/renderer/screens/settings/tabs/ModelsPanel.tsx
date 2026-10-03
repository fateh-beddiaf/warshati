import * as React from 'react'
import { useMemo, useState } from 'react'
import { Search, Smartphone } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { Input } from '../../../components/ui/Input'
import { EmptyState } from '../../../components/ui/EmptyState'
import type { Brand, Model } from '../../../../shared/types'
import { SectionHeader } from '../shared/SectionHeader'
import { RowActions } from '../shared/RowActions'

interface ModelsPanelProps {
  brand: Brand | null
  /** Models of the selected brand only */
  models: Model[]
  onAdd: () => void
  onEdit: (model: Model) => void
  onDelete: (model: Model) => void
}

/**
 * Right column: models of the selected brand with a search box.
 * Lists can reach ~300 rows, so rows are plain elements (no per-row animation).
 */
export function ModelsPanel({ brand, models, onAdd, onEdit, onDelete }: ModelsPanelProps): React.JSX.Element {
  const { t } = useI18n()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? models.filter((m) => m.name.toLowerCase().includes(q)) : models
  }, [models, query])

  return (
    <div className="space-y-4">
      <SectionHeader
        compact
        title={brand ? t.settings.models.title.replace('{brand}', brand.name) : t.settings.models.selectBrandPrompt}
        addLabel={brand ? t.settings.models.addModel.replace('{brand}', brand.name) : undefined}
        onAdd={brand ? onAdd : undefined}
        addTestId="settings-model-add"
      />

      {brand ? (
        <div className="space-y-4 rounded-xl border border-border/80 bg-card p-4 shadow-card">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.common.search}
              className="ps-9"
              data-testid="settings-model-search"
            />
          </div>

          {models.length === 0 ? (
            <EmptyState
              className="py-10"
              icon={<Smartphone />}
              title={t.ui.settings.models.emptyTitle}
              description={t.ui.settings.models.emptyDescription}
            />
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t.ui.settings.models.noMatch}</p>
          ) : (
            <div className="grid max-h-[420px] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
              {filtered.map((m) => (
                <div
                  key={m.id}
                  data-testid="settings-model-row"
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 py-1.5 ps-3 pe-1.5 transition-colors hover:bg-accent/60"
                >
                  <span className="truncate text-sm font-semibold text-foreground">{m.name}</span>
                  <RowActions onEdit={() => onEdit(m)} onDelete={() => onDelete(m)} testIdPrefix="settings-model" />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <EmptyState icon={<Smartphone />} title={t.settings.models.selectBrandPrompt} />
      )}
    </div>
  )
}
