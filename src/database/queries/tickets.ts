import type Database from 'better-sqlite3'
import type { CreateTicketDTO, TicketListItem, UpdateTicketStatusDTO, TicketFullDetails, Ticket } from '../../shared/types'
import { findOrCreateCustomer } from './customers'
import { calculateRemaining, generateBarcodeCode } from '../helpers'
import { generateShortLabel } from '../../shared/device-utils'
import { calculateProfitSplit } from '../../shared/profit'
import { getOverdueThresholdDays } from './settings'

function validatePaymentAmounts(priceValue: unknown, amountPaidValue: unknown): { price: number; amountPaid: number } {
  const price = Number(priceValue)
  const amountPaid = Number(amountPaidValue)

  if (!Number.isFinite(price) || price < 0) {
    throw new Error('سعر الإصلاح يجب أن يكون رقماً صالحاً أكبر من أو يساوي صفر.')
  }
  if (!Number.isFinite(amountPaid) || amountPaid < 0) {
    throw new Error('المبلغ المدفوع يجب أن يكون رقماً صالحاً أكبر من أو يساوي صفر.')
  }
  if (amountPaid > price) {
    throw new Error('المبلغ المدفوع لا يمكن أن يتجاوز سعر الإصلاح الإجمالي.')
  }

  return { price, amountPaid }
}

export function createTicket(db: Database.Database, dto: CreateTicketDTO): { ticketId: number; barcode: string } {
  const transaction = db.transaction(() => {
    // 1. Validate financial values before any data is persisted.
    const { price, amountPaid } = validatePaymentAmounts(dto.ticket.price, dto.ticket.amount_paid)
    const amountRemaining = calculateRemaining(price, amountPaid)
    // A partial payment is a debt, whatever the form said (same rule as updateTicketStatus)
    const paymentType = amountRemaining > 0 ? 'credit' : dto.ticket.payment_type

    // 2. Resolve stable reference identities and preserve their current names as ticket snapshots.
    const technician = db
      .prepare(`SELECT id, name FROM Technician WHERE id = ?`)
      .get(dto.ticket.technician_id) as { id: number; name: string } | undefined
    if (!technician) {
      throw new Error('الفني المختار غير موجود. حدّث بيانات النموذج ثم أعد المحاولة.')
    }

    let brand = (dto.device.brand || '').trim()
    let model = (dto.device.model || '').trim()
    const brandId = dto.device.brand_id ?? null
    const modelId = dto.device.model_id ?? null

    if (brandId !== null) {
      const brandReference = db.prepare(`SELECT name FROM Brand WHERE id = ?`).get(brandId) as { name: string } | undefined
      if (!brandReference) throw new Error('الماركة المختارة غير موجودة. حدّث بيانات النموذج ثم أعد المحاولة.')
      brand = brandReference.name
    }
    if (modelId !== null) {
      const modelReference = db.prepare(`SELECT name, brand_id FROM Model WHERE id = ?`).get(modelId) as { name: string; brand_id: number } | undefined
      if (!modelReference) throw new Error('الموديل المختار غير موجود. حدّث بيانات النموذج ثم أعد المحاولة.')
      if (brandId === null || modelReference.brand_id !== brandId) {
        throw new Error('الموديل المختار لا يتبع الماركة المختارة.')
      }
      model = modelReference.name
    }
    if (!brand || !model) {
      throw new Error('الماركة والموديل مطلوبان لإنشاء التذكرة.')
    }

    // 3. Find or create customer only after all validation passes.
    const customerId = findOrCreateCustomer(db, dto.customer)

    // 4. Generate unique barcode code
    let barcode = generateBarcodeCode()
    // Verify uniqueness
    let exists = db.prepare(`SELECT id FROM Ticket WHERE barcode_code = ?`).get(barcode)
    while (exists) {
      barcode = generateBarcodeCode()
      exists = db.prepare(`SELECT id FROM Ticket WHERE barcode_code = ?`).get(barcode)
    }

    const createdAt = new Date().toISOString()
    const status = 'in_progress'

    // 5. Insert into Ticket table
    const insertTicket = db.prepare(`
      INSERT INTO Ticket (
        barcode_code,
        customer_id,
        created_at,
        technician,
        technician_id,
        repair_category_id,
        price,
        payment_type,
        amount_paid,
        amount_remaining,
        status,
        my_share,
        partner_share
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
    `)

    const ticketResult = insertTicket.run(
      barcode,
      customerId,
      createdAt,
      technician.name,
      technician.id,
      dto.ticket.repair_category_id,
      price,
      paymentType,
      amountPaid,
      amountRemaining,
      status
    )

    const ticketId = Number(ticketResult.lastInsertRowid)

    // 6. Compute short label and insert TicketDevice
    const shortLabel = (dto.device.short_label || '').trim() || generateShortLabel(brand, model)

    db.prepare(`
      INSERT INTO TicketDevice (ticket_id, brand, model, brand_id, model_id, short_label)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(ticketId, brand, model, brandId, modelId, shortLabel)

    // 7. Insert Accessories (if any)
    if (dto.accessory_ids && dto.accessory_ids.length > 0) {
      const insertAccessory = db.prepare(`
        INSERT INTO TicketAccessories (ticket_id, accessory_id)
        VALUES (?, ?)
      `)
      for (const accId of dto.accessory_ids) {
        insertAccessory.run(ticketId, accId)
      }
    }

    // 8. Insert Initial StatusLog
    db.prepare(`
      INSERT INTO StatusLog (ticket_id, old_status, new_status, timestamp)
      VALUES (?, ?, ?, ?)
    `).run(ticketId, null, status, createdAt)

    return { ticketId, barcode }
  })

  return transaction()
}

/**
 * Records a debt payment on an existing ticket (typically after delivery).
 * Only touches amount_paid / amount_remaining / payment_type: no status change, no profit
 * shares, no delivery date and no StatusLog entry. Fully paid tickets become 'cash'.
 */
export function recordPayment(db: Database.Database, ticketId: number, amount: number): Ticket {
  const transaction = db.transaction(() => {
    const ticket = db.prepare(`SELECT * FROM Ticket WHERE id = ?`).get(ticketId) as Ticket | undefined
    if (!ticket) throw new Error(`التذكرة رقم ${ticketId} غير موجودة في النظام.`)

    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('مبلغ الدفعة يجب أن يكون رقماً أكبر من صفر.')
    }
    const remaining = calculateRemaining(ticket.price, ticket.amount_paid)
    if (remaining <= 0) throw new Error('هذه التذكرة مسددة بالكامل، لا يوجد باقٍ.')
    if (value > remaining) {
      throw new Error('مبلغ الدفعة لا يمكن أن يتجاوز المبلغ المتبقي على التذكرة.')
    }

    const newPaid = ticket.amount_paid + value
    const newRemaining = calculateRemaining(ticket.price, newPaid)
    const newType = newRemaining === 0 ? 'cash' : 'credit'

    db.prepare(`UPDATE Ticket SET amount_paid = ?, amount_remaining = ?, payment_type = ? WHERE id = ?`).run(
      newPaid,
      newRemaining,
      newType,
      ticketId
    )
    return db.prepare(`SELECT * FROM Ticket WHERE id = ?`).get(ticketId) as Ticket
  })
  return transaction()
}

/**
 * Validates and updates a ticket's status.
 * Strictly enforces allowed transitions:
 *   - in_progress -> ready
 *   - ready -> delivered
 *   - ready -> in_progress (revert)
 *   - delivered -> ready (revert)
 * Updates financial fields if paymentUpdate is provided,
 * calculates and stores my_share and partner_share atomically when status becomes 'delivered',
 * and atomically logs the transition into StatusLog.
 */
export function updateTicketStatus(
  db: Database.Database,
  dto: UpdateTicketStatusDTO
): { success: boolean; ticket: Ticket } {
  const transaction = db.transaction(() => {
    const currentTicket = db.prepare(`
      SELECT t.*, tech.is_partner AS technician_is_partner
      FROM Ticket t
      JOIN Technician tech ON tech.id = t.technician_id
      WHERE t.id = ?
    `).get(dto.ticketId) as Ticket | undefined
    if (!currentTicket) {
      throw new Error(`التذكرة رقم ${dto.ticketId} غير موجودة في النظام.`)
    }

    const currentStatus = currentTicket.status
    const newStatus = dto.newStatus

    if (currentStatus === newStatus) {
      throw new Error(`التذكرة موجودة بالفعل في حالة "${newStatus}".`)
    }

    // Allowed transition map
    const ALLOWED_TRANSITIONS: Record<string, string[]> = {
      in_progress: ['ready'],
      ready: ['delivered', 'in_progress'],
      delivered: ['ready']
    }

    const allowed = ALLOWED_TRANSITIONS[currentStatus] || []
    if (!allowed.includes(newStatus)) {
      throw new Error(
        `الانتقال من حالة "${currentStatus}" إلى "${newStatus}" غير مسموح به. الانتقالات المسموحة: (قيد الإصلاح ← جاهز، جاهز ← تم التسليم، أو التراجع خطوة واحدة).`
      )
    }

    const timestamp = new Date().toISOString()

    // Financial updates handling
    let newAmountPaid = currentTicket.amount_paid
    let newPaymentType = currentTicket.payment_type

    if (dto.paymentUpdate) {
      if (dto.paymentUpdate.amount_paid !== undefined) {
        newAmountPaid = Number(dto.paymentUpdate.amount_paid)
      }
      if (dto.paymentUpdate.payment_type) {
        newPaymentType = dto.paymentUpdate.payment_type
      }
    }

    const { amountPaid: validatedAmountPaid } = validatePaymentAmounts(currentTicket.price, newAmountPaid)
    newAmountPaid = validatedAmountPaid
    const newAmountRemaining = calculateRemaining(currentTicket.price, newAmountPaid)

    // If remaining balance > 0 and no explicit payment_type was provided, ensure it is classified as credit (دين)
    if (newAmountRemaining > 0 && (!dto.paymentUpdate || !dto.paymentUpdate.payment_type)) {
      newPaymentType = 'credit'
    }

    // Calculate profit shares when transitioning to delivered
    let myShare: number | null = currentTicket.my_share ?? null
    let partnerShare: number | null = currentTicket.partner_share ?? null

    if (newStatus === 'delivered') {
      const category = db
        .prepare(`SELECT default_split_percentage FROM RepairCategory WHERE id = ?`)
        .get(currentTicket.repair_category_id) as { default_split_percentage: number } | undefined

      const splitResult = calculateProfitSplit({
        price: currentTicket.price,
        isPartner: Boolean(currentTicket.technician_is_partner),
        categorySplitPercentage: category?.default_split_percentage ?? 50.0
      })

      myShare = splitResult.myShare
      partnerShare = splitResult.partnerShare
    } else {
      // If reverted away from delivered, clear frozen shares
      myShare = null
      partnerShare = null
    }

    // 1. Update Ticket
    db.prepare(`
      UPDATE Ticket
      SET status = ?,
          amount_paid = ?,
          amount_remaining = ?,
          payment_type = ?,
          my_share = ?,
          partner_share = ?
      WHERE id = ?
    `).run(newStatus, newAmountPaid, newAmountRemaining, newPaymentType, myShare, partnerShare, dto.ticketId)

    // 2. Record in StatusLog
    db.prepare(`
      INSERT INTO StatusLog (ticket_id, old_status, new_status, timestamp)
      VALUES (?, ?, ?, ?)
    `).run(dto.ticketId, currentStatus, newStatus, timestamp)

    const updatedTicket = db.prepare(`
      SELECT t.*, tech.is_partner AS technician_is_partner
      FROM Ticket t
      JOIN Technician tech ON tech.id = t.technician_id
      WHERE t.id = ?
    `).get(dto.ticketId) as Ticket
    return { success: true, ticket: updatedTicket }
  })

  return transaction()
}

export function getTicketsList(
  db: Database.Database,
  searchQuery?: string,
  statusFilter?: string
): TicketListItem[] {
  let query = `
    SELECT 
      t.id,
      t.barcode_code,
      t.customer_id,
      c.name AS customer_name,
      c.phone AS customer_phone,
      td.brand,
      td.model,
      td.short_label,
      rc.name AS category_name,
      t.repair_category_id,
      t.price,
      t.payment_type,
      t.amount_paid,
      t.amount_remaining,
      t.status,
      t.technician,
      t.technician_id,
      tech.is_partner AS technician_is_partner,
      t.created_at,
      t.my_share,
      t.partner_share,
      (
        SELECT timestamp 
        FROM StatusLog 
        WHERE ticket_id = t.id AND new_status = 'ready' 
        ORDER BY id DESC 
        LIMIT 1
      ) AS ready_at
    FROM Ticket t
    JOIN Customer c ON t.customer_id = c.id
    JOIN Technician tech ON tech.id = t.technician_id
    LEFT JOIN TicketDevice td ON td.ticket_id = t.id
    LEFT JOIN RepairCategory rc ON rc.id = t.repair_category_id
    WHERE 1=1
  `

  const params: unknown[] = []

  if (statusFilter && statusFilter !== 'all') {
    query += ` AND t.status = ?`
    params.push(statusFilter)
  }

  if (searchQuery && searchQuery.trim()) {
    const term = `%${searchQuery.trim()}%`
    query += ` AND (c.name LIKE ? OR c.phone LIKE ? OR t.barcode_code LIKE ? OR td.model LIKE ?)`
    params.push(term, term, term, term)
  }

  query += ` ORDER BY t.id DESC`

  const rows = db.prepare(query).all(...params) as (TicketListItem & { ready_at?: string | null })[]
  const thresholdDays = getOverdueThresholdDays(db)
  const now = Date.now()

  return rows.map((row) => {
    let is_overdue = false
    let overdue_days = 0

    if (row.status === 'ready' && row.ready_at) {
      const readyTime = new Date(row.ready_at).getTime()
      if (!isNaN(readyTime)) {
        const diffMs = now - readyTime
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
        overdue_days = Math.max(0, diffDays)
        if (diffDays >= thresholdDays) {
          is_overdue = true
        }
      }
    }

    return {
      ...row,
      is_overdue,
      overdue_days
    }
  })
}

export function getTicketById(db: Database.Database, ticketId: number): TicketFullDetails | null {
  const ticket = db.prepare(`
    SELECT t.*, tech.is_partner AS technician_is_partner
    FROM Ticket t
    JOIN Technician tech ON tech.id = t.technician_id
    WHERE t.id = ?
  `).get(ticketId) as Ticket | undefined
  if (!ticket) return null

  const customer = db.prepare(`SELECT * FROM Customer WHERE id = ?`).get(ticket.customer_id) as import('../../shared/types').Customer | undefined
  const device = db.prepare(`SELECT * FROM TicketDevice WHERE ticket_id = ?`).get(ticket.id) as import('../../shared/types').TicketDevice | undefined
  // The UI dereferences customer.name / device.brand directly: fail with a clear message
  // (surfaced as { success:false, error } by the IPC layer) instead of handing it undefined.
  if (!customer || !device) {
    throw new Error('بيانات التذكرة ناقصة (الزبون/الجهاز)، لا يمكن عرضها.')
  }
  const category = (db.prepare(`SELECT * FROM RepairCategory WHERE id = ?`).get(ticket.repair_category_id) as import('../../shared/types').RepairCategory | undefined) || null

  const accessories = db.prepare(`
    SELECT a.id, a.name
    FROM Accessories a
    JOIN TicketAccessories ta ON ta.accessory_id = a.id
    WHERE ta.ticket_id = ?
  `).all(ticket.id) as import('../../shared/types').Accessories[]

  const statusLogs = db.prepare(`
    SELECT * FROM StatusLog
    WHERE ticket_id = ?
    ORDER BY id ASC
  `).all(ticket.id) as import('../../shared/types').StatusLog[]

  const readyLog = statusLogs.filter((l) => l.new_status === 'ready').slice(-1)[0]
  const ready_at = readyLog ? readyLog.timestamp : null
  let is_overdue = false
  let overdue_days = 0

  if (ticket.status === 'ready' && ready_at) {
    const diffDays = Math.floor((Date.now() - new Date(ready_at).getTime()) / (1000 * 60 * 60 * 24))
    const thresholdDays = getOverdueThresholdDays(db)
    overdue_days = Math.max(0, diffDays)
    if (diffDays >= thresholdDays) {
      is_overdue = true
    }
  }

  return {
    ticket,
    customer,
    device,
    category,
    accessories,
    statusLogs,
    ready_at,
    is_overdue,
    overdue_days
  }
}

export function getTicketByBarcode(db: Database.Database, barcode: string): TicketFullDetails | null {
  const cleanBarcode = barcode.trim()
  const ticket = db.prepare(`SELECT id FROM Ticket WHERE barcode_code = ?`).get(cleanBarcode) as { id: number } | undefined
  if (!ticket) return null

  return getTicketById(db, ticket.id)
}

/**
 * Deletes a single ticket atomically along with its associated records (Device, Accessories, StatusLog).
 * After deletion, if the associated Customer has no remaining tickets, the Customer record
 * is deleted automatically and silently (orphan cascade cleanup).
 */
export function deleteTicket(
  db: Database.Database,
  ticketId: number
): { success: boolean; customerDeleted: boolean } {
  const transaction = db.transaction(() => {
    const ticket = db.prepare(`SELECT customer_id FROM Ticket WHERE id = ?`).get(ticketId) as
      | { customer_id: number }
      | undefined

    if (!ticket) {
      throw new Error(`التذكرة رقم ${ticketId} غير موجودة في النظام.`)
    }

    const customerId = ticket.customer_id

    // 1. Delete dependent records
    db.prepare(`DELETE FROM TicketAccessories WHERE ticket_id = ?`).run(ticketId)
    db.prepare(`DELETE FROM TicketDevice WHERE ticket_id = ?`).run(ticketId)
    db.prepare(`DELETE FROM StatusLog WHERE ticket_id = ?`).run(ticketId)

    // 2. Delete the ticket itself
    db.prepare(`DELETE FROM Ticket WHERE id = ?`).run(ticketId)

    // 3. Check if customer has any remaining tickets
    const remainingCount = (
      db.prepare(`SELECT COUNT(*) AS count FROM Ticket WHERE customer_id = ?`).get(customerId) as {
        count: number
      }
    ).count

    let customerDeleted = false
    if (remainingCount === 0) {
      db.prepare(`DELETE FROM Customer WHERE id = ?`).run(customerId)
      customerDeleted = true
    }

    return { success: true, customerDeleted }
  })

  return transaction()
}

