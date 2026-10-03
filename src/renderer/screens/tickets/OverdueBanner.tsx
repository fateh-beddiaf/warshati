import * as React from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { slideDown } from '../../lib/motion'
import { Button } from '../../components/ui/Button'

interface OverdueBannerProps {
  count: number
  threshold: number
  onShowOverdue: () => void
}

/** Loud-but-static banner shown when ready tickets waited longer than the pickup threshold. */
export function OverdueBanner({ count, threshold, onShowOverdue }: OverdueBannerProps): React.JSX.Element {
  const { t } = useI18n()
  return (
    <motion.div
      {...slideDown}
      className="flex items-center justify-between gap-3 rounded-xl border border-status-overdue/25 bg-status-overdue-soft p-3.5 text-status-overdue-soft-foreground shadow-soft"
    >
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
        <p className="text-xs font-bold">
          {t.ticketsList.overdueAlertCard
            .replace('{count}', String(count))
            .replace('{threshold}', String(threshold))}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        data-testid="overdue-banner"
        onClick={onShowOverdue}
        className="border-status-overdue/30 text-xs font-bold text-status-overdue-soft-foreground hover:bg-status-overdue-soft"
      >
        {t.ui.tickets.showOverdueOnly}
      </Button>
    </motion.div>
  )
}
