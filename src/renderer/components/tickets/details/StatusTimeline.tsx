import * as React from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, History, PencilLine } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { formatDate } from '../../../lib/utils'
import { listContainer, listItemProps } from '../../../lib/motion'
import { SectionCard } from './SectionCard'
import { EditChangeList } from '../edit/EditChangeList'
import type { StatusLog, TicketEditLog, TicketFullDetails } from '../../../../shared/types'

type HistoryEvent =
  | { kind: 'status'; key: string; timestamp: string; log: StatusLog }
  | { kind: 'edit'; key: string; timestamp: string; rows: TicketEditLog[] }

/**
 * One timeline: status changes (StatusLog) and edits (TicketEditLog, the rows of one edit share a timestamp and
 * show as one entry), oldest first. Needed for customer disputes: what was entered, what was changed, and when.
 */
export function buildHistory(statusLogs: StatusLog[], editLogs: TicketEditLog[]): HistoryEvent[] {
  const edits = new Map<string, TicketEditLog[]>()
  for (const row of editLogs) edits.set(row.timestamp, [...(edits.get(row.timestamp) ?? []), row])
  const events: HistoryEvent[] = [
    ...statusLogs.map((log) => ({ kind: 'status' as const, key: `s-${log.id}`, timestamp: log.timestamp, log })),
    ...[...edits.entries()].map(([timestamp, rows]) => ({
      kind: 'edit' as const,
      key: `e-${rows[0].id}`,
      timestamp,
      rows
    }))
  ]
  // ISO timestamps sort as text; equal times keep status before edits (stable sort)
  return events.sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0))
}

/** Status and edit history. Only the first items stagger in (listItemProps). */
export function StatusTimeline({ ticketDetails }: { ticketDetails: TicketFullDetails }): React.JSX.Element | null {
  const { t } = useI18n()
  const { statusLogs, editLogs } = ticketDetails
  const events = React.useMemo(() => buildHistory(statusLogs ?? [], editLogs ?? []), [statusLogs, editLogs])
  if (events.length === 0) return null

  return (
    <SectionCard
      icon={<History className="text-primary-to" />}
      title={editLogs.length > 0 ? t.ui.editTicket.historyTitle : t.ticketDetails.statusHistory}
    >
      <motion.ol
        variants={listContainer}
        data-testid="ticket-history"
        className="relative ms-3 space-y-3 border-s-2 border-border py-1 ps-4"
      >
        {events.map((event, index) => (
          <motion.li
            key={event.key}
            {...listItemProps(index)}
            className="relative"
            data-testid={event.kind === 'edit' ? 'history-edit' : 'history-status'}
          >
            <span
              className={
                event.kind === 'edit'
                  ? 'absolute -start-[23px] top-3 h-3 w-3 rounded-full border-2 border-card bg-warning shadow-soft'
                  : 'absolute -start-[23px] top-3 h-3 w-3 rounded-full border-2 border-card bg-primary shadow-soft'
              }
            />
            {event.kind === 'status' ? (
              <div className="flex flex-col justify-between gap-1 rounded-lg border border-border bg-card p-2.5 text-xs shadow-soft sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  {event.log.old_status ? (
                    <>
                      <span className="font-normal text-muted-foreground">
                        {t.status[event.log.old_status] || event.log.old_status}
                      </span>
                      <ArrowLeft className="h-3 w-3 text-muted-foreground ltr:rotate-180" />
                    </>
                  ) : null}
                  <span className="text-primary">{t.status[event.log.new_status] || event.log.new_status}</span>
                </div>
                <span className="tabular text-[11px] text-muted-foreground">{formatDate(event.timestamp)}</span>
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border border-warning/30 bg-card p-2.5 shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-warning-soft-foreground">
                    <PencilLine className="h-3.5 w-3.5" />
                    {t.ui.editTicket.editedEntry}
                  </span>
                  <span className="tabular text-[11px] text-muted-foreground">{formatDate(event.timestamp)}</span>
                </div>
                <EditChangeList
                  rows={event.rows.map((row) => ({ field: row.field, from: row.old_value, to: row.new_value }))}
                />
              </div>
            )}
          </motion.li>
        ))}
      </motion.ol>
    </SectionCard>
  )
}
