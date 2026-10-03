import * as React from 'react'
import { FileSpreadsheet, FileX, Hourglass, TrendingDown } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { Card, CardHeader, CardTitle } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { Skeleton } from '../../components/ui/Skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../../components/ui/Table'
import { StatusBadge } from '../../components/tickets/StatusBadge'
import { cn, formatCurrency, formatDate } from '../../lib/utils'
import type { TicketListItem } from '../../../shared/types'
import { Mono } from '../../components/ui/Mono'

interface ReportLedgerProps {
  tickets: TicketListItem[]
  initialLoading: boolean
  onOpenTicketDetails?: (ticketId: number) => void
}

export function ReportLedger({ tickets, initialLoading, onOpenTicketDetails }: ReportLedgerProps): React.JSX.Element {
  const { t } = useI18n()

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border bg-muted/40 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileSpreadsheet className="h-4 w-4 text-success" />
            <span>{t.reports.ticketsLedgerSection}</span>
          </CardTitle>
          <span className="text-xs font-semibold text-muted-foreground">
            {t.ui.reports.deliveredCount.replace('{count}', String(tickets.length))}
          </span>
        </div>
      </CardHeader>

      {initialLoading ? (
        <div className="space-y-3 p-5" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : tickets.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-3">{t.reports.table.ticketNumber}</TableHead>
              <TableHead className="px-3">{t.reports.table.customer}</TableHead>
              <TableHead className="px-3">{t.reports.table.device}</TableHead>
              <TableHead className="px-3">{t.reports.table.category}</TableHead>
              <TableHead className="px-3">{t.reports.table.technician}</TableHead>
              <TableHead className="px-3">{t.reports.table.price}</TableHead>
              <TableHead className="px-3">{t.ui.partsCost.reports.netColumn}</TableHead>
              <TableHead className="px-3 text-primary">{t.reports.table.myShare}</TableHead>
              <TableHead className="px-3 text-primary-to">{t.reports.table.partnerShare}</TableHead>
              <TableHead className="px-3">{t.reports.table.paymentStatus}</TableHead>
              <TableHead className="px-3">{t.reports.table.date}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((tItem) => (
              <TableRow
                key={tItem.id}
                tabIndex={0}
                onClick={() => onOpenTicketDetails && onOpenTicketDetails(tItem.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && onOpenTicketDetails) onOpenTicketDetails(tItem.id)
                }}
                className="cursor-pointer focus-visible:bg-accent/50 focus-visible:outline-none"
              >
                <TableCell className="px-3 py-3">
                  <Mono className="block text-xs font-bold text-foreground">{tItem.barcode_code}</Mono>
                  <StatusBadge status={tItem.status} className="mt-1 px-2 py-0 text-[10px]" />
                </TableCell>
                <TableCell className="px-3 py-3">
                  <span className="block text-xs font-bold text-foreground">{tItem.customer_name}</span>
                  <Mono className="text-[11px] text-muted-foreground">
                    {tItem.customer_phone}
                  </Mono>
                </TableCell>
                <TableCell className="px-3 py-3">
                  <span className="block text-xs font-semibold text-foreground">
                    {tItem.brand} {tItem.model}
                  </span>
                  <Mono className="inline-block rounded bg-muted px-1.5 text-[10px] font-bold text-muted-foreground">
                    {tItem.short_label}
                  </Mono>
                </TableCell>
                <TableCell className="px-3 py-3 text-xs font-semibold text-foreground">{tItem.category_name}</TableCell>
                <TableCell className="px-3 py-3">
                  <Badge variant={tItem.technician_is_partner ? 'secondary' : 'outline'} className="text-[11px] font-bold">
                    {tItem.technician}
                  </Badge>
                </TableCell>
                <TableCell className="px-3 py-3 text-xs font-extrabold tabular text-foreground">
                  {formatCurrency(tItem.price)}
                </TableCell>
                <TableCell className="px-3 py-3 text-xs font-extrabold tabular" data-testid="ledger-net">
                  <span className={cn('block', tItem.is_loss ? 'text-danger' : 'text-foreground')}>
                    {formatCurrency(tItem.net_profit ?? tItem.price)}
                  </span>
                  {tItem.is_provisional && (
                    <Badge variant="warning" data-testid="ledger-provisional" className="mt-1 gap-1 px-1.5 py-0 text-[10px]">
                      <Hourglass className="h-3 w-3" />
                      {t.ui.partsCost.reports.provisionalBadge}
                    </Badge>
                  )}
                  {tItem.is_loss && (
                    <Badge variant="destructive" data-testid="ledger-loss" className="mt-1 gap-1 px-1.5 py-0 text-[10px]">
                      <TrendingDown className="h-3 w-3" />
                      {t.ui.partsCost.reports.lossBadge}
                    </Badge>
                  )}
                </TableCell>
                <TableCell
                  className={cn('px-3 py-3 text-xs font-extrabold tabular', (tItem.my_share ?? 0) < 0 ? 'text-danger' : 'text-primary')}
                >
                  {formatCurrency(tItem.my_share ?? 0)}
                </TableCell>
                <TableCell
                  className={cn('px-3 py-3 text-xs font-extrabold tabular', (tItem.partner_share ?? 0) < 0 ? 'text-danger' : 'text-primary-to')}
                >
                  {formatCurrency(tItem.partner_share ?? 0)}
                </TableCell>
                <TableCell className="px-3 py-3">
                  {tItem.amount_remaining > 0 ? (
                    <Badge variant="warning" className="rounded-md text-[11px] font-bold tabular">
                      {t.ui.reports.debtWithAmount.replace('{amount}', formatCurrency(tItem.amount_remaining))}
                    </Badge>
                  ) : (
                    <Badge variant="success" className="rounded-md text-[11px] font-bold">
                      {t.ui.reports.paidInFull}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="px-3 py-3 text-[11px] tabular text-muted-foreground">
                  {formatDate(tItem.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="p-5">
          <EmptyState
            data-testid="report-empty"
            icon={<FileX />}
            title={t.reports.emptyReports}
            description={t.reports.emptyReportsSubtitle}
          />
        </div>
      )}
    </Card>
  )
}
