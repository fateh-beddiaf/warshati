import { useState, useEffect, useRef, useCallback } from 'react'
import type { TicketListItem } from '../../../shared/types'

/** Delay between the last keystroke in the search box and the list query */
export const SEARCH_DEBOUNCE_MS = 250

export type StatusFilter = 'all' | 'in_progress' | 'ready' | 'overdue' | 'delivered' | 'missing_cost'

export interface TicketsListState {
  tickets: TicketListItem[]
  /** A query is in flight */
  loading: boolean
  /** The first response (or failure) has arrived: until then the screen shows skeletons */
  loaded: boolean
  searchQuery: string
  setSearchQuery: (value: string) => void
  statusFilter: StatusFilter
  setStatusFilter: (value: StatusFilter) => void
  fetchTickets: () => Promise<void>
}

/**
 * Loads the tickets list. The query is sent with a debounced copy of the search box so fast typing
 * doesn't fire one IPC round trip per keystroke; out-of-order responses are ignored; `refreshKey`
 * (bumped by the parent) refetches in place.
 */
export function useTicketsList(refreshKey: number): TicketsListState {
  const [tickets, setTickets] = useState<TicketListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const latestRequestRef = useRef(0)

  const [debouncedQuery, setDebouncedQuery] = useState('')
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(searchQuery), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [searchQuery])

  const fetchTickets = useCallback(async (): Promise<void> => {
    const requestId = ++latestRequestRef.current
    setLoading(true)
    try {
      // 'overdue' and 'missing_cost' are derived filters: fetch the matching statuses, narrow here
      const ticketsRes = await window.api.getTicketsList(
        debouncedQuery,
        statusFilter === 'overdue' ? 'ready' : statusFilter === 'missing_cost' ? 'all' : statusFilter
      )

      // Ignore out-of-order responses (fast typing / quick filter switches)
      if (requestId !== latestRequestRef.current) return

      if (ticketsRes.success && ticketsRes.data) {
        if (statusFilter === 'overdue') {
          setTickets(ticketsRes.data.filter((t) => t.is_overdue))
        } else if (statusFilter === 'missing_cost') {
          setTickets(ticketsRes.data.filter((t) => t.parts_cost_missing))
        } else {
          setTickets(ticketsRes.data)
        }
      }
    } catch (err) {
      console.error('Error fetching tickets:', err)
    } finally {
      if (requestId === latestRequestRef.current) {
        setLoading(false)
        setLoaded(true)
      }
    }
  }, [debouncedQuery, statusFilter])

  // Load tickets on (debounced) search / filter changes and when the parent requests a refresh
  useEffect(() => {
    fetchTickets()
  }, [fetchTickets, refreshKey])

  return { tickets, loading, loaded, searchQuery, setSearchQuery, statusFilter, setStatusFilter, fetchTickets }
}
