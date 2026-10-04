import * as React from 'react'
import { AnimatePresence } from 'framer-motion'
import { ClipboardList, PlusCircle, RefreshCw, SearchX, SlidersHorizontal } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { useTicketsList } from './tickets/useTicketsList'
import { useOverdueThreshold } from './tickets/useOverdueThreshold'
import { TicketsToolbar } from './tickets/TicketsToolbar'
import { TicketsTable } from './tickets/TicketsTable'
import { TicketsSkeleton } from './tickets/TicketsSkeleton'
import { OverdueBanner } from './tickets/OverdueBanner'
import { MissingCostBanner } from './tickets/MissingCostBanner'
import { ThresholdPanel } from './tickets/ThresholdPanel'
import type { TicketListItem } from '../../shared/types'

interface TicketsListScreenProps {
  onNewTicketClick: () => void
  onOpenTicketDetails?: (ticketId: number) => void
  onPrintTicket?: (ticket: TicketListItem) => void
  /** Bump to refetch the list in place (without remounting the screen) */
  refreshKey?: number
}

export function TicketsListScreen({
  onNewTicketClick,
  onOpenTicketDetails,
  onPrintTicket,
  refreshKey = 0
}: TicketsListScreenProps): React.JSX.Element {
  const { t } = useI18n()
  const list = useTicketsList(refreshKey)
  const threshold = useOverdueThreshold()
  const { tickets, loading, loaded, searchQuery, statusFilter } = list

  const overdueCount = tickets.filter((ticket) => ticket.is_overdue).length
  const missingCostCount = tickets.filter((ticket) => ticket.parts_cost_missing).length
  const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'all'

  const clearFilters = (): void => {
    list.setSearchQuery('')
    list.setStatusFilter('all')
  }

  const thresholdLabel = t.ui.tickets.thresholdButton.replace('{days}', String(threshold.threshold))

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title={t.ticketsList.title}
        subtitle={t.ticketsList.subtitle}
        icon={<ClipboardList />}
        actions={
          <>
            {/* Threshold adjuster toggle */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => threshold.setIsOpen(!threshold.isOpen)}
              className="gap-1.5 text-xs font-semibold"
              title={t.ui.tickets.thresholdTitle}
              aria-expanded={threshold.isOpen}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{thresholdLabel}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={list.fetchTickets}
              title={t.ui.tickets.refreshTitle}
              aria-label={t.ui.tickets.refreshTitle}
              disabled={loading}
            >
              <RefreshCw className={cn('h-4 w-4 text-muted-foreground', loading && 'animate-spin')} />
            </Button>

            <Button type="button" onClick={onNewTicketClick}>
              <PlusCircle className="h-4 w-4" />
              {t.nav.newTicket}
            </Button>
          </>
        }
      />

      <AnimatePresence initial={false}>
        {threshold.isOpen && <ThresholdPanel key="threshold" state={threshold} onSaved={list.fetchTickets} />}
        {missingCostCount > 0 && statusFilter !== 'missing_cost' && (
          <MissingCostBanner
            key="missing-cost"
            count={missingCostCount}
            onShowMissing={() => list.setStatusFilter('missing_cost')}
          />
        )}
        {overdueCount > 0 && statusFilter !== 'overdue' && (
          <OverdueBanner
            key="overdue"
            count={overdueCount}
            threshold={threshold.threshold}
            onShowOverdue={() => list.setStatusFilter('overdue')}
          />
        )}
      </AnimatePresence>

      <TicketsToolbar
        searchQuery={searchQuery}
        onSearchChange={list.setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={list.setStatusFilter}
      />

      {!loaded ? (
        <TicketsSkeleton />
      ) : tickets.length > 0 ? (
        <TicketsTable tickets={tickets} onOpen={onOpenTicketDetails} onPrint={onPrintTicket} />
      ) : hasActiveFilters ? (
        <EmptyState
          data-testid="tickets-empty-filtered"
          icon={<SearchX />}
          title={t.ui.tickets.emptyFilteredTitle}
          description={t.ui.tickets.emptyFilteredSubtitle}
          action={
            <Button type="button" variant="outline" onClick={clearFilters}>
              {t.ui.tickets.clearFilters}
            </Button>
          }
        />
      ) : (
        <EmptyState
          data-testid="tickets-empty"
          icon={<ClipboardList />}
          title={t.ticketsList.emptyTitle}
          description={t.ticketsList.emptySubtitle}
          action={
            <Button type="button" onClick={onNewTicketClick}>
              <PlusCircle className="h-4 w-4" />
              {t.nav.newTicket}
            </Button>
          }
        />
      )}
    </div>
  )
}
