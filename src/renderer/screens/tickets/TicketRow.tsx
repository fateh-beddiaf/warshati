import * as React from 'react'
import { motion } from 'framer-motion'
import { CircleDollarSign, Printer, Smartphone } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { cn, formatCurrency, formatDateParts } from '../../lib/utils'
import { listItemProps } from '../../lib/motion'
import { Button } from '../../components/ui/Button'
import { TableCell } from '../../components/ui/Table'
import { StatusBadge } from '../../components/tickets/StatusBadge'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/Tooltip'
import type { TicketListItem } from '../../../shared/types'
import { Mono } from '../../components/ui/Mono'

interface TicketRowProps {
  ticket: TicketListItem
  /** Position in the list: only the first rows get the stagger entrance */
  index: number
  onOpen?: (ticketId: number) => void
  onPrint?: (ticket: TicketListItem) => void
}

export function TicketRow({ ticket, index, onOpen, onPrint }: TicketRowProps): React.JSX.Element {
  const { t, language } = useI18n()
  const createdAt = formatDateParts(ticket.created_at, language)
  const isOverdue = ticket.status === 'ready' && !!ticket.is_overdue

  return (
    <motion.tr
      {...listItemProps(index)}
      tabIndex={0}
      data-overdue={isOverdue ? 'true' : undefined}
      onClick={() => onOpen?.(ticket.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) onOpen?.(ticket.id)
      }}
      className={cn(
        'cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        isOverdue
          ? 'bg-status-overdue-soft hover:bg-status-overdue-soft/70'
          : 'hover:bg-accent/50'
      )}
    >
      {/* Barcode, id and created date (+ start-edge accent bar for overdue tickets) */}
      <TableCell className="relative px-2">
        {isOverdue && <span aria-hidden className="absolute inset-y-0 start-0 w-1 bg-status-overdue" />}
        <div className="flex flex-col items-start gap-1">
          <Mono className="w-fit rounded border border-border bg-muted px-1.5 py-1 text-xs font-bold text-foreground">
            {ticket.barcode_code}
          </Mono>
          <span className="text-xs text-muted-foreground tabular">
            #{ticket.id} · {createdAt.date}
          </span>
          <span className="text-[11px] text-muted-foreground tabular">{createdAt.time}</span>
        </div>
      </TableCell>

      {/* Customer */}
      <TableCell className="whitespace-normal px-2">
        <div className="flex flex-col items-start">
          <span className="font-bold text-foreground">{ticket.customer_name}</span>
          <Mono className="mt-0.5 text-xs text-muted-foreground">{ticket.customer_phone}</Mono>
        </div>
      </TableCell>

      {/* Device + repair category */}
      <TableCell className="whitespace-normal px-2">
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Smartphone className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              {ticket.brand} {ticket.model}
            </span>
            {ticket.short_label && <Mono className="text-xs font-bold text-primary">{ticket.short_label}</Mono>}
          </div>
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
            {ticket.category_name || t.ui.tickets.categoryFallback}
          </span>
        </div>
      </TableCell>

      {/* Price + remaining */}
      <TableCell className="px-2">
        <div className="flex flex-col items-start gap-1">
          <span className="flex items-center gap-1.5">
            <span className="font-bold text-foreground tabular">{formatCurrency(ticket.price)}</span>
            {/* Cost still missing: an icon only (never the amount) */}
            {ticket.parts_cost_missing && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    data-testid="row-missing-cost"
                    role="img"
                    aria-label={t.ui.partsCost.tickets.missingAria}
                    className="inline-flex text-warning"
                  >
                    <CircleDollarSign className="h-4 w-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>{t.ui.partsCost.tickets.missingTooltip}</TooltipContent>
              </Tooltip>
            )}
          </span>
          {ticket.amount_remaining > 0 ? (
            <span className="rounded border border-warning/25 bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning-soft-foreground tabular">
              {formatCurrency(ticket.amount_remaining)}
            </span>
          ) : (
            <span className="rounded border border-success/25 bg-success-soft px-2 py-0.5 text-xs font-semibold text-success-soft-foreground">
              {t.ui.tickets.settled}
            </span>
          )}
        </div>
      </TableCell>

      {/* Status (+ overdue days) and technician */}
      <TableCell className="px-2">
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={ticket.status} overdue={isOverdue} />
          {isOverdue && (
            <span className="text-[11px] font-bold text-status-overdue-soft-foreground tabular">
              {t.lifecycle.overdueBadge.replace('{days}', String(ticket.overdue_days || 0))}
            </span>
          )}
          <span className="text-xs font-semibold text-muted-foreground">{ticket.technician}</span>
        </div>
      </TableCell>

      {/* Reprint barcode */}
      <TableCell className="px-2 text-center" onClick={(e) => e.stopPropagation()}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="row-print"
          onClick={() => onPrint?.(ticket)}
          className="gap-1.5 text-xs hover:border-primary/40 hover:text-primary"
          title={t.print.reprintButton}
          aria-label={`${t.ui.tickets.printRow} - ${t.print.reprintButton}`}
        >
          <Printer className="h-3.5 w-3.5 text-primary" />
          <span className="hidden 2xl:inline">{t.ui.tickets.printRow}</span>
        </Button>
      </TableCell>
    </motion.tr>
  )
}
