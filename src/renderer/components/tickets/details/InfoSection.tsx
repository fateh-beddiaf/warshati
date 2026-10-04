import * as React from 'react'
import { Phone, Smartphone, User } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { Badge } from '../../ui/Badge'
import { SectionCard } from './SectionCard'
import type { TicketFullDetails } from '../../../../shared/types'
import { Mono } from '../../ui/Mono'

/** Customer + device/accessories cards (first row of the details body). */
export function InfoSection({ ticketDetails }: { ticketDetails: TicketFullDetails }): React.JSX.Element {
  const { t } = useI18n()
  const { customer, device, accessories } = ticketDetails

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <SectionCard icon={<User className="text-primary" />} title={t.ticketDetails.customerInfo}>
        <p className="text-base font-extrabold text-foreground">{customer.name}</p>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Phone className="h-3.5 w-3.5" />
          <Mono>{customer.phone}</Mono>
        </p>
        {customer.notes && (
          <p className="rounded-lg border border-border bg-card p-2.5 text-xs text-muted-foreground">
            {customer.notes}
          </p>
        )}
      </SectionCard>

      <SectionCard icon={<Smartphone className="text-primary-to" />} title={t.ticketDetails.deviceInfo}>
        <p className="text-base font-extrabold text-foreground">
          {device.brand} {device.model}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">{t.ticketDetails.shortLabel}</span>
          <Mono className="rounded-md bg-foreground px-2 py-0.5 text-xs font-bold text-background">
            {device.short_label}
          </Mono>
        </div>
        <div className="space-y-1.5">
          <span className="block text-xs font-semibold text-muted-foreground">{t.ticketDetails.accessories}</span>
          {accessories.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {accessories.map((acc) => (
                <Badge key={acc.id} variant="default" className="font-bold">
                  {acc.name}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{t.ticketDetails.noAccessories}</span>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
