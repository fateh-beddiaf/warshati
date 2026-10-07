import * as React from 'react'
import { useState } from 'react'
import { useI18n } from '../../../lib/i18n'
import { formatCurrency } from '../../../lib/utils'
import { parseCostInput } from '../../../../shared/parts-cost'
import type { AppMetadata, PaymentType, TicketFullDetails, UpdateTicketResult } from '../../../../shared/types'
import { useCustomerFields } from '../../../screens/new-ticket/useCustomerFields'
import { useDeviceFields } from '../../../screens/new-ticket/useDeviceFields'
import { buildEditPlan, type EditPlan } from './editPatch'

/** A typed amount: '' counts as 0 (as on the New Ticket screen); anything else must be a number >= 0. */
function parseAmount(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed === '') return 0
  const n = Number(trimmed)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * State and save flow of the edit form. It starts from the saved ticket (the form is mounted fresh each time the
 * dialog opens) and reuses the New Ticket hooks and sections. Saving sends only what differs; a delivered ticket,
 * a lowered amount paid or a loss first go through a review of the changes. The backend validates everything again.
 */
export function useTicketEditForm(
  details: TicketFullDetails,
  metadata: AppMetadata,
  onSaved: (result: UpdateTicketResult) => void
) {
  const { t } = useI18n()
  const text = t.ui.editTicket
  const { ticket, customer, device: savedDevice } = details

  // Customer: edit the record itself, or attach the ticket to another / a new customer
  const [customerMode, setCustomerMode] = useState<'edit' | 'reassign'>('edit')
  const [customerName, setCustomerName] = useState(customer.name)
  const [customerPhone, setCustomerPhone] = useState(customer.phone)
  const [customerNotes, setCustomerNotes] = useState(customer.notes ?? '')
  const reassign = useCustomerFields()

  const device = useDeviceFields(metadata, {
    brand: savedDevice.brand,
    brandId: savedDevice.brand_id ?? null,
    model: savedDevice.model,
    modelId: savedDevice.model_id ?? null,
    shortLabel: savedDevice.short_label
  })
  const [selectedAccessoryIds, setSelectedAccessoryIds] = useState<number[]>(details.accessories.map((a) => a.id))
  const [categoryId, setCategoryId] = useState<number | ''>(ticket.repair_category_id)
  const [technicianId, setTechnicianId] = useState<number | null>(ticket.technician_id)
  const [price, setPrice] = useState(String(ticket.price))
  const [amountPaid, setAmountPaid] = useState(String(ticket.amount_paid))
  const [paymentType, setPaymentType] = useState<PaymentType>(ticket.payment_type)
  const [partsCost, setPartsCost] = useState(
    ticket.parts_cost === null || ticket.parts_cost === undefined ? '' : String(ticket.parts_cost)
  )

  const [showErrors, setShowErrors] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [review, setReview] = useState<EditPlan | null>(null)
  const [saving, setSaving] = useState(false)

  const parsedPrice = parseAmount(price)
  const parsedPaid = parseAmount(amountPaid)
  const numPrice = parsedPrice ?? 0
  const numPaid = parsedPaid ?? 0
  const calculatedRemaining = Math.max(0, numPrice - numPaid)
  // A partial payment is always a debt (the backend enforces the same rule)
  const effectivePaymentType: PaymentType = calculatedRemaining > 0 ? 'credit' : paymentType
  const parsedCost = parseCostInput(partsCost)
  const costInvalid = parsedCost.kind === 'invalid'

  const toggleAccessory = (id: number): void => {
    setSelectedAccessoryIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const startReassign = (): void => {
    setCustomerMode('reassign')
    setErrorMessage(null)
  }
  const cancelReassign = (): void => {
    setCustomerMode('edit')
    reassign.resetCustomer()
    setErrorMessage(null)
  }

  const persist = async (plan: EditPlan): Promise<void> => {
    setSaving(true)
    setErrorMessage(null)
    try {
      const res = await window.api.updateTicket(ticket.id, {
        ...plan.patch,
        ...(ticket.status === 'delivered' ? { confirm_delivered: true } : {}),
        ...(plan.paidLowered ? { confirm_paid_lowered: true } : {})
      })
      if (res.success && res.data) {
        setReview(null)
        onSaved(res.data)
      } else {
        setReview(null)
        setErrorMessage(res.error || text.saveFailed)
      }
    } catch (err) {
      console.error('Failed to update the ticket:', err)
      setReview(null)
      setErrorMessage(err instanceof Error ? err.message : text.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setErrorMessage(null)
    const name = customerMode === 'edit' ? customerName : reassign.customerName
    const phone = customerMode === 'edit' ? customerPhone : reassign.customerPhone
    if (!name.trim() || !phone.trim() || !device.brand.trim() || !device.model.trim() || !categoryId || !technicianId) {
      setShowErrors(true)
      setErrorMessage(t.newTicket.requiredFieldsError)
      return
    }
    if (parsedPrice === null || parsedPaid === null) {
      setShowErrors(true)
      setErrorMessage(text.invalidAmount)
      return
    }
    if (costInvalid) {
      setShowErrors(true)
      setErrorMessage(t.ui.partsCost.field.invalid)
      return
    }
    if (parsedPaid > parsedPrice) {
      setErrorMessage(
        parsedPaid === ticket.amount_paid
          ? text.priceBelowPaid
              .replace('{price}', formatCurrency(parsedPrice))
              .replace('{paid}', formatCurrency(parsedPaid))
          : text.paidAbovePrice
      )
      return
    }
    setShowErrors(false)

    const plan = buildEditPlan(
      details,
      {
        customerMode,
        customer: { name: customerName, phone: customerPhone, notes: customerNotes },
        reassign: {
          id: reassign.customerId,
          name: reassign.customerName,
          phone: reassign.customerPhone,
          notes: reassign.customerNotes
        },
        device: {
          brand: device.brand,
          brandId: device.brandId,
          model: device.model,
          modelId: device.modelId,
          shortLabel: device.shortLabel
        },
        accessoryIds: selectedAccessoryIds,
        categoryId: Number(categoryId),
        technicianId,
        price: parsedPrice,
        amountPaid: parsedPaid,
        paymentType: effectivePaymentType,
        partsCost: parsedCost.kind === 'ok' ? parsedCost.value : null
      },
      metadata
    )
    if (Object.keys(plan.patch).length === 0) {
      setErrorMessage(text.noChanges)
      return
    }
    // A delivered ticket shows the changes before saving; a lowered payment or a loss needs an explicit yes
    if (ticket.status === 'delivered' || plan.paidLowered || plan.loss) {
      setReview(plan)
      return
    }
    await persist(plan)
  }

  return {
    metadata,
    showErrors,
    errorMessage,
    saving,
    review,
    closeReview: () => setReview(null),
    confirmReview: () => (review ? persist(review) : Promise.resolve()),
    handleSubmit,
    // customer
    customerMode,
    startReassign,
    cancelReassign,
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    customerNotes,
    setCustomerNotes,
    reassign: { ...reassign, showErrors },
    // device + accessories (DeviceSection)
    ...device,
    selectedAccessoryIds,
    toggleAccessory,
    // repair (RepairSection): the masked cost is always offered here
    categoryId,
    setCategoryId,
    technicianId,
    setTechnicianId,
    showPartsCost: true,
    partsCost,
    setPartsCost,
    costInvalid,
    // payment (PaymentSection)
    price,
    setPrice,
    amountPaid,
    setAmountPaid,
    setPaymentType,
    numPrice,
    numPaid,
    calculatedRemaining,
    effectivePaymentType
  }
}

export type TicketEditForm = ReturnType<typeof useTicketEditForm>
