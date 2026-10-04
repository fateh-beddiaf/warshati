import { useState, useEffect, useRef, useMemo } from 'react'
import { useI18n } from '../../../lib/i18n'
import { formatCurrency } from '../../../lib/utils'
import type { TicketFullDetails, TicketStatus, PaymentType, UpdateTicketStatusDTO } from '../../../../shared/types'
import { resolveProfitSplit } from './profitSplit'
import { usePartsCostEditor } from './usePartsCostEditor'

export type SettlementType = 'full' | 'credit' | 'partial'
export type DeleteStep = 1 | 2 | 3

interface Options {
  isOpen: boolean
  ticketDetails: TicketFullDetails | null
  onClose: () => void
  onStatusUpdated?: () => void
}

/**
 * All stateful logic of the ticket details modal (status changes, delivery settlement, debt
 * payments, 3-step delete). Moved verbatim from the former single-file modal; the components
 * that render it are purely presentational.
 */
export function useTicketDetailsState({ isOpen, ticketDetails, onClose, onStatusUpdated }: Options) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Delivery / Settlement Dialog State
  const [isDeliveryDialogOpen, setIsDeliveryDialogOpen] = useState(false)
  const [settlementType, setSettlementType] = useState<SettlementType>('full')
  const [customAdditionalPaid, setCustomAdditionalPaid] = useState<string>('')

  // 3-Step Delete Ticket Dialog State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteStep, setDeleteStep] = useState<DeleteStep>(1)
  const [confirmBarcode, setConfirmBarcode] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Debt payment (delivered tickets with a remaining balance)
  const [recordAmount, setRecordAmount] = useState('')
  const [recordingPayment, setRecordingPayment] = useState(false)

  // The modal stays mounted while closed, so every piece of internal state is reset whenever it
  // closes/opens or a different ticket is displayed. `sessionRef` also lets in-flight async
  // handlers notice they belong to a previous ticket and skip touching the new one's state.
  const displayedTicketId = ticketDetails?.ticket.id ?? null
  const sessionRef = useRef(0)
  useEffect(() => {
    sessionRef.current += 1
    setLoading(false)
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsDeliveryDialogOpen(false)
    setSettlementType('full')
    setCustomAdditionalPaid('')
    setIsDeleteDialogOpen(false)
    setDeleteStep(1)
    setConfirmBarcode('')
    setDeleting(false)
    setRecordAmount('')
    setRecordingPayment(false)
  }, [isOpen, displayedTicketId])

  const openDeleteDialog = (): void => {
    setDeleteStep(1)
    setConfirmBarcode('')
    setErrorMessage(null)
    setIsDeleteDialogOpen(true)
  }

  // Opening/closing the nested dialogs clears the feedback banners so a stale message never
  // reappears behind or after them.
  const openDeliveryDialog = (): void => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsDeliveryDialogOpen(true)
  }
  const closeDeliveryDialog = (): void => {
    setErrorMessage(null)
    setIsDeliveryDialogOpen(false)
  }
  const closeDeleteDialog = (): void => {
    setErrorMessage(null)
    setIsDeleteDialogOpen(false)
  }

  const handleDeleteTicket = async (): Promise<void> => {
    if (!ticketDetails) return
    const session = sessionRef.current
    const isCurrent = (): boolean => sessionRef.current === session
    setDeleting(true)
    setErrorMessage(null)
    try {
      const res = await window.api.deleteTicket(ticketDetails.ticket.id)
      if (res.success) {
        if (isCurrent()) {
          setIsDeleteDialogOpen(false)
          onClose()
        }
        onStatusUpdated?.()
      } else if (isCurrent()) {
        setErrorMessage(res.error || t.deleteTicket.deleteError)
      }
    } catch (err) {
      if (isCurrent()) setErrorMessage(err instanceof Error ? err.message : t.deleteTicket.deleteError)
    } finally {
      if (isCurrent()) setDeleting(false)
    }
  }

  // Calculate live or stored profit split (on the net profit)
  const profitSplit = useMemo(() => resolveProfitSplit(ticketDetails), [ticketDetails])

  // Parts cost add / edit / clear (any status)
  const partsCost = usePartsCostEditor({ isOpen, ticketDetails, onSaved: onStatusUpdated })

  const handleUpdateStatus = async (
    newStatus: TicketStatus,
    paymentUpdate?: { amount_paid?: number; payment_type?: PaymentType }
  ): Promise<void> => {
    if (!ticketDetails) return
    const { ticket } = ticketDetails
    const session = sessionRef.current
    const isCurrent = (): boolean => sessionRef.current === session
    setLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const dto: UpdateTicketStatusDTO = {
        ticketId: ticket.id,
        newStatus,
        paymentUpdate
      }

      const res = await window.api.updateTicketStatus(dto)
      if (res.success) {
        if (isCurrent()) {
          setSuccessMessage(t.lifecycle.statusUpdateSuccess)
          setIsDeliveryDialogOpen(false)
        }
        if (onStatusUpdated) {
          onStatusUpdated()
        }
      } else if (isCurrent()) {
        setErrorMessage(res.error || t.ui.details.updateStatusFailed)
      }
    } catch (err) {
      console.error('Failed to update status:', err)
      if (isCurrent()) setErrorMessage(err instanceof Error ? err.message : t.ui.details.updateStatusError)
    } finally {
      if (isCurrent()) setLoading(false)
    }
  }

  const handleRecordPayment = async (): Promise<void> => {
    if (!ticketDetails) return
    const { ticket } = ticketDetails
    const raw = recordAmount.trim()
    const amount = Number(raw)
    setSuccessMessage(null)
    if (raw === '' || !Number.isFinite(amount) || amount <= 0) {
      setErrorMessage(t.lifecycle.recordPaymentInvalid)
      return
    }
    if (amount > ticket.amount_remaining) {
      setErrorMessage(t.lifecycle.recordPaymentTooMuch.replace('{remaining}', formatCurrency(ticket.amount_remaining)))
      return
    }

    const session = sessionRef.current
    const isCurrent = (): boolean => sessionRef.current === session
    setRecordingPayment(true)
    setErrorMessage(null)
    try {
      const res = await window.api.recordPayment(ticket.id, amount)
      if (res.success) {
        if (isCurrent()) {
          setRecordAmount('')
          setSuccessMessage(t.lifecycle.recordPaymentSuccess)
        }
        // reloads the displayed ticket and the list (same flow as a status update)
        if (onStatusUpdated) onStatusUpdated()
      } else if (isCurrent()) {
        setErrorMessage(res.error || t.lifecycle.recordPaymentFailed)
      }
    } catch (err) {
      console.error('Failed to record payment:', err)
      if (isCurrent()) setErrorMessage(err instanceof Error ? err.message : t.lifecycle.recordPaymentFailed)
    } finally {
      if (isCurrent()) setRecordingPayment(false)
    }
  }

  const handleConfirmDelivery = async (): Promise<void> => {
    if (!ticketDetails) return
    const { ticket } = ticketDetails
    let paymentUpdate: { amount_paid?: number; payment_type?: PaymentType } | undefined = undefined

    if (ticket.amount_remaining > 0) {
      if (settlementType === 'full') {
        paymentUpdate = {
          amount_paid: ticket.price,
          payment_type: 'cash'
        }
      } else if (settlementType === 'credit') {
        paymentUpdate = {
          amount_paid: ticket.amount_paid,
          payment_type: 'credit'
        }
      } else if (settlementType === 'partial') {
        // Empty means "nothing extra"; anything non-numeric or negative is rejected so the paid
        // amount can never drop below what was already paid.
        const raw = customAdditionalPaid.trim()
        const additional = raw === '' ? 0 : Number(raw)
        if (!Number.isFinite(additional) || additional < 0) {
          setSuccessMessage(null)
          setErrorMessage(t.lifecycle.invalidAdditionalAmount)
          return
        }
        const newTotalPaid = Math.max(ticket.amount_paid, Math.min(ticket.price, ticket.amount_paid + additional))
        paymentUpdate = {
          amount_paid: newTotalPaid,
          payment_type: newTotalPaid >= ticket.price ? 'cash' : 'credit'
        }
      }
    }

    await handleUpdateStatus('delivered', paymentUpdate)
  }

  return {
    loading,
    errorMessage,
    successMessage,
    profitSplit,
    partsCost,
    // delivery
    isDeliveryDialogOpen,
    openDeliveryDialog,
    closeDeliveryDialog,
    settlementType,
    setSettlementType,
    customAdditionalPaid,
    setCustomAdditionalPaid,
    handleConfirmDelivery,
    handleUpdateStatus,
    // debt payment
    recordAmount,
    setRecordAmount,
    recordingPayment,
    handleRecordPayment,
    // delete
    isDeleteDialogOpen,
    openDeleteDialog,
    closeDeleteDialog,
    deleteStep,
    setDeleteStep,
    confirmBarcode,
    setConfirmBarcode,
    deleting,
    handleDeleteTicket
  }
}

export type TicketDetailsState = ReturnType<typeof useTicketDetailsState>
