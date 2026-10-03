import * as React from 'react'
import { motion } from 'framer-motion'
import { useI18n } from '../../lib/i18n'
import { listContainer } from '../../lib/motion'
import { Card } from '../../components/ui/Card'
import { Table, TableHead, TableHeader, TableRow } from '../../components/ui/Table'
import { TicketRow } from './TicketRow'
import type { TicketListItem } from '../../../shared/types'

interface TicketsTableProps {
  tickets: TicketListItem[]
  onOpen?: (ticketId: number) => void
  onPrint?: (ticket: TicketListItem) => void
}

export function TicketsTable({ tickets, onOpen, onPrint }: TicketsTableProps): React.JSX.Element {
  const { t } = useI18n()
  const columns = [
    t.ticketsList.table.ticketNumber,
    t.ticketsList.table.customer,
    t.ticketsList.table.device,
    t.ticketsList.table.category,
    t.ticketsList.table.price,
    t.ticketsList.table.remaining,
    t.ticketsList.table.technician,
    t.ticketsList.table.status,
    t.ticketsList.table.createdAt
  ]

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((label) => (
              <TableHead key={label} className="px-2.5">
                {label}
              </TableHead>
            ))}
            <TableHead className="px-2.5 text-center">{t.common.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <motion.tbody
          variants={listContainer}
          initial="hidden"
          animate="show"
          className="divide-y divide-border bg-card"
        >
          {tickets.map((ticket, index) => (
            <TicketRow key={ticket.id} ticket={ticket} index={index} onOpen={onOpen} onPrint={onPrint} />
          ))}
        </motion.tbody>
      </Table>
    </Card>
  )
}
