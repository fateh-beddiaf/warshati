import * as React from 'react'
import { motion } from 'framer-motion'
import { SlidersHorizontal } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { slideDown } from '../../lib/motion'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import type { OverdueThresholdState } from './useOverdueThreshold'

interface ThresholdPanelProps {
  state: OverdueThresholdState
  /** Called after a valid save so the list can be refetched */
  onSaved: () => void
}

/** Inline panel for editing the "ready but not picked up" threshold (days). */
export function ThresholdPanel({ state, onSaved }: ThresholdPanelProps): React.JSX.Element {
  const { t } = useI18n()
  return (
    <motion.div
      {...slideDown}
      data-testid="threshold-panel"
      className="flex flex-col items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-soft sm:flex-row"
    >
      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
        <SlidersHorizontal className="h-4 w-4 text-primary" />
        <span>{t.lifecycle.thresholdSettingsLabel}</span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min="1"
          max="30"
          value={state.input}
          onChange={(e) => state.setInput(e.target.value)}
          className="h-8 w-20 text-center text-xs font-bold tabular"
        />
        <span className="text-xs text-muted-foreground">{t.common.days}</span>
        <Button type="button" size="sm" onClick={() => state.save(onSaved)}>
          {t.common.save}
        </Button>
      </div>
    </motion.div>
  )
}
