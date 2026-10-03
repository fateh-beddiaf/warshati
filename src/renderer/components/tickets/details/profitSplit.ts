import { calculateProfitSplit } from '../../../../shared/profit'
import type { TicketFullDetails } from '../../../../shared/types'

export interface DisplayedProfitSplit {
  myShare: number
  partnerShare: number
  myPercentage: number
  partnerPercentage: number
  isPartnerExclusive: boolean
}

/** Stored split for delivered tickets, live calculation otherwise (logic moved verbatim from the modal). */
export function resolveProfitSplit(ticketDetails: TicketFullDetails | null): DisplayedProfitSplit {
  if (!ticketDetails) {
    return {
      myShare: 0,
      partnerShare: 0,
      myPercentage: 0,
      partnerPercentage: 0,
      isPartnerExclusive: false
    }
  }
  const { ticket, category } = ticketDetails
  if (ticket.status === 'delivered' && ticket.my_share !== null && ticket.my_share !== undefined && ticket.partner_share !== null && ticket.partner_share !== undefined) {
    const isPartner = Boolean(ticket.technician_is_partner)
    return {
      myShare: ticket.my_share,
      partnerShare: ticket.partner_share,
      myPercentage: isPartner ? 0 : (category?.default_split_percentage ?? 50),
      partnerPercentage: isPartner ? 100 : Math.round((100 - (category?.default_split_percentage ?? 50)) * 100) / 100,
      isPartnerExclusive: isPartner
    }
  }
  return calculateProfitSplit({
    price: ticket.price,
    isPartner: Boolean(ticket.technician_is_partner),
    categorySplitPercentage: category?.default_split_percentage ?? 50.0
  })
}
