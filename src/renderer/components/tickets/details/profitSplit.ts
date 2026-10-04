import { calculateProfitSplit, type ProfitSplitResult } from '../../../../shared/profit'
import type { TicketFullDetails } from '../../../../shared/types'

export type DisplayedProfitSplit = ProfitSplitResult

const EMPTY_SPLIT: DisplayedProfitSplit = {
  netProfit: 0,
  partsCost: 0,
  myShare: 0,
  partnerShare: 0,
  myPercentage: 0,
  partnerPercentage: 0,
  isPartnerExclusive: false,
  isProvisional: false,
  isLoss: false
}

/**
 * What the details modal shows: the stored (frozen) shares for delivered tickets, a live calculation
 * otherwise. Always on the NET profit (price - parts cost). A delivered ticket uses the percentage
 * frozen at delivery, not the category's current one.
 */
export function resolveProfitSplit(ticketDetails: TicketFullDetails | null): DisplayedProfitSplit {
  if (!ticketDetails) return EMPTY_SPLIT
  const { ticket, category } = ticketDetails
  const delivered = ticket.status === 'delivered'
  const computed = calculateProfitSplit({
    price: ticket.price,
    partsCost: ticket.parts_cost ?? null,
    requiresPartsCost: Boolean(ticket.parts_cost_required),
    isPartner: Boolean(ticket.technician_is_partner),
    categorySplitPercentage: category?.default_split_percentage ?? 50.0,
    appliedSplitPercentage: delivered ? (ticket.split_percentage_applied ?? null) : null
  })
  const hasStoredShares =
    delivered &&
    ticket.my_share !== null &&
    ticket.my_share !== undefined &&
    ticket.partner_share !== null &&
    ticket.partner_share !== undefined
  return hasStoredShares
    ? { ...computed, myShare: ticket.my_share as number, partnerShare: ticket.partner_share as number }
    : computed
}
