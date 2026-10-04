import * as React from 'react'
import { AlertTriangle, CircleDollarSign, Search } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { Input } from '../../components/ui/Input'
import { SegmentedControl, type SegmentedItem } from '../../components/ui/SegmentedControl'
import type { StatusFilter } from './useTicketsList'

interface TicketsToolbarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  statusFilter: StatusFilter
  onStatusFilterChange: (value: StatusFilter) => void
}

/** Search box + status filter pills (the active pill glides between filters). */
export function TicketsToolbar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange
}: TicketsToolbarProps): React.JSX.Element {
  const { t } = useI18n()

  const items: Array<SegmentedItem<StatusFilter>> = [
    { value: 'all', label: t.ticketsList.filterAll, testId: 'filter-all' },
    { value: 'in_progress', label: t.ticketsList.filterInProgress, testId: 'filter-in_progress', tone: 'in-progress' },
    { value: 'ready', label: t.ticketsList.filterReady, testId: 'filter-ready', tone: 'ready' },
    {
      value: 'overdue',
      label: t.ticketsList.filterOverdue,
      testId: 'filter-overdue',
      tone: 'overdue',
      icon: <AlertTriangle />
    },
    { value: 'delivered', label: t.ticketsList.filterDelivered, testId: 'filter-delivered', tone: 'delivered' },
    {
      value: 'missing_cost',
      label: t.ui.partsCost.tickets.filterMissing,
      testId: 'filter-missing_cost',
      tone: 'warning',
      icon: <CircleDollarSign />
    }
  ]

  return (
    <div className="flex flex-col items-stretch justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-soft xl:flex-row xl:items-center">
      <div className="relative min-w-[280px] flex-1">
        <Input
          type="text"
          data-testid="tickets-search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t.ticketsList.searchPlaceholder}
          className="ps-9"
        />
        <Search className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
      </div>

      <SegmentedControl
        items={items}
        value={statusFilter}
        onChange={onStatusFilterChange}
        layoutGroup="tickets-status"
        ariaLabel={t.ui.tickets.statusFiltersAria}
      />
    </div>
  )
}
