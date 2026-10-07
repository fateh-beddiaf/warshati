import * as React from 'react'
import { useState, useEffect } from 'react'
import { useI18n } from '../../lib/i18n'
import { generateShortLabel } from '../../../shared/device-utils'
import { isCostLoss, parseCostInput } from '../../../shared/parts-cost'
import { paymentTypeFor } from '../../../shared/payment'
import type { AppMetadata, CreateTicketDTO, PaymentType } from '../../../shared/types'
import { useCustomerFields } from './useCustomerFields'
import { useDeviceFields } from './useDeviceFields'

export interface TicketPrintData {
  barcode: string
  customerName: string
  customerPhone?: string
  shortLabel: string
  ticketId: number
}

/** State, validation and submit logic of the New Ticket screen (UI-free). */
export function useNewTicketForm() {
  const { t } = useI18n()
  const [metadata, setMetadata] = useState<AppMetadata | null>(null)

  const [loading, setLoading] = useState(false)
  const [successInfo, setSuccessInfo] = useState<{ barcode: string; ticketId: number; withoutCost: boolean } | null>(
    null
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // After a failed submit the missing required fields are highlighted
  const [showErrors, setShowErrors] = useState(false)

  // Form State
  const customer = useCustomerFields()
  const device = useDeviceFields(metadata)
  const { customerId, customerName, customerPhone, customerNotes } = customer
  const { brand, brandId, model, modelId, shortLabel } = device

  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [price, setPrice] = useState<string>('')
  const [amountPaid, setAmountPaid] = useState<string>('')
  const [technicianId, setTechnicianId] = useState<number | null>(null)
  const [selectedAccessoryIds, setSelectedAccessoryIds] = useState<number[]>([])
  // Parts cost: text as typed (masked in the UI). Only meaningful when the category requires one.
  const [partsCost, setPartsCost] = useState<string>('')
  const [confirmLossOpen, setConfirmLossOpen] = useState(false)

  // Load initial metadata and customers list
  useEffect(() => {
    async function loadData(): Promise<void> {
      try {
        const metaRes = await window.api.getMetadata()
        if (metaRes.success && metaRes.data) {
          setMetadata(metaRes.data)
          if (metaRes.data.repairCategories.length > 0) {
            setCategoryId(metaRes.data.repairCategories[0].id)
          }
          if (metaRes.data.technicians.length > 0) {
            setTechnicianId(metaRes.data.technicians[0].id)
          }
        }
      } catch (err) {
        console.error('Failed to load initial data:', err)
      }
    }
    loadData()
  }, [])

  // Does the chosen category require a parts cost? (the field is shown only then)
  const requiresPartsCost = Boolean(metadata?.repairCategories.find((c) => c.id === categoryId)?.requires_parts_cost)
  const parsedCost = requiresPartsCost ? parseCostInput(partsCost) : ({ kind: 'empty' } as const)
  const costInvalid = parsedCost.kind === 'invalid'

  // Compute remaining amount
  const numPrice = Number(price) || 0
  const numPaid = Number(amountPaid) || 0
  const calculatedRemaining = Math.max(0, numPrice - numPaid)
  // Shown, not chosen: the backend derives the same type from the remaining amount
  const effectivePaymentType: PaymentType = paymentTypeFor(calculatedRemaining)

  const toggleAccessory = (id: number): void => {
    setSelectedAccessoryIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const resetForm = (): void => {
    customer.resetCustomer()
    device.resetDevice()
    setPrice('')
    setAmountPaid('')
    setSelectedAccessoryIds([])
    setPartsCost('')
    setConfirmLossOpen(false)
    setSuccessInfo(null)
    setErrorMessage(null)
    setShowErrors(false)
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setErrorMessage(null)

    // Validation
    if (
      !customerName.trim() ||
      !customerPhone.trim() ||
      !brand.trim() ||
      !model.trim() ||
      !categoryId ||
      !technicianId
    ) {
      setShowErrors(true)
      setErrorMessage(t.newTicket.requiredFieldsError)
      return
    }
    if (costInvalid) {
      setShowErrors(true)
      setErrorMessage(t.ui.partsCost.field.invalid)
      return
    }
    setShowErrors(false)

    // A cost above the price is a loss: allowed, but only after an explicit confirmation
    if (parsedCost.kind === 'ok' && isCostLoss(parsedCost.value, numPrice)) {
      setConfirmLossOpen(true)
      return
    }
    await submitTicket()
  }

  /** Builds the DTO and saves. Validation (and the loss confirmation) happened before. */
  const submitTicket = async (): Promise<void> => {
    if (!categoryId || !technicianId) return
    setConfirmLossOpen(false)
    setLoading(true)

    const dto: CreateTicketDTO = {
      customer: {
        id: customerId,
        name: customerName.trim(),
        phone: customerPhone.trim(),
        notes: customerNotes.trim() || undefined
      },
      device: {
        brand: brand.trim(),
        model: model.trim(),
        brand_id: brandId ?? undefined,
        model_id: modelId ?? undefined,
        short_label: shortLabel.trim() || undefined
      },
      ticket: {
        repair_category_id: Number(categoryId),
        price: numPrice,
        amount_paid: numPaid,
        technician_id: technicianId,
        // empty = not entered yet (NULL), never 0: the ticket stays flagged until the cost is added
        parts_cost: parsedCost.kind === 'ok' ? parsedCost.value : null
      },
      accessory_ids: selectedAccessoryIds
    }

    try {
      const res = await window.api.createTicket(dto)
      if (res.success && res.data) {
        setSuccessInfo({
          barcode: res.data.barcode,
          ticketId: res.data.ticketId,
          withoutCost: requiresPartsCost && parsedCost.kind === 'empty'
        })
      } else {
        setErrorMessage(res.error || t.newTicket.errorTitle)
      }
    } catch (err) {
      console.error('Error creating ticket:', err)
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const printData: TicketPrintData | null = successInfo
    ? {
        barcode: successInfo.barcode,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        shortLabel: shortLabel.trim() || generateShortLabel(brand, model),
        ticketId: successInfo.ticketId
      }
    : null

  return {
    metadata,
    loading,
    successInfo,
    errorMessage,
    showErrors,
    printData,
    // customer
    ...customer,
    // device
    ...device,
    selectedAccessoryIds,
    toggleAccessory,
    // repair & payment
    categoryId,
    setCategoryId,
    technicianId,
    setTechnicianId,
    price,
    setPrice,
    amountPaid,
    setAmountPaid,
    numPrice,
    numPaid,
    calculatedRemaining,
    effectivePaymentType,
    // parts cost (the field is shown only for a category that requires one)
    requiresPartsCost,
    showPartsCost: requiresPartsCost,
    partsCost,
    setPartsCost,
    costInvalid,
    confirmLossOpen,
    setConfirmLossOpen,
    // actions
    handleSubmit,
    submitTicket,
    resetForm
  }
}

export type NewTicketForm = ReturnType<typeof useNewTicketForm>
