import * as React from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowRightLeft, Check, CheckCircle, PackageCheck, RotateCcw } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { Button } from '../../ui/Button'
import { slideDown } from '../../../lib/motion'
import type { TicketFullDetails } from '../../../../shared/types'
import type { TicketDetailsState } from './useTicketDetailsState'

/** Overdue warning for ready tickets that waited longer than the pickup threshold. */
export function OverdueBanner({ ticketDetails }: { ticketDetails: TicketFullDetails }): React.JSX.Element | null {
  const { t } = useI18n()
  if (ticketDetails.ticket.status !== 'ready' || !ticketDetails.is_overdue) return null
  return (
    <motion.div
      {...slideDown}
      data-testid="overdue-banner"
      className="flex items-start gap-3 rounded-xl border-2 border-status-overdue/40 bg-status-overdue-soft p-4 text-status-overdue-soft-foreground shadow-soft"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <h4 className="text-sm font-bold">{t.lifecycle.overdueWarningTitle}</h4>
        <p className="mt-0.5 text-xs opacity-90">
          {t.lifecycle.overdueWarningDesc.replace('{days}', String(ticketDetails.overdue_days || 0))}
        </p>
      </div>
    </motion.div>
  )
}

/** Lifecycle actions: in_progress -> ready -> delivered (with revert steps). */
export function StatusActions({
  ticketDetails,
  state
}: {
  ticketDetails: TicketFullDetails
  state: Pick<TicketDetailsState, 'loading' | 'handleUpdateStatus' | 'openDeliveryDialog'>
}): React.JSX.Element {
  const { t } = useI18n()
  const { ticket } = ticketDetails
  const { loading, handleUpdateStatus, openDeliveryDialog } = state

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2 text-xs font-bold text-muted-foreground">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-primary" />
          <span>{t.lifecycle.statusActionTitle}</span>
        </div>
        <span className="text-[11px]">{t.ui.details.statusLine.replace('{status}', t.status[ticket.status])}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {ticket.status === 'in_progress' && (
          <Button
            type="button"
            variant="success"
            disabled={loading}
            data-testid="status-to-ready"
            onClick={() => handleUpdateStatus('ready')}
            className="flex-1"
          >
            <Check className="h-4 w-4" />
            {t.lifecycle.markReady}
          </Button>
        )}

        {ticket.status === 'ready' && (
          <>
            <Button
              type="button"
              disabled={loading}
              data-testid="open-delivery"
              onClick={openDeliveryDialog}
              className="flex-1"
            >
              <PackageCheck className="h-4 w-4" />
              {t.lifecycle.markDelivered}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              data-testid="status-to-in-progress"
              onClick={() => handleUpdateStatus('in_progress')}
              title={t.lifecycle.revertToInProgress}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t.lifecycle.revertToInProgress}
            </Button>
          </>
        )}

        {ticket.status === 'delivered' && (
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-success">
              <CheckCircle className="h-4 w-4" />
              {t.ui.details.deliveredNotice}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              data-testid="status-back-to-ready"
              onClick={() => handleUpdateStatus('ready')}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t.lifecycle.revertToReady}
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
