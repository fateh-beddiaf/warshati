import { generateShortLabel } from '../../../../shared/device-utils'
import type {
  AppMetadata,
  PaymentType,
  TicketEditField,
  TicketFullDetails,
  UpdateTicketPatch
} from '../../../../shared/types'

/** What the edit form holds, already parsed (numbers, ids). */
export interface EditFormValues {
  customerMode: 'edit' | 'reassign'
  customer: { name: string; phone: string; notes: string }
  reassign: { id?: number; name: string; phone: string; notes: string }
  device: { brand: string; brandId: number | null; model: string; modelId: number | null; shortLabel: string }
  accessoryIds: number[]
  categoryId: number
  technicianId: number
  price: number
  amountPaid: number
  /** The type the form shows (a remaining balance already forces 'credit') */
  paymentType: PaymentType
  /** null = not entered */
  partsCost: number | null
}

/** One line of the review: same value format as TicketEditLog, so the history formatter shows it too. */
export interface EditChange {
  field: TicketEditField
  from: string | null
  to: string | null
}

export interface EditPlan {
  /** Only what differs (no confirmations: the dialog adds them once the user agreed) */
  patch: UpdateTicketPatch
  changes: EditChange[]
  /** The profit split of a delivered ticket will be recalculated */
  profitChanged: boolean
  paidLowered: boolean
  /** Parts cost above the price */
  loss: boolean
  /** The Customer record itself is edited (shows on every ticket of that customer) */
  customerEdited: boolean
}

const cleanName = (value: string): string => value.trim().replace(/\s+/g, ' ')
const money = (n: number | null | undefined): string | null => (n === null || n === undefined ? null : String(n))

/**
 * Compares the form with the saved ticket. Mirrors the backend (updateTicket): the backend still validates
 * everything and is the one that decides; this only decides what to send and what to show for review.
 */
export function buildEditPlan(details: TicketFullDetails, form: EditFormValues, metadata: AppMetadata): EditPlan {
  const { ticket, customer, device, accessories } = details
  const patch: UpdateTicketPatch = {}
  const changes: EditChange[] = []
  const add = (field: TicketEditField, from: string | null, to: string | null): void => {
    if (from !== to) changes.push({ field, from, to })
  }

  let customerEdited = false
  if (form.customerMode === 'edit') {
    const name = cleanName(form.customer.name)
    const phone = form.customer.phone.trim()
    const notes = form.customer.notes.trim() || null
    if (name !== customer.name || phone !== customer.phone || notes !== (customer.notes ?? null)) {
      patch.customer = { name, phone, notes: notes ?? '' }
      add('customer_name', customer.name, name)
      add('customer_phone', customer.phone, phone)
      add('customer_notes', customer.notes ?? null, notes)
      customerEdited = true
    }
  } else {
    const name = cleanName(form.reassign.name)
    const phone = form.reassign.phone.trim()
    const sameCustomer = form.reassign.id === customer.id && name === customer.name && phone === customer.phone
    if (!sameCustomer) {
      patch.reassign_customer = {
        ...(form.reassign.id !== undefined ? { id: form.reassign.id } : {}),
        name,
        phone,
        ...(form.reassign.notes.trim() ? { notes: form.reassign.notes.trim() } : {})
      }
      add('customer', `${customer.name} · ${customer.phone}`, `${name} · ${phone}`)
    }
  }

  const brand = form.device.brand.trim()
  const model = form.device.model.trim()
  const label = form.device.shortLabel.trim() || generateShortLabel(brand, model)
  if (
    brand !== device.brand ||
    model !== device.model ||
    label !== device.short_label ||
    form.device.brandId !== (device.brand_id ?? null) ||
    form.device.modelId !== (device.model_id ?? null)
  ) {
    patch.device = {
      brand,
      model,
      ...(form.device.brandId !== null ? { brand_id: form.device.brandId } : {}),
      ...(form.device.modelId !== null ? { model_id: form.device.modelId } : {}),
      short_label: label
    }
    add('brand', device.brand, brand)
    add('model', device.model, model)
    add('short_label', device.short_label, label)
  }

  const currentIds = accessories.map((a) => a.id)
  const wanted = [...new Set(form.accessoryIds)]
  if (wanted.length !== currentIds.length || wanted.some((id) => !currentIds.includes(id))) {
    patch.accessory_ids = wanted
    const names = (ids: number[]): string | null =>
      metadata.accessories
        .filter((a) => ids.includes(a.id))
        .map((a) => a.name)
        .join(', ') || null
    add('accessories', names(currentIds), names(wanted))
  }

  if (form.categoryId !== ticket.repair_category_id) {
    patch.repair_category_id = form.categoryId
    const name = (id: number): string => metadata.repairCategories.find((c) => c.id === id)?.name ?? `#${id}`
    add('repair_category', details.category?.name ?? name(ticket.repair_category_id), name(form.categoryId))
  }
  if (form.technicianId !== ticket.technician_id) {
    patch.technician_id = form.technicianId
    add('technician', ticket.technician, metadata.technicians.find((x) => x.id === form.technicianId)?.name ?? '')
  }

  if (form.price !== ticket.price) {
    patch.price = form.price
    add('price', money(ticket.price), money(form.price))
  }
  if (form.amountPaid !== ticket.amount_paid) {
    patch.amount_paid = form.amountPaid
    add('amount_paid', money(ticket.amount_paid), money(form.amountPaid))
  }
  if (form.paymentType !== ticket.payment_type) {
    patch.payment_type = form.paymentType
    add('payment_type', ticket.payment_type, form.paymentType)
  }
  const currentCost = ticket.parts_cost ?? null
  if (form.partsCost !== currentCost) {
    patch.parts_cost = form.partsCost
    add('parts_cost', money(currentCost), money(form.partsCost))
  }

  const profitFields: TicketEditField[] = ['price', 'parts_cost', 'technician', 'repair_category']
  return {
    patch,
    changes,
    profitChanged: ticket.status === 'delivered' && changes.some((c) => profitFields.includes(c.field)),
    paidLowered: form.amountPaid < ticket.amount_paid,
    loss: form.partsCost !== null && form.partsCost > form.price,
    customerEdited
  }
}

/** Fields printed on the label: a change offers to reprint it (the barcode itself never changes). */
export const PRINTED_FIELDS: readonly TicketEditField[] = ['customer', 'customer_name', 'customer_phone', 'short_label']
