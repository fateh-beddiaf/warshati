import type Database from 'better-sqlite3'
import type {
  Customer,
  PaymentType,
  Ticket,
  TicketDevice,
  TicketEditField,
  UpdateTicketPatch,
  UpdateTicketResult
} from '../../shared/types'
import { calculateProfitSplit, roundMoney } from '../../shared/profit'
import { generateShortLabel } from '../../shared/device-utils'
import { calculateRemaining } from '../helpers'
import { findOrCreateCustomer, normalizeName, normalizePhone } from './customers'
import { getTicketById, normalizePartsCost, resolveDevice } from './tickets'
import { insertEditLogs, moneyLogValue, type EditLogChange } from './ticket-edit-log'

/*
 * Editing a ticket after creation (updateTicket).
 *
 * Editable: the customer (name, phone, notes: the Customer RECORD, so every ticket of that customer shows the change),
 * or attaching the ticket to another / a new customer; the device (brand, model, short label); accessories; repair
 * category; technician; price; amount paid and payment type; parts cost.
 * Never editable: barcode_code, created_at, status (it has its own flow) and StatusLog. Any other key is rejected.
 *
 * One transaction: everything is validated first, then applied, then one TicketEditLog row is written per changed
 * field (all with the same timestamp). Any error rolls the whole edit back.
 *
 * Payments (same rules as creation): price >= amount_paid, amount_remaining = price - paid, a remaining balance makes
 * the payment type 'credit'. Lowering amount_paid creates or increases a debt: it needs confirm_paid_lowered.
 *
 * Profit (AGENTS.md section 4), always through the pure calculateProfitSplit:
 *  - a ticket that is not delivered is just saved: its shares are computed at delivery, as before;
 *  - a delivered ticket needs confirm_delivered; when its price, parts cost, technician or category changes, the
 *    frozen shares are recomputed:
 *      price / cost      -> with the frozen split_percentage_applied (as setPartsCost does);
 *      technician        -> a partner takes 100% of the net (frozen percentage cleared); a non-partner uses the
 *                           frozen percentage or, when there is none, the category's current one (then frozen);
 *      category          -> the percentage is re-frozen from the NEW category's current percentage.
 *  - changing the category also re-snapshots parts_cost_required from the new category (any status): the snapshot
 *    describes the category the ticket is in.
 */

const PATCH_KEYS: ReadonlySet<string> = new Set([
  'customer',
  'reassign_customer',
  'device',
  'accessory_ids',
  'repair_category_id',
  'technician_id',
  'price',
  'amount_paid',
  'payment_type',
  'parts_cost',
  'confirm_delivered',
  'confirm_paid_lowered'
])
const CUSTOMER_KEYS: ReadonlySet<string> = new Set(['name', 'phone', 'notes'])
const REASSIGN_KEYS: ReadonlySet<string> = new Set(['id', 'name', 'phone', 'notes'])
const DEVICE_KEYS: ReadonlySet<string> = new Set(['brand', 'model', 'brand_id', 'model_id', 'short_label'])

function rejectUnknownKeys(value: object, allowed: ReadonlySet<string>, prefix = ''): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`الحقل "${prefix}${key}" غير قابل للتعديل.`)
  }
}

/** Customer names are stored trimmed with single inner spaces (same as findOrCreateCustomer). */
const cleanName = (value: string): string => value.trim().replace(/\s+/g, ' ')
const customerLabel = (c: { name: string; phone: string }): string => `${c.name} · ${c.phone}`

function requireAmount(value: unknown, message: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(message)
  return value
}

type TicketRow = Omit<Ticket, 'technician_is_partner'> & { technician_is_partner: number }

interface CategoryRow {
  id: number
  name: string
  default_split_percentage: number
  requires_parts_cost: number
}

export function updateTicket(db: Database.Database, ticketId: number, patch: UpdateTicketPatch): UpdateTicketResult {
  const transaction = db.transaction((): UpdateTicketResult => {
    // ---------------------------------------------------------------- 1. validate (no writes)
    if (typeof patch !== 'object' || patch === null || Array.isArray(patch))
      throw new Error('بيانات التعديل غير صالحة.')
    rejectUnknownKeys(patch, PATCH_KEYS)
    if (patch.customer) rejectUnknownKeys(patch.customer, CUSTOMER_KEYS, 'customer.')
    if (patch.reassign_customer) rejectUnknownKeys(patch.reassign_customer, REASSIGN_KEYS, 'reassign_customer.')
    if (patch.device) rejectUnknownKeys(patch.device, DEVICE_KEYS, 'device.')
    if (patch.customer && patch.reassign_customer) {
      throw new Error('اختر إما تعديل بيانات الزبون أو ربط التذكرة بزبون آخر، لا الاثنين معاً.')
    }

    const ticket = db
      .prepare(
        `SELECT t.*, tech.is_partner AS technician_is_partner
         FROM Ticket t JOIN Technician tech ON tech.id = t.technician_id WHERE t.id = ?`
      )
      .get(ticketId) as TicketRow | undefined
    if (!ticket) throw new Error(`التذكرة رقم ${ticketId} غير موجودة في النظام.`)
    const customer = db.prepare(`SELECT * FROM Customer WHERE id = ?`).get(ticket.customer_id) as Customer
    const device = db.prepare(`SELECT * FROM TicketDevice WHERE ticket_id = ?`).get(ticketId) as
      TicketDevice | undefined
    if (!device) throw new Error('بيانات جهاز التذكرة ناقصة، لا يمكن تعديلها.')

    const delivered = ticket.status === 'delivered'
    const changes: EditLogChange[] = []
    const change = (field: TicketEditField, oldValue: string | null, newValue: string | null): void => {
      if (oldValue !== newValue) changes.push({ field, old_value: oldValue, new_value: newValue })
    }

    // Customer record (name / phone / notes)
    let customerEdit: { name: string; phone: string; notes: string | null } | null = null
    if (patch.customer) {
      const name = cleanName(String(patch.customer.name ?? ''))
      const phone = String(patch.customer.phone ?? '').trim()
      if (!name || !phone) throw new Error('اسم الزبون ورقم هاتفه مطلوبان.')
      const notes =
        patch.customer.notes === undefined ? (customer.notes ?? null) : String(patch.customer.notes).trim() || null
      const sameIdentity =
        normalizeName(name) === normalizeName(customer.name) && normalizePhone(phone) === normalizePhone(customer.phone)
      if (!sameIdentity) {
        // Two records for one person would split their history: point the ticket at that customer instead.
        const twins = db
          .prepare(`SELECT id, name FROM Customer WHERE id != ? AND replace(replace(phone, ' ', ''), char(9), '') = ?`)
          .all(customer.id, normalizePhone(phone)) as { id: number; name: string }[]
        if (twins.some((c) => normalizeName(c.name) === normalizeName(name))) {
          throw new Error(
            'يوجد زبون آخر مسجَّل بنفس الاسم ورقم الهاتف. إن كانت التذكرة له فاستعمل "ربط التذكرة بزبون آخر" بدل تعديل هذا الزبون.'
          )
        }
      }
      change('customer_name', customer.name, name)
      change('customer_phone', customer.phone, phone)
      change('customer_notes', customer.notes ?? null, notes)
      customerEdit = { name, phone, notes }
    }

    // Attach to another customer: only the shape is checked here, the match happens when applying
    if (patch.reassign_customer) {
      const name = cleanName(String(patch.reassign_customer.name ?? ''))
      const phone = String(patch.reassign_customer.phone ?? '').trim()
      if (!name || !phone) throw new Error('اسم الزبون ورقم هاتفه مطلوبان.')
    }

    // Device
    let deviceEdit: {
      brand: string
      model: string
      brandId: number | null
      modelId: number | null
      label: string
    } | null = null
    if (patch.device) {
      const resolved = resolveDevice(db, patch.device)
      const label = String(patch.device.short_label ?? '').trim() || generateShortLabel(resolved.brand, resolved.model)
      change('brand', device.brand, resolved.brand)
      change('model', device.model, resolved.model)
      change('short_label', device.short_label, label)
      const idsChanged =
        resolved.brandId !== (device.brand_id ?? null) || resolved.modelId !== (device.model_id ?? null)
      if (
        idsChanged ||
        resolved.brand !== device.brand ||
        resolved.model !== device.model ||
        label !== device.short_label
      )
        deviceEdit = { ...resolved, label }
    }

    // Accessories (compared as sets; logged as names in the Settings order)
    let accessoryIds: number[] | null = null
    if (patch.accessory_ids) {
      const wanted = [...new Set(patch.accessory_ids)]
      const known = db.prepare(`SELECT id, name FROM Accessories ORDER BY id`).all() as { id: number; name: string }[]
      const missing = wanted.filter((id) => !known.some((a) => a.id === id))
      if (missing.length > 0) throw new Error('أحد الملحقات المختارة غير موجود. حدّث النموذج ثم أعد المحاولة.')
      const current = (
        db.prepare(`SELECT accessory_id FROM TicketAccessories WHERE ticket_id = ?`).all(ticketId) as {
          accessory_id: number
        }[]
      ).map((r) => r.accessory_id)
      const names = (ids: number[]): string | null =>
        known
          .filter((a) => ids.includes(a.id))
          .map((a) => a.name)
          .join(', ') || null
      const sameSet = wanted.length === current.length && wanted.every((id) => current.includes(id))
      if (!sameSet) {
        change('accessories', names(current), names(wanted))
        accessoryIds = wanted
      }
    }

    // Repair category
    const getCategory = db.prepare(
      `SELECT id, name, default_split_percentage, requires_parts_cost FROM RepairCategory WHERE id = ?`
    )
    const oldCategory = getCategory.get(ticket.repair_category_id) as CategoryRow | undefined
    let category = oldCategory
    const categoryChanged =
      patch.repair_category_id !== undefined && patch.repair_category_id !== ticket.repair_category_id
    if (categoryChanged) {
      category = getCategory.get(patch.repair_category_id) as CategoryRow | undefined
      if (!category) throw new Error('التصنيف المختار غير موجود. حدّث النموذج ثم أعد المحاولة.')
      change('repair_category', oldCategory?.name ?? `#${ticket.repair_category_id}`, category.name)
    }

    // Technician (the ticket keeps a snapshot of the name next to the id)
    let technician = { id: ticket.technician_id, name: ticket.technician, is_partner: ticket.technician_is_partner }
    const technicianChanged = patch.technician_id !== undefined && patch.technician_id !== ticket.technician_id
    if (technicianChanged) {
      const row = db.prepare(`SELECT id, name, is_partner FROM Technician WHERE id = ?`).get(patch.technician_id) as
        typeof technician | undefined
      if (!row) throw new Error('الفني المختار غير موجود. حدّث النموذج ثم أعد المحاولة.')
      technician = row
      change('technician', ticket.technician, row.name)
    }

    // Money
    const price =
      patch.price === undefined
        ? ticket.price
        : requireAmount(patch.price, 'سعر الإصلاح يجب أن يكون رقماً صالحاً أكبر من أو يساوي صفر.')
    const amountPaid =
      patch.amount_paid === undefined
        ? ticket.amount_paid
        : requireAmount(patch.amount_paid, 'المبلغ المدفوع يجب أن يكون رقماً صالحاً أكبر من أو يساوي صفر.')
    if (roundMoney(amountPaid) > roundMoney(price)) {
      throw new Error(
        patch.amount_paid === undefined || amountPaid === ticket.amount_paid
          ? `السعر لا يمكن أن يقل عن المبلغ المدفوع (${amountPaid}). خفّض المبلغ المدفوع أولاً إن كان خاطئاً.`
          : 'المبلغ المدفوع لا يمكن أن يتجاوز سعر الإصلاح.'
      )
    }
    if (amountPaid < ticket.amount_paid && patch.confirm_paid_lowered !== true) {
      throw new Error('خفض المبلغ المدفوع يُنشئ ديناً على الزبون أو يزيده، ويحتاج تأكيداً صريحاً.')
    }
    if (patch.payment_type !== undefined && patch.payment_type !== 'cash' && patch.payment_type !== 'credit') {
      throw new Error('نوع الدفع غير صالح.')
    }
    const moneyTouched =
      patch.price !== undefined || patch.amount_paid !== undefined || patch.payment_type !== undefined
    const amountRemaining = moneyTouched ? calculateRemaining(price, amountPaid) : ticket.amount_remaining
    // A remaining balance is always a debt (same rule as creation)
    const paymentType: PaymentType = !moneyTouched
      ? ticket.payment_type
      : amountRemaining > 0
        ? 'credit'
        : (patch.payment_type ?? ticket.payment_type)
    change('price', moneyLogValue(ticket.price), moneyLogValue(price))
    change('amount_paid', moneyLogValue(ticket.amount_paid), moneyLogValue(amountPaid))
    change('payment_type', ticket.payment_type, paymentType)

    // Parts cost (null = not entered)
    const partsCost =
      patch.parts_cost === undefined ? (ticket.parts_cost ?? null) : normalizePartsCost(patch.parts_cost)
    change('parts_cost', moneyLogValue(ticket.parts_cost ?? null), moneyLogValue(partsCost))

    const touchesSomething = Object.keys(patch).some((key) => !key.startsWith('confirm_'))
    if (delivered && touchesSomething && patch.confirm_delivered !== true) {
      throw new Error('هذه التذكرة مسلَّمة: تعديلها يعيد حساب توزيع أرباحها، ويحتاج تأكيداً صريحاً.')
    }

    // ---------------------------------------------------------------- 2. apply
    let customerId = ticket.customer_id
    if (patch.reassign_customer) {
      // New Ticket matching rules: never renames an existing customer; no exact match = a new customer
      customerId = findOrCreateCustomer(db, patch.reassign_customer)
      if (customerId !== ticket.customer_id) {
        const target = db.prepare(`SELECT name, phone FROM Customer WHERE id = ?`).get(customerId) as Customer
        change('customer', customerLabel(customer), customerLabel(target))
      }
    }

    // Nothing differs: nothing is written (no empty edit in the history)
    if (changes.length === 0 && !deviceEdit) {
      const unchanged = getTicketById(db, ticketId)
      if (!unchanged) throw new Error(`التذكرة رقم ${ticketId} غير موجودة في النظام.`)
      return { details: unchanged, changedFields: [] }
    }

    if (customerEdit && changes.some((c) => c.field.startsWith('customer_'))) {
      db.prepare(`UPDATE Customer SET name = ?, phone = ?, notes = ? WHERE id = ?`).run(
        customerEdit.name,
        customerEdit.phone,
        customerEdit.notes,
        customer.id
      )
    }

    if (deviceEdit) {
      db.prepare(
        `UPDATE TicketDevice SET brand = ?, model = ?, brand_id = ?, model_id = ?, short_label = ? WHERE ticket_id = ?`
      ).run(deviceEdit.brand, deviceEdit.model, deviceEdit.brandId, deviceEdit.modelId, deviceEdit.label, ticketId)
    }

    if (accessoryIds) {
      db.prepare(`DELETE FROM TicketAccessories WHERE ticket_id = ?`).run(ticketId)
      const insert = db.prepare(`INSERT INTO TicketAccessories (ticket_id, accessory_id) VALUES (?, ?)`)
      for (const id of accessoryIds) insert.run(ticketId, id)
    }

    const costRequired = categoryChanged ? (category?.requires_parts_cost ? 1 : 0) : ticket.parts_cost_required ? 1 : 0
    let myShare = ticket.my_share ?? null
    let partnerShare = ticket.partner_share ?? null
    let splitApplied = ticket.split_percentage_applied ?? null
    const profitInputsChanged = changes.some((c) =>
      ['price', 'parts_cost', 'technician', 'repair_category'].includes(c.field)
    )
    if (delivered && profitInputsChanged) {
      const split = calculateProfitSplit({
        price,
        partsCost,
        requiresPartsCost: Boolean(costRequired),
        isPartner: Boolean(technician.is_partner),
        // the fallback when no percentage is frozen, and the source of the new one after a category change
        categorySplitPercentage: category?.default_split_percentage ?? 50.0,
        appliedSplitPercentage: categoryChanged ? null : splitApplied
      })
      myShare = split.myShare
      partnerShare = split.partnerShare
      splitApplied = split.isPartnerExclusive ? null : split.myPercentage
    }

    db.prepare(
      `UPDATE Ticket
       SET customer_id = ?, technician = ?, technician_id = ?, repair_category_id = ?, price = ?, amount_paid = ?,
           amount_remaining = ?, payment_type = ?, parts_cost = ?, parts_cost_required = ?, my_share = ?,
           partner_share = ?, split_percentage_applied = ?
       WHERE id = ?`
    ).run(
      customerId,
      technician.name,
      technician.id,
      category?.id ?? ticket.repair_category_id,
      price,
      amountPaid,
      amountRemaining,
      paymentType,
      partsCost,
      costRequired,
      myShare,
      partnerShare,
      splitApplied,
      ticketId
    )

    // A customer left without any ticket (typically one created by mistake) goes, as when a ticket is deleted.
    // Its name and phone stay readable in this ticket's edit history.
    if (customerId !== ticket.customer_id) {
      const left = db.prepare(`SELECT COUNT(*) AS count FROM Ticket WHERE customer_id = ?`).get(ticket.customer_id) as {
        count: number
      }
      if (left.count === 0) db.prepare(`DELETE FROM Customer WHERE id = ?`).run(ticket.customer_id)
    }

    // ---------------------------------------------------------------- 3. log
    insertEditLogs(db, ticketId, changes, new Date().toISOString())

    const details = getTicketById(db, ticketId)
    if (!details) throw new Error(`التذكرة رقم ${ticketId} غير موجودة في النظام.`)
    return { details, changedFields: changes.map((c) => c.field) }
  })
  return transaction()
}
