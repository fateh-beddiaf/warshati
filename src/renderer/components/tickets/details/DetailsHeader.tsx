import * as React from 'react'
import { FileText } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { DialogDescription, DialogTitle } from '../../ui/Dialog'
import { StatusBadge } from '../StatusBadge'
import type { TicketFullDetails } from '../../../../shared/types'
import { Mono } from '../../ui/Mono'

/** Modal header: ticket id, status badge and the barcode. Doubles as the Radix title/description. */
export function DetailsHeader({ ticketDetails }: { ticketDetails: TicketFullDetails }): React.JSX.Element {
  const { t } = useI18n()
  const { ticket } = ticketDetails
  return (
    <div className="border-b border-border bg-gradient-header px-6 py-5 pe-14">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-card">
          <FileText className="h-6 w-6" />
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <DialogTitle className="text-xl">
              {t.ticketDetails.title} <span className="tabular">#{ticket.id}</span>
            </DialogTitle>
            <StatusBadge
              status={ticket.status}
              overdue={Boolean(ticketDetails.is_overdue)}
              overdueDays={ticketDetails.overdue_days}
            />
          </div>
          <DialogDescription className="text-xs">
            {t.ticketDetails.ticketCode}{' '}
            <Mono as="strong" className="text-sm font-bold text-foreground">
              {ticket.barcode_code}
            </Mono>
          </DialogDescription>
        </div>
      </div>
    </div>
  )
}
