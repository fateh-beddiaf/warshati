import * as React from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, History } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { formatDate } from '../../../lib/utils'
import { listContainer, listItemProps } from '../../../lib/motion'
import { SectionCard } from './SectionCard'
import type { TicketFullDetails } from '../../../../shared/types'

/** StatusLog history. Only the first items stagger in (listItemProps). */
export function StatusTimeline({ ticketDetails }: { ticketDetails: TicketFullDetails }): React.JSX.Element | null {
  const { t } = useI18n()
  const { statusLogs } = ticketDetails
  if (!statusLogs || statusLogs.length === 0) return null

  return (
    <SectionCard icon={<History className="text-primary-to" />} title={t.ticketDetails.statusHistory}>
      <motion.ol
        variants={listContainer}
        className="relative ms-3 space-y-3 border-s-2 border-border py-1 ps-4"
      >
        {statusLogs.map((log, index) => (
          <motion.li key={log.id || index} {...listItemProps(index)} className="relative">
            <span className="absolute -start-[23px] top-3 h-3 w-3 rounded-full border-2 border-card bg-primary shadow-soft" />
            <div className="flex flex-col justify-between gap-1 rounded-lg border border-border bg-card p-2.5 text-xs shadow-soft sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 font-bold text-foreground">
                {log.old_status ? (
                  <>
                    <span className="font-normal text-muted-foreground">{t.status[log.old_status] || log.old_status}</span>
                    <ArrowLeft className="h-3 w-3 text-muted-foreground ltr:rotate-180" />
                  </>
                ) : null}
                <span className="text-primary">{t.status[log.new_status] || log.new_status}</span>
              </div>
              <span className="tabular text-[11px] text-muted-foreground">
                {formatDate(log.timestamp)}
              </span>
            </div>
          </motion.li>
        ))}
      </motion.ol>
    </SectionCard>
  )
}
