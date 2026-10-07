import * as React from 'react'
import { motion } from 'framer-motion'
import { PencilLine, Printer, Trash2 } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { listContainer } from '../../lib/motion'
import { Button } from '../ui/Button'
import { Dialog, DialogContent } from '../ui/Dialog'
import type { TicketFullDetails } from '../../../shared/types'
import { useTicketDetailsState } from './details/useTicketDetailsState'
import { DetailsHeader } from './details/DetailsHeader'
import { FeedbackBanners } from './details/FeedbackBanners'
import { OverdueBanner, StatusActions } from './details/StatusActions'
import { InfoSection } from './details/InfoSection'
import { RepairFinancialSection } from './details/RepairFinancialSection'
import { StatusTimeline } from './details/StatusTimeline'
import { DeliveryDialog } from './details/DeliveryDialog'
import { DeleteTicketDialog } from './details/DeleteTicketDialog'
import { PartsCostDialog } from './details/PartsCostDialog'
import { EditTicketDialog } from './edit/EditTicketDialog'
import { ReprintPromptDialog } from './edit/ReprintPromptDialog'

export interface TicketDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  ticketDetails: TicketFullDetails | null
  onReprintClick: (ticket: TicketFullDetails) => void
  onStatusUpdated?: () => void
}

/**
 * Ticket details as a Radix Dialog. All stateful logic lives in `useTicketDetailsState`; the
 * sections are in ./details. The delivery confirmation and the 3-step delete are nested dialogs.
 */
export function TicketDetailsModal({
  isOpen,
  onClose,
  ticketDetails,
  onReprintClick,
  onStatusUpdated
}: TicketDetailsModalProps): React.JSX.Element {
  const { t } = useI18n()
  const state = useTicketDetailsState({ isOpen, ticketDetails, onClose, onStatusUpdated })

  // Feedback banners are shown by the top-most dialog only (and the test ids stay unique)
  const mainOwnsFeedback = !state.isDeliveryDialogOpen && !state.isDeleteDialogOpen && !state.isEditOpen

  return (
    <>
      <Dialog open={isOpen && ticketDetails !== null} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className="flex max-w-2xl flex-col gap-0 overflow-hidden p-0"
          closeTestId="details-close"
          closeLabel={t.ticketDetails.closeButton}
          onOpenAutoFocus={(e) => {
            // Don't land on an action button: a stray Enter/scan must never trigger one.
            e.preventDefault()
            ;(e.currentTarget as HTMLElement).focus()
          }}
        >
          {ticketDetails && (
            <>
              <DetailsHeader ticketDetails={ticketDetails} />

              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                {mainOwnsFeedback && (
                  <FeedbackBanners errorMessage={state.errorMessage} successMessage={state.successMessage} />
                )}
                <OverdueBanner ticketDetails={ticketDetails} />
                <StatusActions ticketDetails={ticketDetails} state={state} />

                <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-5">
                  <InfoSection ticketDetails={ticketDetails} />
                  <RepairFinancialSection ticketDetails={ticketDetails} state={state} />
                  <StatusTimeline ticketDetails={ticketDetails} />
                </motion.div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/40 px-6 py-4">
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" data-testid="details-close-footer" onClick={onClose}>
                    {t.ticketDetails.closeButton}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    data-testid="details-delete"
                    onClick={state.openDeleteDialog}
                    className="border-danger/30 text-danger hover:bg-danger-soft hover:text-danger-soft-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t.deleteTicket.buttonLabel}
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" data-testid="details-edit" onClick={state.openEdit}>
                    <PencilLine className="h-4 w-4" />
                    {t.ui.editTicket.editButton}
                  </Button>
                  <Button type="button" data-testid="details-reprint" onClick={() => onReprintClick(ticketDetails)}>
                    <Printer className="h-4 w-4" />
                    {t.ticketDetails.printLabelButton}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {ticketDetails && isOpen && (
        <>
          <DeliveryDialog ticketDetails={ticketDetails} state={state} />
          <PartsCostDialog ticketDetails={ticketDetails} state={state} />
          <DeleteTicketDialog ticketDetails={ticketDetails} state={state} />
          <EditTicketDialog
            open={state.isEditOpen}
            details={ticketDetails}
            onClose={state.closeEdit}
            onSaved={state.handleEditSaved}
          />
          <ReprintPromptDialog
            open={state.reprintDetails !== null}
            onDismiss={state.dismissReprint}
            onPrint={() => {
              if (state.reprintDetails) onReprintClick(state.reprintDetails)
              state.dismissReprint()
            }}
          />
        </>
      )}
    </>
  )
}
