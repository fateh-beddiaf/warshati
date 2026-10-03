import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useI18n } from '../../lib/i18n'
import type {
  FinancialReportResult,
  ReportPeriod,
  ReportFilterDTO,
  AppMetadata,
  TicketListItem
} from '../../../shared/types'

export interface ReportFilters {
  period: ReportPeriod
  startDate: string
  endDate: string
  technicianFilter: string
  categoryFilter: string
}

export interface ReportData {
  report: FinancialReportResult | null
  metadata: AppMetadata | null
  loading: boolean
  loadError: string | null
  deliveredTickets: TicketListItem[]
  reload: () => Promise<void>
}

/** Loads the filter metadata once and the financial report whenever a filter changes. */
export function useReportData(filters: ReportFilters): ReportData {
  const { t } = useI18n()
  const { period, startDate, endDate, technicianFilter, categoryFilter } = filters

  const [report, setReport] = useState<FinancialReportResult | null>(null)
  const [metadata, setMetadata] = useState<AppMetadata | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const latestRequestRef = useRef(0)

  // Fetch Metadata for filters
  useEffect(() => {
    async function loadMeta(): Promise<void> {
      try {
        const res = await window.api.getMetadata()
        if (res.success && res.data) {
          setMetadata(res.data)
        }
      } catch (err) {
        console.error('Failed to load metadata:', err)
      }
    }
    loadMeta()
  }, [])

  // Fetch Report Data
  const loadReport = useCallback(async (): Promise<void> => {
    const requestId = ++latestRequestRef.current
    setLoading(true)
    try {
      const filterDTO: ReportFilterDTO = {
        period,
        startDate: period === 'custom' ? startDate : undefined,
        endDate: period === 'custom' ? endDate : undefined,
        technicianFilter: technicianFilter !== 'all' ? technicianFilter : undefined,
        categoryFilter: categoryFilter !== 'all' ? Number(categoryFilter) : undefined
      }

      const res = await window.api.getFinancialReport(filterDTO)
      // Ignore out-of-order responses (quick filter switches)
      if (requestId !== latestRequestRef.current) return
      if (res.success && res.data) {
        setReport(res.data)
        setLoadError(null)
      } else {
        // Don't keep showing the previous period's numbers next to an error
        setReport(null)
        setLoadError(res.error || t.reports.loadError)
      }
    } catch (err) {
      console.error('Failed to load financial report:', err)
      if (requestId !== latestRequestRef.current) return
      setReport(null)
      setLoadError(t.reports.loadError)
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false)
    }
  }, [period, startDate, endDate, technicianFilter, categoryFilter, t])

  // The ledger only lists delivered tickets: derive them once per report, not per use
  const deliveredTickets = useMemo(
    () => (report?.tickets ?? []).filter((tk) => tk.status === 'delivered'),
    [report]
  )

  useEffect(() => {
    loadReport()
  }, [loadReport])

  return { report, metadata, loading, loadError, deliveredTickets, reload: loadReport }
}
