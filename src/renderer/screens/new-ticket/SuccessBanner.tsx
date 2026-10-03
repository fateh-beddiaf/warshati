import * as React from 'react'
import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, AlertTriangle, CheckCircle2, Plus, Printer } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { scaleIn, slideDown } from '../../lib/motion'
import { Button } from '../../components/ui/Button'
import { Mono } from '../../components/ui/Mono'

interface SuccessBannerProps {
  barcode: string
  /** The category requires a parts cost and none was entered: remind the user to add it later */
  withoutCost?: boolean
  onPrint: () => void
  onAnother: () => void
  onView: () => void
}

/** Shown after a ticket is saved: barcode + print / another / view actions. */
export function SuccessBanner({ barcode, withoutCost, onPrint, onAnother, onView }: SuccessBannerProps): React.JSX.Element {
  const { t } = useI18n()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest' })
  }, [])

  return (
    <motion.div
      ref={ref}
      {...scaleIn}
      data-testid="ticket-created-banner"
      className="space-y-4 rounded-xl border border-success/25 bg-success-soft p-5 text-success-soft-foreground shadow-card"
    >
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 shrink-0 text-success" />
          <div className="space-y-1">
            <h4 className="text-base font-bold">{t.newTicket.successTitle}</h4>
            <p className="text-sm">
              {t.newTicket.successBarcode}{' '}
              <Mono
                data-testid="ticket-created-barcode"
                className="inline-block rounded-md bg-success/15 px-2 py-0.5 font-bold"
              >
                {barcode}
              </Mono>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button type="button" onClick={onPrint} data-testid="ticket-created-print">
            <Printer className="h-4 w-4" />
            {t.ui.newTicket.actions.printLabel}
          </Button>
          <Button type="button" variant="outline" onClick={onAnother} data-testid="ticket-created-another">
            <Plus className="h-4 w-4" />
            {t.ui.newTicket.actions.anotherTicket}
          </Button>
          <Button type="button" variant="ghost" onClick={onView} data-testid="ticket-created-view">
            {t.ui.newTicket.actions.viewInList}
          </Button>
        </div>
      </div>

      {withoutCost && (
        <div
          role="status"
          data-testid="ticket-created-no-cost-warning"
          className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning-soft p-3 text-warning-soft-foreground"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-0.5 text-xs">
            <p className="font-bold">{t.ui.partsCost.newTicket.noCostTitle}</p>
            <p>{t.ui.partsCost.newTicket.noCostBody}</p>
          </div>
        </div>
      )}
    </motion.div>
  )
}

/** Validation / save error. */
export function ErrorBanner({ message }: { message: string }): React.JSX.Element {
  return (
    <motion.div
      {...slideDown}
      role="alert"
      data-testid="ticket-error-banner"
      className="flex items-center gap-3 rounded-xl border border-danger/25 bg-danger-soft p-4 text-danger-soft-foreground shadow-soft"
    >
      <AlertCircle className="h-5 w-5 shrink-0 text-danger" />
      <p className="text-sm font-semibold">{message}</p>
    </motion.div>
  )
}
