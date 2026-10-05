import * as React from 'react'
import { motion } from 'framer-motion'
import { ShieldAlert } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { slideDown } from '../lib/motion'
import { Button } from './ui/Button'
import type { BackupStatus } from '../../shared/auto-backup'

interface BackupWarningBannerProps {
  status: BackupStatus
  onOpenSettings: () => void
}

/**
 * Stays on every screen while automatic backups are on but not protecting the data: no backup for more than
 * 3 days, or the chosen folder unreachable (USB drive removed). Static, no looping animation.
 */
export function BackupWarningBanner({ status, onOpenSettings }: BackupWarningBannerProps): React.JSX.Element {
  const { t } = useI18n()
  const l = t.ui.layout
  const message = status.health === 'unavailable' ? l.backupUnavailable.replace('{dir}', status.dir) : l.backupStale
  return (
    <motion.div
      {...slideDown}
      role="alert"
      data-testid="backup-warning-banner"
      data-health={status.health}
      className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-danger/25 bg-danger-soft p-3.5 text-danger-soft-foreground shadow-soft"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <ShieldAlert className="h-5 w-5 flex-shrink-0" />
        <p className="text-xs font-bold [overflow-wrap:anywhere]">{message}</p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        data-testid="backup-warning-open-settings"
        onClick={onOpenSettings}
        className="flex-shrink-0 border-danger/30 text-xs font-bold text-danger-soft-foreground hover:bg-danger-soft"
      >
        {l.backupOpenSettings}
      </Button>
    </motion.div>
  )
}
