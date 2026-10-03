import * as React from 'react'
import { motion } from 'framer-motion'
import { CircleDollarSign } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { slideDown } from '../../lib/motion'
import { Button } from '../../components/ui/Button'

interface MissingCostBannerProps {
  count: number
  onShowMissing: () => void
}

/** Static banner (same style as the overdue one): N tickets still need their parts cost. Never shows an amount. */
export function MissingCostBanner({ count, onShowMissing }: MissingCostBannerProps): React.JSX.Element {
  const { t } = useI18n()
  return (
    <motion.div
      {...slideDown}
      data-testid="missing-cost-banner"
      className="flex items-center justify-between gap-3 rounded-xl border border-warning/25 bg-warning-soft p-3.5 text-warning-soft-foreground shadow-soft"
    >
      <div className="flex items-center gap-2.5">
        <CircleDollarSign className="h-5 w-5 flex-shrink-0" />
        <p className="text-xs font-bold">{t.ui.partsCost.tickets.bannerText.replace('{count}', String(count))}</p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        data-testid="missing-cost-banner-show"
        onClick={onShowMissing}
        className="border-warning/30 text-xs font-bold text-warning-soft-foreground hover:bg-warning-soft"
      >
        {t.ui.partsCost.tickets.showMissingOnly}
      </Button>
    </motion.div>
  )
}
