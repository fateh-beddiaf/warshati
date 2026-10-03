import * as React from 'react'
import { AlertTriangle, CheckCircle, Clock, PackageCheck } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { useI18n } from '../../lib/i18n'
import type { TicketStatus } from '../../../shared/types'

interface StatusBadgeProps {
  status: TicketStatus
  /** A ready ticket that waited longer than the pickup threshold gets the louder "overdue" tone */
  overdue?: boolean
  overdueDays?: number
  className?: string
}

/** One place that maps a ticket status to its colour tokens + icon + label. */
export function StatusBadge({ status, overdue = false, overdueDays, className }: StatusBadgeProps): React.JSX.Element {
  const { t } = useI18n()

  if (status === 'ready' && overdue) {
    return (
      <Badge variant="overdue" className={className} data-status="overdue">
        <AlertTriangle className="h-3 w-3" />
        {t.status.ready}
        {overdueDays !== undefined && (
          <span className="tabular">· {t.lifecycle.overdueBadge.replace('{days}', String(overdueDays))}</span>
        )}
      </Badge>
    )
  }

  switch (status) {
    case 'in_progress':
      return (
        <Badge variant="inProgress" className={className} data-status="in_progress">
          <Clock className="h-3 w-3" />
          {t.status.in_progress}
        </Badge>
      )
    case 'ready':
      return (
        <Badge variant="ready" className={className} data-status="ready">
          <CheckCircle className="h-3 w-3" />
          {t.status.ready}
        </Badge>
      )
    case 'delivered':
      return (
        <Badge variant="delivered" className={className} data-status="delivered">
          <PackageCheck className="h-3 w-3" />
          {t.status.delivered}
        </Badge>
      )
    default:
      return <Badge variant="outline">{String(status)}</Badge>
  }
}
